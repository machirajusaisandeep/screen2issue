import { Clock3, FlaskConical, Trash2 } from 'lucide-react'
import type { DraftSummary } from '@/lib/project/storage'

interface ProjectStartOptionsProps {
  draft: DraftSummary | null
  storageLabel: string | null
  onResume: () => void
  onClearDraft: () => void
  onOpenSample: () => void
}

export function ProjectStartOptions({
  draft,
  storageLabel,
  onResume,
  onClearDraft,
  onOpenSample,
}: ProjectStartOptionsProps) {
  return (
    <section className="project-start-options" aria-label="Start options">
      {draft ? (
        <div className="resume-card">
          <div className="resume-card-icon" aria-hidden="true"><Clock3 size={18} /></div>
          <div className="resume-card-copy">
            <strong>{draft.title || draft.videoName}</strong>
            <span>
              {draft.frameCount} derived frames · saved {formatRelativeTime(draft.updatedAt)}
              {storageLabel ? ` · ${storageLabel}` : ''}
            </span>
            <span className="mono">Original recording was not stored.</span>
          </div>
          <div className="resume-card-actions">
            <button className="btn btn-primary" onClick={onResume}>Resume project</button>
            <button className="btn btn-ghost btn-icon" onClick={onClearDraft} aria-label="Clear saved project">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ) : null}

      <button className="sample-project-card" onClick={onOpenSample}>
        <FlaskConical size={15} aria-hidden="true" />
        <span>New here? Explore a sanitized sample project</span>
        <span aria-hidden="true">→</span>
      </button>
    </section>
  )
}

function formatRelativeTime(value: string): string {
  const elapsed = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(elapsed) || elapsed < 60_000) return 'just now'
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
