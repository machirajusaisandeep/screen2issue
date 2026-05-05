import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { AppBar } from '@/components/ui/AppBar'
import { HintBar } from '@/components/ui/HintBar'
import { Toast } from '@/components/ui/Toast'
import { UploadScreen } from '@/components/upload/UploadScreen'
import { ProcessingScreen } from '@/components/processing/ProcessingScreen'
import { TimelineScreen } from '@/components/timeline/TimelineScreen'
import { EnhancementsScreen } from '@/components/enhancements/EnhancementsScreen'
import { ExportScreen } from '@/components/export/ExportScreen'
import type { AppStep, BugReport, CursorEvent, ExtractedFrame } from '@/types/report'
import { captureEnvironmentMetadata } from '@/lib/report/captureEnvironment'

type Theme = 'dark' | 'light'
type Accent = 'amber' | 'cyan' | 'lime'
type Density = 'comfy' | 'compact'

const STEP_INDEX: Record<AppStep, number> = {
  upload: 0, processing: 1, timeline: 2, enhancements: 3, export: 4,
}
const STEP_KEYS: AppStep[] = ['upload', 'processing', 'timeline', 'enhancements', 'export']

const HINTS: Record<AppStep, { k: string; l: string }[]> = {
  upload:       [{ k: '1–5', l: 'jump to screen' }],
  processing:   [{ k: 'esc', l: 'cancel' }],
  timeline:     [{ k: 'enter', l: 'continue to enhancements' }, { k: '1–5', l: 'jump' }],
  enhancements: [{ k: 'enter', l: 'continue to export' }, { k: '1–5', l: 'jump' }],
  export:       [{ k: '⌘C', l: 'copy AI prompt' }, { k: '1–5', l: 'jump' }],
}

function makeEmptyReport(file: File): BugReport {
  return {
    title: '',
    summary: '',
    videoName: file.name,
    videoType: file.type || 'unknown',
    videoSizeBytes: file.size,
    videoDurationMs: 0,
    createdAt: new Date().toISOString(),
    environment: captureEnvironmentMetadata(),
    frames: [],
    observedBehavior: '',
    expectedBehavior: '',
    reproductionSteps: [''],
    browserCursorEvents: [],
    enhancedCursorEvents: [],
    transcriptSegments: [],
    localEngineStatus: { state: 'idle' },
    enhancementWarnings: [],
  }
}

interface ProcessingResult {
  cursorEvents: CursorEvent[]
  frames: ExtractedFrame[]
}

