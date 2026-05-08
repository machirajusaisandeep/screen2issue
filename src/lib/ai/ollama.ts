import { AIError, type AICallOptions, type AICallResult } from './types'

type OllamaContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export async function callOllama(options: AICallOptions): Promise<AICallResult> {
  const { settings, systemPrompt, userPrompt, imageBase64, imageMimeType = 'image/jpeg' } = options

  const baseUrl = (settings.ollamaBaseUrl || 'http://localhost:11434').replace(/\/$/, '')
  const model = settings.ollamaModel?.trim() || 'llava'

  const content: OllamaContentPart[] = []

  if (imageBase64) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${imageMimeType};base64,${imageBase64}` },
    })
  }
  content.push({ type: 'text', text: userPrompt })

  const messages: { role: string; content: OllamaContentPart[] | string }[] = []
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  messages.push({ role: 'user', content })

  let response: Response
  try {
    response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    })
  } catch {
    throw new AIError(
      'api_error',
      `Could not reach Ollama at ${baseUrl}. Make sure Ollama is running and OLLAMA_ORIGINS is set if using a hosted app.`,
    )
  }

  if (!response.ok) {
    let message = `Ollama error ${response.status}`
    try {
      const data = await response.json() as { error?: string }
      if (data.error) message = data.error
    } catch {}
    throw new AIError('api_error', message)
  }

  let data: { choices?: { message?: { content?: string } }[] }
  try {
    data = await response.json()
  } catch {
    throw new AIError('parse_error', 'Failed to parse Ollama response.')
  }

  const text = data.choices?.[0]?.message?.content
  if (!text) throw new AIError('parse_error', 'Ollama returned an empty response.')

  return { text }
}
