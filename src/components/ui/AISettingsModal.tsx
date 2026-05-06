import { useEffect, useState } from 'react'
import { GEMINI_MODELS, type AIProvider, type AISettings } from '@/lib/ai/types'

interface AISettingsModalProps {
  open: boolean
  initialSettings: AISettings
  onSave: (settings: AISettings) => void
  onClose: () => void
}

const PROVIDERS: { id: AIProvider; label: string }[] = [
  { id: 'gemini',   label: 'Gemini' },
  { id: 'claude',   label: 'Claude' },
  { id: 'openai',   label: 'OpenAI' },
  { id: 'deepseek', label: 'DeepSeek' },
]

export function AISettingsModal({ open, initialSettings, onSave, onClose }: AISettingsModalProps) {
  const [draft, setDraft] = useState<AISettings>(initialSettings)

  useEffect(() => {
    if (open) setDraft(initialSettings)
  }, [open, initialSettings])

  if (!open) return null

  function handleSave() {
    onSave(draft)
    onClose()
  }

  return (
    <div className="ai-modal-backdrop" onClick={onClose}>
      <div className="ai-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-modal-header">
          <span>AI Provider Settings</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="ai-modal-body">
          <div className="ai-field">
            <span className="ai-field-label">Provider</span>
            <div className="ai-provider-seg">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  className={draft.provider === p.id ? 'active' : ''}
                  onClick={() => setDraft((d) => ({ ...d, provider: p.id }))}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ai-field">
            <label className="ai-field-label" htmlFor="ai-gemini-key">Gemini API Key</label>
            <input
              id="ai-gemini-key"
              type="password"
              className="s2i-input"
              placeholder="AIza…"
              value={draft.geminiKey}
              onChange={(e) => setDraft((d) => ({ ...d, geminiKey: e.target.value }))}
              autoComplete="off"
            />
            <label className="ai-field-label" htmlFor="ai-gemini-model" style={{ marginTop: 8 }}>Gemini Model</label>
            <select
              id="ai-gemini-model"
              className="s2i-select"
              value={draft.geminiModel}
              onChange={(e) => setDraft((d) => ({ ...d, geminiModel: e.target.value as AISettings['geminiModel'] }))}
            >
              {GEMINI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <span className="ai-field-note">1.5 Flash has the broadest free-tier availability.</span>
          </div>

          <div className="ai-field">
            <label className="ai-field-label" htmlFor="ai-claude-key">Claude API Key</label>
            <input
              id="ai-claude-key"
              type="password"
              className="s2i-input"
              placeholder="sk-ant-…"
              value={draft.claudeKey}
              onChange={(e) => setDraft((d) => ({ ...d, claudeKey: e.target.value }))}
              autoComplete="off"
            />
          </div>

          <div className="ai-field">
            <label className="ai-field-label" htmlFor="ai-openai-key">OpenAI API Key</label>
            <input
              id="ai-openai-key"
              type="password"
              className="s2i-input"
              placeholder="sk-…"
              value={draft.openaiKey}
              onChange={(e) => setDraft((d) => ({ ...d, openaiKey: e.target.value }))}
              autoComplete="off"
            />
          </div>

          <div className="ai-field">
            <label className="ai-field-label" htmlFor="ai-deepseek-key">DeepSeek API Key</label>
            <input
              id="ai-deepseek-key"
              type="password"
              className="s2i-input"
              placeholder="sk-…"
              value={draft.deepseekKey}
              onChange={(e) => setDraft((d) => ({ ...d, deepseekKey: e.target.value }))}
              autoComplete="off"
            />
            <span className="ai-field-note">Text-only — screenshot image analysis is skipped.</span>
          </div>

          <p className="ai-field-note">Keys are stored only in localStorage on this device.</p>
        </div>

        <div className="ai-modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
