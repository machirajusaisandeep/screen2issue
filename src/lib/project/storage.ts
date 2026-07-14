import { nanoid } from 'nanoid'
import type { AppStep, BugReport } from '@/types/report'
import {
  PROJECT_SCHEMA_VERSION,
  isProjectDocumentV1,
  type ProjectDocumentV1,
  type RestoredProject,
  type SerializedFrameV1,
} from './projectDocument'

const DB_NAME = 'screen2issue-projects'
const DB_VERSION = 1
const PROJECT_STORE = 'projects'
const ASSET_STORE = 'assets'
const ACTIVE_PROJECT_KEY = 'active'

export class ProjectStorageError extends Error {
  kind: 'unavailable' | 'quota' | 'corrupt'

  constructor(kind: ProjectStorageError['kind'], message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ProjectStorageError'
    this.kind = kind
  }
}

export type DraftSummary = {
  projectId: string
  title: string
  videoName: string
  updatedAt: string
  frameCount: number
  currentStep: ProjectDocumentV1['currentStep']
}

export async function saveProjectDraft(
  report: BugReport,
  currentStep: AppStep,
  existingProjectId?: string,
): Promise<ProjectDocumentV1> {
  if (currentStep === 'processing') {
    throw new ProjectStorageError('corrupt', 'Processing state cannot be persisted as a draft.')
  }

  const db = await openDatabase()
  const projectId = existingProjectId ?? nanoid()
  const now = new Date().toISOString()
  const previous = await getRecord<ProjectDocumentV1>(db, PROJECT_STORE, ACTIVE_PROJECT_KEY)
  const serializedFrames: SerializedFrameV1[] = []
  const assets: { key: string; blob: Blob }[] = []

  for (const frame of report.frames) {
    const assetKey = `${projectId}:${frame.id}`
    serializedFrames.push({ ...frame, imageUrl: undefined, assetKey } as unknown as SerializedFrameV1)
    const response = await fetch(frame.imageUrl)
    assets.push({ key: assetKey, blob: await response.blob() })
  }

  const document: ProjectDocumentV1 = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId,
    createdAt: previous?.projectId === projectId ? previous.createdAt : now,
    updatedAt: now,
    currentStep,
    source: {
      name: report.videoName,
      type: report.videoType,
      sizeBytes: report.videoSizeBytes,
      durationMs: report.videoDurationMs,
      originalRecordingPersisted: false,
    },
    report: { ...report, frames: serializedFrames },
  }

  try {
    await writeDocument(db, document, assets)
    return document
  } catch (error) {
    if (isQuotaError(error)) {
      throw new ProjectStorageError(
        'quota',
        'This browser does not have enough storage for the derived frames. Export the report or clear the current draft.',
        { cause: error },
      )
    }
    throw error
  } finally {
    db.close()
  }
}

export async function loadProjectDraft(): Promise<RestoredProject | null> {
  const db = await openDatabase()
  try {
    const value = await getRecord<unknown>(db, PROJECT_STORE, ACTIVE_PROJECT_KEY)
    if (value == null) return null
    if (!isProjectDocumentV1(value)) {
      throw new ProjectStorageError('corrupt', 'The saved project uses an unsupported or damaged format.')
    }

    const frames = await Promise.all(
      value.report.frames.map(async (frame) => {
        const blob = await getRecord<Blob>(db, ASSET_STORE, frame.assetKey)
        if (!blob) {
          throw new ProjectStorageError('corrupt', `The saved image for frame ${frame.id} is missing.`)
        }
        const { assetKey: _assetKey, ...metadata } = frame
        void _assetKey
        return { ...metadata, imageUrl: URL.createObjectURL(blob) }
      }),
    )

    return {
      document: value,
      report: { ...value.report, frames },
    }
  } finally {
    db.close()
  }
}

export async function getDraftSummary(): Promise<DraftSummary | null> {
  const db = await openDatabase()
  try {
    const value = await getRecord<unknown>(db, PROJECT_STORE, ACTIVE_PROJECT_KEY)
    if (value == null) return null
    if (!isProjectDocumentV1(value)) {
      throw new ProjectStorageError('corrupt', 'The saved project uses an unsupported or damaged format.')
    }
    return {
      projectId: value.projectId,
      title: value.report.title,
      videoName: value.report.videoName,
      updatedAt: value.updatedAt,
      frameCount: value.report.frames.length,
      currentStep: value.currentStep,
    }
  } finally {
    db.close()
  }
}

export async function clearProjectDraft(): Promise<void> {
  const db = await openDatabase()
  try {
    const tx = db.transaction([PROJECT_STORE, ASSET_STORE], 'readwrite')
    tx.objectStore(PROJECT_STORE).delete(ACTIVE_PROJECT_KEY)
    tx.objectStore(ASSET_STORE).clear()
    await transactionDone(tx)
  } finally {
    db.close()
  }
}

export async function estimateProjectStorage(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null
  const estimate = await navigator.storage.estimate()
  return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 }
}

function openDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in globalThis)) {
    return Promise.reject(new ProjectStorageError('unavailable', 'IndexedDB is unavailable in this browser.'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PROJECT_STORE)) db.createObjectStore(PROJECT_STORE)
      if (!db.objectStoreNames.contains(ASSET_STORE)) db.createObjectStore(ASSET_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function writeDocument(
  db: IDBDatabase,
  document: ProjectDocumentV1,
  assets: { key: string; blob: Blob }[],
): Promise<void> {
  const tx = db.transaction([PROJECT_STORE, ASSET_STORE], 'readwrite')
  const assetStore = tx.objectStore(ASSET_STORE)
  assetStore.clear()
  for (const asset of assets) assetStore.put(asset.blob, asset.key)
  tx.objectStore(PROJECT_STORE).put(document, ACTIVE_PROJECT_KEY)
  await transactionDone(tx)
}

function getRecord<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readonly').objectStore(store).get(key)
    request.onsuccess = () => resolve(request.result as T | undefined)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)
}
