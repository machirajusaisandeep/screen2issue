import { lazy, Suspense, useCallback, useEffect, useEffectEvent, useState } from 'react'
import { AppBar } from '@/components/ui/AppBar'
import { HintBar } from '@/components/ui/HintBar'
import { Toast } from '@/components/ui/Toast'
import { AISettingsModal } from '@/components/ui/AISettingsModal'
import { UploadScreen } from '@/components/upload/UploadScreen'
import { PrivacyStorageModal } from '@/components/ui/PrivacyStorageModal'
import { SmallScreenGuard } from '@/components/ui/SmallScreenGuard'
import { waitForLocalEngineHealth } from '@/lib/runtime/desktopLocalEngine'
import { resolveRuntimeCapabilities, type RuntimeCapabilities } from '@/lib/runtime/capabilities'
import type { AppStep, BugReport, CursorEvent, ExtractedFrame } from '@/types/report'
import { captureEnvironmentMetadata } from '@/lib/report/captureEnvironment'
import type { LocalEngineStatus } from '@/lib/localEngine/types'
import { startBundledLocalEngine } from '@/lib/runtime/desktopLocalEngine'
import { useAiSettings } from '@/hooks/useAiSettings'
import { useTheme } from '@/hooks/useTheme'
import { createSampleReport } from '@/lib/project/sampleProject'
import {
  clearProjectDraft,
  estimateProjectStorage,
  getDraftSummary,
  loadProjectDraft,
  ProjectStorageError,
  saveProjectDraft,
  type DraftSummary,
} from '@/lib/project/storage'

const ProcessingScreen = lazy(() => import('@/components/processing/ProcessingScreen').then((module) => ({ default: module.ProcessingScreen })))
const TimelineScreen = lazy(() => import('@/components/timeline/TimelineScreen').then((module) => ({ default: module.TimelineScreen })))
const EnhancementsScreen = lazy(() => import('@/components/enhancements/EnhancementsScreen').then((module) => ({ default: module.EnhancementsScreen })))
const ExportScreen = lazy(() => import('@/components/export/ExportScreen').then((module) => ({ default: module.ExportScreen })))


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
  const theme = useTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [step, setStep]       = useState<AppStep>('upload')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [frames, setFrames]   = useState<ExtractedFrame[]>([])
  const [report, setReport]   = useState<BugReport | null>(null)
  const [toast, setToast]     = useState<string | null>(null)
  const [draftSummary, setDraftSummary] = useState<DraftSummary | null>(null)
  const [projectId, setProjectId] = useState<string | undefined>()
  const [storageLabel, setStorageLabel] = useState<string | null>(null)
  const [desktopEngineStatus, setDesktopEngineStatus] = useState<LocalEngineStatus>(
    runtimeCapabilities.supportsBundledLocalEngine ? { state: 'starting' } : { state: 'idle' },
  )

  const syncDesktopEngineStatus = useCallback((status: LocalEngineStatus) => {
    setDesktopEngineStatus(status)
    setReport((current) => current ? { ...current, localEngineStatus: status } : current)
  }, [])

  const refreshDraftMetadata = useCallback(async () => {
    try {
      setDraftSummary(await getDraftSummary())
    } catch (error) {
      if (error instanceof ProjectStorageError && error.kind === 'corrupt') {
        setToast('Saved project needs to be cleared before it can be resumed')
      }
    }
    const estimate = await estimateProjectStorage()
    if (estimate) setStorageLabel(formatStorage(estimate.usage, estimate.quota))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshDraftMetadata(), 0)
    return () => window.clearTimeout(timer)
  }, [refreshDraftMetadata])

  useEffect(() => {
    if (!report || step === 'upload' || step === 'processing') return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void saveProjectDraft(report, step, projectId)
        .then((document) => {
          if (cancelled) return
          setProjectId(document.projectId)
          setDraftSummary({
            projectId: document.projectId,
            title: document.report.title,
            videoName: document.report.videoName,
            updatedAt: document.updatedAt,
            frameCount: document.report.frames.length,
            currentStep: document.currentStep,
          })
        })
        .catch((error: unknown) => {
          if (!cancelled) setToast(error instanceof Error ? error.message : 'Project autosave failed')
        })
    }, 900)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [projectId, report, step])

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
    void clearProjectDraft().then(() => refreshDraftMetadata())
    setProjectId(undefined)
    setVideoFile(file)
    setReport(makeEmptyReport(file, desktopEngineStatus))
    setStep('processing')
  }, [desktopEngineStatus, refreshDraftMetadata])

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

  const handleProcessingError = useCallback((message: string) => {
    setToast(message)
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

  const handleResumeDraft = useCallback(async () => {
    try {
      const restored = await loadProjectDraft()
      if (!restored) return
      setProjectId(restored.document.projectId)
      setReport(restored.report)
      setFrames(restored.report.frames)
      setVideoFile(null)
      setStep(restored.document.currentStep)
      setToast('Saved project restored')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Saved project could not be restored')
    }
  }, [])

  const handleClearDraft = useCallback(async () => {
    await clearProjectDraft()
    setDraftSummary(null)
    setProjectId(undefined)
    await refreshDraftMetadata()
    setToast('Saved project cleared')
  }, [refreshDraftMetadata])

  const handleOpenSample = useCallback(() => {
    const sample = createSampleReport(desktopEngineStatus)
    setProjectId(undefined)
    setVideoFile(null)
    setReport(sample)
    setFrames(sample.frames)
    setStep('timeline')
    setToast('Sanitized sample project opened')
  }, [desktopEngineStatus])

  return (
    <>
      <AppBar
        step={STEP_INDEX[step]}
        onJump={jumpTo}
        runtimeCapabilities={runtimeCapabilities}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenPrivacy={() => setPrivacyOpen(true)}
        themePreference={theme.preference}
        onCycleTheme={theme.cyclePreference}
      />

      <Suspense fallback={<div className="screen-loading" role="status">Loading workspace…</div>}>
      {step === 'upload' && (
        <UploadScreen
          onFileSelected={handleFileSelected}
          runtimeCapabilities={runtimeCapabilities}
          draftSummary={draftSummary}
          storageLabel={storageLabel}
          onResumeDraft={() => void handleResumeDraft()}
          onClearDraft={() => void handleClearDraft()}
          onOpenSample={handleOpenSample}
        />
      )}
      {step === 'processing' && videoFile && (
        <ProcessingScreen
          file={videoFile}
          runtimeCapabilities={runtimeCapabilities}
          localEngineStatus={desktopEngineStatus}
          onComplete={handleProcessingComplete}
          onError={handleProcessingError}
          onCancel={() => setStep('upload')}
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
      </Suspense>

      <HintBar items={HINTS[step]} />

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {settingsOpen ? (
        <AISettingsModal
          open
          initialSettings={aiSettings}
          onSave={saveAiSettings}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      <PrivacyStorageModal
        open={privacyOpen}
        storageLabel={storageLabel}
        hasDraft={draftSummary != null}
        onClearDraft={() => void handleClearDraft()}
        onClose={() => setPrivacyOpen(false)}
        runtime={runtimeCapabilities}
        localEngineStatus={desktopEngineStatus}
      />
      <SmallScreenGuard />
    </>
  )
}

function formatStorage(usage: number, quota: number): string {
  const used = formatBytes(usage)
  const total = formatBytes(quota)
  return quota > 0 ? `${used} used of ${total}` : `${used} used`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}
