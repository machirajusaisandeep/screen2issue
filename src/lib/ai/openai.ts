import { AIError, type AICallOptions, type AICallResult } from './types'

const MODEL = 'gpt-4o'

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export async function callOpenAI(options: AICallOptions): Promise<AICallResult> {
  const { settings, systemPrompt, userPrompt, imageBase64, imageMimeType = 'image/jpeg' } = options

  if (!settings.openaiKey) {
    throw new AIError('no_key', 'No OpenAI API key configured. Open Settings (gear icon) to add one.')
  }

  const userContent: ContentPart[] = []

  if (imageBase64) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${imageMimeType};base64,${imageBase64}` },
    })
  }
  userContent.push({ type: 'text', text: userPrompt })

  const messages: { role: string; content: string | ContentPart[] }[] = []

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  messages.push({ role: 'user', content: userContent })

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 1024 }),
  })

  if (!response.ok) {
    let message = `OpenAI API error ${response.status}`
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
    throw new AIError('parse_error', 'Failed to parse OpenAI response.')
  }

  const text = data.choices?.[0]?.message?.content
  if (!text) throw new AIError('parse_error', 'OpenAI returned an empty response.')

  return { text }
}
