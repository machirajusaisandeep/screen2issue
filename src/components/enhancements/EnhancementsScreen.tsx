import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BrainCircuit, FileSearch, MessagesSquare } from 'lucide-react'
import type { BugReport } from '@/types/report'
import { HarUpload } from '@/components/har/HarUpload'
import { HarSummaryPanel } from '@/components/har/HarSummaryPanel'
import { LocalEnginePanel } from '@/components/enhancements/LocalEnginePanel'
import { TranscriptPanel } from '@/components/enhancements/TranscriptPanel'
import { parseHar } from '@/lib/har/parseHar'
import { summarizeHar } from '@/lib/har/summarizeHar'
import {
  checkHealth,
  enhanceFrames,
  LocalEngineRequestError,
  transcribeVideo,
} from '@/lib/localEngine/client'
import {
  applyEnhancementResult,
  applyTranscriptionResult,
  setLocalEngineState,
} from '@/lib/localEngine/merge'
import {
  countFramesWithEffectiveOcr,
  getEffectiveFrameOcr,
  getSuspiciousHarEntries,
  formatHarEntryLabel,
} from '@/lib/report/reportData'
import { formatTimestamp } from '@/lib/video/formatTimestamp'
import type { RuntimeCapabilities } from '@/lib/runtime/capabilities'
import { callAI, AIError } from '@/lib/ai/client'
import type { AISettings } from '@/lib/ai/types'

interface EnhancementsScreenProps {
  report: BugReport
  videoFile: File | null
  runtimeCapabilities: RuntimeCapabilities
  aiSettings: AISettings
  onBack: () => void
  onNext: () => void
  onReportChange: (report: BugReport) => void
}

function EnhancementAccordionSection({
  children,
  count,
  defaultOpen = true,
  eyebrow,
  title,
}: {
  children: ReactNode
  count?: string
  defaultOpen?: boolean
  eyebrow: string
  title: string
}) {
  return (
    <details className="enhancement-accordion" open={defaultOpen}>
      <summary className="enhancement-accordion-summary">
        <span className="enhancement-accordion-kicker mono">{eyebrow}</span>
        <span className="enhancement-accordion-title">{title}</span>
        {count ? <span className="analysis-pill mono">{count}</span> : null}
      </summary>
      <div className="enhancement-accordion-body">{children}</div>
    </details>
  )
}

type LocalAction = 'check' | 'enhance' | 'transcribe' | null
type AiAction = 'activity' | 'har' | 'transcript'

