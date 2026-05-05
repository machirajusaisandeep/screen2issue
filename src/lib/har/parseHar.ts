import { nanoid } from 'nanoid'
import type { HarEntrySummary } from '@/types/report'

type HarRequest = {
  method?: string
  url?: string
  bodySize?: number
}

type HarResponse = {
  status?: number
  statusText?: string
  bodySize?: number
  content?: {
    size?: number
  }
}

type RawHarEntry = {
  startedDateTime?: string
  time?: number
  request?: HarRequest
  response?: HarResponse
  _error?: string
  _errorText?: string
}

type RawHarFile = {
  log?: {
    entries?: RawHarEntry[]
  }
}

export type ParsedHarFile = {
  fileName: string
  importedAt: string
  entries: HarEntrySummary[]
}

export function parseHar(fileName: string, content: string): ParsedHarFile {
  let parsed: RawHarFile

  try {
    parsed = JSON.parse(content) as RawHarFile
  } catch {
    throw new Error('This HAR file is not valid JSON.')
  }

  const rawEntries = parsed.log?.entries
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    throw new Error('This HAR file does not contain any network entries.')
  }

  const importedAt = new Date().toISOString()
  const timestamps = rawEntries
    .map((entry) => Date.parse(entry.startedDateTime ?? ''))
    .filter(Number.isFinite)

  const baseTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : undefined

  const entries = rawEntries.map<HarEntrySummary>((entry) => {
    const startedAt = parseTimestamp(entry.startedDateTime)
    const status = normalizeNumber(entry.response?.status)
    const durationMs = normalizeNumber(entry.time)
    const failureReason = getFailureReason(entry)

    return {
      id: nanoid(),
      startedDateTime: entry.startedDateTime,
      relativeStartedMs:
        typeof baseTimestamp === 'number' && typeof startedAt === 'number'
          ? Math.max(0, startedAt - baseTimestamp)
          : undefined,
      method: entry.request?.method?.toUpperCase() || 'GET',
      url: sanitizeUrl(entry.request?.url),
      status,
      statusText: entry.response?.statusText,
      durationMs,
      requestSizeBytes: normalizeNumber(entry.request?.bodySize),
      responseSizeBytes: normalizeNumber(entry.response?.bodySize ?? entry.response?.content?.size),
      isError: Boolean(failureReason) || (typeof status === 'number' && status >= 400),
      isSlow: typeof durationMs === 'number' && durationMs >= 3000,
      failureReason,
    }
  })

  return {
    fileName,
    importedAt,
    entries,
  }
}

function getFailureReason(entry: RawHarEntry): string | undefined {
  const status = normalizeNumber(entry.response?.status)
  const rawFailure = entry._error || entry._errorText
  if (rawFailure) return rawFailure
  if (status === 0) return 'Request failed before a response was recorded.'
  if (entry.response?.statusText?.toLowerCase().includes('cors')) {
    return entry.response.statusText
  }
  return undefined
}

function parseTimestamp(value?: string): number | undefined {
  const timestamp = Date.parse(value ?? '')
  return Number.isFinite(timestamp) ? timestamp : undefined
}

function normalizeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && value >= 0 ? value : undefined
}

function sanitizeUrl(rawUrl?: string): string {
  if (!rawUrl) return 'unknown-url'

  try {
    const url = new URL(rawUrl)
    url.username = ''
    url.password = ''
    url.hash = ''

    const params = new URLSearchParams()
    url.searchParams.forEach((_value, key) => {
      params.append(key, '[redacted]')
    })

    const search = params.toString()
    return `${url.origin}${url.pathname}${search ? `?${search}` : ''}`
  } catch {
    const [path, query = ''] = rawUrl.split('?')
    if (!query) return path

    const redacted = query
      .split('&')
      .filter(Boolean)
      .map((pair) => `${pair.split('=')[0]}=[redacted]`)
      .join('&')

    return `${path}?${redacted}`
  }
}
