import { useMemo, useState } from 'react'
import type { BugReport } from '@/types/report'
import { generateMarkdown } from '@/lib/report/generateMarkdown'
import { generateJson } from '@/lib/report/generateJson'
import { generateAiPrompt } from '@/lib/report/generateAiPrompt'
import { generateZipReport } from '@/lib/export/generateZip'
import { downloadBlob, downloadMarkdown, downloadJson } from '@/lib/download'

interface ExportScreenProps {
  report: BugReport
  onChange: (r: BugReport) => void
  onBack: () => void
  onToast: (msg: string) => void
}

type Tab = 'markdown' | 'prompt' | 'json'

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

export function ExportScreen({ report, onChange, onBack, onToast }: ExportScreenProps) {
  const [tab, setTab] = useState<Tab>('markdown')
  const [zipBusy, setZipBusy] = useState(false)

  const md     = useMemo(() => generateMarkdown(report), [report])
  const prompt = useMemo(() => generateAiPrompt(report), [report])
  const json   = useMemo(() => generateJson(report),     [report])

  const previewText = tab === 'markdown' ? md : tab === 'prompt' ? prompt : json

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

        <div className="export-actions">
          <button
            className="btn btn-primary"
            onClick={() => copy(prompt, 'AI debugging prompt')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
            Copy AI prompt
          </button>
          <button className="btn" onClick={() => download('bug-report.md', md)}>
            ↓ bug-report.md
          </button>
          <button className="btn" onClick={() => download('metadata.json', json)}>
            ↓ metadata.json
          </button>
          <button className="btn" onClick={downloadZip} disabled={zipBusy}>
            {zipBusy ? 'Building ZIP…' : '↓ screen2issue-report.zip'}
          </button>
          <button className="btn btn-ghost" onClick={onBack} style={{ gridColumn: '1 / -1' }}>
            ← Back to enhancements
          </button>
        </div>
      </section>

      {/* ── Right: live preview ── */}
      <section className="export-preview">
        <div className="export-preview-tabs">
          {(['markdown', 'prompt', 'json'] as Tab[]).map((t) => (
            <button
              key={t}
              className={`export-tab${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'markdown' ? 'bug-report.md' : t === 'prompt' ? 'ai-prompt.txt' : 'metadata.json'}
            </button>
          ))}
          <span className="export-tab-spacer" />
          <div className="export-tab-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => copy(previewText, tab)}>
              copy
            </button>
          </div>
        </div>
        <MarkdownPreview text={previewText} />
      </section>
    </main>
  )
}
