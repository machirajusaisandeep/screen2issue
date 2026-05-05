import type { BugReport } from '@/types/report'
import { buildReportMetadata } from '@/lib/report/reportData'

export function generateJson(report: BugReport): string {
  return JSON.stringify(buildReportMetadata(report), null, 2)
}
