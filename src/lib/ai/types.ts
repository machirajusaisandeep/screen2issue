export type AIProvider = 'gemini' | 'claude' | 'openai' | 'deepseek' | 'ollama'

export type GeminiModel =
  | 'gemini-2.0-flash'
  | 'gemini-1.5-flash'
  | 'gemini-1.5-flash-8b'
  | 'gemini-1.5-pro'

export const GEMINI_MODELS: { id: GeminiModel; label: string }[] = [
  { id: 'gemini-2.0-flash',    label: '2.0 Flash (latest)' },
  { id: 'gemini-1.5-flash',    label: '1.5 Flash (free tier)' },
  { id: 'gemini-1.5-flash-8b', label: '1.5 Flash 8B (smallest)' },
  { id: 'gemini-1.5-pro',      label: '1.5 Pro' },
]

export type AISettings = {
  provider: AIProvider
  geminiKey: string
  geminiModel: GeminiModel
  claudeKey: string
  openaiKey: string
  deepseekKey: string
  ollamaBaseUrl: string
  ollamaModel: string
}

export type AICallOptions = {
  settings: AISettings
  systemPrompt?: string
  userPrompt: string
  imageBase64?: string
  imageMimeType?: string
}

export type AICallResult = {
  text: string
}

export class AIError extends Error {
  kind: 'no_key' | 'api_error' | 'parse_error'

  constructor(kind: AIError['kind'], message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AIError'
    this.kind = kind
  }
}
