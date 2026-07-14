import type { AnalyzerAdapter, ExportAdapter } from '@/types/extensions'

export const exampleAnalyzer: AnalyzerAdapter = {
  id: 'example-note-counter',
  label: 'Example note counter',
  description: 'Demonstrates a deterministic local analyzer.',
  dataBoundary: 'local',
  capabilities: ['report-text'],
  isAvailable: () => true,
  async run({ report }, signal) {
    signal.throwIfAborted()
    const count = report.frames.filter((frame) => frame.note?.trim()).length
    return { enhancementWarnings: [`Example analyzer found ${count} reviewer notes.`] }
  },
}

export const exampleTextExporter: ExportAdapter = {
  id: 'example-text', label: 'Example text exporter',
  description: 'Minimal contributor export example.', extension: 'txt', mimeType: 'text/plain',
  validate: () => [],
  async generate(report, signal) {
    signal?.throwIfAborted()
    return `${report.title}\n\n${report.summary}`
  },
}
