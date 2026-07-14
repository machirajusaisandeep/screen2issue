import { AIError, type AICallOptions, type AICallResult } from './types'

const MODEL = 'deepseek-chat'

export async function callDeepSeek(options: AICallOptions): Promise<AICallResult> {
  const { settings, systemPrompt, userPrompt } = options

  if (!settings.deepseekKey) {
    throw new AIError('no_key', 'No DeepSeek API key configured. Open Settings (gear icon) to add one.')
  }

  const messages: { role: string; content: string }[] = []

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  // DeepSeek's public API is text-only — image data is dropped
  messages.push({ role: 'user', content: userPrompt })

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.deepseekKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 1024 }),
  })

  if (!response.ok) {
    let message = `DeepSeek API error ${response.status}`
    try {
      const data = await response.json() as { error?: { message?: string } }
      if (data.error?.message) message = data.error.message
    } catch {
      // Keep the status-based fallback when the provider returns a non-JSON error.
    }
    throw new AIError('api_error', message)
  }

  let data: { choices?: { message?: { content?: string } }[] }
  try {
    data = await response.json()
  } catch {
    throw new AIError('parse_error', 'Failed to parse DeepSeek response.')
  }

  const text = data.choices?.[0]?.message?.content
  if (!text) throw new AIError('parse_error', 'DeepSeek returned an empty response.')

  return { text }
}
