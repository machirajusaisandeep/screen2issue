import { useState } from 'react'
import type { AISettings, ClaudeModel, GeminiModel } from '@/lib/ai/types'

const KEYS = {
  provider:      'ai_provider',
  geminiKey:     'ai_gemini_key',
  geminiModel:   'ai_gemini_model',
  claudeKey:     'ai_claude_key',
  claudeModel:   'ai_claude_model',
  openaiKey:     'ai_openai_key',
  deepseekKey:   'ai_deepseek_key',
  ollamaBaseUrl: 'ai_ollama_base_url',
  ollamaModel:   'ai_ollama_model',
} as const

function loadSettings(): AISettings {
  return {
    provider:      (localStorage.getItem(KEYS.provider) as AISettings['provider']) || 'gemini',
    geminiKey:     localStorage.getItem(KEYS.geminiKey) ?? '',
    geminiModel:   (localStorage.getItem(KEYS.geminiModel) as GeminiModel) || 'gemini-1.5-flash',
    claudeKey:     localStorage.getItem(KEYS.claudeKey) ?? '',
    claudeModel:   (localStorage.getItem(KEYS.claudeModel) as ClaudeModel) || 'claude-haiku-4-5-20251001',
    openaiKey:     localStorage.getItem(KEYS.openaiKey) ?? '',
    deepseekKey:   localStorage.getItem(KEYS.deepseekKey) ?? '',
    ollamaBaseUrl: localStorage.getItem(KEYS.ollamaBaseUrl) ?? 'http://localhost:11434',
    ollamaModel:   localStorage.getItem(KEYS.ollamaModel) ?? 'llava',
  }
}

export function useAiSettings() {
  const [settings, setSettings] = useState<AISettings>(loadSettings)

  function saveSettings(next: AISettings) {
    localStorage.setItem(KEYS.provider,      next.provider)
    localStorage.setItem(KEYS.geminiKey,     next.geminiKey)
    localStorage.setItem(KEYS.geminiModel,   next.geminiModel)
    localStorage.setItem(KEYS.claudeKey,     next.claudeKey)
    localStorage.setItem(KEYS.claudeModel,   next.claudeModel)
    localStorage.setItem(KEYS.openaiKey,     next.openaiKey)
    localStorage.setItem(KEYS.deepseekKey,   next.deepseekKey)
    localStorage.setItem(KEYS.ollamaBaseUrl, next.ollamaBaseUrl)
    localStorage.setItem(KEYS.ollamaModel,   next.ollamaModel)
    setSettings(next)
  }

  return { settings, saveSettings }
}
