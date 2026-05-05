import { useEffect, useRef, useState } from 'react'
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
import { countFramesWithEffectiveOcr } from '@/lib/report/reportData'
import type { RuntimeCapabilities } from '@/lib/runtime/capabilities'

interface EnhancementsScreenProps {
  report: BugReport
  videoFile: File | null
  runtimeCapabilities: RuntimeCapabilities
  onBack: () => void
  onNext: () => void
  onReportChange: (report: BugReport) => void
}

type LocalAction = 'check' | 'enhance' | 'transcribe' | null

export function EnhancementsScreen({
  report,
  videoFile,
  runtimeCapabilities,
  onBack,
  onNext,
  onReportChange,
}: EnhancementsScreenProps) {
  const [harError, setHarError] = useState<string | null>(null)
  const [localEngineError, setLocalEngineError] = useState<string | null>(null)
  const [localEngineMessage, setLocalEngineMessage] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<LocalAction>(null)
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

        <div className="analysis-grid">
          <div className="analysis-card analysis-card-callout">
            <div className="analysis-card-head">
              <div>
                <h3>Optional Enrichments</h3>
                <p>
                  Step 4 is where extra debugging context lives. HAR stays here, and the optional
                  local engine can layer better OCR, cursor analysis, and audio transcript data on
                  top of the browser-only baseline from step 2.
                </p>
              </div>
              <div className="analysis-pill mono">step 4 of 5</div>
            </div>
            <div className="analysis-stats mono">
              <span>browser mode still works with no Python engine</span>
              <span>safe to skip and continue</span>
              <span>{report.transcriptSegments.length > 0 ? `${report.transcriptSegments.length} transcript segments loaded` : 'no transcript loaded yet'}</span>
              <span>{report.harSummary ? `${report.harSummary.totalRequests} HAR requests loaded` : 'no HAR loaded yet'}</span>
            </div>
          </div>

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

          <HarUpload
            fileName={report.harSummary?.fileName}
            syncOffsetSeconds={harSyncOffsetSeconds}
            error={harError}
            onFileSelected={handleHarSelected}
            onSyncOffsetChange={handleHarOffsetChange}
          />

          <TranscriptPanel segments={report.transcriptSegments} />

          <div className="analysis-card">
            <div className="analysis-card-head">
              <div>
                <h3>More Enhancements Coming</h3>
                <p>
                  This stage is intentionally separate from review so we can keep adding optional
                  debugging inputs without crowding the export step.
                </p>
              </div>
            </div>
            <div className="analysis-roadmap">
              <div className="analysis-roadmap-item">Console logs or traces</div>
              <div className="analysis-roadmap-item">Browser metadata import</div>
              <div className="analysis-roadmap-item">Additional local engine enrichments</div>
            </div>
          </div>
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

        {report.harSummary ? <HarSummaryPanel summary={report.harSummary} /> : null}
      </section>
    </main>
  )
}
