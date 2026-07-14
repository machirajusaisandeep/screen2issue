# Architecture

Screen2Issue is a local-first React/PWA with an optional macOS-bundled localhost engine. The browser is the reference surface.

## Data flow

1. The original recording is held in memory and decoded with browser media APIs.
2. Derived frames, OCR, annotations, and report fields form a `ProjectDocumentV1` draft in IndexedDB.
3. The original recording and provider API keys are never placed in project storage.
4. First-party analyzers and exporters are registered at compile time. v1.0 does not execute arbitrary runtime plugins.
5. External AI calls require a visible data-boundary confirmation and go directly to the configured provider.

Primary boundaries are `local` (browser), `localhost` (optional engine), and `external` (explicit provider request). See [ADR 0001](adr/0001-compile-time-adapters.md).

## Package responsibilities

- `src/lib/project`: versioned project schema, migrations, autosave, and sample data.
- `src/lib/extensions`: typed registries, validation, first-party adapters, and examples.
- `src/lib/report`: deterministic report generation and report-derived selectors.
- `src/lib/diagnostics.ts`: user-reviewed, privacy-preserving diagnostic export.
- `src/components`: workflow screens and shared UI.

The initial application shell excludes OCR models, ZIP generation, AI clients, and enhancement screens. These load only when needed.