export default function App() {
  const [step, setStep]       = useState<AppStep>('upload')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [frames, setFrames]   = useState<ExtractedFrame[]>([])
  const [report, setReport]   = useState<BugReport | null>(null)
  const [toast, setToast]     = useState<string | null>(null)

  // Theme / accent / density — driven by data-* attrs on <html>
  const [theme, setTheme]     = useState<Theme>('dark')
  const [accent, setAccent]   = useState<Accent>('amber')
  const [density, setDensity] = useState<Density>('comfy')
  const [tweaksOpen, setTweaksOpen] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent)
  }, [accent])
  useEffect(() => {
    document.documentElement.setAttribute('data-density', density)
  }, [density])

  function jumpTo(idx: number) {
    const target = STEP_KEYS[idx]
    if (!target) return
    if (target === 'processing') return
    if ((target === 'timeline' || target === 'enhancements' || target === 'export') && frames.length === 0) return
    if (target === 'export' && !report) return
    setStep(target)
  }

  const handleScreenJumpKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    const index = Number.parseInt(event.key, 10)
    if (index >= 1 && index <= 5) {
      jumpTo(index - 1)
    }
  })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => handleScreenJumpKey(event)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleFileSelected = useCallback((file: File) => {
    setVideoFile(file)
    setReport(makeEmptyReport(file))
    setStep('processing')
  }, [])

  const handleProcessingComplete = useCallback(({ frames: processedFrames, cursorEvents }: ProcessingResult) => {
    setFrames(processedFrames)
    setReport((prev) =>
      prev ? {
        ...prev,
        browserCursorEvents: cursorEvents,
        enhancedCursorEvents: [],
        transcriptSegments: [],
        localEngineStatus: { state: 'idle' },
        enhancementWarnings: [],
        frames: processedFrames,
        videoDurationMs:
          processedFrames.length > 0
            ? processedFrames[processedFrames.length - 1].timestampMs
            : 0,
      } : prev,
    )
    setStep('timeline')
  }, [])

  const handleProcessingError = useCallback(() => {
    setTimeout(() => setStep('upload'), 4000)
  }, [])

  const handleFramesChange = useCallback((updated: ExtractedFrame[]) => {
    setFrames(updated)
    setReport((prev) => prev ? { ...prev, frames: updated } : prev)
  }, [])

  const handleReportChange = useCallback((updated: BugReport) => {
    setReport(updated)
    setFrames(updated.frames)
  }, [])

  const showToast = useCallback((msg: string) => setToast(msg), [])

  return (
    <>
      <AppBar step={STEP_INDEX[step]} onJump={jumpTo} />

      {step === 'upload' && (
        <UploadScreen onFileSelected={handleFileSelected} />
      )}
      {step === 'processing' && videoFile && (
        <ProcessingScreen
          file={videoFile}
          onComplete={handleProcessingComplete}
          onError={handleProcessingError}
        />
      )}
      {step === 'timeline' && report && (
        <TimelineScreen
          frames={frames}
          report={report}
          onChange={handleFramesChange}
          onReportChange={handleReportChange}
          onNext={() => setStep('enhancements')}
        />
      )}
      {step === 'enhancements' && report && (
        <EnhancementsScreen
          report={report}
          videoFile={videoFile}
          onBack={() => setStep('timeline')}
          onNext={() => setStep('export')}
          onReportChange={handleReportChange}
        />
      )}
      {step === 'export' && report && (
        <ExportScreen
          report={report}
          onChange={handleReportChange}
          onBack={() => setStep('enhancements')}
          onToast={showToast}
        />
      )}

      <HintBar items={HINTS[step]} />

      {/* Tweaks panel */}
      <button
        onClick={() => setTweaksOpen((o) => !o)}
        style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 200,
          background: 'var(--bg-3)', border: '1px solid var(--border)',
          color: 'var(--fg-3)', borderRadius: 8, padding: '6px 10px',
          fontSize: 11, fontFamily: 'var(--font-mono)',
        }}
      >
        {tweaksOpen ? '✕ tweaks' : '⚙ tweaks'}
      </button>

      {tweaksOpen && (
        <div className="tweaks-panel">
          <div className="tweaks-header">Tweaks</div>
          <div className="tweaks-body">
            <div className="tweaks-row">
              <span className="tweaks-label">Theme</span>
              <div className="tweaks-seg">
                {(['dark', 'light'] as Theme[]).map((t) => (
                  <button key={t} className={theme === t ? 'active' : ''} onClick={() => setTheme(t)}>{t}</button>
                ))}
              </div>
            </div>
            <div className="tweaks-row">
              <span className="tweaks-label">Accent</span>
              <div className="tweaks-seg">
                {(['amber', 'cyan', 'lime'] as Accent[]).map((a) => (
                  <button key={a} className={accent === a ? 'active' : ''} onClick={() => setAccent(a)}>{a}</button>
                ))}
              </div>
            </div>
            <div className="tweaks-row">
              <span className="tweaks-label">Density</span>
              <div className="tweaks-seg">
                {(['comfy', 'compact'] as Density[]).map((d) => (
                  <button key={d} className={density === d ? 'active' : ''} onClick={() => setDensity(d)}>{d}</button>
                ))}
              </div>
            </div>
            <div className="tweaks-row">
              <span className="tweaks-label">Jump to screen</span>
              <div className="tweaks-seg">
                {['1 Upload', '3 Review', '4 Enhance', '5 Export'].map((label, i) => {
                  const idx = i === 0 ? 0 : i === 1 ? 2 : i === 2 ? 3 : 4
                  return (
                    <button key={label} onClick={() => { jumpTo(idx); setTweaksOpen(false) }}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  )
}
