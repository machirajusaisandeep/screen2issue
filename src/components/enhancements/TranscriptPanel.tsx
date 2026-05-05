import type { TranscriptSegment } from '@/lib/localEngine/types'
import { formatTimestamp } from '@/lib/video/formatTimestamp'

interface TranscriptPanelProps {
  segments: TranscriptSegment[]
}

export function TranscriptPanel({ segments }: TranscriptPanelProps) {
  return (
    <div className="analysis-card">
      <div className="analysis-card-head">
        <div>
          <h3>Transcript Review</h3>
          <p>
            Audio transcription is optional and English-only in v1. Segments appear here and then
            flow into timeline review and exports.
          </p>
        </div>
        <div className="analysis-pill mono">
          {segments.length > 0 ? `${segments.length} segments` : 'no transcript yet'}
        </div>
      </div>

      {segments.length > 0 ? (
        <div className="analysis-transcript-list">
          {segments.slice(0, 14).map((segment) => (
            <div key={segment.id} className="analysis-transcript-item">
              <div className="analysis-transcript-time mono">
                {formatTimestamp(segment.startMs)} → {formatTimestamp(segment.endMs)}
              </div>
              <div>{segment.text}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="analysis-empty">
          No transcript segments have been loaded yet. You can keep working without a transcript.
        </div>
      )}
    </div>
  )
}
