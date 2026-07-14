import type { BugReport } from '@/types/report'
import type { ValidationIssue } from '@/types/extensions'

export function validateReport(report: BugReport): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const add = (id: string, severity: ValidationIssue['severity'], message: string, navigationTarget: string) =>
    issues.push({ id, severity, section: 'export', message, navigationTarget })

  if (!report.title.trim()) add('missing-title', 'error', 'Add a concise issue title.', 'title')
  if (!report.summary.trim()) add('missing-summary', 'warning', 'Add a short summary for readers who did not see the recording.', 'summary')
  if (!report.observedBehavior.trim()) add('missing-observed', 'warning', 'Describe what actually happened.', 'observed')
  if (!report.expectedBehavior.trim()) add('missing-expected', 'warning', 'Describe the expected behavior.', 'expected')
  if (!report.reproductionSteps.some((step) => step.trim())) add('missing-steps', 'warning', 'Add at least one reproduction step.', 'steps')
  if (!report.frames.some((frame) => frame.included)) add('missing-evidence', 'error', 'Include at least one evidence frame.', 'evidence')
  return issues
}
