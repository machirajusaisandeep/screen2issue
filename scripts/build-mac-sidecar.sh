#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_VENV="$ROOT_DIR/python-engine/.venv"
PYTHON_BIN="$PYTHON_VENV/bin/python"
PIP_BIN="$PYTHON_VENV/bin/pip"
PYINSTALLER_BIN="$PYTHON_VENV/bin/pyinstaller"
RESOURCE_ROOT="$ROOT_DIR/src-tauri/resources/local-engine"
BIN_DIR="$RESOURCE_ROOT/bin"
FFMPEG_DIR="$RESOURCE_ROOT/ffmpeg"
TESSERACT_DIR="$RESOURCE_ROOT/tesseract"
TESSDATA_DIR="$TESSERACT_DIR/share/tessdata"
MODEL_TARGET_DIR="$RESOURCE_ROOT/models/whisper-small.en"
MODEL_SOURCE_DIR="${SCREEN2ISSUE_WHISPER_MODEL_PATH:-}"

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "python-engine/.venv is missing. Create it first and install the desktop requirements." >&2
  exit 1
fi

if [[ -z "$MODEL_SOURCE_DIR" ]]; then
  echo "Set SCREEN2ISSUE_WHISPER_MODEL_PATH to the downloaded small.en model directory before building the desktop sidecar." >&2
  exit 1
fi

if [[ ! -d "$MODEL_SOURCE_DIR" ]]; then
  echo "SCREEN2ISSUE_WHISPER_MODEL_PATH does not point to an existing directory: $MODEL_SOURCE_DIR" >&2
  exit 1
fi

"$PIP_BIN" install -r "$ROOT_DIR/python-engine/requirements-desktop.txt"

rm -rf "$BIN_DIR" "$FFMPEG_DIR" "$TESSERACT_DIR" "$RESOURCE_ROOT/models"
mkdir -p "$RESOURCE_ROOT" "$BIN_DIR" "$FFMPEG_DIR" "$TESSDATA_DIR" "$MODEL_TARGET_DIR"

"$PYINSTALLER_BIN" \
  --noconfirm \
  --clean \
  --onedir \
  --paths "$ROOT_DIR/python-engine" \
  "$ROOT_DIR/python-engine/packaging/desktop_entry.py" \
  --name "screen2issue-local-engine-aarch64-apple-darwin" \
  --distpath "$BIN_DIR" \
  --workpath "$ROOT_DIR/python-engine/build/pyinstaller" \
  --specpath "$ROOT_DIR/python-engine/build/spec"

cp "$(command -v ffmpeg)" "$FFMPEG_DIR/ffmpeg"
cp "$(command -v ffprobe)" "$FFMPEG_DIR/ffprobe"
cp "$(command -v tesseract)" "$TESSERACT_DIR/tesseract"

if command -v brew >/dev/null 2>&1; then
  TESS_PREFIX="$(brew --prefix tesseract)"
else
  echo "Homebrew is required to locate the packaged tessdata files." >&2
  exit 1
fi

cp "$TESS_PREFIX/share/tessdata/eng.traineddata" "$TESSDATA_DIR/eng.traineddata"
cp "$TESS_PREFIX/share/tessdata/osd.traineddata" "$TESSDATA_DIR/osd.traineddata"
cp "$TESS_PREFIX/share/tessdata/snum.traineddata" "$TESSDATA_DIR/snum.traineddata"
rsync -a "$MODEL_SOURCE_DIR/" "$MODEL_TARGET_DIR/"

while IFS= read -r -d '' linked_file; do
  materialized_file="${linked_file}.materialized"
  if [[ -d "$linked_file" ]]; then
    cp -RL "$linked_file" "$materialized_file"
  else
    cp -L "$linked_file" "$materialized_file"
  fi
  rm "$linked_file"
  mv "$materialized_file" "$linked_file"
done < <(find "$BIN_DIR/screen2issue-local-engine-aarch64-apple-darwin" -type l -print0)

chmod +x "$BIN_DIR/screen2issue-local-engine-aarch64-apple-darwin/screen2issue-local-engine-aarch64-apple-darwin"
chmod +x "$FFMPEG_DIR/ffmpeg" "$FFMPEG_DIR/ffprobe" "$TESSERACT_DIR/tesseract"
chmod -R u+rwX "$RESOURCE_ROOT"

echo "Desktop sidecar resources prepared in $RESOURCE_ROOT"
