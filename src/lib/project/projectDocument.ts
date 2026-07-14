import type { AppStep, BugReport, ExtractedFrame } from '@/types/report'

export const PROJECT_SCHEMA_VERSION = 1 as const

export type SerializedFrameV1 = Omit<ExtractedFrame, 'imageUrl'> & {
  assetKey: string
}

export type ProjectDocumentV1 = {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION
  projectId: string
  createdAt: string
  updatedAt: string
  currentStep: Exclude<AppStep, 'processing'>
  source: {
    name: string
    type: string
    sizeBytes: number
    durationMs: number
    originalRecordingPersisted: false
  }
  report: Omit<BugReport, 'frames'> & {
    frames: SerializedFrameV1[]
  }
}

export type RestoredProject = {
  document: ProjectDocumentV1
  report: BugReport
}

export function isProjectDocumentV1(value: unknown): value is ProjectDocumentV1 {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ProjectDocumentV1>
  return (
    candidate.schemaVersion === PROJECT_SCHEMA_VERSION &&
    typeof candidate.projectId === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    !!candidate.report &&
    Array.isArray(candidate.report.frames)
  )
}
