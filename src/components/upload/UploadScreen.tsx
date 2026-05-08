import { useCallback, useEffect, useRef, useState } from 'react'
import type { RuntimeCapabilities } from '@/lib/runtime/capabilities'

interface UploadScreenProps {
  onFileSelected: (file: File) => void
  runtimeCapabilities: RuntimeCapabilities
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const MAX_VIDEO_BYTES = 750 * 1024 * 1024

export function UploadScreen({ onFileSelected, runtimeCapabilities }: UploadScreenProps) {
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

  const surfaceFootnotes =
    runtimeCapabilities.surface === 'desktop'
      ? [
          'No cloud upload — processing stays on this Mac',
          'Step 4 can use the bundled local engine',
          'Export a shareable ZIP, Markdown, or JSON bundle',
        ]
      : runtimeCapabilities.surface === 'pwa'
        ? [
            'Installed browser app',
            'No account, no telemetry',
            'Works offline after first load',
          ]
        : [
            'No upload — frames extracted in your browser',
            'No account, no telemetry',
            'Installable as a PWA',
          ]

  const privacyNote =
    runtimeCapabilities.surface === 'desktop'
      ? 'Browser processing and optional enhanced local-engine steps both stay on this machine. Videos, screenshots, transcripts, and HAR files are not sent to external services.'
      : 'All processing happens locally in your browser. Videos, screenshots, OCR text, and HAR files are not uploaded anywhere.'

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('video/') && !/\.(mp4|webm|mov)$/i.test(file.name)) {
        setError(`Unsupported format: "${file.name}". Use .mp4, .webm, or .mov.`)
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
          <div className="upload-eyebrow mono">screen recording → ai-ready bug report</div>
          <h1 className="upload-title">
            Drop a screen recording. Walk away with a debuggable issue.
          </h1>
          <p className="upload-tagline">
            {runtimeCapabilities.surface === 'desktop'
              ? 'Pull frames, prune dupes, write notes, then optionally layer in bundled OCR and transcript enrichments before you export. Everything stays on this Mac.'
              : 'Pull frames, prune dupes, write notes, ship a clean Markdown report you can paste into Claude, GitHub, Jira or Linear. Your video never leaves this browser.'}
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
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            const f = e.dataTransfer.files[0]
            if (f) handleFile(f)
          }}
          onClick={() => inputRef.current?.click()}
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
            <div className="dropzone-meta">.mp4 · .webm · .mov · up to ~750 MB</div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </div>

        {error && <div className="upload-error">{error}</div>}

        <div className="upload-foot">
          {surfaceFootnotes.map((text) => (
            <div key={text} className="upload-foot-item">
              <span className="upload-foot-dot" aria-hidden="true" />
              <span>{text}</span>
            </div>
          ))}
        </div>

        <div className="privacy-note">{privacyNote}</div>
      </div>
    </main>
  )
}
