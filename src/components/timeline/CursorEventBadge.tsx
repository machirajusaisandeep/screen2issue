import type { CursorEvent } from '@/types/report'

type CursorEventBadgeProps = {
  event: CursorEvent
}

const LABELS: Record<CursorEvent['type'], string> = {
  possible_click: 'possible click',
  possible_cursor_move: 'cursor movement',
}

export function CursorEventBadge({ event }: CursorEventBadgeProps) {
  return (
    <span className={`cursor-badge ${event.type}`}>
      {LABELS[event.type]} · {Math.round(event.confidence * 100)}%
    </span>
  )
}
