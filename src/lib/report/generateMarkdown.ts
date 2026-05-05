import type { BugReport } from '@/types/report'
import { formatDuration } from '@/lib/video/formatTimestamp'
import {
  buildReportMetadata,
  formatCursorEventLabel,
  formatHarEntryLabel,
} from '@/lib/report/reportData'

type MarkdownOptions = {
  imageBasePath?: string
}

export function generateMarkdown(report: BugReport, options: MarkdownOptions = {}): string {
  const metadata = buildReportMetadata(report)

  const timelineSection = metadata.includedFrames
    .map((frame) => {
      const note = frame.note || '_No note_'
      const lines = [`### ${frame.timestamp}`, '', `Note: ${note}`]

      if (frame.effectiveOcrText) {
        lines.push(
          '',
          `Visible text (${frame.ocrSource === 'enhanced' ? 'enhanced local engine' : 'browser OCR'}):`,
          frame.effectiveOcrText,
        )
      }

      if (frame.transcriptSegments.length > 0) {
        lines.push('', 'Transcript near this moment:')
        frame.transcriptSegments.forEach((segment) => {
          lines.push(`- ${formatTranscriptRange(segment.startMs, segment.endMs)} ${segment.text}`)
        })
      }

      if (frame.detectedLabels.length > 0) {
        lines.push('', `Detected UI labels: ${frame.detectedLabels.join(', ')}`)
      }

      if (typeof frame.qualityScore === 'number') {
        lines.push('', `Frame quality score: ${Math.round(frame.qualityScore * 100)}%`)
      }

      if (frame.warnings.length > 0) {
        lines.push('', 'Enhanced warnings:')
        frame.warnings.forEach((warning) => lines.push(`- ${warning}`))
      }

      if (frame.cursorEvents.length > 0) {
        lines.push(
          '',
          `Cursor / click events (${frame.cursorEventSource === 'enhanced' ? 'enhanced local engine' : 'browser detection'}):`,
        )
        frame.cursorEvents.forEach((event) => lines.push(`- ${formatCursorEventLabel(event)}`))
      }

      if (frame.harEntries.length > 0) {
        lines.push('', 'Network issues near this moment:')
        frame.harEntries.forEach((entry) => lines.push(`- ${formatHarEntryLabel(entry)}`))
      }

      if (options.imageBasePath) {
        const framePath = `${options.imageBasePath}/${frame.fileName}`
        lines.push('', `![Frame at ${frame.timestamp}](${framePath})`)
      }

      return lines.join('\n')
    })
    .join('\n\n')

  const steps = report.reproductionSteps
    .filter((step) => step.trim())
    .map((step, index) => `${index + 1}. ${step}`)
    .join('\n')

  const environmentLines = [
    `- **Platform:** ${metadata.environment.platform}`,
    `- **Language:** ${metadata.environment.language}`,
    `- **Viewport:** ${metadata.environment.viewport}`,
    `- **Screen:** ${metadata.environment.screen}`,
    `- **Standalone PWA:** ${metadata.environment.standalone ? 'Yes' : 'No'}`,
  ].join('\n')

  const suspiciousRequests = metadata.harSummary?.entries.filter((entry) => entry.isError || entry.isSlow) ?? []

  const provenanceLines = [
    '- **Browser mode baseline:** OCR and cursor detection ran in-browser during step 2.',
    `- **Enhanced local engine used:** ${metadata.analysisProvenance.localEngineUsed ? 'Yes' : 'No'}`,
    `- **Enhanced OCR frames:** ${metadata.analysisProvenance.enhancedOcrFrames}`,
    `- **Frames with enhanced cursor analysis:** ${metadata.analysisProvenance.enhancedCursorFrames}`,
    `- **Enhanced cursor events:** ${metadata.analysisProvenance.enhancedCursorEvents}`,
    `- **Transcript segments:** ${metadata.analysisProvenance.transcriptSegments}`,
    `- **HAR included:** ${metadata.analysisProvenance.harIncluded ? 'Yes' : 'No'}`,
    `- **Local engine status:** ${metadata.localEngineStatus?.state ?? 'idle'}`,
  ]

  if (metadata.localEngineStatus?.health) {
    provenanceLines.push(
      `- **Local engine:** ${metadata.localEngineStatus.health.engine} ${metadata.localEngineStatus.health.version}`,
    )
  }

  if (metadata.enhancementWarnings?.length) {
    provenanceLines.push(
      `- **Enhancement warnings:** ${metadata.enhancementWarnings.join('; ')}`,
    )
  }

  const transcriptSection = metadata.transcriptSegments?.length
    ? `## Audio Transcript

${metadata.transcriptSegments
    .map((segment) => `- ${formatTranscriptRange(segment.startMs, segment.endMs)} ${segment.text}`)
    .join('\n')}`
    : ''

  const harSection = metadata.harSummary
    ? `## Network / HAR Summary

- **File:** ${metadata.harSummary.fileName}
- **Sync offset:** ${metadata.harSummary.syncOffsetMs / 1000}s
- **Total requests:** ${metadata.harSummary.totalRequests}
- **Failed requests:** ${metadata.harSummary.errorCount}
- **Slow requests:** ${metadata.harSummary.slowRequestCount}

### Suspicious Requests

${suspiciousRequests.length > 0
    ? `| Time | Method | URL | Status | Duration |
|---|---|---|---|---|
${suspiciousRequests
    .map((entry) => `| ${typeof entry.offsetMs === 'number' ? formatHarTime(entry.offsetMs) : 'n/a'} | ${entry.method} | ${entry.url} | ${entry.status ?? 'failed'} | ${typeof entry.durationMs === 'number' ? `${Math.round(entry.durationMs)}ms` : 'n/a'} |`)
    .join('\n')}`
    : '_No suspicious requests detected._'}`
    : ''

  return `# Bug Report: ${report.title}

## Summary

${report.summary || '_No summary provided_'}

## Video Details

- **File:** ${report.videoName}
- **Duration:** ${formatDuration(report.videoDurationMs)}
- **Created:** ${report.createdAt}
- **Frames reviewed:** ${metadata.includedFrames.length}

## Environment

${environmentLines}

## Analysis Provenance

${provenanceLines.join('\n')}

## Observed Behavior

${report.observedBehavior || '_Not specified_'}

## Expected Behavior

${report.expectedBehavior || '_Not specified_'}

## Reproduction Steps

${steps || '_Not provided_'}

## Timeline

${timelineSection || '_No frames selected_'}

${transcriptSection ? `\n\n${transcriptSection}` : ''}
${harSection ? `\n\n${harSection}` : ''}

---

> Generated by Screen2Issue — local-first with no external uploads.
`
}

function formatHarTime(offsetMs: number): string {
  if (offsetMs < 0) return `-${formatTimestampPart(Math.abs(offsetMs))}`
  return formatTimestampPart(offsetMs)
}

function formatTimestampPart(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatTranscriptRange(startMs: number, endMs: number): string {
  return `[${formatTimestampPart(startMs)} - ${formatTimestampPart(endMs)}]`
}
