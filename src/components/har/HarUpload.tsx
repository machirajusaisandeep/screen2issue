import { useRef } from 'react'

type HarUploadProps = {
  fileName?: string
  syncOffsetSeconds: number
  error?: string | null
  onFileSelected: (file: File) => void
  onSyncOffsetChange: (value: number) => void
}

export function HarUpload({
  fileName,
  syncOffsetSeconds,
  error,
  onFileSelected,
  onSyncOffsetChange,
}: HarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="analysis-card">
      <div className="analysis-card-head">
        <div>
          <h3>HAR Upload</h3>
          <p>
            Import a HAR file locally to line up suspicious network requests with the video
            timeline.
          </p>
        </div>
        <button className="btn btn-sm" onClick={() => inputRef.current?.click()}>
          {fileName ? 'Replace HAR' : 'Upload HAR'}
        </button>
      </div>

      <div className="analysis-warning">
        HAR files can contain sensitive URLs, cookies, tokens, emails, and payloads. Screen2Issue
        only keeps a sanitized local summary and does not export full headers or bodies.
      </div>

      <div className="analysis-field-row">
        <label className="analysis-field">
          <span className="mono">har sync offset in seconds</span>
          <input
            className="s2i-input"
            type="number"
            step="0.1"
            value={Number.isFinite(syncOffsetSeconds) ? syncOffsetSeconds : 0}
            onChange={(event) => onSyncOffsetChange(Number(event.target.value) || 0)}
          />
        </label>
        <div className="analysis-field">
          <span className="mono">current file</span>
          <div className="analysis-inline-value">{fileName ?? 'none imported'}</div>
        </div>
      </div>

      {error ? <div className="analysis-error">{error}</div> : null}

      <input
        ref={inputRef}
        type="file"
        accept=".har,application/json"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFileSelected(file)
        }}
      />
    </div>
  )
}
