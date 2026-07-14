import type { AnalyzerAdapter, ExportAdapter } from '@/types/extensions'

const analyzers = new Map<string, AnalyzerAdapter>()
const exporters = new Map<string, ExportAdapter>()

export function registerAnalyzer(adapter: AnalyzerAdapter): void {
  assertUnique(analyzers, adapter.id, 'analyzer')
  analyzers.set(adapter.id, adapter)
}

export function registerExporter(adapter: ExportAdapter): void {
  assertUnique(exporters, adapter.id, 'exporter')
  exporters.set(adapter.id, adapter)
}

export function getAnalyzers(): readonly AnalyzerAdapter[] {
  return [...analyzers.values()]
}

export function getExporters(): readonly ExportAdapter[] {
  return [...exporters.values()]
}

export function resetExtensionRegistryForTests(): void {
  analyzers.clear()
  exporters.clear()
}

function assertUnique<T>(registry: Map<string, T>, id: string, kind: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`${kind} id "${id}" must use lowercase kebab-case.`)
  }
  if (registry.has(id)) throw new Error(`${kind} id "${id}" is already registered.`)
}
