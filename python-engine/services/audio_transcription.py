from __future__ import annotations

import shutil
import subprocess
from functools import lru_cache
import os
from pathlib import Path

from faster_whisper import WhisperModel

from services.schemas import TranscriptSegmentModel, TranscriptionResponse


def transcribe_video_file(video_path: Path) -> TranscriptionResponse:
    warnings: list[str] = []
    has_audio = detect_audio_stream(video_path)
    if not has_audio:
        return TranscriptionResponse(
            hasAudio=False,
            segments=[],
            warnings=["No audio track was detected in the uploaded recording."],
        )

    try:
        model = get_transcription_model()
        segments, _info = model.transcribe(
            str(video_path),
            task="transcribe",
            language="en",
            beam_size=5,
            vad_filter=True,
        )
    except FileNotFoundError as error:
        raise RuntimeError("ffmpeg must be installed and available on PATH.") from error
    except Exception as error:
        raise RuntimeError(f"Audio transcription failed: {error}") from error

    transcript_segments = [
        TranscriptSegmentModel(
            id=f"segment-{index}",
            startMs=int(segment.start * 1000),
            endMs=int(segment.end * 1000),
            text=segment.text.strip(),
            confidence=None,
        )
        for index, segment in enumerate(segments, start=1)
        if segment.text.strip()
    ]

    if not transcript_segments:
        warnings.append("No speech was recognized in the local transcription pass.")

    return TranscriptionResponse(
        hasAudio=True,
        segments=transcript_segments,
        warnings=warnings,
    )


def detect_audio_stream(video_path: Path) -> bool:
    ffprobe_path = os.environ.get("SCREEN2ISSUE_FFPROBE_BINARY") or shutil.which("ffprobe")
    if not ffprobe_path:
        return True

    result = subprocess.run(
        [
            ffprobe_path,
            "-v",
            "error",
            "-select_streams",
            "a",
            "-show_entries",
            "stream=index",
            "-of",
            "csv=p=0",
            str(video_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    return bool(result.stdout.strip())


@lru_cache(maxsize=1)
def get_transcription_model() -> WhisperModel:
    model_path = os.environ.get("SCREEN2ISSUE_WHISPER_MODEL_PATH", "small.en")
    return WhisperModel(model_path, device="cpu", compute_type="int8")
