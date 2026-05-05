from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
import pytesseract
from pytesseract import Output


@dataclass
class OcrFrameResult:
    text: str | None
    confidence: float | None
    detected_labels: list[str]
    quality_score: float
    warnings: list[str]


def analyze_frame_text(frame_path: Path) -> OcrFrameResult:
    image = cv2.imread(str(frame_path))
    if image is None:
        raise RuntimeError(f"Could not read frame image: {frame_path.name}")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    scaled = cv2.resize(gray, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC)
    thresholded = cv2.threshold(
        scaled,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )[1]

    config = "--oem 3 --psm 6"
    raw_text = pytesseract.image_to_string(thresholded, lang="eng", config=config)
    data = pytesseract.image_to_data(thresholded, lang="eng", config=config, output_type=Output.DICT)

    confidence_values = [
        float(value)
        for value in data.get("conf", [])
        if isinstance(value, (int, float, str)) and str(value) not in {"", "-1"}
    ]
    text = raw_text.strip() or None
    confidence = round(sum(confidence_values) / len(confidence_values), 1) if confidence_values else None
    detected_labels = extract_detected_labels(text)
    quality_score, warnings = assess_frame_quality(gray)

    return OcrFrameResult(
        text=text,
        confidence=confidence,
        detected_labels=detected_labels,
        quality_score=quality_score,
        warnings=warnings,
    )


def assess_frame_quality(gray_image: np.ndarray) -> tuple[float, list[str]]:
    sharpness = float(cv2.Laplacian(gray_image, cv2.CV_64F).var())
    contrast = float(gray_image.std())
    brightness = float(gray_image.mean()) / 255.0

    sharpness_score = min(sharpness / 180.0, 1.0)
    contrast_score = min(contrast / 80.0, 1.0)
    brightness_score = 1.0 - min(abs(brightness - 0.55) / 0.55, 1.0)
    quality_score = round(max(0.0, min((sharpness_score + contrast_score + brightness_score) / 3.0, 1.0)), 3)

    warnings: list[str] = []
    if sharpness < 45:
        warnings.append("Frame appears blurry; OCR confidence may be reduced.")
    if contrast < 28:
        warnings.append("Frame has low contrast; text may be hard to read.")
    if brightness < 0.18:
        warnings.append("Frame is very dark; enhanced detection may miss details.")

    return quality_score, warnings


def extract_detected_labels(text: str | None) -> list[str]:
    if not text:
        return []

    labels: list[str] = []
    for line in text.splitlines():
        cleaned = " ".join(line.split())
        if not cleaned:
            continue
        if len(cleaned) > 42:
            continue
        if len(cleaned.split()) > 5:
            continue
        labels.append(cleaned)
        if len(labels) == 5:
            break

    return labels
