import type {
  BugReport,
  CursorEvent,
  CursorEventType,
  ExtractedFrame,
  HarEntrySummary,
} from '@/types/report'
import type { TranscriptSegment } from '@/lib/localEngine/types'
import {
  formatDuration,
  formatSignedTimestamp,
  formatTimestamp,
  formatTimestampForFile,
} from '@/lib/video/formatTimestamp'

const CURSOR_FRAME_WINDOW_MS = 600
const HAR_FRAME_WINDOW_MS = 1800
const TRANSCRIPT_FRAME_WINDOW_MS = 1200

export const CURSOR_CONFIDENCE_THRESHOLD = 0.55

export type OcrSource = 'browser' | 'enhanced' | 'none'
export type CursorSource = 'browser' | 'enhanced' | 'none'

export type ExportFrameMetadata = {
  id: string
  timestampMs: number
  timestamp: string
  fileName: string
  differenceScore: number
  note?: string
  browserOcrText?: string
  browserOcrConfidence?: number
  enhancedOcrText?: string
  enhancedOcrConfidence?: number
  effectiveOcrText?: string
  effectiveOcrConfidence?: number
  ocrSource: OcrSource
  cursorEvents: CursorEvent[]
  browserCursorEvents: CursorEvent[]
  enhancedCursorEvents: CursorEvent[]
  cursorEventSource: CursorSource
  transcriptSegments: TranscriptSegment[]
  detectedLabels: string[]
  qualityScore?: number
  warnings: string[]
  harEntries: HarEntrySummary[]
}

export type ExportMetadata = {
  reportTitle: string
  summary: string
  observedBehavior: string
  expectedBehavior: string
  reproductionSteps: string[]
  videoFileName: string
  videoType: string
  videoSizeBytes: number
  videoDurationMs: number
  videoDuration: string
  reportCreatedAt: string
  generatedAt: string
  environment: BugReport['environment']
  includedFrames: ExportFrameMetadata[]
  browserCursorEvents?: CursorEvent[]
  enhancedCursorEvents?: CursorEvent[]
  transcriptSegments?: TranscriptSegment[]
  harSummary?: BugReport['harSummary']
  enhancementWarnings?: string[]
  localEngineStatus?: BugReport['localEngineStatus']
  analysisProvenance: {
    browserMode: true
    localEngineUsed: boolean
    enhancedOcrFrames: number
    enhancedCursorFrames: number
    enhancedCursorEvents: number
    transcriptSegments: number
    harIncluded: boolean
  }
}

export function getIncludedFrames(report: BugReport): ExtractedFrame[] {
  return report.frames.filter((frame) => frame.included)
}

export function getFrameFileName(timestampMs: number): string {
  return `frame-${formatTimestampForFile(timestampMs)}.png`
}

export function getNearbyCursorEvents(
  events: CursorEvent[],
  timestampMs: number,
  windowMs = CURSOR_FRAME_WINDOW_MS,
): CursorEvent[] {
  return events.filter((event) => Math.abs(event.timestampMs - timestampMs) <= windowMs)
}

export function getFrameOcrSource(frame: ExtractedFrame): OcrSource {
  if (frame.enhancedOcrText !== undefined || frame.enhancedOcrConfidence !== undefined) {
    return 'enhanced'
  }

  if (frame.ocrText !== undefined || frame.ocrConfidence !== undefined) {
    return 'browser'
  }

  return 'none'
}

export function getEffectiveFrameOcr(frame: ExtractedFrame): {
  confidence?: number
  source: OcrSource
  text?: string
} {
  const source = getFrameOcrSource(frame)

  if (source === 'enhanced') {
    return {
      source,
      text: frame.enhancedOcrText,
      confidence: frame.enhancedOcrConfidence,
    }
  }

  if (source === 'browser') {
    return {
      source,
      text: frame.ocrText,
      confidence: frame.ocrConfidence,
    }
  }

  return { source }
}

