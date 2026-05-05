# Screen2Issue Release Guide

This repo now supports three release surfaces from one codebase:

1. `macOS DMG` via Tauri and the bundled local engine
2. `Web app` via Vercel
3. `PWA` from the same hosted Vercel build

## 1. Initial GitHub import

The local repo is ready to push to:

- `https://github.com/machirajusaisandeep/screen2issue.git`

Recommended first push:

```bash
git push -u origin main
```

If GitHub returns a `403`, the local machine is authenticated as the wrong account or the repo does
not yet grant access to that account.

## 2. Local prerequisites

- Node.js `20.19.0+`
- npm
- Rust stable
- Python `3.13`
- Homebrew `ffmpeg` and `tesseract`
- A downloaded `faster-whisper` `small.en` model directory

Pinned helpers in this repo:

- `.nvmrc`
- `rust-toolchain.toml`

## 3. Browser-only web/PWA release

Install and verify locally:

```bash
nvm use
npm install
npm run lint
npm run build:web
```

Vercel deploy workflow:

- `.github/workflows/deploy-web-vercel.yml`

Required GitHub secrets:

- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VERCEL_TOKEN`

Behavior by hosted surface:

- Web and PWA keep the browser-only workflow public
- Step 4 still includes HAR import
- Local-engine actions stay hidden on hosted releases

## 4. macOS DMG release

Prepare the bundled local-engine resources:

```bash
python3 -m venv python-engine/.venv
source python-engine/.venv/bin/activate
pip install -r python-engine/requirements-desktop.txt
export SCREEN2ISSUE_WHISPER_MODEL_PATH="/absolute/path/to/small.en"
npm run build:desktop:sidecar
```

Then build the signed app bundle and DMG:

```bash
npm run build:desktop:mac
```

Or run the combined command:

```bash
npm run release:desktop:dmg
```

Desktop packaging layout:

- `src-tauri/`
- `src-tauri/resources/local-engine/`
- `python-engine/packaging/desktop_entry.py`
- `scripts/build-mac-sidecar.sh`

## 5. Signing and notarization

The macOS workflow expects Apple signing/notarization values in GitHub Actions.

Current workflow:

- `.github/workflows/release-macos-dmg.yml`

Expected secrets or environment values:

- `APPLE_SIGNING_IDENTITY`
- `APPLE_API_KEY`
- `APPLE_API_ISSUER`
- `APPLE_API_KEY_PATH`
- `SCREEN2ISSUE_WHISPER_MODEL_PATH`

For local release builds, export the equivalent values in your shell before running the DMG build.

## 6. Surface behavior summary

- `desktop`: bundled helper auto-starts and step 4 exposes enhanced OCR/transcription controls
- `web`: browser-only public release with HAR and export
- `pwa`: installable browser-only shell with offline-friendly assets
