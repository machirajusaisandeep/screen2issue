import { nanoid } from 'nanoid'
import { imageUrlToImageData } from '@/lib/image'
import type { CursorEvent, ExtractedFrame } from '@/types/report'

const ANALYSIS_WIDTH = 200
const ANALYSIS_HEIGHT = 112
const PIXEL_DELTA_THRESHOLD = 54
const MIN_CHANGED_RATIO = 0.0004
const MAX_CHANGED_RATIO = 0.08

export type CursorDetectionProgress = {
  current: number
  total: number
  percent: number
}

export async function detectCursorEvents(
  frames: ExtractedFrame[],
  onProgress?: (progress: CursorDetectionProgress) => void,
  signal?: AbortSignal,
): Promise<CursorEvent[]> {
  signal?.throwIfAborted()
  if (frames.length < 2) return []

  const events: CursorEvent[] = []
  let previousImage = await imageUrlToImageData(
    frames[0].imageUrl,
    ANALYSIS_WIDTH,
    ANALYSIS_HEIGHT,
  )

  for (let index = 1; index < frames.length; index += 1) {
    signal?.throwIfAborted()
    const currentImage = await imageUrlToImageData(
      frames[index].imageUrl,
      ANALYSIS_WIDTH,
      ANALYSIS_HEIGHT,
    )

    const event = analyzeFramePair(frames[index], previousImage, currentImage)
    if (event) {
      events.push(event)
    }

    previousImage = currentImage
    onProgress?.({
      current: index,
      total: frames.length - 1,
      percent: Math.round((index / (frames.length - 1)) * 100),
    })
  }

  return events
}

function analyzeFramePair(
  frame: ExtractedFrame,
  previous: ImageData,
  current: ImageData,
): CursorEvent | null {
  const pixelCount = current.width * current.height
  let changedPixels = 0
  let minX = current.width
  let minY = current.height
  let maxX = 0
  let maxY = 0
  let sumX = 0
  let sumY = 0

  for (let i = 0; i < current.data.length; i += 4) {
    const delta =
      Math.abs(current.data[i] - previous.data[i]) +
      Math.abs(current.data[i + 1] - previous.data[i + 1]) +
      Math.abs(current.data[i + 2] - previous.data[i + 2])

    if (delta < PIXEL_DELTA_THRESHOLD) continue

    const pixelIndex = i / 4
    const x = pixelIndex % current.width
    const y = Math.floor(pixelIndex / current.width)

    changedPixels += 1
    sumX += x
    sumY += y
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  if (changedPixels === 0) return null

  const changedRatio = changedPixels / pixelCount
  if (changedRatio < MIN_CHANGED_RATIO || changedRatio > MAX_CHANGED_RATIO) {
    return null
  }

  const boxWidthRatio = (maxX - minX + 1) / current.width
  const boxHeightRatio = (maxY - minY + 1) / current.height
  if (boxWidthRatio > 0.22 || boxHeightRatio > 0.22) {
    return null
  }

  const areaPixels = (maxX - minX + 1) * (maxY - minY + 1)
  const compactness = changedPixels / Math.max(areaPixels, 1)
  const isPossibleClick =
    changedRatio > 0.003 && boxWidthRatio > 0.045 && boxHeightRatio > 0.045 && compactness < 0.72

  const confidence = clamp(
    0.42 +
      Math.min(0.28, compactness * 0.3) +
      Math.min(0.18, boxWidthRatio * 0.9) +
      Math.min(0.16, boxHeightRatio * 0.9) -
      Math.max(0, changedRatio - 0.02) * 3,
    0.35,
    0.96,
  )

  return {
    id: nanoid(),
    timestampMs: frame.timestampMs,
    type: isPossibleClick ? 'possible_click' : 'possible_cursor_move',
    x: round(((sumX / changedPixels) / current.width) * 100, 1),
    y: round(((sumY / changedPixels) / current.height) * 100, 1),
    confidence,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number, precision: number): number {
  const scale = 10 ** precision
  return Math.round(value * scale) / scale
}
