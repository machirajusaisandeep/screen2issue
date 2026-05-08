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


const STEP_INDEX: Record<AppStep, number> = {
  upload: 0, processing: 1, timeline: 2, enhancements: 3, export: 4,
}
const STEP_KEYS: AppStep[] = ['upload', 'processing', 'timeline', 'enhancements', 'export']

const HINTS: Record<AppStep, { k: string; l: string }[]> = {
  upload:       [],
  processing:   [],
  timeline:     [{ k: 'enter', l: 'continue to enhancements' }],
  enhancements: [{ k: 'enter', l: 'continue to export' }],
  export:       [{ k: '⌘C', l: 'copy AI prompt' }],
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

      <HintBar items={HINTS[step]} />

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
