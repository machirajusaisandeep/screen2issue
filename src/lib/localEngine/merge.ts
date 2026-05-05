import { nanoid } from 'nanoid'
import type {
  EnhancementResult,
  LocalEngineStatus,
  TranscriptSegment,
  TranscriptionResult,
} from '@/lib/localEngine/types'
import type { BugReport, CursorEvent, ExtractedFrame } from '@/types/report'

export function applyEnhancementResult(
  report: BugReport,
  result: EnhancementResult,
): BugReport {
  const resultByFrameId = new Map(result.frames.map((frame) => [frame.frameId, frame]))
  const enhancedCursorEvents: CursorEvent[] = []

  const frames = report.frames.map((frame) => {
    const enhanced = resultByFrameId.get(frame.id)
    if (!enhanced) return frame

    for (const cursorEvent of enhanced.cursorEvents ?? []) {
      enhancedCursorEvents.push({
        id: cursorEvent.id ?? nanoid(),
        timestampMs: cursorEvent.timestampMs ?? frame.timestampMs,
        type: cursorEvent.type,
        x: cursorEvent.x,
        y: cursorEvent.y,
        confidence: cursorEvent.confidence,
        note: cursorEvent.note,
      })
    }

    return {
      ...frame,
      enhancedOcrText: enhanced.ocrText,
      enhancedOcrConfidence: enhanced.ocrConfidence,
      enhancedDetectedLabels: dedupeStrings(enhanced.detectedLabels),
      enhancedQualityScore: enhanced.qualityScore,
      enhancedWarnings: dedupeStrings(enhanced.warnings),
      enhancedCursorAnalysisApplied: true,
    } satisfies ExtractedFrame
  })

  return {
    ...report,
    frames,
    enhancedCursorEvents,
    transcriptSegments: mergeTranscriptSegments(report.transcriptSegments, result.transcript ?? []),
    enhancementWarnings: dedupeStrings([
      ...report.enhancementWarnings,
      ...(result.warnings ?? []),
    ]),
  }
}

export function applyTranscriptionResult(
  report: BugReport,
  result: TranscriptionResult,
): BugReport {
  return {
    ...report,
    transcriptSegments: result.segments,
    enhancementWarnings: dedupeStrings([
      ...report.enhancementWarnings,
      ...(result.warnings ?? []),
    ]),
  }
}

export function setLocalEngineState(
  report: BugReport,
  patch: Partial<LocalEngineStatus> & Pick<LocalEngineStatus, 'state'>,
): BugReport {
  return {
    ...report,
    localEngineStatus: {
      ...report.localEngineStatus,
      ...patch,
    },
  }
}

export function mergeTranscriptSegments(
  current: TranscriptSegment[],
  incoming: TranscriptSegment[],
): TranscriptSegment[] {
  const merged = new Map<string, TranscriptSegment>()

  for (const segment of [...current, ...incoming]) {
    const key = segment.id || `${segment.startMs}-${segment.endMs}-${segment.text}`
    merged.set(key, segment)
  }

  return [...merged.values()].sort((left, right) => left.startMs - right.startMs)
}

function dedupeStrings(values?: string[]): string[] {
  if (!values || values.length === 0) return []
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
