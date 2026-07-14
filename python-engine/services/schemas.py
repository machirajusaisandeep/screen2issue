from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class FrameManifestItem(BaseModel):
    frameId: str
    timestampMs: int
    included: bool


class EnhanceFramesManifest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    frames: list[FrameManifestItem]


class LocalEngineCursorEventModel(BaseModel):
    id: str | None = None
    timestampMs: int | None = None
    type: str
    x: float | None = None
    y: float | None = None
    confidence: float
    note: str | None = None


class TranscriptSegmentModel(BaseModel):
    id: str
    startMs: int
    endMs: int
    text: str
    confidence: float | None = None


class EnhancedFrameResultModel(BaseModel):
    frameId: str
    ocrText: str | None = None
    ocrConfidence: float | None = None
    cursorEvents: list[LocalEngineCursorEventModel] = Field(default_factory=list)
    detectedLabels: list[str] = Field(default_factory=list)
    qualityScore: float | None = None
    warnings: list[str] = Field(default_factory=list)


class EnhancementResponse(BaseModel):
    frames: list[EnhancedFrameResultModel]
    transcript: list[TranscriptSegmentModel] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ExtractedFrameModel(BaseModel):
    id: str
    timestampMs: int
    imageUrl: str
    width: int
    height: int
    differenceScore: float
    included: bool = True


class FrameExtractionResponse(BaseModel):
    frames: list[ExtractedFrameModel]
    durationMs: int
    decoder: str


class TranscriptionResponse(BaseModel):
    hasAudio: bool
    segments: list[TranscriptSegmentModel] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    ok: bool
    engine: str
    version: str
    features: list[str]
