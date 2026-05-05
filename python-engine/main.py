from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from services.audio_transcription import transcribe_video_file
from services.frame_analysis import analyze_frames
from services.schemas import (
    EnhanceFramesManifest,
    EnhancementResponse,
    HealthResponse,
    TranscriptionResponse,
)
from services.tempfiles import managed_temp_dir, save_upload_file


logger = logging.getLogger("screen2issue.local_engine")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")

ALLOWED_ORIGINS = [
    "http://127.0.0.1",
    "http://127.0.0.1:5173",
    "http://localhost",
    "http://localhost:5173",
    "http://tauri.localhost",
    "https://tauri.localhost",
    "tauri://localhost",
]

app = FastAPI(title="Screen2Issue Local Engine", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        ok=True,
        engine="screen2issue-local-engine",
        version=app.version,
        features=["ocr", "cursor_detection", "audio_transcription"],
    )


@app.post("/enhance-frames", response_model=EnhancementResponse)
async def enhance_frames(
    manifest: Annotated[UploadFile, File(...)],
    frames: Annotated[list[UploadFile], File(...)],
) -> EnhancementResponse:
    parsed_manifest = _parse_manifest(manifest)

    with managed_temp_dir("enhance-frames-") as temp_dir:
        frame_paths: dict[str, Path] = {}

        for upload in frames:
            frame_id = Path(upload.filename or "").stem
            if not frame_id:
                continue
            target_path = temp_dir / f"{frame_id}.png"
            await save_upload_file(upload, target_path)
            frame_paths[frame_id] = target_path

        logger.info(
            "enhance_frames received frame_count=%s manifest_count=%s",
            len(frame_paths),
            len(parsed_manifest.frames),
        )

        try:
            return analyze_frames(parsed_manifest, frame_paths)
        except Exception as error:  # pragma: no cover - surfaced to frontend
            logger.exception("enhance_frames failed: %s", error.__class__.__name__)
            raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/transcribe-video", response_model=TranscriptionResponse)
async def transcribe_video(
    video: Annotated[UploadFile, File(...)],
    manifest: UploadFile | None = File(default=None),
) -> TranscriptionResponse:
    if manifest is not None:
        _parse_json_upload(manifest)

    with managed_temp_dir("transcribe-video-") as temp_dir:
        video_name = video.filename or "uploaded-video"
        target_path = temp_dir / video_name
        await save_upload_file(video, target_path)

        logger.info("transcribe_video received video_name=%s", video_name)

        try:
            return transcribe_video_file(target_path)
        except Exception as error:  # pragma: no cover - surfaced to frontend
            logger.exception("transcribe_video failed: %s", error.__class__.__name__)
            raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/analyze-video", response_model=EnhancementResponse)
async def analyze_video(
    video: Annotated[UploadFile, File(...)],
) -> EnhancementResponse:
    with managed_temp_dir("analyze-video-") as temp_dir:
        video_name = video.filename or "uploaded-video"
        target_path = temp_dir / video_name
        await save_upload_file(video, target_path)

        logger.info("analyze_video received video_name=%s", video_name)

        transcription = transcribe_video_file(target_path)
        return EnhancementResponse(
            frames=[],
            transcript=transcription.segments,
            warnings=transcription.warnings,
        )


def _parse_manifest(upload: UploadFile) -> EnhanceFramesManifest:
    try:
        payload = _parse_json_upload(upload)
        return EnhanceFramesManifest.model_validate(payload)
    except Exception as error:  # pragma: no cover - surfaced to frontend
        raise HTTPException(status_code=400, detail="Invalid manifest payload.") from error


def _parse_json_upload(upload: UploadFile) -> dict:
    try:
        return json.loads(upload.file.read().decode("utf-8"))
    except Exception as error:  # pragma: no cover - surfaced to frontend
        raise HTTPException(status_code=400, detail="Invalid JSON payload.") from error


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8765)