export function EnhancementsScreen({
  report,
  videoFile,
  runtimeCapabilities,
  aiSettings,
  onBack,
  onNext,
  onReportChange,
}: EnhancementsScreenProps) {
  const [harError, setHarError] = useState<string | null>(null)
  const [localEngineError, setLocalEngineError] = useState<string | null>(null)
  const [localEngineMessage, setLocalEngineMessage] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<LocalAction>(null)
  const [aiBusyAction, setAiBusyAction] = useState<AiAction | null>(null)
  const [pendingAiAction, setPendingAiAction] = useState<AiAction | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiMessage, setAiMessage] = useState<string | null>(null)
  const reportRef = useRef(report)

  useEffect(() => {
    reportRef.current = report
  }, [report])

  const includedCount = report.frames.filter((frame) => frame.included).length
  const ocrCount = countFramesWithEffectiveOcr(report.frames.filter((frame) => frame.included))
  const harSyncOffsetSeconds = report.harSummary ? report.harSummary.syncOffsetMs / 1000 : 0

  function commitReport(nextReport: BugReport) {
    reportRef.current = nextReport
    onReportChange(nextReport)
  }

  async function handleHarSelected(file: File) {
    setHarError(null)

    try {
      const parsed = parseHar(file.name, await file.text())
      const offsetMs = reportRef.current.harSummary?.syncOffsetMs ?? 0
      commitReport({
        ...reportRef.current,
        harSummary: summarizeHar(parsed, offsetMs),
      })
    } catch (error) {
      setHarError(error instanceof Error ? error.message : 'Could not import this HAR file.')
    }
  }

  function handleHarOffsetChange(offsetSeconds: number) {
    if (!reportRef.current.harSummary) return

    commitReport({
      ...reportRef.current,
      harSummary: summarizeHar(
        {
          fileName: reportRef.current.harSummary.fileName,
          importedAt: reportRef.current.harSummary.importedAt,
          entries: reportRef.current.harSummary.entries,
        },
        Math.round(offsetSeconds * 1000),
      ),
    })
  }

  async function handleCheckLocalEngine() {
    setBusyAction('check')
    setLocalEngineError(null)
    setLocalEngineMessage(null)
    commitReport(setLocalEngineState(reportRef.current, {
      state: 'checking',
      lastError: undefined,
    }))

    try {
      const health = await checkHealth()
      commitReport(setLocalEngineState(reportRef.current, {
        state: 'connected',
        health,
        lastCheckedAt: new Date().toISOString(),
        lastError: undefined,
      }))
      setLocalEngineMessage(`Connected to ${health.engine} ${health.version}.`)
    } catch (error) {
      handleLocalEngineFailure(error, 'Could not connect to the local engine.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleEnhanceDetection() {
    setBusyAction('enhance')
    setLocalEngineError(null)
    setLocalEngineMessage(null)
    commitReport(setLocalEngineState(reportRef.current, {
      state: 'enhancing',
      lastError: undefined,
    }))

    try {
      const result = await enhanceFrames(reportRef.current.frames)
      const mergedReport = applyEnhancementResult(reportRef.current, result)
      commitReport(setLocalEngineState(mergedReport, {
        state: 'complete',
        lastCheckedAt: new Date().toISOString(),
        lastError: undefined,
      }))
      setLocalEngineMessage(`Enhanced ${result.frames.length} extracted frames locally.`)
    } catch (error) {
      handleLocalEngineFailure(error, 'Local frame enhancement failed.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleTranscribeAudio() {
    if (!videoFile) {
      const message = 'The original video file is no longer available for transcription.'
      setLocalEngineError(message)
      commitReport(setLocalEngineState(reportRef.current, {
        state: 'error',
        lastError: message,
      }))
      return
    }

    setBusyAction('transcribe')
    setLocalEngineError(null)
    setLocalEngineMessage(null)
    commitReport(setLocalEngineState(reportRef.current, {
      state: 'enhancing',
      lastError: undefined,
    }))

    try {
      const result = await transcribeVideo(videoFile, {
        videoName: reportRef.current.videoName,
        videoType: reportRef.current.videoType,
        videoSizeBytes: reportRef.current.videoSizeBytes,
        videoDurationMs: reportRef.current.videoDurationMs,
      })
      const mergedReport = applyTranscriptionResult(reportRef.current, result)
      commitReport(setLocalEngineState(mergedReport, {
        state: 'complete',
        lastCheckedAt: new Date().toISOString(),
        lastError: undefined,
      }))
      setLocalEngineMessage(
        result.hasAudio
          ? `Loaded ${result.segments.length} transcript segments from the local engine.`
          : 'No usable audio track was detected in the uploaded recording.',
      )
    } catch (error) {
      handleLocalEngineFailure(error, 'Local transcription failed.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleAnalyzeActivity() {
    setAiBusyAction('activity')
    setAiError(null)
    setAiMessage(null)
    try {
      const includedFrames = reportRef.current.frames.filter((f) => f.included)
      const framesContext = includedFrames
        .map((f, i) => {
          const ocr = getEffectiveFrameOcr(f)
          return `Frame ${i + 1} at ${formatTimestamp(f.timestampMs)}:${f.note ? ` ${f.note}` : ''}${ocr.text ? `\nVisible text: ${ocr.text}` : ''}`
        })
        .join('\n\n')
      const cursorSummary = `${reportRef.current.browserCursorEvents.length} browser cursor events, ${reportRef.current.enhancedCursorEvents.length} enhanced cursor events`
      const transcriptText =
        reportRef.current.transcriptSegments.length > 0
          ? reportRef.current.transcriptSegments.map((s) => s.text).join(' ')
          : 'No transcript available.'

      const result = await callAI({
        settings: aiSettings,
        systemPrompt:
          'You are analyzing a screen recording session for a bug report. Summarize what the user was doing based on the frame descriptions, cursor events, and transcript.',
        userPrompt: `Frames:\n${framesContext}\n\nCursor events: ${cursorSummary}\n\nTranscript: ${transcriptText}\n\nPlease summarize the user activity in 2–4 sentences.`,
      })
      commitReport({ ...reportRef.current, aiActivitySummary: result.text })
      setAiMessage('Activity summary generated.')
    } catch (error) {
      setAiError(error instanceof AIError ? error.message : 'Activity analysis failed.')
    } finally {
      setAiBusyAction(null)
    }
  }

  async function handleAnalyzeHar() {
    if (!reportRef.current.harSummary) return
    setAiBusyAction('har')
    setAiError(null)
    setAiMessage(null)
    try {
      const suspicious = getSuspiciousHarEntries(reportRef.current)
        .slice(0, 30)
        .map((e) => formatHarEntryLabel(e))
        .join('\n')
      const { totalRequests, errorCount, slowRequestCount } = reportRef.current.harSummary
      const summary = `Total: ${totalRequests} requests, ${errorCount} errors, ${slowRequestCount} slow.`

      const result = await callAI({
        settings: aiSettings,
        systemPrompt:
          'You are analyzing network traffic from a HAR file for a bug report. Identify patterns, errors, and issues.',
        userPrompt: `HAR Summary: ${summary}\n\nSuspicious requests:\n${suspicious || '(none)'}\n\nPlease identify the most significant issues and patterns in 3–5 bullet points.`,
      })
      commitReport({ ...reportRef.current, aiHarInsights: result.text })
      setAiMessage('HAR analysis complete.')
    } catch (error) {
      setAiError(error instanceof AIError ? error.message : 'HAR analysis failed.')
    } finally {
      setAiBusyAction(null)
    }
  }

  async function handleAnalyzeTranscript() {
    setAiBusyAction('transcript')
    setAiError(null)
    setAiMessage(null)
    try {
      const transcriptText = reportRef.current.transcriptSegments
        .map((s) => `[${formatTimestamp(s.startMs)}] ${s.text}`)
        .join('\n')

      const result = await callAI({
        settings: aiSettings,
        systemPrompt:
          'You are analyzing an audio transcript from a screen recording. Summarize what was communicated.',
        userPrompt: `Transcript:\n${transcriptText}\n\nPlease summarize what was communicated in 2–3 sentences.`,
      })
      commitReport({ ...reportRef.current, aiTranscriptInsights: result.text })
      setAiMessage('Transcript analysis complete.')
    } catch (error) {
      setAiError(error instanceof AIError ? error.message : 'Transcript analysis failed.')
    } finally {
      setAiBusyAction(null)
    }
  }

  function requestAiAction(action: AiAction) {
    setPendingAiAction(action)
  }

  function confirmAiAction() {
    const action = pendingAiAction
    setPendingAiAction(null)
    if (action === 'activity') void handleAnalyzeActivity()
    if (action === 'har') void handleAnalyzeHar()
    if (action === 'transcript') void handleAnalyzeTranscript()
  }

  function handleLocalEngineFailure(error: unknown, fallbackMessage: string) {
    const message = error instanceof Error ? error.message : fallbackMessage
    const state =
      error instanceof LocalEngineRequestError && error.kind === 'not_connected'
        ? 'not_connected'
        : 'error'

    commitReport(setLocalEngineState(reportRef.current, {
      state,
      lastError: message,
      lastCheckedAt: new Date().toISOString(),
    }))
    setLocalEngineError(message)
  }

  return (
    <main className="screen enhancements-screen">
      <section className="enhancements-main">
        <div className="review-head">
          <div className="review-title-block">
            <h2 className="review-title">Enhancements</h2>
            <div className="review-meta mono">
              <span>{includedCount} included frames</span>
              <span>· {ocrCount} included frames with active OCR</span>
              <span>· {report.browserCursorEvents.length} browser cursor events</span>
              <span>· {report.enhancedCursorEvents.length} enhanced cursor events</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={onBack}>
              ← Back to review
            </button>
            <button className="btn btn-primary btn-sm" onClick={onNext}>
              Continue to export
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </div>
        </div>

        <div className="enhancements-accordion-list">
          <EnhancementAccordionSection
            eyebrow="1"
            title="Local Engine"
            count={report.localEngineStatus.state}
          >
            {runtimeCapabilities.showLocalEngineActions ? (
              <LocalEnginePanel
                status={report.localEngineStatus}
                frameCount={report.frames.length}
                transcriptCount={report.transcriptSegments.length}
                videoName={report.videoName}
                busyAction={busyAction}
                error={localEngineError}
                message={localEngineMessage}
                onCheck={handleCheckLocalEngine}
                onEnhance={handleEnhanceDetection}
                onTranscribe={handleTranscribeAudio}
              />
            ) : (
              <div className="analysis-card">
                <div className="analysis-card-head">
                  <div>
                    <h3>Desktop-Only Local Engine</h3>
                    <p>
                      The hosted {runtimeCapabilities.surface === 'pwa' ? 'PWA' : 'web app'} ships the
                      browser-only workflow publicly. Enhanced OCR, local transcription, and bundled
                      helper startup are available in the Mac app release.
                    </p>
                  </div>
                  <div className="analysis-pill mono">browser-only release</div>
                </div>
                <div className="analysis-warning">
                  Public web and PWA releases keep step 4 focused on browser-safe enhancements like
                  HAR import. Install the Mac app when you want the bundled local engine workflow.
                </div>
                <div className="analysis-stats mono">
                  <span>HAR import is still available here</span>
                  <span>browser OCR and cursor detection already ran in step 2</span>
                  <span>desktop surface unlocks transcript + enhanced OCR</span>
                </div>
              </div>
            )}
          </EnhancementAccordionSection>

          <EnhancementAccordionSection
            eyebrow="2"
            title="HAR"
            count={report.harSummary ? `${report.harSummary.totalRequests} requests` : 'not loaded'}
          >
            <HarUpload
              fileName={report.harSummary?.fileName}
              syncOffsetSeconds={harSyncOffsetSeconds}
              error={harError}
              onFileSelected={handleHarSelected}
              onSyncOffsetChange={handleHarOffsetChange}
            />
            {report.harSummary ? <HarSummaryPanel summary={report.harSummary} /> : null}
          </EnhancementAccordionSection>

          <EnhancementAccordionSection
            eyebrow="3"
            title="Audio Transcript"
            count={report.transcriptSegments.length > 0 ? `${report.transcriptSegments.length} segments` : 'empty'}
          >
            <TranscriptPanel segments={report.transcriptSegments} />
          </EnhancementAccordionSection>

          <EnhancementAccordionSection
            eyebrow="4"
            title="AI Analysis"
            count={aiSettings.provider}
          >
            <div className="analysis-card analysis-card-callout">
              <div className="analysis-card-head">
                <div>
                  <h3>AI Analysis</h3>
                  <p>
                    Use your configured AI provider to understand user activity, analyze network
                    traffic, and summarize the transcript. Calls go directly from your browser
                    to the provider API — nothing is proxied.
                  </p>
                </div>
                <div className="analysis-pill mono">{aiSettings.provider}</div>
              </div>
              <div className="analysis-actions">
                <button
                  className="btn btn-ai"
                  onClick={() => requestAiAction('activity')}
                  disabled={aiBusyAction !== null}
                >
                  <BrainCircuit size={16} strokeWidth={2.2} />
                  {aiBusyAction === 'activity' ? 'Analyzing…' : 'Understand Activity with AI'}
                </button>
                {report.harSummary && (
                  <button
                    className="btn btn-ai"
                    onClick={() => requestAiAction('har')}
                    disabled={aiBusyAction !== null}
                  >
                    <FileSearch size={16} strokeWidth={2.2} />
                    {aiBusyAction === 'har' ? 'Analyzing…' : 'Analyze HAR with AI'}
                  </button>
                )}
                {report.transcriptSegments.length > 0 && (
                  <button
                    className="btn btn-ai"
                    onClick={() => requestAiAction('transcript')}
                    disabled={aiBusyAction !== null}
                  >
                    <MessagesSquare size={16} strokeWidth={2.2} />
                    {aiBusyAction === 'transcript' ? 'Analyzing…' : 'Analyze Transcript with AI'}
                  </button>
                )}
              </div>
              {aiMessage && <div className="analysis-success">{aiMessage}</div>}
              {aiError && <div className="analysis-error">{aiError}</div>}
              {report.aiActivitySummary && (
                <div className="frame-subsection">
                  <div className="frame-subsection-head"><span className="mono">activity summary</span></div>
                  <div className="frame-related-list">
                    <div className="frame-related-item">{report.aiActivitySummary}</div>
                  </div>
                </div>
              )}
              {report.aiHarInsights && (
                <div className="frame-subsection">
                  <div className="frame-subsection-head"><span className="mono">har insights</span></div>
                  <div className="frame-related-list">
                    <div className="frame-related-item">{report.aiHarInsights}</div>
                  </div>
                </div>
              )}
              {report.aiTranscriptInsights && (
                <div className="frame-subsection">
                  <div className="frame-subsection-head"><span className="mono">transcript insights</span></div>
                  <div className="frame-related-list">
                    <div className="frame-related-item">{report.aiTranscriptInsights}</div>
                  </div>
                </div>
              )}
            </div>
          </EnhancementAccordionSection>
        </div>

        {report.enhancementWarnings.length > 0 ? (
          <div className="analysis-card">
            <div className="analysis-card-head">
              <div>
                <h3>Enhancement Warnings</h3>
                <p>Non-fatal local-engine warnings are kept here and included in export metadata.</p>
              </div>
            </div>
            <div className="analysis-roadmap">
              {report.enhancementWarnings.map((warning) => (
                <div key={warning} className="analysis-roadmap-item">
                  {warning}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
      {pendingAiAction ? (
        <div className="ai-modal-backdrop" role="presentation" onMouseDown={() => setPendingAiAction(null)}>
          <section
            className="data-boundary-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="data-boundary-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="ai-modal-header" id="data-boundary-title">Confirm external AI request</div>
            <div className="ai-modal-body">
              <div className="data-boundary-badge mono">data leaves this device</div>
              <p>
                Screen2Issue will send only the relevant report text for this {pendingAiAction}
                analysis directly to your configured {aiSettings.provider} endpoint. The original
                recording and API key are not included in the request payload.
              </p>
              <p className="ai-field-note">Review your provider's retention policy before continuing.</p>
            </div>
            <div className="ai-modal-footer">
              <button className="btn btn-ghost" onClick={() => setPendingAiAction(null)}>Cancel</button>
              <button className="btn btn-ai" onClick={confirmAiAction}>Send to {aiSettings.provider}</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
