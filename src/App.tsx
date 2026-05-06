import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { AppBar } from '@/components/ui/AppBar'
import { HintBar } from '@/components/ui/HintBar'
import { Toast } from '@/components/ui/Toast'
import { AISettingsModal } from '@/components/ui/AISettingsModal'
import { UploadScreen } from '@/components/upload/UploadScreen'
import { ProcessingScreen } from '@/components/processing/ProcessingScreen'
import { TimelineScreen } from '@/components/timeline/TimelineScreen'
import { EnhancementsScreen } from '@/components/enhancements/EnhancementsScreen'
import { ExportScreen } from '@/components/export/ExportScreen'
import { waitForLocalEngineHealth } from '@/lib/runtime/desktopLocalEngine'
import { resolveRuntimeCapabilities, type RuntimeCapabilities } from '@/lib/runtime/capabilities'
import type { AppStep, BugReport, CursorEvent, ExtractedFrame } from '@/types/report'
import { captureEnvironmentMetadata } from '@/lib/report/captureEnvironment'
import type { LocalEngineStatus } from '@/lib/localEngine/types'
import { startBundledLocalEngine } from '@/lib/runtime/desktopLocalEngine'
import { useAiSettings } from '@/hooks/useAiSettings'

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

function makeEmptyReport(file: File, localEngineStatus: LocalEngineStatus): BugReport {
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
    localEngineStatus,
    enhancementWarnings: [],
  }
}

interface ProcessingResult {
  cursorEvents: CursorEvent[]
  frames: ExtractedFrame[]
}

export default function App() {
  const [runtimeCapabilities] = useState<RuntimeCapabilities>(() => resolveRuntimeCapabilities())
  const { settings: aiSettings, saveSettings: saveAiSettings } = useAiSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [step, setStep]       = useState<AppStep>('upload')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [frames, setFrames]   = useState<ExtractedFrame[]>([])
  const [report, setReport]   = useState<BugReport | null>(null)
  const [toast, setToast]     = useState<string | null>(null)
  const [desktopEngineStatus, setDesktopEngineStatus] = useState<LocalEngineStatus>(
    runtimeCapabilities.supportsBundledLocalEngine ? { state: 'starting' } : { state: 'idle' },
  )

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

  const syncDesktopEngineStatus = useCallback((status: LocalEngineStatus) => {
    setDesktopEngineStatus(status)
    setReport((current) => current ? { ...current, localEngineStatus: status } : current)
  }, [])

  useEffect(() => {
    if (!runtimeCapabilities.supportsBundledLocalEngine) return

    let cancelled = false

    async function bootDesktopEngine() {
      syncDesktopEngineStatus({ state: 'starting' })

      try {
        const launchResult = await startBundledLocalEngine(runtimeCapabilities)
        if (cancelled) return

        if (launchResult.status === 'port_conflict') {
          syncDesktopEngineStatus({
            state: 'port_conflict',
            lastError:
              launchResult.message ??
              'Another process is already using the local engine port (127.0.0.1:8765).',
            lastCheckedAt: new Date().toISOString(),
          })
          return
        }

        const health = await waitForLocalEngineHealth()
        if (cancelled) return

        syncDesktopEngineStatus({
          state: 'connected',
          health,
          lastCheckedAt: new Date().toISOString(),
        })
      } catch (error) {
        if (cancelled) return

        syncDesktopEngineStatus({
          state: 'error',
          lastError:
            error instanceof Error
              ? error.message
              : 'The bundled local engine could not be started.',
          lastCheckedAt: new Date().toISOString(),
        })
      }
    }

    void bootDesktopEngine()

    return () => {
      cancelled = true
    }
  }, [runtimeCapabilities, syncDesktopEngineStatus])

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
    setReport(makeEmptyReport(file, desktopEngineStatus))
    setStep('processing')
  }, [desktopEngineStatus])

  const handleProcessingComplete = useCallback(({ frames: processedFrames, cursorEvents }: ProcessingResult) => {
    setFrames(processedFrames)
    setReport((prev) =>
      prev ? {
        ...prev,
        browserCursorEvents: cursorEvents,
        enhancedCursorEvents: [],
        transcriptSegments: [],
        localEngineStatus: desktopEngineStatus,
        enhancementWarnings: [],
        frames: processedFrames,
        videoDurationMs:
          processedFrames.length > 0
            ? processedFrames[processedFrames.length - 1].timestampMs
            : 0,
      } : prev,
    )
    setStep('timeline')
  }, [desktopEngineStatus])

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
      <AppBar
        step={STEP_INDEX[step]}
        onJump={jumpTo}
        runtimeCapabilities={runtimeCapabilities}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {step === 'upload' && (
        <UploadScreen
          onFileSelected={handleFileSelected}
          runtimeCapabilities={runtimeCapabilities}
        />
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
          aiSettings={aiSettings}
          onChange={handleFramesChange}
          onReportChange={handleReportChange}
          onNext={() => setStep('enhancements')}
        />
      )}
      {step === 'enhancements' && report && (
        <EnhancementsScreen
          report={report}
          videoFile={videoFile}
          runtimeCapabilities={runtimeCapabilities}
          aiSettings={aiSettings}
          onBack={() => setStep('timeline')}
          onNext={() => setStep('export')}
          onReportChange={handleReportChange}
        />
      )}
      {step === 'export' && report && (
        <ExportScreen
          report={report}
          aiSettings={aiSettings}
          onChange={handleReportChange}
          onBack={() => setStep('enhancements')}
          onToast={showToast}
        />
      )}

      <HintBar items={HINTS[step]} runtimeCapabilities={runtimeCapabilities} />

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

      <AISettingsModal
        open={settingsOpen}
        initialSettings={aiSettings}
        onSave={saveAiSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  )
}
