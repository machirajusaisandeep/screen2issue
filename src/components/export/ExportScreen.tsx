import { useMemo, useState } from 'react'
import { Copy, WandSparkles, FileText, Braces, Archive, Download } from 'lucide-react'
import type { BugReport } from '@/types/report'
import { generateMarkdown } from '@/lib/report/generateMarkdown'
import { generateJson } from '@/lib/report/generateJson'
import { generateAiPrompt } from '@/lib/report/generateAiPrompt'
import { generateZipReport } from '@/lib/export/generateZip'
import { downloadBlob, downloadMarkdown, downloadJson } from '@/lib/download'
import { callAI, AIError } from '@/lib/ai/client'
import type { AISettings } from '@/lib/ai/types'
import { countTextTokens, countImageTokens, formatTokenCount } from '@/lib/tokens'

interface ExportScreenProps {
  report: BugReport
  aiSettings: AISettings
  onChange: (r: BugReport) => void
  onBack: () => void
  onToast: (msg: string) => void
}

type Tab = 'markdown' | 'prompt' | 'json' | 'enhanced-prompt'


function MarkdownPreview({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="export-preview-body">
      {lines.map((line, i) => {
        if (line.startsWith('# '))   return <span key={i} className="md-h1">{line.slice(2)}{'\n'}</span>
        if (line.startsWith('## '))  return <span key={i} className="md-h2">{line}{'\n'}</span>
        if (line.startsWith('### ')) return <span key={i} className="md-h3">{line}{'\n'}</span>
        if (line.startsWith('- ') || /^\d+\. /.test(line)) return <span key={i} className="md-li">{line}{'\n'}</span>
        if (line.startsWith('_') || line.startsWith('Screenshot:') || line.startsWith('Note:')) return <span key={i} className="md-meta">{line}{'\n'}</span>
        return <span key={i}>{line}{'\n'}</span>
      })}
    </div>
  )
}

