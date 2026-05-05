import type { HarSummary } from '@/types/report'
import type { ParsedHarFile } from '@/lib/har/parseHar'

export function summarizeHar(parsed: ParsedHarFile, syncOffsetMs = 0): HarSummary {
  const entries = parsed.entries.map((entry) => ({
    ...entry,
    offsetMs:
      typeof entry.relativeStartedMs === 'number'
        ? entry.relativeStartedMs + syncOffsetMs
        : undefined,
  }))

  return {
    fileName: parsed.fileName,
    importedAt: parsed.importedAt,
    syncOffsetMs,
    totalRequests: entries.length,
    errorCount: entries.filter((entry) => entry.isError).length,
    slowRequestCount: entries.filter((entry) => entry.isSlow).length,
    entries,
  }
}
