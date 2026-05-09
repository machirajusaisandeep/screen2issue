import { AIError, type AICallOptions, type AICallResult } from './types'

export async function callGemini(options: AICallOptions): Promise<AICallResult> {
  const { settings, systemPrompt, userPrompt, imageBase64, imageMimeType = 'image/jpeg' } = options
  const model = settings.geminiModel ?? 'gemini-1.5-flash'

  if (!settings.geminiKey) {
    throw new AIError('no_key', 'No Gemini API key configured. Open Settings (gear icon) to add one.')
  }

  const parts: unknown[] = []

  if (imageBase64) {
    parts.push({ inlineData: { mimeType: imageMimeType, data: imageBase64 } })
  }
  parts.push({ text: userPrompt })

  const body: Record<string, unknown> = {
    contents: [{ parts }],
  }

  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] }
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': settings.geminiKey,
      },
      body: JSON.stringify(body),
    },
  )

  if (!response.ok) {
    let message = `Gemini API error ${response.status}`
    try {
      const data = await response.json() as { error?: { message?: string; status?: string } }
      if (data.error?.message) {
        // Quota errors are verbose — extract just the key fact
        if (data.error.status === 'RESOURCE_EXHAUSTED' || data.error.message.includes('Quota exceeded')) {
          message = 'Gemini quota exceeded. Enable billing at ai.dev or switch to Claude/OpenAI in Settings.'
        } else {
          message = data.error.message
        }
      }
    } catch {}
    throw new AIError('api_error', message)
  }

  let data: { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  try {
    data = await response.json()
  } catch {
    throw new AIError('parse_error', 'Failed to parse Gemini response.')
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new AIError('parse_error', 'Gemini returned an empty response.')

  return { text }
}
