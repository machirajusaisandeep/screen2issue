import { encode } from 'gpt-tokenizer'

/**
 * Count text tokens using cl100k_base (GPT-4 / Claude approximation).
 * Accurate to within ~5% for English; falls back to length/4 on error.
 */
export function countTextTokens(text: string): number {
  if (!text.trim()) return 0
  try {
    return encode(text).length
  } catch {
    return Math.ceil(text.length / 4)
  }
}

/**
 * Estimate image tokens for a given resolution.
 *
 * Claude: resizes to fit 1568px longest edge, then width*height/750.
 * Other providers (OpenAI, Gemini, DeepSeek) use Claude's formula as an
 * approximation — within ~20% for typical screen recording resolutions.
 */
export function countImageTokens(width: number, height: number): number {
  const MAX_EDGE = 1568
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  const w = Math.floor(width * scale)
  const h = Math.floor(height * scale)
  return Math.ceil((w * h) / 750)
}

export function formatTokenCount(n: number): string {
  if (n >= 10_000) return `~${Math.round(n / 1000)}k`
  if (n >= 1_000)  return `~${(n / 1000).toFixed(1)}k`
  return `~${n}`
}
