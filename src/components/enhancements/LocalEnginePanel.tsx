import type { LocalEngineStatus } from '@/lib/localEngine/types'

type LocalAction = 'check' | 'enhance' | 'transcribe' | null

interface LocalEnginePanelProps {
  error?: string | null
  frameCount: number
  onCheck: () => void
  onEnhance: () => void
  onTranscribe: () => void
  status: LocalEngineStatus
  transcriptCount: number
  videoName?: string
  busyAction: LocalAction
  message?: string | null
}

export function LocalEnginePanel({
  error,
  frameCount,
  onCheck,
  onEnhance,
  onTranscribe,
  status,
  transcriptCount,
  videoName,
  busyAction,
  message,
}: LocalEnginePanelProps) {
  const statusLabel = getStatusLabel(status)

  return (
    <div className="analysis-card analysis-card-callout">
      <div className="analysis-card-head">
        <div>
          <h3>Enhanced Local Engine</h3>
          <p>
            Browser mode stays entirely in-browser. Enhanced mode sends data only to a Python
            engine running locally on your machine, and nothing is sent to external services.
          </p>
        </div>
        <div className={`analysis-pill mono analysis-pill-status state-${status.state}`}>
          {statusLabel}
        </div>
      </div>

      <div className="analysis-warning">
        No localhost request happens automatically. Screen2Issue only talks to
        <span className="mono"> http://127.0.0.1:8765 </span>
        after you click one of these actions.
      </div>

      <div className="analysis-field-row">
        <div className="analysis-field">
          <span className="mono">check local engine</span>
          <div className="analysis-inline-value">
            Pings the local FastAPI helper only. No frames, HAR data, or video bytes are sent.
          </div>
        </div>
        <div className="analysis-field">
          <span className="mono">enhance detection locally</span>
          <div className="analysis-inline-value">
            Sends all {frameCount} extracted frames plus frame ids, timestamps, and included flags.
            No HAR data is sent.
          </div>
        </div>
      </div>

      <div className="analysis-field-row">
        <div className="analysis-field">
          <span className="mono">transcribe audio locally</span>
          <div className="analysis-inline-value">
            Sends the original video file{videoName ? ` (${videoName})` : ''} for English-only
            local transcription.
          </div>
        </div>
        <div className="analysis-field">
          <span className="mono">current engine details</span>
          <div className="analysis-inline-value">
            {status.health
              ? `${status.health.engine} ${status.health.version} · ${status.health.features.join(', ')}`
              : 'no local engine details loaded yet'}
          </div>
        </div>
      </div>

      <div className="analysis-stats mono">
        <span>{frameCount} extracted frames ready for enhancement</span>
        <span>{transcriptCount > 0 ? `${transcriptCount} transcript segments loaded` : 'no transcript loaded yet'}</span>
        <span>{status.lastCheckedAt ? `last checked ${new Date(status.lastCheckedAt).toLocaleString()}` : 'engine not checked yet'}</span>
      </div>

      <div className="analysis-actions">
        <button className="btn" onClick={onCheck} disabled={busyAction !== null}>
          {busyAction === 'check' ? 'Checking…' : 'Check Local Engine'}
        </button>
        <button className="btn btn-primary" onClick={onEnhance} disabled={busyAction !== null}>
          {busyAction === 'enhance' ? 'Enhancing…' : 'Enhance Detection Locally'}
        </button>
        <button className="btn" onClick={onTranscribe} disabled={busyAction !== null}>
          {busyAction === 'transcribe' ? 'Transcribing…' : 'Transcribe Audio Locally'}
        </button>
      </div>

      {message ? <div className="analysis-success">{message}</div> : null}
      {error ? <div className="analysis-error">{error}</div> : null}
    </div>
  )
}

function getStatusLabel(status: LocalEngineStatus): string {
  if (status.state === 'connected' && status.health) {
    return `connected · ${status.health.engine}`
  }

  if (status.state === 'starting') return 'starting'
  if (status.state === 'complete') return 'complete'
  if (status.state === 'checking') return 'checking'
  if (status.state === 'enhancing') return 'running'
  if (status.state === 'not_connected') return 'not connected'
  if (status.state === 'port_conflict') return 'port conflict'
  if (status.state === 'error') return 'error'
  return 'idle'
}
