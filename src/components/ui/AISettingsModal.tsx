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
  { id: 'ollama',   label: 'Ollama' },
]

export function AISettingsModal({ open, initialSettings, onSave, onClose }: AISettingsModalProps) {
  const [draft, setDraft] = useState<AISettings>(initialSettings)
  // activeTab tracks which provider's fields are visible — starts on the saved provider
  const [activeTab, setActiveTab] = useState<AIProvider>(initialSettings.provider)

  useEffect(() => {
    if (open) {
      setDraft(initialSettings)
      setActiveTab(initialSettings.provider)
    }
  }, [open, initialSettings])

  if (!open) return null

  function handleSave() {
    // The selected provider is whichever tab is active
    onSave({ ...draft, provider: activeTab })
    onClose()
  }

  return (
    <div className="ai-modal-backdrop" onClick={onClose}>
      <div className="ai-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-modal-header">
          <span>AI Provider Settings</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Provider tabs */}
        <div className="ai-provider-tabs">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              className={`ai-provider-tab${activeTab === p.id ? ' active' : ''}`}
              onClick={() => setActiveTab(p.id)}
            >
              {p.label}
              {draft.provider === p.id && <span className="ai-provider-tab-dot" />}
            </button>
          ))}
        </div>

        <div className="ai-modal-body">
          {activeTab === 'gemini' && (
            <>
              <div className="ai-field">
                <label className="ai-field-label" htmlFor="ai-gemini-key">API Key</label>
                <input
                  id="ai-gemini-key"
                  type="password"
                  className="s2i-input"
                  placeholder="AIza…"
                  value={draft.geminiKey}
                  onChange={(e) => setDraft((d) => ({ ...d, geminiKey: e.target.value }))}
                  autoComplete="off"
                />
              </div>
              <div className="ai-field">
                <label className="ai-field-label" htmlFor="ai-gemini-model">Model</label>
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
            </>
          )}

          {activeTab === 'claude' && (
            <div className="ai-field">
              <label className="ai-field-label" htmlFor="ai-claude-key">API Key</label>
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
          )}

          {activeTab === 'openai' && (
            <div className="ai-field">
              <label className="ai-field-label" htmlFor="ai-openai-key">API Key</label>
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
          )}

          {activeTab === 'deepseek' && (
            <div className="ai-field">
              <label className="ai-field-label" htmlFor="ai-deepseek-key">API Key</label>
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
          )}

          {activeTab === 'ollama' && (
            <>
              <div className="ai-field">
                <label className="ai-field-label" htmlFor="ai-ollama-url">Base URL</label>
                <input
                  id="ai-ollama-url"
                  type="text"
                  className="s2i-input"
                  placeholder="http://localhost:11434"
                  value={draft.ollamaBaseUrl}
                  onChange={(e) => setDraft((d) => ({ ...d, ollamaBaseUrl: e.target.value }))}
                  autoComplete="off"
                />
              </div>
              <div className="ai-field">
                <label className="ai-field-label" htmlFor="ai-ollama-model">Model</label>
                <input
                  id="ai-ollama-model"
                  type="text"
                  className="s2i-input"
                  placeholder="llava"
                  value={draft.ollamaModel}
                  onChange={(e) => setDraft((d) => ({ ...d, ollamaModel: e.target.value }))}
                  autoComplete="off"
                />
                <span className="ai-field-note">
                  No API key needed. Use a vision model (llava, llama3.2-vision) for screenshot
                  analysis. If running from a hosted URL, start Ollama with{' '}
                  <code className="mono">OLLAMA_ORIGINS=*</code>.
                </span>
              </div>
            </>
          )}

          <p className="ai-field-note" style={{ marginTop: 8 }}>
            API keys are stored only in localStorage on this device.
          </p>
        </div>

        <div className="ai-modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>
            Use {PROVIDERS.find((p) => p.id === activeTab)?.label}
          </button>
        </div>
      </div>
    </div>
  )
}
