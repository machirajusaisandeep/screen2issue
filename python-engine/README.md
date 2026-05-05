# Screen2Issue Local Python Engine

This folder contains the optional phase-1 local engine for Screen2Issue. The React app works
without it, but if you run this service locally the Enhancements step can:

- enhance OCR on all extracted frames
- run best-effort cursor detection across those frames
- transcribe the uploaded video locally in English

## Privacy and network model

- The service binds only to `127.0.0.1:8765`.
- It is intended for local-only use from the Screen2Issue frontend.
- Raw screenshots, raw video/audio bytes, HAR payloads, and transcript text are not logged.
- Temporary files are written under `python-engine/tmp` and cleaned up after each request.

## Phase 1 assumptions

Phase 1 is a developer/bootstrap implementation. It assumes the local machine has:

- Python 3.11+
- `ffmpeg` / `ffprobe` on `PATH`
- Tesseract OCR installed and available on `PATH`

The transcription model uses `faster-whisper` with `small.en`. In phase 1 it may download to the
local Faster Whisper cache the first time it is used. Packaging that model into the app is the
phase-2 job.

## Desktop packaging

The repo also includes desktop packaging scaffolding for the macOS release path:

- `requirements-desktop.txt` adds PyInstaller
- `packaging/desktop_entry.py` is the frozen helper entrypoint
- `scripts/build-mac-sidecar.sh` builds the helper and copies bundled resources into `src-tauri/resources/local-engine`

For the desktop sidecar build, set `SCREEN2ISSUE_WHISPER_MODEL_PATH` to a downloaded `small.en`
model directory before running the build script.

## Install

```bash
cd /Users/sandeepmachiraju/Documents/projects/screen2issue/python-engine
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
cd /Users/sandeepmachiraju/Documents/projects/screen2issue/python-engine
source .venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8765 --reload
```

## Endpoints

- `GET /health`
- `POST /enhance-frames`
- `POST /transcribe-video`
- `POST /analyze-video`

`/enhance-frames` expects:

- a `manifest` JSON file describing frame ids, timestamps, and included flags
- one uploaded image file per extracted frame in the `frames` form field

`/transcribe-video` expects:

- a `video` upload
- an optional `manifest` JSON file with video metadata

## Notes on the current implementation

- OCR is best-effort and optimized for UI text rather than document fidelity.
- Cursor detection is experimental and based on visual change heuristics between frames.
- Audio transcription is English-only in v1.
- `/analyze-video` is a simple orchestration endpoint kept ready for future frontend use.
