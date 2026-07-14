import type { BugReport } from '@/types/report'
import type { ExportAdapter } from '@/types/extensions'
import { generateMarkdown } from '@/lib/report/generateMarkdown'
import { generateJson } from '@/lib/report/generateJson'
import { validateReport } from '@/lib/extensions/validation'
import { registerExporter } from '@/lib/extensions/registry'

export function generateGitHubIssueMarkdown(report: BugReport): string {
  const body = generateMarkdown(report)
  return `<!-- Generated locally by Screen2Issue. Review before posting. -->\n\n${body}`
}

export const markdownExportAdapter: ExportAdapter = {
  id: 'markdown', label: 'Markdown report', description: 'Portable engineering report.',
  extension: 'md', mimeType: 'text/markdown', validate: validateReport,
  async generate(report) { return generateMarkdown(report) },
}

export const githubIssueExportAdapter: ExportAdapter = {
  id: 'github-issue-markdown', label: 'GitHub issue Markdown',
  description: 'Markdown formatted for pasting into a GitHub issue.',
  extension: 'md', mimeType: 'text/markdown', validate: validateReport,
  async generate(report) { return generateGitHubIssueMarkdown(report) },
}

export const jsonExportAdapter: ExportAdapter = {
  id: 'json', label: 'JSON metadata', description: 'Structured report data for tools.',
  extension: 'json', mimeType: 'application/json', validate: validateReport,
  async generate(report) { return generateJson(report) },
}

export function registerFirstPartyExporters(): void {
  ;[markdownExportAdapter, githubIssueExportAdapter, jsonExportAdapter].forEach(registerExporter)
}
