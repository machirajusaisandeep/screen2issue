from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from services.schemas import FrameManifestItem, LocalEngineCursorEventModel


def detect_cursor_events(
    frames: list[FrameManifestItem],
    frame_paths: dict[str, Path],
) -> dict[str, list[LocalEngineCursorEventModel]]:
    sorted_frames = sorted(frames, key=lambda frame: frame.timestampMs)
    prepared_images: list[tuple[FrameManifestItem, np.ndarray]] = []

    for frame in sorted_frames:
        path = frame_paths.get(frame.frameId)
        if path is None:
            continue
        image = cv2.imread(str(path))
        if image is None:
            continue
        prepared_images.append((frame, normalize_for_diff(image)))

    events_by_frame: dict[str, list[LocalEngineCursorEventModel]] = {
        frame.frameId: [] for frame in sorted_frames
    }

    for index in range(1, len(prepared_images)):
        current_frame, current_image = prepared_images[index]
        _, previous_image = prepared_images[index - 1]
        diff = cv2.absdiff(current_image, previous_image)
        _, binary = cv2.threshold(diff, 32, 255, cv2.THRESH_BINARY)
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue

        image_height, image_width = binary.shape
        image_area = image_height * image_width
        candidate = max(contours, key=cv2.contourArea)
        area = float(cv2.contourArea(candidate))
        if area < image_area * 0.00005 or area > image_area * 0.02:
            continue

        x, y, width, height = cv2.boundingRect(candidate)
        centroid_x = x + (width / 2.0)
        centroid_y = y + (height / 2.0)
        confidence = max(0.35, min(0.95, (area / (image_area * 0.0025)) * 0.7))
        event_type = "possible_click" if area < image_area * 0.0012 else "possible_cursor_move"

        events_by_frame[current_frame.frameId] = [
            LocalEngineCursorEventModel(
                timestampMs=current_frame.timestampMs,
                type=event_type,
                x=round((centroid_x / image_width) * 100, 1),
                y=round((centroid_y / image_height) * 100, 1),
                confidence=round(float(confidence), 2),
            )
        ]

    return events_by_frame


def normalize_for_diff(image: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (640, 360), interpolation=cv2.INTER_AREA)
    return cv2.GaussianBlur(resized, (5, 5), 0)
