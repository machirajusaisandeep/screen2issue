import { describe, expect, it } from 'vitest'
import { createDiagnosticExport, sanitizeDiagnosticError } from './diagnostics'

describe('diagnostic privacy', () => {
  it('redacts common secrets and personal endpoints', () => {
    const output = sanitizeDiagnosticError('token=secret user@example.com https://internal.test/a')
    expect(output).not.toContain('secret')
    expect(output).not.toContain('user@example.com')
    expect(output).not.toContain('internal.test')
  })

  it('makes exclusions explicit', () => {
    const output = createDiagnosticExport(
      { surface: 'web', supportsBundledLocalEngine: false, showLocalEngineActions: false, localEngineBaseUrl: 'http://127.0.0.1:8765' },
      { state: 'idle' },
    )
    expect(output.privacy).toEqual({ recordingsIncluded: false, framesIncluded: false, apiKeysIncluded: false, telemetrySent: false })
  })
})
