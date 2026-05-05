import { imageUrlToBlob } from '@/lib/image'
import type { ExtractedFrame } from '@/types/report'
import type {
  EnhancementResult,
  LocalEngineHealth,
  TranscriptionResult,
} from '@/lib/localEngine/types'

const LOCAL_ENGINE_BASE_URL = 'http://127.0.0.1:8765'

type EnhanceFrameManifest = {
  frameId: string
  timestampMs: number
  included: boolean
}

type TranscriptionManifest = {
  videoName: string
  videoType: string
  videoSizeBytes: number
  videoDurationMs?: number
}

export class LocalEngineRequestError extends Error {
  kind: 'invalid_response' | 'not_connected' | 'request_failed'

  constructor(
    kind: 'invalid_response' | 'not_connected' | 'request_failed',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.kind = kind
  }
}

export async function checkHealth(): Promise<LocalEngineHealth> {
  return requestJson<LocalEngineHealth>('/health')
}

export async function enhanceFrames(frames: ExtractedFrame[]): Promise<EnhancementResult> {
  const form = new FormData()
  const manifest: EnhanceFrameManifest[] = frames.map((frame) => ({
    frameId: frame.id,
    timestampMs: frame.timestampMs,
    included: frame.included,
  }))

  form.append(
    'manifest',
    new Blob([JSON.stringify({ frames: manifest })], { type: 'application/json' }),
    'manifest.json',
  )

  for (const frame of frames) {
    const blob = await imageUrlToBlob(frame.imageUrl, 'image/png')
    form.append('frames', blob, `${frame.id}.png`)
  }

  return requestJson<EnhancementResult>('/enhance-frames', {
    method: 'POST',
    body: form,
  })
}

export async function transcribeVideo(
  file: File,
  manifest?: TranscriptionManifest,
): Promise<TranscriptionResult> {
  const form = new FormData()
  form.append('video', file, file.name)

  if (manifest) {
    form.append(
      'manifest',
      new Blob([JSON.stringify(manifest)], { type: 'application/json' }),
      'manifest.json',
    )
  }

  return requestJson<TranscriptionResult>('/transcribe-video', {
    method: 'POST',
    body: form,
  })
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${LOCAL_ENGINE_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init?.headers,
      },
    })
  } catch (error) {
    throw new LocalEngineRequestError(
      'not_connected',
      'Could not reach the local engine at http://127.0.0.1:8765.',
      { cause: error },
    )
  }

  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')

  if (!response.ok) {
    const errorMessage = isJson
      ? await readJsonMessage(response)
      : `Local engine request failed with ${response.status}.`

    throw new LocalEngineRequestError('request_failed', errorMessage)
  }

  if (!isJson) {
    throw new LocalEngineRequestError(
      'invalid_response',
      'Local engine returned a non-JSON response.',
    )
  }

  return response.json() as Promise<T>
}

async function readJsonMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { detail?: string; error?: string }
    return payload.detail ?? payload.error ?? `Local engine request failed with ${response.status}.`
  } catch {
    return `Local engine request failed with ${response.status}.`
  }
}
