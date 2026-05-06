import type {
  LocalEngineStatus,
  TranscriptSegment,
} from '@/lib/localEngine/types'

export type ExtractedFrame = {
  id: string
  timestampMs: number
  imageUrl: string
  differenceScore: number
  included: boolean
  note?: string
  ocrText?: string
  ocrConfidence?: number
  enhancedOcrText?: string
  enhancedOcrConfidence?: number
  enhancedDetectedLabels?: string[]
  enhancedQualityScore?: number
  enhancedWarnings?: string[]
  enhancedCursorAnalysisApplied?: boolean
  aiScreenshotAnalysis?: string
  aiOcrCorrection?: string
}

export type CursorEventType = 'possible_click' | 'possible_cursor_move'

export type CursorEvent = {
  id: string
  timestampMs: number
  type: CursorEventType
  x?: number
  y?: number
  confidence: number
  note?: string
}

export type HarEntrySummary = {
  id: string
  startedDateTime?: string
  relativeStartedMs?: number
  offsetMs?: number
  method: string
  url: string
  status?: number
  statusText?: string
  durationMs?: number
  requestSizeBytes?: number
  responseSizeBytes?: number
  isError: boolean
  isSlow: boolean
  failureReason?: string
}

export type HarSummary = {
  fileName: string
  importedAt: string
  syncOffsetMs: number
  totalRequests: number
  errorCount: number
  slowRequestCount: number
  entries: HarEntrySummary[]
}

export type EnvironmentMetadata = {
  userAgent: string
  language: string
  languages: string[]
  platform: string
  viewport: string
  screen: string
  devicePixelRatio: number
  standalone: boolean
}

export type BugReport = {
  title: string
  summary: string
  videoName: string
  videoType: string
  videoSizeBytes: number
  videoDurationMs: number
  createdAt: string
  environment: EnvironmentMetadata
  frames: ExtractedFrame[]
  observedBehavior: string
  expectedBehavior: string
  reproductionSteps: string[]
  harSummary?: HarSummary
  browserCursorEvents: CursorEvent[]
  enhancedCursorEvents: CursorEvent[]
  transcriptSegments: TranscriptSegment[]
  localEngineStatus: LocalEngineStatus
  enhancementWarnings: string[]
  aiActivitySummary?: string
  aiHarInsights?: string
  aiTranscriptInsights?: string
  aiEnhancedPrompt?: string
}

export type ProcessingStep =
  | 'idle'
  | 'loading'
  | 'extracting'
  | 'comparing'
  | 'timeline'
  | 'ready'
  | 'error'

export type AppStep = 'upload' | 'processing' | 'timeline' | 'enhancements' | 'export'