export function countFramesWithEffectiveOcr(frames: ExtractedFrame[]): number {
  return frames.filter((frame) => {
    const ocr = getEffectiveFrameOcr(frame)
    return Boolean(cleanOptionalText(ocr.text))
  }).length
}

export function getNearbyTranscriptSegments(
  report: BugReport,
  timestampMs: number,
  windowMs = TRANSCRIPT_FRAME_WINDOW_MS,
): TranscriptSegment[] {
  return report.transcriptSegments
    .filter((segment) => {
      if (timestampMs >= segment.startMs && timestampMs <= segment.endMs) return true

      const distance = Math.min(
        Math.abs(segment.startMs - timestampMs),
        Math.abs(segment.endMs - timestampMs),
      )
      return distance <= windowMs
    })
    .sort((left, right) => left.startMs - right.startMs)
}

export function getPreferredCursorEventsForFrame(
  report: BugReport,
  frame: ExtractedFrame,
  windowMs = CURSOR_FRAME_WINDOW_MS,
): {
  browserEvents: CursorEvent[]
  cursorEvents: CursorEvent[]
  enhancedEvents: CursorEvent[]
  source: CursorSource
} {
  const enhancedEvents = getNearbyCursorEvents(
    report.enhancedCursorEvents,
    frame.timestampMs,
    windowMs,
  ).filter((event) => event.confidence >= CURSOR_CONFIDENCE_THRESHOLD)
  const browserEvents = getNearbyCursorEvents(
    report.browserCursorEvents,
    frame.timestampMs,
    windowMs,
  ).filter((event) => event.confidence >= CURSOR_CONFIDENCE_THRESHOLD)

  if (frame.enhancedCursorAnalysisApplied) {
    return {
      source: 'enhanced',
      cursorEvents: enhancedEvents,
      enhancedEvents,
      browserEvents,
    }
  }

  if (enhancedEvents.length > 0) {
    return {
      source: 'enhanced',
      cursorEvents: enhancedEvents,
      enhancedEvents,
      browserEvents,
    }
  }

  if (browserEvents.length > 0) {
    return {
      source: 'browser',
      cursorEvents: browserEvents,
      enhancedEvents,
      browserEvents,
    }
  }

  return {
    source: 'none',
    cursorEvents: [],
    enhancedEvents,
    browserEvents,
  }
}

export function countFramesWithEnhancedCursorData(report: BugReport): number {
  return report.frames.filter((frame) => frame.enhancedCursorAnalysisApplied).length
}

export function getSuspiciousHarEntries(report: BugReport): HarEntrySummary[] {
  return report.harSummary?.entries.filter((entry) => entry.isError || entry.isSlow) ?? []
}

export function getNearbyHarEntries(
  report: BugReport,
  timestampMs: number,
  windowMs = HAR_FRAME_WINDOW_MS,
): HarEntrySummary[] {
  return getSuspiciousHarEntries(report).filter((entry) => {
    if (typeof entry.offsetMs !== 'number') return false
    return Math.abs(entry.offsetMs - timestampMs) <= windowMs
  })
}

