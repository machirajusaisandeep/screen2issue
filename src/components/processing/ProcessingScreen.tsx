import { useEffect, useRef, useState } from 'react'
import { extractFrames } from '@/lib/video/extractFrames'
import { detectCursorEvents } from '@/lib/video/detectCursorEvents'
import { runOcr } from '@/lib/ocr/runOcr'
import { CURSOR_CONFIDENCE_THRESHOLD } from '@/lib/report/reportData'
import type { CursorEvent, ExtractedFrame } from '@/types/report'

interface ProcessingResult {
  cursorEvents: CursorEvent[]
  frames: ExtractedFrame[]
}

interface ProcessingScreenProps {
  file: File
  onComplete: (result: ProcessingResult) => void
  onError: (msg: string) => void
}

interface LogLine {
  t: string
  k: string
  m: string
}

const STAGES = [
  { key: 'load', label: 'Loading video' },
  { key: 'extract', label: 'Extracting frames' },
  { key: 'compare', label: 'Comparing visual diffs' },
  { key: 'cursor', label: 'Detecting cursor events' },
  { key: 'ocr', label: 'Running OCR' },
  { key: 'report', label: 'Preparing timeline' },
] as const

function fmtT(ms: number) {
  const s = (ms / 1000).toFixed(3)
  const [a, b] = s.split('.')
  return `00:${a.padStart(2, '0')}.${b}`
}

export function ProcessingScreen({ file, onComplete, onError }: ProcessingScreenProps) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<LogLine[]>([
    { t: '00:00.000', k: 'open', m: `Reading ${file.name} (${(file.size / 1e6).toFixed(1)} MB)` },
  ])
  const logRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  const addLog = (line: LogLine) => setLogs((current) => [...current, line])

  useEffect(() => {
    if (started.current) return
    started.current = true

    const t0 = performance.now()

    async function runPipeline() {
      const extractedFrames = await extractFrames(file, (step, pct) => {
        const elapsed = performance.now() - t0
        const stageMap: Record<string, number> = {
          loading: 0,
          extracting: 1,
          comparing: 2,
          timeline: 5,
        }
        const idx = stageMap[step] ?? 0
        setActiveIdx(idx)

        const base = idx / STAGES.length
        const increment = (pct / 100) / STAGES.length
        setProgress(Math.min(0.98, base + increment))

        const logMessages: Record<string, string[]> = {
          loading: ['HTMLVideoElement.loadedmetadata fired'],
          extracting: ['seek · captured frame', 'diff threshold check · keep'],
          comparing: ['diff computed · above threshold · keep', 'near-duplicate · drop'],
          timeline: ['initial frame set ready'],
        }
        const messages = logMessages[step]
        if (messages && pct === 100) {
          addLog({ t: fmtT(elapsed), k: step, m: messages[messages.length - 1] })
        }
      })

      setActiveIdx(3)
      addLog({
        t: fmtT(performance.now() - t0),
        k: 'cursor',
        m: 'best-effort cursor detection started',
      })

      let cursorEvents: CursorEvent[] = []
      try {
        const detectedEvents = await detectCursorEvents(extractedFrames, (cursorProgress) => {
          const base = 3 / STAGES.length
          const increment = (cursorProgress.percent / 100) / STAGES.length
          setProgress(Math.min(0.98, base + increment))
        })
        cursorEvents = detectedEvents.filter(
          (event) => event.confidence >= CURSOR_CONFIDENCE_THRESHOLD,
        )
        addLog({
          t: fmtT(performance.now() - t0),
          k: 'cursor',
          m: `${cursorEvents.length} events kept above confidence threshold`,
        })
      } catch (error) {
        addLog({
          t: fmtT(performance.now() - t0),
          k: 'cursor',
          m: error instanceof Error ? `skipped · ${error.message}` : 'skipped · unexpected error',
        })
      }

      setActiveIdx(4)
      addLog({
        t: fmtT(performance.now() - t0),
        k: 'ocr',
        m: `automatic OCR started for ${extractedFrames.length} extracted frames`,
      })

      let processedFrames = extractedFrames
      try {
        processedFrames = await runOcr(extractedFrames, (ocrProgress) => {
          const base = 4 / STAGES.length
          const increment = (ocrProgress.percent / 100) / STAGES.length
          setProgress(Math.min(0.99, base + increment))
        })
        const framesWithOcr = processedFrames.filter((frame) => frame.ocrText?.trim()).length
        addLog({
          t: fmtT(performance.now() - t0),
          k: 'ocr',
          m: `${framesWithOcr} frames produced visible text`,
        })
      } catch (error) {
        addLog({
          t: fmtT(performance.now() - t0),
          k: 'ocr',
          m: error instanceof Error ? `skipped · ${error.message}` : 'skipped · unexpected error',
        })
      }

      setActiveIdx(STAGES.length)
      setProgress(1)
      addLog({
        t: fmtT(performance.now() - t0),
        k: 'done',
        m: `kept ${processedFrames.length} frames · pipeline complete`,
      })

      setTimeout(() => onComplete({ frames: processedFrames, cursorEvents }), 400)
    }

    runPipeline().catch((error: Error) => {
      addLog({ t: fmtT(performance.now() - t0), k: 'error', m: error.message })
      onError(error.message)
    })
  }, [file, onComplete, onError])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  const sizeMB = (file.size / 1e6).toFixed(1)

  return (
    <main className="screen processing-screen">
      <div className="processing-card">
        <div className="processing-head">
          <h2 className="processing-title">Working on your recording</h2>
          <p className="processing-sub mono">
            {file.name} · {sizeMB} MB · frames, OCR, and cursor analysis stay on this device
          </p>
        </div>

        <div className="proc-bar-wrap">
          <div className="proc-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>

        <div className="proc-list">
          {STAGES.map((stage, index) => {
            const cls = index < activeIdx ? 'done' : index === activeIdx ? 'active' : 'pending'
            return (
              <div key={stage.key} className={`proc-step ${cls}`}>
                <span className="proc-marker" aria-hidden="true" />
                <span>{stage.label}</span>
                <span className="proc-meta mono">
                  {index < activeIdx ? 'ok' : index === activeIdx ? 'running' : '—'}
                </span>
              </div>
            )
          })}
        </div>

        <div className="proc-log" ref={logRef}>
          {logs.map((line, index) => (
            <div key={index} className="proc-log-line">
              <span className="lt">[{line.t}]</span>
              <span className="lk">{line.k}</span>
              <span> · {line.m}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
