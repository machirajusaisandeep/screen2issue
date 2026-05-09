import { AIError, type AICallOptions, type AICallResult } from './types'

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

export async function callClaude(options: AICallOptions): Promise<AICallResult> {
  const { settings, systemPrompt, userPrompt, imageBase64, imageMimeType = 'image/jpeg' } = options

  if (!settings.claudeKey) {
    throw new AIError('no_key', 'No Claude API key configured. Open Settings (gear icon) to add one.')
  }

  const model = settings.claudeModel ?? 'claude-haiku-4-5-20251001'

  const content: ContentPart[] = []

  if (imageBase64) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: imageMimeType, data: imageBase64 },
    })
  }
  content.push({ type: 'text', text: userPrompt })

  const body: Record<string, unknown> = {
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content }],
  }

  if (systemPrompt) {
    body.system = systemPrompt
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': settings.claudeKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let message = `Claude API error ${response.status}`
    try {
      const data = await response.json() as { error?: { message?: string } }
      if (data.error?.message) message = data.error.message
    } catch {}
    throw new AIError('api_error', message)
  }

  let data: { content?: { type: string; text?: string }[] }
  try {
    data = await response.json()
  } catch {
    throw new AIError('parse_error', 'Failed to parse Claude response.')
  }

  const text = data.content?.find((c) => c.type === 'text')?.text
  if (!text) throw new AIError('parse_error', 'Claude returned an empty response.')

  return { text }
}
