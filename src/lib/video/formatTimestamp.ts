/** Converts milliseconds to MM:SS display string, e.g. 4200 → "00:04" */
export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatTimestampForFile(ms: number): string {
  return formatTimestamp(ms).replace(/:/g, '-')
}

export function formatSignedTimestamp(ms: number): string {
  const sign = ms < 0 ? '-' : ''
  return `${sign}${formatTimestamp(Math.abs(ms))}`
}

/** Converts milliseconds to a human-readable duration, e.g. 125000 → "2m 5s" */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds}s`
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}
