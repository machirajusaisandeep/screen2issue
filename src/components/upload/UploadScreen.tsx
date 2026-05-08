import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
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
      ? 'Default processing stays on this Mac, including the bundled local-engine enrichments.'
      : runtimeCapabilities.surface === 'pwa'
        ? 'Core processing runs in this installed browser app.'
        : 'Core processing runs in your browser with no account or server upload.'

  const optionalAiNote =
    runtimeCapabilities.surface === 'desktop'
      ? 'External AI actions are optional and only run when you configure a provider and click them.'
      : 'Optional AI actions may send selected text or screenshots to the provider you configure.'

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
          <div className="upload-flow" aria-label="Screen recording to AI-ready bug report">
            <span className="upload-flow-badge mono">screen recording</span>
            <span className="upload-flow-arrow" aria-hidden="true">
              <svg width="44" height="18" viewBox="0 0 44 18" fill="none">
                <path d="M2 9h36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M30 2l8 7-8 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="upload-flow-badge upload-flow-badge-accent mono">AI-ready bug report</span>
          </div>
          <h1 className="upload-title">
            Turn a recording into a bug report engineers can act on.
          </h1>
          <p className="upload-tagline">
            {runtimeCapabilities.surface === 'desktop'
              ? 'Extract key moments, remove duplicate frames, add context, and layer in local OCR, cursor, network, and transcript evidence before exporting Markdown, JSON, or ZIP.'
              : 'Extract key moments, remove duplicate frames, add context, and export a clean Markdown issue with screenshots, OCR, cursor activity, and network evidence.'}
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

        <div className="privacy-note">
          <div>{privacyNote}</div>
          <div className="privacy-note-ai">
            <Sparkles size={14} strokeWidth={1.8} aria-hidden="true" />
            <span>{optionalAiNote}</span>
          </div>
        </div>
      </div>
    </main>
  )
}
