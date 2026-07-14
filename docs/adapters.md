# Adapter authoring guide

Screen2Issue v1.0 supports compile-time analyzers and exporters. Import and register adapters in the application build; do not fetch or evaluate contributor code at runtime.

An `AnalyzerAdapter` declares its identity, capabilities, data boundary, availability, cancellable `run` method, and typed report patch. Check `signal.throwIfAborted()` before expensive work and between stages. Never mutate the supplied report.

An `ExportAdapter` declares validation, extension/MIME metadata, and asynchronous generation. Exporters must be deterministic unless their description explicitly says otherwise and must not initiate network requests.

Working examples live in [`src/lib/extensions/examples.ts`](../src/lib/extensions/examples.ts). IDs use lowercase kebab-case and must be unique. Add unit tests for registration, cancellation, validation, sanitization, and generated output.

Contributor checklist:

- Declare `local`, `localhost`, or `external` accurately.
- List the minimum required capabilities.
- Exclude secrets and original media from patches and output unless the user explicitly chose a media export.
- Return actionable `ValidationIssue` entries with a section and optional navigation target.
- Document failure and cancellation behavior.
