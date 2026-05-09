# Changelog

All notable changes to Screen2Issue will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versions follow [Semantic Versioning](https://semver.org/).

---

## [0.1.0] — 2026-05-08

### Added
- Local-first video processing: key-frame extraction, browser OCR (tesseract.js), and cursor/click detection — all in-browser with no backend
- Timeline review: include/exclude frame toggles, per-frame notes, OCR and cursor event editing
- Optional HAR import with sanitized request summaries and manual sync offset
- Optional localhost-only Python engine for enhanced OCR, cursor analysis, and English audio transcription
- AI-ready Markdown report generation with configurable Claude, Gemini, OpenAI, DeepSeek, and Ollama providers
- ZIP export with `bug-report.md`, `metadata.json`, and extracted frame PNGs
- Installable PWA with offline app shell support
- macOS DMG release via Tauri with bundled local engine sidecar
