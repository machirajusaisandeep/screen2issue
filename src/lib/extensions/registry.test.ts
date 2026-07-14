import { beforeEach, describe, expect, it } from 'vitest'
import type { AnalyzerAdapter, ExportAdapter } from '@/types/extensions'
import { getAnalyzers, getExporters, registerAnalyzer, registerExporter, resetExtensionRegistryForTests } from './registry'

beforeEach(resetExtensionRegistryForTests)

describe('extension registry', () => {
  it('registers typed analyzers and exporters in insertion order', () => {
    const analyzer: AnalyzerAdapter = {
      id: 'example-analyzer', label: 'Example', description: 'Example analyzer',
      dataBoundary: 'local', capabilities: ['frames'], isAvailable: () => true, run: async () => ({}),
    }
    const exporter: ExportAdapter = {
      id: 'example-export', label: 'Example export', description: 'Example exporter',
      extension: '.txt', mimeType: 'text/plain', validate: () => [], generate: async () => 'ok',
    }
    registerAnalyzer(analyzer)
    registerExporter(exporter)
    expect(getAnalyzers()).toEqual([analyzer])
    expect(getExporters()).toEqual([exporter])
  })

  it('rejects duplicate and non-kebab-case ids', () => {
    const exporter: ExportAdapter = {
      id: 'valid-export', label: 'Valid', description: 'Valid', extension: '.txt', mimeType: 'text/plain',
      validate: () => [], generate: async () => 'ok',
    }
    registerExporter(exporter)
    expect(() => registerExporter(exporter)).toThrow(/already registered/)
    expect(() => registerExporter({ ...exporter, id: 'Invalid Export' })).toThrow(/kebab-case/)
  })
})
