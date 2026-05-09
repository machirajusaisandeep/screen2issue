# Contributing to Screen2Issue

Thank you for your interest in contributing. This guide walks you through getting the project running locally and making a pull request.

## Prerequisites

- Node.js 20+
- npm

## Local Setup

```bash
git clone https://github.com/machirajusaisandeep/screen2issue.git
cd screen2issue
nvm use          # uses .nvmrc if present
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Optional: Python Engine

The local engine adds enhanced OCR, cursor detection, and audio transcription. It requires Python 3.10+, `ffmpeg`, `ffprobe`, and Tesseract installed on your machine.

```bash
cd python-engine
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8765 --reload
```

## Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |

## Before Opening a PR

1. Run `npm run lint` — fix any lint errors.
2. Run `npm run build` — ensure the build passes with no type errors.
3. Test your change manually end-to-end (upload a recording, check the timeline, export).
4. Keep PRs focused on one thing. If you are fixing a bug, fix only that bug.

## Good First Areas

- Better frame selection heuristics
- More robust OCR pre-processing
- Better HAR redaction rules
- UI polish and accessibility passes
- Additional export targets
- Unit tests for `src/lib/` utilities (Vitest)

## Commit Style

Use short imperative commit messages: `fix HAR redaction for multipart URLs`, `add cursor event toggle to timeline`. No ticket numbers required.

## Questions

Open a [GitHub Discussion](https://github.com/machirajusaisandeep/screen2issue/discussions) or comment on an existing issue.
