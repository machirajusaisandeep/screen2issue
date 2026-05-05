export type LocalEngineCursorEventType = 'possible_click' | 'possible_cursor_move'

export type LocalEngineCursorEvent = {
  id?: string
  timestampMs?: number
  type: LocalEngineCursorEventType
  x?: number
  y?: number
  confidence: number
  note?: string
}

export type TranscriptSegment = {
  id: string
  startMs: number
  endMs: number
  text: string
  confidence?: number
}

export type EnhancedFrameResult = {
  frameId: string
  ocrText?: string
  ocrConfidence?: number
  cursorEvents?: LocalEngineCursorEvent[]
  detectedLabels?: string[]
  qualityScore?: number
  warnings?: string[]
}

export type EnhancementResult = {
  frames: EnhancedFrameResult[]
  transcript?: TranscriptSegment[]
  warnings?: string[]
}

export type TranscriptionResult = {
  hasAudio: boolean
  segments: TranscriptSegment[]
  warnings?: string[]
}

export type LocalEngineHealth = {
  ok: boolean
  engine: string
  version: string
  features: string[]
}

export type LocalEngineState =
  | 'idle'
  | 'checking'
  | 'not_connected'
  | 'connected'
  | 'enhancing'
  | 'complete'
  | 'error'

export type LocalEngineStatus = {
  state: LocalEngineState
  health?: LocalEngineHealth
  lastError?: string
  lastCheckedAt?: string
}
