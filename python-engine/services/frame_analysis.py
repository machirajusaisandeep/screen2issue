from __future__ import annotations

from pathlib import Path

from services.cursor_detection import detect_cursor_events
from services.ocr import analyze_frame_text
from services.schemas import (
    EnhanceFramesManifest,
    EnhancedFrameResultModel,
    EnhancementResponse,
)


def analyze_frames(
    manifest: EnhanceFramesManifest,
    frame_paths: dict[str, Path],
) -> EnhancementResponse:
    cursor_events_by_frame = detect_cursor_events(manifest.frames, frame_paths)
    frame_results: list[EnhancedFrameResultModel] = []
    warnings: list[str] = []

    for frame in manifest.frames:
        frame_path = frame_paths.get(frame.frameId)
        if frame_path is None:
            warnings.append(f"Missing uploaded frame bytes for {frame.frameId}.")
            continue

        ocr_result = analyze_frame_text(frame_path)
        frame_results.append(
            EnhancedFrameResultModel(
                frameId=frame.frameId,
                ocrText=ocr_result.text,
                ocrConfidence=ocr_result.confidence,
                cursorEvents=cursor_events_by_frame.get(frame.frameId, []),
                detectedLabels=ocr_result.detected_labels,
                qualityScore=ocr_result.quality_score,
                warnings=ocr_result.warnings,
            )
        )

    return EnhancementResponse(frames=frame_results, warnings=warnings)
