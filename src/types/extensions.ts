import type { BugReport } from '@/types/report'
import type { RuntimeCapabilities } from '@/lib/runtime/capabilities'

export type ThemePreference = 'system' | 'dark' | 'light'

export type DataBoundary = 'local' | 'localhost' | 'external'

export type ValidationIssue = {
  id: string
  severity: 'info' | 'warning' | 'error'
  section: 'upload' | 'review' | 'enhancements' | 'export' | 'settings'
  message: string
  navigationTarget?: string
}

export type AnalyzerContext = {
  report: BugReport
  runtime: RuntimeCapabilities
}

export type AnalysisPatch = Partial<BugReport> & {
  warnings?: string[]
}

export interface AnalyzerAdapter {
  id: string
  label: string
  description: string
  dataBoundary: DataBoundary
  capabilities: readonly string[]
  isAvailable(context: AnalyzerContext): boolean | Promise<boolean>
  run(context: AnalyzerContext, signal: AbortSignal): Promise<AnalysisPatch>
}

export interface ExportAdapter {
  id: string
  label: string
  description: string
  extension: string
  mimeType: string
  validate(report: BugReport): ValidationIssue[]
  generate(report: BugReport, signal?: AbortSignal): Promise<string | Blob>
}
