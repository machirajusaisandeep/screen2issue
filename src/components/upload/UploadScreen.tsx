import { useCallback, useRef, useState } from 'react'

interface UploadScreenProps {
  onFileSelected: (file: File) => void
}

const MAX_VIDEO_BYTES = 750 * 1024 * 1024

export function UploadScreen({ onFileSelected }: UploadScreenProps) {
  const [over, setOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  return (
    <main className="screen upload-screen">
      <div className="upload-stack">
        <div className="upload-hero">
          <div className="upload-eyebrow mono">screen recording → ai-ready bug report</div>
          <h1 className="upload-title">
            Drop a screen recording. Walk away with a debuggable issue.
          </h1>
          <p className="upload-tagline">
            Pull frames, prune dupes, write notes, ship a clean Markdown report you can paste
            into Claude, GitHub, Jira or Linear. Your video never leaves this tab.
          </p>
          </div>

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
          {[
            'No upload — frames extracted in your browser',
            'No account, no telemetry',
            'Installable as a PWA',
          ].map((text) => (
            <div key={text} className="upload-foot-item">
              <span className="upload-foot-dot" aria-hidden="true" />
              <span>{text}</span>
            </div>
          ))}
        </div>

        <div className="privacy-note">
          All processing happens locally in your browser. Videos, screenshots, OCR text, and HAR
          files are not uploaded anywhere.
        </div>
      </div>
    </main>
  )
}