export function buildReportMetadata(report: BugReport): ExportMetadata {
  const includedFrames = getIncludedFrames(report).map((frame) => ({
    ...buildFrameMetadata(report, frame),
  }))

  const enhancedOcrFrames = report.frames.filter(
    (frame) => frame.enhancedOcrText !== undefined || frame.enhancedOcrConfidence !== undefined,
  ).length
  const transcriptSegments = report.transcriptSegments.length > 0 ? report.transcriptSegments : undefined
  const browserCursorEvents =
    report.browserCursorEvents.length > 0 ? report.browserCursorEvents : undefined
  const enhancedCursorEvents =
    report.enhancedCursorEvents.length > 0 ? report.enhancedCursorEvents : undefined
  const enhancementWarnings =
    report.enhancementWarnings.length > 0 ? report.enhancementWarnings : undefined

  return {
    reportTitle: report.title,
    summary: report.summary,
    observedBehavior: report.observedBehavior,
    expectedBehavior: report.expectedBehavior,
    reproductionSteps: report.reproductionSteps.filter(Boolean).map((step) => step.trim()),
    videoFileName: report.videoName,
    videoType: report.videoType,
    videoSizeBytes: report.videoSizeBytes,
    videoDurationMs: report.videoDurationMs,
    videoDuration: formatDuration(report.videoDurationMs),
    reportCreatedAt: report.createdAt,
    generatedAt: new Date().toISOString(),
    environment: report.environment,
    includedFrames,
    browserCursorEvents,
    enhancedCursorEvents,
    transcriptSegments,
    harSummary: report.harSummary,
    enhancementWarnings,
    localEngineStatus: report.localEngineStatus,
    analysisProvenance: {
      browserMode: true,
      localEngineUsed:
        enhancedOcrFrames > 0 ||
        countFramesWithEnhancedCursorData(report) > 0 ||
        report.transcriptSegments.length > 0,
      enhancedOcrFrames,
      enhancedCursorFrames: countFramesWithEnhancedCursorData(report),
      enhancedCursorEvents: report.enhancedCursorEvents.length,
      transcriptSegments: report.transcriptSegments.length,
      harIncluded: Boolean(report.harSummary),
    },
  }
}

export function buildFrameMetadata(report: BugReport, frame: ExtractedFrame): ExportFrameMetadata {
  const ocr = getEffectiveFrameOcr(frame)
  const cursor = getPreferredCursorEventsForFrame(report, frame)

  return {
    id: frame.id,
    timestampMs: frame.timestampMs,
    timestamp: formatTimestamp(frame.timestampMs),
    fileName: getFrameFileName(frame.timestampMs),
    differenceScore: frame.differenceScore,
    note: cleanOptionalText(frame.note),
    browserOcrText: cleanOptionalText(frame.ocrText),
    browserOcrConfidence: frame.ocrConfidence,
    enhancedOcrText: cleanOptionalText(frame.enhancedOcrText),
    enhancedOcrConfidence: frame.enhancedOcrConfidence,
    effectiveOcrText: cleanOptionalText(ocr.text),
    effectiveOcrConfidence: ocr.confidence,
    ocrSource: ocr.source,
    cursorEvents: cursor.cursorEvents,
    browserCursorEvents: cursor.browserEvents,
    enhancedCursorEvents: cursor.enhancedEvents,
    cursorEventSource: cursor.source,
    transcriptSegments: getNearbyTranscriptSegments(report, frame.timestampMs),
    detectedLabels: frame.enhancedDetectedLabels ?? [],
    qualityScore: frame.enhancedQualityScore,
    warnings: frame.enhancedWarnings ?? [],
    harEntries: getNearbyHarEntries(report, frame.timestampMs),
  }
}

export function formatCursorEventLabel(event: CursorEvent): string {
  const eventType = CURSOR_EVENT_LABELS[event.type]
  const location =
    typeof event.x === 'number' && typeof event.y === 'number'
      ? ` near ${Math.round(event.x)}%, ${Math.round(event.y)}%`
      : ''

  return `${eventType}${location} (${Math.round(event.confidence * 100)}% confidence)`
}

export function formatHarEntryLabel(entry: HarEntrySummary): string {
  const timing =
    typeof entry.offsetMs === 'number' ? formatSignedTimestamp(entry.offsetMs) : 'n/a'
  const status = entry.status ? `${entry.status} ${entry.statusText ?? ''}`.trim() : 'failed'
  const duration = typeof entry.durationMs === 'number' ? ` in ${Math.round(entry.durationMs)}ms` : ''
  return `${timing} ${entry.method} ${entry.url} -> ${status}${duration}`
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes} B`

  const units = ['KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = -1

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

function cleanOptionalText(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const CURSOR_EVENT_LABELS: Record<CursorEventType, string> = {
  possible_click: 'Possible click',
  possible_cursor_move: 'Possible cursor movement',
}
