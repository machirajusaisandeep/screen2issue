/**
 * Computes a perceptual difference score between two canvas ImageData buffers.
 * Returns a value between 0 (identical) and 1 (completely different).
 *
 * Both inputs must have the same dimensions (width × height).
 * We average the absolute per-channel RGB difference across all pixels.
 * Alpha channel is ignored since screen recordings are always opaque.
 */
export function compareFrames(a: ImageData, b: ImageData): number {
  const data1 = a.data
  const data2 = b.data
  const pixelCount = a.width * a.height

  let totalDiff = 0
  for (let i = 0; i < data1.length; i += 4) {
    // Sum absolute difference across R, G, B channels (skip alpha at i+3)
    totalDiff +=
      Math.abs(data1[i] - data2[i]) +
      Math.abs(data1[i + 1] - data2[i + 1]) +
      Math.abs(data1[i + 2] - data2[i + 2])
  }

  // Average over 3 channels × pixelCount, normalized to [0, 1]
  return totalDiff / (3 * pixelCount * 255)
}
