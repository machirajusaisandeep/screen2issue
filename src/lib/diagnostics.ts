import type { RuntimeCapabilities } from '@/lib/runtime/capabilities'
import type { LocalEngineStatus } from '@/lib/localEngine/types'

export interface DiagnosticExportV1 {
  schemaVersion: 1
  appVersion: string
  generatedAt: string
  runtimeSurface: RuntimeCapabilities['surface']
  capabilities: Pick<RuntimeCapabilities, 'supportsBundledLocalEngine' | 'showLocalEngineActions'>
  localEngineState: LocalEngineStatus['state']
  sanitizedErrors: string[]
  privacy: { recordingsIncluded: false; framesIncluded: false; apiKeysIncluded: false; telemetrySent: false }
}

export function sanitizeDiagnosticError(value: string): string {
  return value
    .replace(/https?:\/\/[^\s]+/gi, '[url]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/(api[-_ ]?key|token|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .slice(0, 500)
}

export function createDiagnosticExport(
  runtime: RuntimeCapabilities,
  engine: LocalEngineStatus,
  errors: string[] = [],
): DiagnosticExportV1 {
  return {
    schemaVersion: 1,
    appVersion: '0.1.0',
    generatedAt: new Date().toISOString(),
    runtimeSurface: runtime.surface,
    capabilities: {
      supportsBundledLocalEngine: runtime.supportsBundledLocalEngine,
      showLocalEngineActions: runtime.showLocalEngineActions,
    },
    localEngineState: engine.state,
    sanitizedErrors: errors.map(sanitizeDiagnosticError),
    privacy: { recordingsIncluded: false, framesIncluded: false, apiKeysIncluded: false, telemetrySent: false },
  }
}
