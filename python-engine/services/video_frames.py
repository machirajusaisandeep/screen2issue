from __future__ import annotations

import base64
from pathlib import Path
from uuid import uuid4

import av
import numpy as np
from PIL import Image

from services.schemas import ExtractedFrameModel, FrameExtractionResponse


MAX_FRAMES = 30
FRAME_INTERVAL_SECONDS = 1.0
DIFFERENCE_THRESHOLD = 0.08
COMPARE_SIZE = (160, 90)


def extract_video_frames(video_path: Path, output_dir: Path) -> FrameExtractionResponse:
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        container = av.open(str(video_path))
    except av.error.FFmpegError as error:
        raise RuntimeError("The selected file does not contain a readable video stream.") from error

    with container:
        stream = next((candidate for candidate in container.streams if candidate.type == "video"), None)
        if stream is None:
            raise RuntimeError("The selected file does not contain a video stream.")

        duration = _duration_seconds(container, stream)
        if duration <= 0:
            raise RuntimeError("Could not determine the recording duration.")

        interval = max(FRAME_INTERVAL_SECONDS, duration / max(1, MAX_FRAMES - 1))
        next_sample_time = 0.0
        sampled: list[tuple[float, Image.Image]] = []

        try:
            for frame in container.decode(stream):
                timestamp = float(frame.time or 0.0)
                if timestamp + 0.001 < next_sample_time:
                    continue

                sampled.append((timestamp, frame.to_image().convert("RGB")))
                next_sample_time += interval
                while next_sample_time <= timestamp:
                    next_sample_time += interval
                if len(sampled) >= MAX_FRAMES:
                    break
        except (av.error.FFmpegError, ValueError) as error:
            raise RuntimeError(f"The bundled decoder could not read this recording: {error}") from error

    if not sampled:
        raise RuntimeError("The bundled decoder did not produce any frames.")

    kept: list[ExtractedFrameModel] = []
    previous_comparison: np.ndarray | None = None
    for index, (timestamp, image) in enumerate(sampled):
        comparison = np.asarray(image.resize(COMPARE_SIZE), dtype=np.int16)
        difference = (
            1.0
            if previous_comparison is None
            else float(np.abs(comparison - previous_comparison).mean() / 255.0)
        )
        is_last = index == len(sampled) - 1
        if index != 0 and not is_last and difference < DIFFERENCE_THRESHOLD:
            continue

        frame_path = output_dir / f"frame-{index:04d}.jpg"
        image.save(frame_path, format="JPEG", quality=82, optimize=True)
        encoded = base64.b64encode(frame_path.read_bytes()).decode("ascii")
        kept.append(
            ExtractedFrameModel(
                id=uuid4().hex,
                timestampMs=round(timestamp * 1000),
                imageUrl=f"data:image/jpeg;base64,{encoded}",
                width=image.width,
                height=image.height,
                differenceScore=round(difference, 2),
                included=True,
            )
        )
        previous_comparison = comparison

    return FrameExtractionResponse(
        frames=kept,
        durationMs=round(duration * 1000),
        decoder="bundled-ffmpeg",
    )


def _duration_seconds(container: av.container.InputContainer, stream: av.video.stream.VideoStream) -> float:
    if container.duration is not None:
        return float(container.duration / av.time_base)
    if stream.duration is not None and stream.time_base is not None:
        return float(stream.duration * stream.time_base)
    return 0.0
