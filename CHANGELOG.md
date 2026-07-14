# Changelog

All notable changes to Screen2Issue are documented here. Versions follow [Semantic Versioning](https://semver.org/).

## [0.2.0] — 2026-07-14

### Added

- System, light, and dark themes with reduced-motion and small-screen support.
- Sanitized sample-project onboarding and versioned IndexedDB autosave for derived project data.
- Cancellable processing with retry, elapsed time, partial warnings, and recovery controls.
- Evidence filters, list/grid layouts, bulk include/exclude, undo, preview, and progressive disclosure.
- Export completeness checks, live output tabs, GitHub-ready issue Markdown, and clear copy feedback.
- Typed analyzer and exporter registries, diagnostic export, architecture documentation, and contributor guides.
- Vitest, Playwright, accessibility coverage, bundle-budget checks, and expanded CI gates.

### Changed

- Simplified the upload screen around one primary action and concise local-first messaging.
- Redesigned enhancement capabilities and AI data-boundary confirmation.
- Reworked the macOS installer with a focused branded drag-to-Applications layout.
- Improved the bundled local-engine packaging and macOS resource resolution.

### Fixed

- Restricted uploads to supported video formats with MIME, extension, size, and decode validation.
- Fixed desktop video processing by routing extraction through the bundled local engine.
- Prevented background shadows from bleeding through modal overlays.
- Improved compact navigation to avoid clipping and horizontal overflow at 768px.

## [0.1.0] — 2026-05-08

### Added

- Local-first video processing with key-frame extraction, browser OCR, and cursor detection.
- Timeline review with frame inclusion, notes, OCR, and cursor-event editing.
- Optional HAR import and localhost-only Python enrichment engine.
- AI-ready Markdown, JSON, and ZIP exports.
- Installable PWA and macOS DMG distribution.
