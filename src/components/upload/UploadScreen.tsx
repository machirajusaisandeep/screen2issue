import { useCallback, useEffect, useRef, useState } from 'react'
import type { RuntimeCapabilities } from '@/lib/runtime/capabilities'
import type { DraftSummary } from '@/lib/project/storage'
import { ProjectStartOptions } from '@/components/project/ProjectStartOptions'
import { validateVideoFile } from '@/lib/video/validateVideoFile'

interface UploadScreenProps {
  onFileSelected: (file: File) => void
  runtimeCapabilities: RuntimeCapabilities
  draftSummary: DraftSummary | null
  storageLabel: string | null
  onResumeDraft: () => void
  onClearDraft: () => void
  onOpenSample: () => void
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const MAX_VIDEO_BYTES = 750 * 1024 * 1024

export function UploadScreen({
  onFileSelected,
  runtimeCapabilities,
  draftSummary,
  storageLabel,
  onResumeDraft,
  onClearDraft,
  onOpenSample,
}: UploadScreenProps) {
  const [over, setOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installState, setInstallState] = useState<'accepted' | 'dismissed' | 'installing' | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (runtimeCapabilities.surface !== 'web') return

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setInstallState(null)
    }

    function handleInstalled() {
      setInstallPrompt(null)
      setInstallState('accepted')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [runtimeCapabilities.surface])

  const handleFile = useCallback(
    async (file: File) => {
      const validation = await validateVideoFile(file)
      if (!validation.valid) {
        setError(validation.message)
        return
      }
      if (file.size > MAX_VIDEO_BYTES) {
        setError(
          `This recording is ${(file.size / 1024 / 1024).toFixed(0)} MB. ` +
            'For reliable in-browser processing, keep uploads under ~750 MB.',
        )
        return
      }
      setError(null)
      onFileSelected(file)
    },
    [onFileSelected],
  )

  async function handleInstallPwa() {
    if (!installPrompt) return

    setInstallState('installing')
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallPrompt(null)
    setInstallState(choice.outcome)
  }

  return (
    <main className="screen upload-screen">
      <div className="upload-stack">
        <div className="upload-hero">
          <h1 className="upload-title">
            Turn a screen recording into a clear bug report.
          </h1>
          <p className="upload-tagline">
            Drop in a recording. Screen2Issue finds the key moments and prepares the evidence locally.
          </p>
        </div>

        {runtimeCapabilities.surface === 'web' && (installPrompt || installState === 'accepted') ? (
          <div className="install-callout">
            <div className="install-callout-copy">
              <div className="install-callout-title">Install the browser-only PWA</div>
              <div className="install-callout-text">
                Keep Screen2Issue handy on this device with the offline-friendly hosted build.
              </div>
            </div>
            {installPrompt ? (
              <button className="btn btn-sm" onClick={() => void handleInstallPwa()}>
                {installState === 'installing' ? 'Opening prompt…' : 'Install PWA'}
              </button>
            ) : (
              <div className="install-callout-state mono">installed</div>
            )}
          </div>
        ) : null}

        <div
          className={`dropzone${over ? ' over' : ''}`}
          role="button"
          tabIndex={0}
          aria-describedby="dropzone-formats dropzone-privacy"
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            const f = e.dataTransfer.files[0]
            if (f) void handleFile(f)
          }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              inputRef.current?.click()
            }
          }}
        >
          <div className="dropzone-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="14" height="12" rx="2" />
              <path d="M17 10l4-2v8l-4-2" />
            </svg>
          </div>
          <div>
            <div className="dropzone-headline">
              Drop a recording here, or <strong>choose a file</strong>
            </div>
            <div id="dropzone-formats" className="dropzone-meta">.mp4 · .webm · .mov · up to ~750 MB</div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
              e.currentTarget.value = ''
            }}
          />
        </div>

        {error && <div className="upload-error" role="alert">{error}</div>}

        <div id="dropzone-privacy" className="upload-trust mono">
          <span>{runtimeCapabilities.surface === 'desktop' ? 'STAYS ON THIS MAC' : 'PROCESSED ON THIS DEVICE'}</span>
          <span aria-hidden="true">·</span>
          <span>AI OPTIONAL</span>
        </div>

        <ProjectStartOptions
          draft={draftSummary}
          storageLabel={storageLabel}
          onResume={onResumeDraft}
          onClearDraft={onClearDraft}
          onOpenSample={onOpenSample}
        />
      </div>
    </main>
  )
}
