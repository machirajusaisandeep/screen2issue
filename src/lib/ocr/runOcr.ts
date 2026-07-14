import type { ExtractedFrame } from '@/types/report'
import { formatTimestamp } from '@/lib/video/formatTimestamp'

type WorkerOptions = {
  corePath: string
  langPath: string
  workerPath: string
  gzip: boolean
  logger?: (message: { progress: number; status: string }) => void
}

type OcrWorker = {
  setParameters: (params: Record<string, string>) => Promise<unknown>
  recognize: (image: string) => Promise<{ data: { text: string; confidence?: number } }>
  terminate: () => Promise<unknown>
}

type CreateWorker = (
  langs?: string,
  oem?: number,
  options?: Partial<WorkerOptions>,
) => Promise<OcrWorker>

type TesseractModule = {
  createWorker?: CreateWorker
  default?: {
    createWorker?: CreateWorker
  }
}

export type OcrProgress = {
  completed: number
  total: number
  percent: number
  status: string
  currentTimestamp?: string
}

export async function runOcr(
  frames: ExtractedFrame[],
  onProgress?: (progress: OcrProgress) => void,
  signal?: AbortSignal,
): Promise<ExtractedFrame[]> {
  signal?.throwIfAborted()
  const includedFrames = frames.filter((frame) => frame.included)
  if (includedFrames.length === 0) return frames

  const createWorker = await loadCreateWorker()
  let currentIndex = 0

  const worker = await createWorker('eng', 1, {
    workerPath: resolvePublicAsset('tesseract/worker.min.js'),
    corePath: resolvePublicAsset('tesseract/core'),
    langPath: resolvePublicAsset('tesseract/lang'),
    gzip: true,
    logger: (message) => {
      const frame = includedFrames[currentIndex]
      onProgress?.({
        completed: currentIndex,
        total: includedFrames.length,
        percent: Math.round(((currentIndex + message.progress) / includedFrames.length) * 100),
        status: message.status,
        currentTimestamp: frame ? formatTimestamp(frame.timestampMs) : undefined,
      })
    },
  } satisfies WorkerOptions)

  try {
    await worker.setParameters({
      preserve_interword_spaces: '1',
      user_defined_dpi: '150',
    })

    const ocrById = new Map<string, Pick<ExtractedFrame, 'ocrText' | 'ocrConfidence'>>()

    for (currentIndex = 0; currentIndex < includedFrames.length; currentIndex += 1) {
      signal?.throwIfAborted()
      const frame = includedFrames[currentIndex]
      onProgress?.({
        completed: currentIndex,
        total: includedFrames.length,
        percent: Math.round((currentIndex / includedFrames.length) * 100),
        status: 'recognizing text',
        currentTimestamp: formatTimestamp(frame.timestampMs),
      })

      const result = await worker.recognize(frame.imageUrl)
      signal?.throwIfAborted()
      const text = result.data.text.trim()

      ocrById.set(frame.id, {
        ocrText: text || undefined,
        ocrConfidence:
          typeof result.data.confidence === 'number'
            ? Math.round(result.data.confidence * 10) / 10
            : undefined,
      })
    }

    onProgress?.({
      completed: includedFrames.length,
      total: includedFrames.length,
      percent: 100,
      status: 'done',
    })

    return frames.map((frame) => {
      const ocrResult = ocrById.get(frame.id)
      return ocrResult ? { ...frame, ...ocrResult } : frame
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OCR failed unexpectedly.'
    throw new Error(`OCR failed: ${message}`, { cause: error })
  } finally {
    await worker.terminate()
  }
}

async function loadCreateWorker(): Promise<CreateWorker> {
  const module = (await import('tesseract.js')) as unknown as TesseractModule
  const createWorker = module.createWorker ?? module.default?.createWorker

  if (!createWorker) {
    throw new Error('Tesseract could not be initialized in this browser build.')
  }

  return createWorker
}

function resolvePublicAsset(relativePath: string): string {
  const normalized = relativePath.replace(/^\/+/, '')
  return new URL(`${import.meta.env.BASE_URL}${normalized}`, window.location.origin).toString()
}
