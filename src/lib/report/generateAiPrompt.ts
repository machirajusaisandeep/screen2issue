import type { BugReport } from '@/types/report'
import { buildReportMetadata, formatCursorEventLabel, formatHarEntryLabel } from '@/lib/report/reportData'

export function generateAiPrompt(report: BugReport): string {
  const metadata = buildReportMetadata(report)

  const timeline = metadata.includedFrames
    .map((frame) => {
      const lines = [`- ${frame.timestamp} — ${frame.note || '(no note)'}`]

      if (frame.aiScreenshotAnalysis) {
        lines.push(`  AI screenshot analysis: ${frame.aiScreenshotAnalysis}`)
      }

      if (frame.aiOcrCorrection) {
        lines.push(`  AI OCR correction: ${frame.aiOcrCorrection}`)
      } else if (frame.effectiveOcrText) {
        lines.push(
          `  Visible text (${frame.ocrSource === 'enhanced' ? 'enhanced local engine' : 'browser OCR'}): ${frame.effectiveOcrText}`,
        )
      }

      if (frame.transcriptSegments.length > 0) {
        lines.push(
          `  Transcript nearby: ${frame.transcriptSegments.map((segment) => segment.text).join(' / ')}`,
        )
      }

      if (frame.detectedLabels.length > 0) {
        lines.push(`  Detected UI labels: ${frame.detectedLabels.join(', ')}`)
      }

      if (typeof frame.qualityScore === 'number') {
        lines.push(`  Frame quality score: ${Math.round(frame.qualityScore * 100)}%`)
      }

      if (frame.warnings.length > 0) {
        lines.push(`  Enhanced warnings: ${frame.warnings.join('; ')}`)
      }

      if (frame.cursorEvents.length > 0) {
        lines.push(
          `  Cursor / click (${frame.cursorEventSource === 'enhanced' ? 'enhanced local engine' : 'browser detection'}): ${frame.cursorEvents.map(formatCursorEventLabel).join('; ')}`,
        )
      }

      if (frame.harEntries.length > 0) {
        lines.push(`  Network issues nearby: ${frame.harEntries.map(formatHarEntryLabel).join('; ')}`)
      }

      return lines.join('\n')
    })
    .join('\n')

  const suspiciousRequests = metadata.harSummary?.entries.filter((entry) => entry.isError || entry.isSlow) ?? []

  const environment = [
    `- Platform: ${metadata.environment.platform}`,
    `- Language: ${metadata.environment.language}`,
    `- Viewport: ${metadata.environment.viewport}`,
    `- Screen: ${metadata.environment.screen}`,
    `- PWA standalone: ${metadata.environment.standalone ? 'yes' : 'no'}`,
  ].join('\n')

  const steps = report.reproductionSteps
    .filter((step) => step.trim())
    .map((step, index) => `${index + 1}. ${step}`)
    .join('\n')

  const provenance = [
    '- Browser OCR and cursor detection ran in-browser during step 2.',
    `- Enhanced local engine used: ${metadata.analysisProvenance.localEngineUsed ? 'yes' : 'no'}`,
    `- Enhanced OCR frames: ${metadata.analysisProvenance.enhancedOcrFrames}`,
    `- Frames with enhanced cursor analysis: ${metadata.analysisProvenance.enhancedCursorFrames}`,
    `- Enhanced cursor events: ${metadata.analysisProvenance.enhancedCursorEvents}`,
    `- Transcript segments: ${metadata.analysisProvenance.transcriptSegments}`,
    `- HAR included: ${metadata.analysisProvenance.harIncluded ? 'yes' : 'no'}`,
  ]

  if (metadata.localEngineStatus?.health) {
    provenance.push(
      `- Local engine: ${metadata.localEngineStatus.health.engine} ${metadata.localEngineStatus.health.version}`,
    )
  }

  if (metadata.enhancementWarnings?.length) {
    provenance.push(`- Enhancement warnings: ${metadata.enhancementWarnings.join('; ')}`)
  }

  const transcriptSection = metadata.transcriptSegments?.length
    ? `Transcript segments:
${metadata.transcriptSegments
    .map((segment) => `- ${formatRange(segment.startMs, segment.endMs)} ${segment.text}`)
    .join('\n')}
`
    : ''

  const aiActivitySection = report.aiActivitySummary
    ? `AI Activity Summary:\n${report.aiActivitySummary}\n`
    : ''

  const aiHarSection = report.aiHarInsights
    ? `AI HAR Analysis:\n${report.aiHarInsights}\n`
    : ''

  const aiTranscriptSection = report.aiTranscriptInsights
    ? `AI Transcript Summary:\n${report.aiTranscriptInsights}\n`
    : ''

  return `I am debugging an issue reported through a local-first screen recording workflow.

Please analyze the timeline below and suggest:
1. Likely frontend causes
2. Likely backend/API causes
3. Reproduction steps to confirm the issue
4. What logs or network calls to inspect
5. Possible fixes or next debugging checks

---

Context:
Title: ${report.title}
Summary: ${report.summary || 'Not provided'}

Observed behavior:
${report.observedBehavior || 'Not specified'}

Expected behavior:
${report.expectedBehavior || 'Not specified'}

Environment metadata:
${environment}

Analysis provenance:
${provenance.join('\n')}

${steps ? `Reproduction steps:\n${steps}\n` : ''}${aiActivitySection ? `${aiActivitySection}\n` : ''}${aiHarSection ? `${aiHarSection}\n` : ''}${aiTranscriptSection ? `${aiTranscriptSection}\n` : ''}${transcriptSection ? `${transcriptSection}\n` : ''}Timeline:
${timeline || '(no frames selected)'}

${suspiciousRequests.length > 0
    ? `\nSuspicious HAR issues:\n${suspiciousRequests.map((entry) => `- ${formatHarEntryLabel(entry)}`).join('\n')}\n`
    : ''}
`
}

function formatRange(startMs: number, endMs: number): string {
  return `[${formatTimestampPart(startMs)} - ${formatTimestampPart(endMs)}]`
}

function formatTimestampPart(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
