# Screen2Issue

**Convert screen recordings into AI-ready bug reports locally.**

Screen2Issue turns a screen recording into a structured debugging report you can review, export, and paste into AI tools without sending your recording to a server.

## Why This Exists

Bug reports often arrive as videos with no searchable text, no timeline context, and no clean way to share the issue with engineers or AI tools. Screen2Issue narrows that gap:

1. Extract key frames from a recording.
2. Let you review the timeline and annotate what matters.
3. Automatically enrich the report with local OCR and experimental cursor detection.
4. Add optional enhancements like HAR import or a localhost-only Python engine.
5. Export a clean Markdown, JSON, or ZIP bundle for debugging.

## What Makes This Different?

Screen2Issue is not a generic video-to-PDF converter and not a full bug-reporting SaaS.

It solves one focused problem:

When someone sends you a screen recording of a bug, Screen2Issue turns that video into a searchable, AI-ready debugging report locally in your browser.

## Local-First Privacy Promise

- No account.
- No cloud processing.
- No analytics.
- Browser mode has no backend and keeps video processing in-browser.
- Optional enhanced mode sends data only to a Python engine running on `127.0.0.1` on your own machine.
- No recordings, screenshots, transcripts, or HAR summaries are sent to external services.
- The service worker caches the app shell and static assets only. Uploaded recordings and generated report downloads are not sent anywhere.

## Features

- Local-first video processing with browser-native `HTMLVideoElement` and Canvas APIs
- Key-frame extraction with lightweight visual diffing
- Automatic OCR during processing using local `tesseract.js`
- Automatic experimental cursor / click detection during processing
- Timeline review with include/exclude toggles and per-frame notes
- Optional HAR import with sanitized request summaries and manual sync offset
- Optional localhost-only Python engine for enhanced OCR, cursor analysis, and English audio transcription
- AI-ready Markdown report generation
- Sanitized JSON metadata export
- ZIP export with `bug-report.md`, `metadata.json`, and PNG screenshots
- Installable PWA with offline app shell support

## How To Run Locally

**Requirements:** Node.js 20+, npm

```bash
git clone https://github.com/your-org/screen2issue
cd screen2issue
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Optional local engine

Browser mode works with only the frontend. To enable enhanced OCR, enhanced cursor detection, and
audio transcription in step 4, run the optional FastAPI helper:

```bash
cd python-engine
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8765 --reload
```

Phase 1 assumes local `ffmpeg` / `ffprobe` and Tesseract OCR are already installed.

### Production build

```bash
npm run build
npm run preview
```

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build the production bundle |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build locally |

`npm install` also runs a small postinstall step that copies local OCR worker/model assets into `public/tesseract/` so OCR does not need a CDN.

## How To Use

1. Upload a screen recording (`.mp4`, `.webm`, `.mov`).
2. Wait for processing to extract key frames, run browser OCR, and detect likely cursor events locally.
3. Review the timeline, remove irrelevant frames, and edit notes/OCR/cursor events.
4. Open the enhancements step and optionally:
   - upload a HAR file with a sync offset
   - check the optional local engine
   - run enhanced frame detection locally
   - transcribe audio locally
5. Review the generated report in export.
6. Download Markdown, JSON, or ZIP, or copy the AI debugging prompt.

## Export Formats

### `bug-report.md`

Includes:

- Summary
- Video details
- Environment metadata
- Observed behavior
- Expected behavior
- Reproduction steps
- Timeline notes
- OCR text with browser-vs-enhanced provenance
- Cursor/click events with browser-vs-enhanced provenance
- Transcript segments when available
- Enhanced labels, frame quality notes, and enhancement warnings when available
- HAR summary when available

### `metadata.json`

Includes sanitized structured data for:

- Report content
- Environment metadata
- Included frames
- Browser and enhanced OCR output
- Browser and enhanced cursor events
- Transcript segments
- Local engine provenance and enhancement warnings
- HAR summary

### `screen2issue-report.zip`

Contains:

```text
screen2issue-report.zip
├─ bug-report.md
├─ metadata.json
└─ frames/
   ├─ frame-00-02.png
   ├─ frame-00-08.png
   └─ frame-00-12.png
```

## HAR Support

A HAR file is a browser-exported archive of network requests. It can help correlate what the UI showed with what the browser or API was doing.

Screen2Issue:

- Parses HAR files locally in the browser
- Keeps only a sanitized summary for export
- Does not export full request headers by default
- Does not export cookies by default
- Does not export full request or response bodies by default

### HAR Privacy Warning

HAR files may still contain sensitive URLs, query parameters, tokens, emails, or internal endpoints. Screen2Issue redacts query values in exported request URLs, but you should still review HAR-derived output before sharing it.

## OCR Notes

- OCR runs automatically during processing on the extracted frame set.
- OCR quality depends on text size, compression, scaling, and motion blur.
- OCR happens with local `tesseract.js` assets, not a remote API.
- Extracted text remains editable in the timeline.
- Step 4 can optionally layer enhanced OCR from the local Python engine on top of the browser baseline.

## Cursor Detection Notes

- Cursor detection is experimental.
- It uses simple frame-difference heuristics, not a full vision model.
- It runs automatically during processing.
- It works best when the recording shows a visible cursor or click highlight.
- Results are editable and removable in the timeline.
- Step 4 can optionally replace the active cursor view with enhanced localhost-only detections.

## Local Engine Notes

- The optional Python engine listens only on `127.0.0.1:8765`.
- Screen2Issue never talks to it automatically; you must click the local-engine actions in step 4.
- `Enhance Detection Locally` sends all extracted frames plus ids, timestamps, and included flags.
- `Transcribe Audio Locally` sends the original uploaded video file.
- Audio transcription is English-only in v1.

## PWA / Offline Behavior

- The app is installable as a PWA.
- The app shell works offline after first load.
- OCR worker/model assets are cached on demand after they are used.
- Uploaded videos and generated report downloads are not cached by the app itself.

## Roadmap

### Near-term

- Better cursor/click heuristics
- More OCR controls and cancellation
- Better HAR-to-timeline correlation
- Local-engine packaging so end users do not need separate installs

### Later

- Electron / Tauri desktop packaging
- Additional local analysis modules in the Enhancements step
- Optional local AI integration

## Contributing

Pull requests are welcome.

Good first areas:

- Better frame selection heuristics
- More robust OCR pre-processing
- Better HAR redaction rules
- UI polish and accessibility passes
- Additional export targets

## License

MIT — see [LICENSE](LICENSE).
