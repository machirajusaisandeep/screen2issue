import { loadImageElement } from '@/lib/image'
import { AIError, type AICallOptions, type AICallResult, type AISettings } from './types'
import { callGemini } from './gemini'
import { callClaude } from './claude'
import { callOpenAI } from './openai'
import { callDeepSeek } from './deepseek'
import { callOllama } from './ollama'

export { AIError } from './types'
export type { AISettings, AICallOptions, AICallResult } from './types'

const PROVIDER_LABELS: Record<AISettings['provider'], string> = {
  gemini: 'Gemini',
  claude: 'Claude',
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  ollama: 'Ollama',
}

export async function callAI(options: AICallOptions): Promise<AICallResult> {
  const { provider } = options.settings

  // Ollama needs no API key — just a running local server
  if (provider !== 'ollama') {
    const keyMap: Record<Exclude<AISettings['provider'], 'ollama'>, string> = {
      gemini: options.settings.geminiKey,
      claude: options.settings.claudeKey,
      openai: options.settings.openaiKey,
      deepseek: options.settings.deepseekKey,
    }
    if (!keyMap[provider]) {
      throw new AIError(
        'no_key',
        `No ${PROVIDER_LABELS[provider]} API key configured. Open Settings (gear icon) to add one.`,
      )
    }
  }

  switch (provider) {
    case 'gemini':   return callGemini(options)
    case 'claude':   return callClaude(options)
    case 'openai':   return callOpenAI(options)
    case 'deepseek': return callDeepSeek(options)
    case 'ollama':   return callOllama(options)
  }
}

export function imageUrlToBase64(imageUrl: string): string {
  const idx = imageUrl.indexOf(',')
  return idx >= 0 ? imageUrl.slice(idx + 1) : imageUrl
}

export async function resizeImageForAI(
  imageUrl: string,
  maxDimension = 1280,
): Promise<string> {
  const img = await loadImageElement(imageUrl)
  const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height))
  const w = Math.round((img.naturalWidth || img.width) * scale)
  const h = Math.round((img.naturalHeight || img.height) * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable.')
  ctx.drawImage(img, 0, 0, w, h)

  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
}
