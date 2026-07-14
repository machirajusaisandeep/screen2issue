from __future__ import annotations

import os
import sys
from pathlib import Path

import uvicorn

from main import app


def resolve_resource_root() -> Path:
    configured = os.environ.get("SCREEN2ISSUE_RESOURCE_DIR")
    if configured:
        return Path(configured).expanduser().resolve()

    executable = Path(sys.executable).resolve()
    if "Contents/MacOS" in executable.as_posix():
        return executable.parents[1] / "Resources" / "local-engine"

    return executable.parent


def configure_runtime(resource_root: Path) -> None:
    ffmpeg_dir = resource_root / "ffmpeg"
    tesseract_dir = resource_root / "tesseract"
    whisper_model_dir = resource_root / "models" / "whisper-small.en"
    tessdata_dir = tesseract_dir / "share" / "tessdata"

    os.environ["PATH"] = f"{ffmpeg_dir}:{tesseract_dir}:{os.environ.get('PATH', '')}"
    os.environ.setdefault("TESSDATA_PREFIX", str(tessdata_dir))
    os.environ.setdefault(
        "SCREEN2ISSUE_TESSERACT_BINARY",
        str(tesseract_dir / "tesseract"),
    )
    os.environ.setdefault(
        "SCREEN2ISSUE_FFMPEG_BINARY",
        str(ffmpeg_dir / "ffmpeg"),
    )
    os.environ.setdefault(
        "SCREEN2ISSUE_FFPROBE_BINARY",
        str(ffmpeg_dir / "ffprobe"),
    )
    os.environ.setdefault(
        "SCREEN2ISSUE_WHISPER_MODEL_PATH",
        str(whisper_model_dir),
    )


def main() -> None:
    resource_root = resolve_resource_root()
    configure_runtime(resource_root)

    port = int(os.environ.get("SCREEN2ISSUE_ENGINE_PORT", "8765"))
    log_level = os.environ.get("SCREEN2ISSUE_LOG_LEVEL", "warning")

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=port,
        log_level=log_level,
        reload=False,
    )


if __name__ == "__main__":
    main()
