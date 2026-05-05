import { nanoid } from 'nanoid'
import type { ExtractedFrame } from '@/types/report'
import { compareFrames } from './compareFrames'

// Configurable constants — adjust to taste
const FRAME_INTERVAL_SECONDS = 1
const DIFFERENCE_THRESHOLD = 0.08
const MAX_FRAMES = 30
// Thumbnail size for perceptual comparison (smaller = faster)
const COMPARE_WIDTH = 160
const COMPARE_HEIGHT = 90

export type ProgressCallback = (
  step: 'loading' | 'extracting' | 'comparing' | 'timeline',
  percent: number,
) => void

/**
 * Extracts key frames from a video File using browser-native HTMLVideoElement + Canvas APIs.
 * No server upload, no FFmpeg — everything stays on the user's device.
 *
 * Algorithm:
 *  1. Create an object URL and load into a hidden <video> element.
 *  2. Seek at FRAME_INTERVAL_SECONDS increments.
 *  3. Draw each frame to a canvas; extract a small comparison thumbnail.
 *  4. Keep frames where pixel-diff vs previous exceeds DIFFERENCE_THRESHOLD.
 *  5. Always keep first and last frames; cap total at MAX_FRAMES.
 *  6. Revoke the object URL when done to free memory.
 */
export async function extractFrames(
  file: File,
  onProgress?: ProgressCallback,
): Promise<ExtractedFrame[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    const objectUrl = URL.createObjectURL(file)
    video.src = objectUrl

    const fullCanvas = document.createElement('canvas')
    const fullCtx = fullCanvas.getContext('2d')!
    const thumbCanvas = document.createElement('canvas')
    thumbCanvas.width = COMPARE_WIDTH
    thumbCanvas.height = COMPARE_HEIGHT
    const thumbCtx = thumbCanvas.getContext('2d')!

    video.addEventListener('error', () => {
      URL.revokeObjectURL(objectUrl)
      reject(
        new Error(
          'This browser could not decode the video. Try .mp4 (H.264) or .webm. ' +
            '.mov files are only supported in Safari and Chrome.',
        ),
      )
    })

    video.addEventListener('loadedmetadata', async () => {
      onProgress?.('loading', 100)

      const duration = video.duration
      if (!isFinite(duration) || duration === 0) {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Could not determine video duration.'))
        return
      }

      fullCanvas.width = video.videoWidth
      fullCanvas.height = video.videoHeight

      const seekTimes: number[] = []
      for (let t = 0; t <= duration; t += FRAME_INTERVAL_SECONDS) {
        seekTimes.push(Math.min(t, duration))
      }
      // Always include the very last frame
      if (seekTimes[seekTimes.length - 1] < duration) {
        seekTimes.push(duration)
      }

      const allFrames: ExtractedFrame[] = []
      let prevThumbData: ImageData | null = null

      for (let i = 0; i < seekTimes.length; i++) {
        const t = seekTimes[i]

        // Seek to timestamp and wait for the browser to render the frame
        await seekTo(video, t)

        // Draw full-resolution frame for the exported thumbnail
        fullCtx.drawImage(video, 0, 0, fullCanvas.width, fullCanvas.height)
        // Draw small thumbnail for comparison
        thumbCtx.drawImage(video, 0, 0, COMPARE_WIDTH, COMPARE_HEIGHT)

        const thumbData = thumbCtx.getImageData(0, 0, COMPARE_WIDTH, COMPARE_HEIGHT)
        const diff = prevThumbData ? compareFrames(prevThumbData, thumbData) : 1

        const isFirst = i === 0
        const isLast = i === seekTimes.length - 1
        const isSignificant = diff >= DIFFERENCE_THRESHOLD

        if (isFirst || isLast || isSignificant) {
          const imageUrl = fullCanvas.toDataURL('image/jpeg', 0.8)
          allFrames.push({
            id: nanoid(),
            timestampMs: Math.round(t * 1000),
            imageUrl,
            differenceScore: Math.round(diff * 100) / 100,
            included: true,
          })
          prevThumbData = thumbData
        }

        onProgress?.('extracting', Math.round(((i + 1) / seekTimes.length) * 100))
      }

      onProgress?.('comparing', 100)

      // Cap to MAX_FRAMES, always preserving first and last
      const capped = capFrames(allFrames, MAX_FRAMES)

      onProgress?.('timeline', 100)
      URL.revokeObjectURL(objectUrl)
      resolve(capped)
    })
  })
}

/** Seeks the video to a specific time and resolves when the frame is ready. */
function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })
}

/**
 * Reduces frames array to at most maxFrames entries.
 * Always keeps the first and last; evenly samples the middle ones.
 */
function capFrames(frames: ExtractedFrame[], maxFrames: number): ExtractedFrame[] {
  if (frames.length <= maxFrames) return frames
  const first = frames[0]
  const last = frames[frames.length - 1]
  const middle = frames.slice(1, -1)
  const targetMiddle = maxFrames - 2
  const step = middle.length / targetMiddle
  const sampled = Array.from({ length: targetMiddle }, (_, i) =>
    middle[Math.round(i * step)],
  )
  return [first, ...sampled, last]
}
