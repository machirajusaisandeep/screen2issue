import { useState } from 'react'
import { ScanSearch, WandSparkles, X } from 'lucide-react'
import type { BugReport, CursorEvent, ExtractedFrame } from '@/types/report'
import { countTextTokens, formatTokenCount } from '@/lib/tokens'
import { formatTimestamp } from '@/lib/video/formatTimestamp'
import {
  countFramesWithEffectiveOcr,
  countFramesWithEnhancedCursorData,
  CURSOR_CONFIDENCE_THRESHOLD,
  formatHarEntryLabel,
  getEffectiveFrameOcr,
  getNearbyHarEntries,
  getPreferredCursorEventsForFrame,
  getNearbyTranscriptSegments,
  type CursorSource,
  type OcrSource,
} from '@/lib/report/reportData'
import { CursorEventBadge } from '@/components/timeline/CursorEventBadge'
import { callAI, imageUrlToBase64, AIError } from '@/lib/ai/client'
import type { AISettings } from '@/lib/ai/types'

interface TimelineScreenProps {
  frames: ExtractedFrame[]
  report: BugReport
  aiSettings: AISettings
  onChange: (frames: ExtractedFrame[]) => void
  onReportChange: (r: BugReport) => void
  onNext: () => void
}

type Layout = 'list' | 'grid'

function estimateFrameTokens(frame: ExtractedFrame): number {
  const base = 20
  const ocr = countTextTokens((frame.enhancedOcrText ?? frame.ocrText) ?? '')
  const note = countTextTokens(frame.note ?? '')
  return base + ocr + note
}

function updateFrame(frames: ExtractedFrame[], id: string, patch: Partial<ExtractedFrame>) {
  return frames.map((frame) => (frame.id === id ? { ...frame, ...patch } : frame))
}

function updateFrameOcrText(
  frames: ExtractedFrame[],
  id: string,
  value: string,
  source: OcrSource,
): ExtractedFrame[] {
  return frames.map((frame) => {
    if (frame.id !== id) return frame

    if (source === 'enhanced') {
      return { ...frame, enhancedOcrText: value }
    }

    return { ...frame, ocrText: value }
  })
}

function updateCursorEvent(
  events: CursorEvent[],
  id: string,
  patch: Partial<CursorEvent>,
): CursorEvent[] {
  return events.map((event) => (event.id === id ? { ...event, ...patch } : event))
}

function updateCursorCollection(
  report: BugReport,
  source: CursorSource,
  nextEvents: CursorEvent[],
): BugReport {
  if (source === 'enhanced') {
    return { ...report, enhancedCursorEvents: nextEvents }
  }

  return { ...report, browserCursorEvents: nextEvents }
}