export function ExportScreen({ report, aiSettings, onChange, onBack, onToast }: ExportScreenProps) {
  const [tab, setTab] = useState<Tab>('markdown')
  const [zipBusy, setZipBusy] = useState(false)
  const [promptAiBusy, setPromptAiBusy] = useState(false)
  const [promptAiError, setPromptAiError] = useState<string | null>(null)

  const md     = useMemo(() => generateMarkdown(report), [report])
  const prompt = useMemo(() => generateAiPrompt(report), [report])
  const json   = useMemo(() => generateJson(report),     [report])

  const includedFrames = report.frames.filter((f) => f.included)
  const rawFrameTokens = includedFrames.reduce(
    (sum, f) => sum + countImageTokens(f.width ?? 1920, f.height ?? 1080),
    0,
  )

  const baseReportTokens = useMemo(() => countTextTokens(prompt), [prompt])

  const aiGeneratedTokens = useMemo(() => {
    const frameAi = report.frames.reduce((sum, f) => {
      return sum + countTextTokens((f.aiScreenshotAnalysis ?? '') + (f.aiOcrCorrection ?? ''))
    }, 0)
    const reportAi = countTextTokens(
      (report.aiActivitySummary ?? '') +
      (report.aiHarInsights ?? '') +
      (report.aiTranscriptInsights ?? '') +
      (report.aiEnhancedPrompt ?? ''),
    )
    return frameAi + reportAi
  }, [report])

  const hasAiContent = aiGeneratedTokens > 0

  const previewText =
    tab === 'markdown' ? md
    : tab === 'prompt' ? prompt
    : tab === 'json' ? json
    : report.aiEnhancedPrompt ?? ''

  const tabItems = [
    { id: 'markdown' as const, label: 'bug-report.md', text: md },
    { id: 'prompt' as const, label: 'ai-prompt.txt', text: prompt },
    { id: 'json' as const, label: 'metadata.json', text: json },
    ...(report.aiEnhancedPrompt
      ? [{ id: 'enhanced-prompt' as const, label: 'ai-enhanced-prompt.txt', text: report.aiEnhancedPrompt }]
      : []),
  ]

  async function handleEnhancePrompt() {
    setPromptAiBusy(true)
    setPromptAiError(null)
    try {
      const result = await callAI({
        settings: aiSettings,
        systemPrompt:
          'You are a senior software engineer helping write debugging prompts for AI assistants. Improve the given prompt to be more precise, structured, and actionable.',
        userPrompt: `Original debugging prompt:\n\n${prompt}\n\nPlease improve this prompt to be more precise and structured. Include specific areas to investigate based on the data provided. Return only the improved prompt text.`,
      })
      onChange({ ...report, aiEnhancedPrompt: result.text })
      onToast('AI prompt enhanced')
      setTab('enhanced-prompt')
    } catch (error) {
      setPromptAiError(error instanceof AIError ? error.message : 'Prompt enhancement failed.')
    } finally {
      setPromptAiBusy(false)
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text).catch(() => {})
    onToast(`${label} copied to clipboard`)
  }

  function download(filename: string, content: string) {
    if (filename.endsWith('.md'))   downloadMarkdown(content)
    else                            downloadJson(content)
    onToast(`${filename} downloaded`)
  }

  async function downloadZip() {
    setZipBusy(true)
    try {
      const zipBlob = await generateZipReport(report)
      downloadBlob(zipBlob, 'screen2issue-report.zip')
      onToast('screen2issue-report.zip downloaded')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'ZIP export failed')
    } finally {
      setZipBusy(false)
    }
  }

  return (
    <main className="screen export-screen">
      {/* ── Left: form ── */}
      <section className="export-form">
        <div className="field">
          <label className="field-label">Report title</label>
          <input
            className="s2i-input"
            value={report.title}
            onChange={(e) => onChange({ ...report, title: e.target.value })}
          />
        </div>

        <div className="field">
          <label className="field-label">Summary</label>
          <textarea
            className="s2i-textarea"
            value={report.summary}
            onChange={(e) => onChange({ ...report, summary: e.target.value })}
          />
          <span className="field-help">
            Two or three sentences that frame the issue for a reader who hasn't seen the recording.
          </span>
        </div>

        <div className="field">
          <label className="field-label">Observed behavior</label>
          <textarea
            className="s2i-textarea"
            value={report.observedBehavior}
            onChange={(e) => onChange({ ...report, observedBehavior: e.target.value })}
          />
        </div>

        <div className="field">
          <label className="field-label">Expected behavior</label>
          <textarea
            className="s2i-textarea"
            value={report.expectedBehavior}
            onChange={(e) => onChange({ ...report, expectedBehavior: e.target.value })}
          />
        </div>

        <div className="field">
          <label className="field-label">Reproduction steps</label>
          <div className="repro-list">
            {report.reproductionSteps.map((s, i) => (
              <div key={i} className="repro-item">
                <span className="repro-num mono">{i + 1}.</span>
                <input
                  className="repro-input"
                  value={s}
                  onChange={(e) => {
                    const steps = [...report.reproductionSteps]
                    steps[i] = e.target.value
                    onChange({ ...report, reproductionSteps: steps })
                  }}
                />
                <button
                  className="repro-del"
                  onClick={() =>
                    onChange({
                      ...report,
                      reproductionSteps: report.reproductionSteps.filter((_, j) => j !== i),
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              className="repro-add"
              onClick={() =>
                onChange({ ...report, reproductionSteps: [...report.reproductionSteps, ''] })
              }
            >
              + add step
            </button>
          </div>
        </div>

        <div className="token-summary">
          <div className="token-summary-head mono">token optimization</div>
          <div className="token-summary-rows">
            <div className="token-summary-row">
              <span className="token-summary-label">Without AI</span>
              <span className="token-summary-value mono">{formatTokenCount(baseReportTokens)} tokens</span>
            </div>
            {hasAiContent && (
              <div className="token-summary-row">
                <span className="token-summary-label">With AI enhancements</span>
                <span className="token-summary-value mono accent">
                  {formatTokenCount(baseReportTokens + aiGeneratedTokens)} tokens
                </span>
              </div>
            )}
            <div className="token-summary-row">
              <span className="token-summary-label">Raw frames (est.)</span>
              <span className="token-summary-value mono muted">{formatTokenCount(rawFrameTokens)} tokens</span>
            </div>
            <div className="token-summary-savings mono">
              saves {formatTokenCount(rawFrameTokens - baseReportTokens)} tokens vs raw frames
            </div>
          </div>
        </div>

        <div className="export-actions">
          <button
            className="btn btn-ai"
            onClick={() => copy(prompt, 'AI debugging prompt')}
          >
            <Copy size={16} strokeWidth={2.2} />
            Copy AI prompt
          </button>
          <button className="btn" onClick={() => download('bug-report.md', md)}>
            <FileText size={14} strokeWidth={2.2} />
            bug-report.md
          </button>
          <button className="btn" onClick={() => download('metadata.json', json)}>
            <Braces size={14} strokeWidth={2.2} />
            metadata.json
          </button>
          <button className="btn" onClick={downloadZip} disabled={zipBusy}>
            <Archive size={14} strokeWidth={2.2} />
            {zipBusy ? 'Building ZIP…' : 'screen2issue-report.zip'}
          </button>
          <button
            className="btn btn-ai"
            onClick={handleEnhancePrompt}
            disabled={promptAiBusy}
            style={{ gridColumn: '1 / -1' }}
          >
            <WandSparkles size={16} strokeWidth={2.2} />
            {promptAiBusy ? 'Enhancing…' : 'Enhance Prompt with AI'}
          </button>
          {promptAiError && (
            <div className="analysis-error" style={{ gridColumn: '1 / -1' }}>{promptAiError}</div>
          )}
          <button className="btn btn-ghost" onClick={onBack} style={{ gridColumn: '1 / -1' }}>
            ← Back to enhancements
          </button>
        </div>
      </section>

      {/* ── Right: live preview ── */}
      <section className="export-preview">
        <div className="export-preview-tabs">
          {tabItems.map((item) => (
            <button
              key={item.id}
              className={`export-tab${tab === item.id ? ' active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <span>{item.label}</span>
              <span className="export-tab-token">
                {formatTokenCount(countTextTokens(item.text))} tokens
              </span>
            </button>
          ))}
          <span className="export-tab-spacer" />
          <div className="export-tab-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => copy(previewText, tab)}>
              <Copy size={13} strokeWidth={2.2} />
              copy
            </button>
          </div>
        </div>
        <MarkdownPreview text={previewText} />
      </section>
    </main>
  )
}