export function TimelineScreen({
  frames, report, aiSettings, onChange, onReportChange, onNext,
}: TimelineScreenProps) {
  const [layout, setLayout] = useState<Layout>('list')
  const [previewFrameId, setPreviewFrameId] = useState<string | null>(null)
  const [frameAiBusy, setFrameAiBusy] = useState<Record<string, 'screenshot' | 'ocr' | null>>({})
  const [frameAiError, setFrameAiError] = useState<Record<string, string | null>>({})

  function setFrameBusy(frameId: string, action: 'screenshot' | 'ocr' | null) {
    setFrameAiBusy((prev) => ({ ...prev, [frameId]: action }))
  }

  function setFrameError(frameId: string, error: string | null) {
    setFrameAiError((prev) => ({ ...prev, [frameId]: error }))
  }

  async function handleAnalyzeScreenshot(frame: ExtractedFrame) {
    setFrameBusy(frame.id, 'screenshot')
    setFrameError(frame.id, null)
    try {
      const imageBase64 = imageUrlToBase64(frame.imageUrl)
      const result = await callAI({
        settings: aiSettings,
        systemPrompt:
          'You are analyzing a screenshot from a screen recording bug report. Describe concisely what is visible: the UI state, key elements, any notable interactions or errors shown.',
        userPrompt:
          'Analyze this screenshot and describe what is visible, including UI elements, text content, and any apparent user actions or error states.',
        imageBase64,
        imageMimeType: 'image/jpeg',
      })
      onChange(updateFrame(frames, frame.id, { aiScreenshotAnalysis: result.text }))
    } catch (error) {
      setFrameError(frame.id, error instanceof AIError ? error.message : 'AI analysis failed.')
    } finally {
      setFrameBusy(frame.id, null)
    }
  }

  async function handleFixOcr(frame: ExtractedFrame) {
    setFrameBusy(frame.id, 'ocr')
    setFrameError(frame.id, null)
    const ocr = getEffectiveFrameOcr(frame)
    try {
      const imageBase64 = imageUrlToBase64(frame.imageUrl)
      const result = await callAI({
        settings: aiSettings,
        systemPrompt:
          'You are correcting OCR text extracted from a screenshot. Return only the corrected text with no explanation or commentary.',
        userPrompt: `Current OCR text (may have errors): "${ocr.text ?? '(empty)'}"\n\nPlease correct this OCR text based on what is visible in the screenshot. Return only the corrected text.`,
        imageBase64,
        imageMimeType: 'image/jpeg',
      })
      onChange(updateFrame(frames, frame.id, { aiOcrCorrection: result.text }))
    } catch (error) {
      setFrameError(frame.id, error instanceof AIError ? error.message : 'AI OCR fix failed.')
    } finally {
      setFrameBusy(frame.id, null)
    }
  }

  const includedFrames = frames.filter((frame) => frame.included)
  const includedCount = includedFrames.length
  const totalReportTokens = includedFrames.reduce((sum, f) => sum + estimateFrameTokens(f), 0)
  const ocrCount = countFramesWithEffectiveOcr(includedFrames)
  const enhancedOcrCount = frames.filter(
    (frame) => frame.enhancedOcrText !== undefined || frame.enhancedOcrConfidence !== undefined,
  ).length
  const transcriptCount = report.transcriptSegments.length
  const enhancedCursorFrameCount = countFramesWithEnhancedCursorData(report)
  const previewFrame = previewFrameId
    ? frames.find((frame) => frame.id === previewFrameId) ?? null
    : null

  return (
    <main className="screen review-screen">
      <section className="review-main">
        <div className="review-head">
          <div className="review-title-block">
            <h2 className="review-title">Timeline review</h2>
            <div className="review-meta mono">
              <span><strong>{includedCount}</strong>/{frames.length} frames included</span>
              <span>· source: <strong>{report.videoName}</strong></span>
              <span>· <strong>{formatTokenCount(totalReportTokens)}</strong> tokens</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="layout-toggle">
              <button className={layout === 'list' ? 'active' : ''} onClick={() => setLayout('list')}>list</button>
              <button className={layout === 'grid' ? 'active' : ''} onClick={() => setLayout('grid')}>grid</button>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={onNext}
              disabled={includedCount === 0}
            >
              Continue to enhancements
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </div>
        </div>

        <div className="analysis-grid">
          <div className="analysis-card analysis-card-callout">
            <div className="analysis-card-head">
              <div>
                <h3>Review the captured evidence</h3>
                <p>
                  Keep the frames that prove the issue, add a short note where intent is unclear,
                  and fix OCR only when it changes the story. The next step can add local-engine
                  OCR, transcript, cursor, and HAR context.
                </p>
              </div>
              <div className="analysis-pill mono">ready for review</div>
            </div>
            <div className="analysis-stats mono">
              <span className="analysis-stat"><strong>{ocrCount}</strong> frames with OCR</span>
              <span className="analysis-stat"><strong>{report.browserCursorEvents.length}</strong> cursor events</span>
              <span className="analysis-stat"><strong>{enhancedOcrCount}</strong> enhanced OCR frames</span>
              <span className="analysis-stat"><strong>{report.enhancedCursorEvents.length}</strong> enhanced cursor events</span>
              <span className="analysis-stat">
                <strong>{transcriptCount}</strong>
                {transcriptCount > 0 ? ' transcript segments' : ' transcript segments yet'}
              </span>
              <span className="analysis-stat">{report.harSummary ? 'HAR summary ready' : 'HAR can be added next'}</span>
            </div>
          </div>
        </div>

        <div className={layout === 'grid' ? 'frame-grid' : 'frame-list'}>
          {frames.map((frame) => {
            const ocr = getEffectiveFrameOcr(frame)
            const cursorData = getPreferredCursorEventsForFrame(report, frame)
            const cursorEvents = cursorData.cursorEvents.filter(
              (event) => event.confidence >= CURSOR_CONFIDENCE_THRESHOLD,
            )
            const harEntries = getNearbyHarEntries(report, frame.timestampMs)
            const transcriptSegments = getNearbyTranscriptSegments(report, frame.timestampMs)
            const labels = frame.enhancedDetectedLabels ?? []
            const warnings = frame.enhancedWarnings ?? []

            const frameTokens = estimateFrameTokens(frame)
            const hasAiContent = !!(frame.aiScreenshotAnalysis || frame.aiOcrCorrection)
            const aiTokens = countTextTokens(
              (frame.aiScreenshotAnalysis ?? '') + (frame.aiOcrCorrection ?? ''),
            )

            return (
              <div key={frame.id} className={`frame-card ${frame.included ? 'selected' : 'excluded'}`}>
                <div className="frame-media">
                  <div
                    className="frame-thumb"
                    onClick={() => setPreviewFrameId(frame.id)}
                    title="Open image preview"
                  >
                    <img
                      src={frame.imageUrl}
                      alt={`Frame at ${formatTimestamp(frame.timestampMs)}`}
                    />
                    <span className="frame-thumb-time mono">{formatTimestamp(frame.timestampMs)}</span>
                    <span className="frame-thumb-diff mono">Δ {frame.differenceScore.toFixed(2)}</span>
                  </div>
                  <div className="frame-media-meta mono">
                    <span>{formatTokenCount(frameTokens)} tokens</span>
                    {hasAiContent && (
                      <span className="frame-token-ai">+{formatTokenCount(aiTokens)} AI</span>
                    )}
                  </div>
                  <div className="frame-actions">
                    <div
                      title={`Visual difference: ${(frame.differenceScore * 100).toFixed(0)}%`}
                      className="frame-diff"
                    >
                      <span className="mono">change</span>
                      <div className="diff-bar">
                        <div className="diff-bar-fill" style={{ width: `${Math.min(100, frame.differenceScore * 180)}%` }} />
                      </div>
                    </div>
                    <button
                      className={`switch frame-include-switch ${frame.included ? 'on' : ''}`}
                      onClick={() => onChange(updateFrame(frames, frame.id, { included: !frame.included }))}
                      role="switch"
                      aria-checked={frame.included}
                      title={frame.included ? 'Included — click to exclude' : 'Excluded — click to include'}
                      aria-label={frame.included ? 'Exclude frame' : 'Include frame'}
                    />
                    <button
                      className="btn btn-ghost btn-sm frame-remove"
                      onClick={() => onChange(frames.filter((candidate) => candidate.id !== frame.id))}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="frame-body">
                  <div className="frame-label-row">
                    {typeof ocr.confidence === 'number' ? (
                      <span className="frame-inline-pill">ocr {Math.round(ocr.confidence)}%</span>
                    ) : null}
                    {ocr.source === 'enhanced' ? (
                      <span className="frame-inline-pill frame-inline-pill-accent">enhanced ocr</span>
                    ) : null}
                    {cursorEvents.length > 0 ? (
                      <span className="frame-inline-pill">
                        {cursorEvents.length} {cursorData.source === 'enhanced' ? 'enhanced ' : ''}cursor event{cursorEvents.length === 1 ? '' : 's'}
                      </span>
                    ) : null}
                    {transcriptSegments.length > 0 ? (
                      <span className="frame-inline-pill frame-inline-pill-accent">
                        {transcriptSegments.length} transcript snippet{transcriptSegments.length === 1 ? '' : 's'}
                      </span>
                    ) : null}
                    {labels.length > 0 ? (
                      <span className="frame-inline-pill">{labels.length} ui label{labels.length === 1 ? '' : 's'}</span>
                    ) : null}
                    {harEntries.length > 0 ? (
                      <span className="frame-inline-pill">{harEntries.length} network issue{harEntries.length === 1 ? '' : 's'}</span>
                    ) : null}
                  </div>

                  <label className="frame-field">
                    <span className="frame-field-head">
                      <span>Reviewer note</span>
                      <span>Exported with this frame</span>
                    </span>
                    <textarea
                      className="frame-note"
                      placeholder="Explain the action, visible failure, or why this moment matters."
                      value={frame.note ?? ''}
                      onChange={(event) => onChange(updateFrame(frames, frame.id, { note: event.target.value }))}
                    />
                  </label>

                  <div className="frame-subsection">
                    <div className="frame-subsection-head">
                      <span className="mono">detected text</span>
                      <span>
                        {ocr.source === 'enhanced'
                          ? 'Enhanced local OCR is active. Edit only the parts that are wrong.'
                          : 'Browser OCR is active. Step 4 can replace it with enhanced local OCR.'}
                      </span>
                    </div>
                    <textarea
                      className="frame-note frame-note-secondary"
                      placeholder="No visible text detected yet, or add the important text manually."
                      value={ocr.text ?? ''}
                      onChange={(event) => onChange(updateFrameOcrText(frames, frame.id, event.target.value, ocr.source))}
                    />
                  </div>

                  <div className="frame-subsection">
                    <div className="frame-subsection-head">
                      <span className="mono">optional AI help</span>
                      <span>Use this when the frame needs a clearer description or OCR cleanup.</span>
                    </div>
                    <div className="analysis-actions" style={{ flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-ai btn-sm"
                        onClick={() => handleAnalyzeScreenshot(frame)}
                        disabled={frameAiBusy[frame.id] != null}
                      >
                        <ScanSearch size={14} strokeWidth={2.2} />
                        {frameAiBusy[frame.id] === 'screenshot' ? 'Analyzing…' : 'Analyze Screenshot'}
                      </button>
                      <button
                        className="btn btn-ai btn-sm"
                        onClick={() => handleFixOcr(frame)}
                        disabled={frameAiBusy[frame.id] != null}
                      >
                        <WandSparkles size={14} strokeWidth={2.2} />
                        {frameAiBusy[frame.id] === 'ocr' ? 'Fixing…' : 'Fix OCR with AI'}
                      </button>
                    </div>
                    {frameAiError[frame.id] && (
                      <div className="analysis-error">{frameAiError[frame.id]}</div>
                    )}
                    {frame.aiScreenshotAnalysis && (
                      <div className="frame-related-list">
                        <div className="frame-related-item">{frame.aiScreenshotAnalysis}</div>
                      </div>
                    )}
                    {frame.aiOcrCorrection && (
                      <div className="frame-related-list">
                        <div className="frame-related-item">
                          <strong>AI OCR correction:</strong> {frame.aiOcrCorrection}
                        </div>
                      </div>
                    )}
                  </div>

                  {transcriptSegments.length > 0 ? (
                    <div className="frame-subsection">
                      <div className="frame-subsection-head">
                        <span className="mono">audio transcript</span>
                        <span>English transcript snippets that overlap or sit near this frame.</span>
                      </div>
                      <div className="frame-related-list">
                        {transcriptSegments.map((segment) => (
                          <div key={segment.id} className="frame-related-item">
                            <strong className="mono">{formatTimestamp(segment.startMs)}</strong>
                            {' · '}
                            {segment.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {labels.length > 0 || typeof frame.enhancedQualityScore === 'number' || warnings.length > 0 ? (
                    <div className="frame-subsection">
                      <div className="frame-subsection-head">
                        <span className="mono">enhanced analysis</span>
                        <span>Extra labels and quality notes from the optional local engine.</span>
                      </div>
                      <div className="frame-related-list">
                        {labels.length > 0 ? (
                          <div className="frame-related-item">
                            <strong>Detected labels:</strong> {labels.join(', ')}
                          </div>
                        ) : null}
                        {typeof frame.enhancedQualityScore === 'number' ? (
                          <div className="frame-related-item">
                            <strong>Frame quality:</strong> {Math.round(frame.enhancedQualityScore * 100)}%
                          </div>
                        ) : null}
                        {warnings.map((warning) => (
                          <div key={warning} className="frame-related-item">
                            <strong>Warning:</strong> {warning}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {cursorData.source !== 'none' ? (
                    <div className="frame-subsection">
                      <div className="frame-subsection-head">
                        <span className="mono">cursor / click events</span>
                        <span>
                          {cursorData.source === 'enhanced'
                            ? 'Editable enhanced detections from the optional local engine.'
                            : 'Editable browser detections captured during step 2.'}
                        </span>
                      </div>
                      {cursorEvents.length > 0 ? (
                        <div className="cursor-event-list">
                          {cursorEvents.map((event) => (
                            <div key={event.id} className="cursor-event-row">
                              <CursorEventBadge event={event} />
                              <select
                                className="s2i-select"
                                value={event.type}
                                onChange={(changeEvent) =>
                                  onReportChange(
                                    updateCursorCollection(
                                      report,
                                      cursorData.source,
                                      updateCursorEvent(
                                        cursorData.source === 'enhanced'
                                          ? report.enhancedCursorEvents
                                          : report.browserCursorEvents,
                                        event.id,
                                        { type: changeEvent.target.value as CursorEvent['type'] },
                                      ),
                                    ),
                                  )}
                              >
                                <option value="possible_click">Possible click</option>
                                <option value="possible_cursor_move">Possible cursor movement</option>
                              </select>
                              <input
                                className="s2i-input"
                                value={event.note ?? ''}
                                placeholder="Optional event note"
                                onChange={(changeEvent) =>
                                  onReportChange(
                                    updateCursorCollection(
                                      report,
                                      cursorData.source,
                                      updateCursorEvent(
                                        cursorData.source === 'enhanced'
                                          ? report.enhancedCursorEvents
                                          : report.browserCursorEvents,
                                        event.id,
                                        { note: changeEvent.target.value },
                                      ),
                                    ),
                                  )}
                              />
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() =>
                                  onReportChange(
                                    updateCursorCollection(
                                      report,
                                      cursorData.source,
                                      (cursorData.source === 'enhanced'
                                        ? report.enhancedCursorEvents
                                        : report.browserCursorEvents).filter((candidate) => candidate.id !== event.id),
                                    ),
                                  )}
                              >
                                remove
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="analysis-empty">
                          No {cursorData.source === 'enhanced' ? 'enhanced' : 'browser'} cursor
                          events are currently active for this frame.
                        </div>
                      )}
                    </div>
                  ) : null}

                  {harEntries.length > 0 ? (
                    <div className="frame-subsection">
                      <div className="frame-subsection-head">
                        <span className="mono">network issues</span>
                        <span>Suspicious HAR entries close to this frame.</span>
                      </div>
                      <div className="frame-related-list">
                        {harEntries.map((entry) => (
                          <div key={entry.id} className="frame-related-item">
                            {formatHarEntryLabel(entry)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

              </div>
            )
          })}
        </div>
      </section>

      <aside className="review-side">
        <div className="side-section">
          <h4>Report title</h4>
          <input
            className="s2i-input"
            value={report.title}
            placeholder="Brief issue title…"
            onChange={(event) => onReportChange({ ...report, title: event.target.value })}
          />
        </div>
        <div className="side-section">
          <h4>Summary</h4>
          <textarea
            className="s2i-textarea"
            value={report.summary}
            placeholder="Two or three sentences…"
            onChange={(event) => onReportChange({ ...report, summary: event.target.value })}
          />
        </div>
        <div className="side-section">
          <h4>Observed behavior</h4>
          <textarea
            className="s2i-textarea"
            value={report.observedBehavior}
            placeholder="What actually happens…"
            onChange={(event) => onReportChange({ ...report, observedBehavior: event.target.value })}
          />
        </div>
        <div className="side-section">
          <h4>Expected behavior</h4>
          <textarea
            className="s2i-textarea"
            value={report.expectedBehavior}
            placeholder="What should happen…"
            onChange={(event) => onReportChange({ ...report, expectedBehavior: event.target.value })}
          />
        </div>
        <div className="side-section">
          <h4>Analysis captured</h4>
          <div className="repro-list mono">
            <div>{ocrCount} included frames with active OCR</div>
            <div>{report.browserCursorEvents.length} browser cursor events</div>
            <div>{report.enhancedCursorEvents.length} enhanced cursor events</div>
            <div>{enhancedCursorFrameCount} frames with enhanced cursor analysis</div>
            <div>{enhancedOcrCount} frames with enhanced OCR</div>
            <div>{transcriptCount} transcript segments</div>
            <div>{report.harSummary ? `${report.harSummary.errorCount} failed HAR requests` : 'No HAR summary'}</div>
          </div>
        </div>
        <div className="side-section">
          <h4>Reproduction steps</h4>
          <div className="repro-list">
            {report.reproductionSteps.map((step, index) => (
              <div key={index} className="repro-item">
                <span className="repro-num mono">{index + 1}.</span>
                <input
                  className="repro-input"
                  value={step}
                  placeholder={`Step ${index + 1}…`}
                  onChange={(event) => {
                    const steps = [...report.reproductionSteps]
                    steps[index] = event.target.value
                    onReportChange({ ...report, reproductionSteps: steps })
                  }}
                />
                <button
                  className="repro-del"
                  onClick={() =>
                    onReportChange({
                      ...report,
                      reproductionSteps: report.reproductionSteps.filter((_, candidate) => candidate !== index),
                    })}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              className="repro-add"
              onClick={() =>
                onReportChange({ ...report, reproductionSteps: [...report.reproductionSteps, ''] })
              }
            >
              + add step
            </button>
          </div>
        </div>
      </aside>

      {previewFrame ? (
        <div
          className="frame-preview-backdrop"
          role="presentation"
          onClick={() => setPreviewFrameId(null)}
        >
          <div
            className="frame-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Frame preview at ${formatTimestamp(previewFrame.timestampMs)}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="frame-preview-head">
              <div>
                <div className="frame-preview-title">Frame preview</div>
                <div className="frame-preview-meta mono">
                  {formatTimestamp(previewFrame.timestampMs)} · Δ {previewFrame.differenceScore.toFixed(2)}
                </div>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setPreviewFrameId(null)}
                aria-label="Close frame preview"
              >
                <X size={16} />
              </button>
            </div>
            <div className="frame-preview-image-wrap">
              <img
                src={previewFrame.imageUrl}
                alt={`Frame at ${formatTimestamp(previewFrame.timestampMs)}`}
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
