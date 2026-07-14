import { useEffect, useRef, useState } from 'react'
import { extractFrames } from '@/lib/video/extractFrames'
import { detectCursorEvents } from '@/lib/video/detectCursorEvents'
import { runOcr } from '@/lib/ocr/runOcr'
import { CURSOR_CONFIDENCE_THRESHOLD } from '@/lib/report/reportData'
import type { CursorEvent, ExtractedFrame } from '@/types/report'
import { countImageTokens, formatTokenCount } from '@/lib/tokens'
import type { RuntimeCapabilities } from '@/lib/runtime/capabilities'
import { startBundledLocalEngine, waitForLocalEngineHealth } from '@/lib/runtime/desktopLocalEngine'
import { extractVideoFrames } from '@/lib/localEngine/client'
import type { LocalEngineStatus } from '@/lib/localEngine/types'

const TYPICAL_BITRATE = 2 * 1024 * 1024 // 2 MB/s screen recording estimate

function estimateFromFile(file: File) {
  const durationEstSec = Math.max(5, file.size / TYPICAL_BITRATE)
  const frameCount = Math.min(30, Math.ceil(durationEstSec))
  const rawTokens = frameCount * countImageTokens(1920, 1080)
  return { frameCount, rawTokens, exact: false }
}

function computeFromFrames(frames: ExtractedFrame[]) {
  const rawTokens = frames.reduce(
    (sum, f) => sum + countImageTokens(f.width ?? 1920, f.height ?? 1080),
    0,
  )
  return { frameCount: frames.length, rawTokens, exact: true }
}

interface ProcessingResult {
  cursorEvents: CursorEvent[]
  frames: ExtractedFrame[]
}

interface ProcessingScreenProps {
  file: File
  onComplete: (result: ProcessingResult) => void
  onError: (msg: string) => void
  onCancel: () => void
  runtimeCapabilities: RuntimeCapabilities
  localEngineStatus: LocalEngineStatus
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

export function ProcessingScreen({ file, onComplete, onError, onCancel, runtimeCapabilities, localEngineStatus }: ProcessingScreenProps) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<LogLine[]>([
    { t: '00:00.000', k: 'open', m: `Reading ${file.name} (${(file.size / 1e6).toFixed(1)} MB)` },
  ])
  const [tokenInfo, setTokenInfo] = useState(() => estimateFromFile(file))
  const [attempt, setAttempt] = useState(0)
  const [pipelineError, setPipelineError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [elapsedMs, setElapsedMs] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const startedAt = useRef<number | null>(null)
  const localEngineStateRef = useRef(localEngineStatus.state)

  useEffect(() => {
    localEngineStateRef.current = localEngineStatus.state
  }, [localEngineStatus.state])

  const addLog = (line: LogLine) => setLogs((current) => [...current, line])

  useEffect(() => {
    startedAt.current = performance.now()
    const controller = new AbortController()
    abortRef.current = controller
    const t0 = performance.now()

    async function runPipeline() {
      const updateExtractionProgress = (step: 'loading' | 'extracting' | 'comparing' | 'timeline', pct: number) => {
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
          loading: [runtimeCapabilities.supportsBundledLocalEngine
            ? 'FFprobe metadata loaded'
            : 'HTMLVideoElement.loadedmetadata fired'],
          extracting: ['seek · captured frame', 'diff threshold check · keep'],
          comparing: ['diff computed · above threshold · keep', 'near-duplicate · drop'],
          timeline: ['initial frame set ready'],
        }
        const messages = logMessages[step]
        if (messages && pct === 100) {
          addLog({ t: fmtT(elapsed), k: step, m: messages[messages.length - 1] })
        }
      }

      let extractedFrames: ExtractedFrame[]
      if (runtimeCapabilities.supportsBundledLocalEngine) {
        setActiveIdx(0)
        setProgress(0.03)
        addLog({
          t: fmtT(performance.now() - t0),
          k: 'decoder',
          m: 'starting bundled FFmpeg decoder on 127.0.0.1',
        })
        if (localEngineStateRef.current !== 'starting') {
          const launch = await startBundledLocalEngine(runtimeCapabilities)
          if (launch.status === 'port_conflict') {
            throw new Error(launch.message ?? 'The local engine port is already in use.')
          }
        }
        await waitForLocalEngineHealth()
        controller.signal.throwIfAborted()
        updateExtractionProgress('loading', 100)
        setActiveIdx(1)
        setProgress(0.12)
        const result = await extractVideoFrames(file, controller.signal)
        controller.signal.throwIfAborted()
        extractedFrames = result.frames
        updateExtractionProgress('extracting', 100)
        updateExtractionProgress('comparing', 100)
        updateExtractionProgress('timeline', 100)
        addLog({
          t: fmtT(performance.now() - t0),
          k: 'decoder',
          m: `${result.decoder} produced ${result.frames.length} key frames`,
        })
      } else {
        extractedFrames = await extractFrames(file, updateExtractionProgress, controller.signal)
      }

      setTokenInfo(computeFromFrames(extractedFrames))

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
        }, controller.signal)
        cursorEvents = detectedEvents.filter(
          (event) => event.confidence >= CURSOR_CONFIDENCE_THRESHOLD,
        )
        addLog({
          t: fmtT(performance.now() - t0),
          k: 'cursor',
          m: `${cursorEvents.length} events kept above confidence threshold`,
        })
      } catch (error) {
        if (isAbortError(error)) throw error
        const message = error instanceof Error ? error.message : 'Cursor detection was skipped.'
        setWarnings((current) => [...current, `Cursor detection: ${message}`])
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
        }, controller.signal)
        const framesWithOcr = processedFrames.filter((frame) => frame.ocrText?.trim()).length
        addLog({
          t: fmtT(performance.now() - t0),
          k: 'ocr',
          m: `${framesWithOcr} frames produced visible text`,
        })
      } catch (error) {
        if (isAbortError(error)) throw error
        const message = error instanceof Error ? error.message : 'OCR was skipped.'
        setWarnings((current) => [...current, `OCR: ${message}`])
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

      window.setTimeout(() => {
        if (!controller.signal.aborted) onComplete({ frames: processedFrames, cursorEvents })
      }, 400)
    }

    runPipeline().catch((error: unknown) => {
      if (isAbortError(error)) return
      const message = error instanceof Error ? error.message : 'Processing failed unexpectedly.'
      setPipelineError(message)
      addLog({ t: fmtT(performance.now() - t0), k: 'error', m: message })
      onError(message)
    })
    return () => controller.abort()
  }, [attempt, file, onComplete, onError, runtimeCapabilities])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const started = startedAt.current
      if (started !== null) setElapsedMs(performance.now() - started)
    }, 250)
    return () => window.clearInterval(timer)
  }, [attempt])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  const sizeMB = (file.size / 1e6).toFixed(1)

  function retry() {
    abortRef.current?.abort()
    startedAt.current = performance.now()
    setElapsedMs(0)
    setActiveIdx(0)
    setProgress(0)
    setPipelineError(null)
    setWarnings([])
    setTokenInfo(estimateFromFile(file))
    setLogs([{ t: '00:00.000', k: 'retry', m: `Retrying ${file.name}` }])
    setAttempt((value) => value + 1)
  }

  function cancel() {
    abortRef.current?.abort()
    onCancel()
  }

  return (
    <main className="screen processing-screen">
      <div className="processing-card">
        <div className="processing-head">
          <h2 className="processing-title">Working on your recording</h2>
          <p className="processing-sub mono">
            {file.name} · {sizeMB} MB · frames, OCR, and cursor analysis stay on this device
          </p>
          <div className="processing-elapsed mono">elapsed {formatElapsed(elapsedMs)}</div>
        </div>

        <div className="proc-bar-wrap" role="progressbar" aria-label="Recording processing" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="proc-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>

        {warnings.length > 0 ? (
          <div className="processing-warning" role="status">
            <strong>Timeline can still be created</strong>
            {warnings.map((warning) => <span key={warning}>{warning}</span>)}
          </div>
        ) : null}

        {pipelineError ? (
          <div className="processing-error" role="alert">
            <strong>Processing stopped</strong>
            <span>{pipelineError}</span>
            <div><button className="btn btn-primary" onClick={retry}>Retry processing</button><button className="btn" onClick={cancel}>Choose another recording</button></div>
          </div>
        ) : null}

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

        <div className="proc-token-card">
          <div className="proc-token-head mono">token estimate{tokenInfo.exact ? '' : ' (updating…)'}</div>
          <div className="proc-token-rows">
            <div className="proc-token-row">
              <span className="proc-token-label">Raw frames → AI</span>
              <span className="proc-token-val warning mono">{formatTokenCount(tokenInfo.rawTokens)} tokens</span>
              <span className="proc-token-hint mono">
                {tokenInfo.exact ? tokenInfo.frameCount : `~${tokenInfo.frameCount}`} frames × {formatTokenCount(countImageTokens(1920, 1080))} each
              </span>
            </div>
            <div className="proc-token-row">
              <span className="proc-token-label">screen2issue report</span>
              <span className="proc-token-val success mono">
                {formatTokenCount(tokenInfo.frameCount * 25)}–{formatTokenCount(tokenInfo.frameCount * 80)} tokens
              </span>
              <span className="proc-token-hint mono">text-only · images stay local</span>
            </div>
            <div className="proc-token-savings mono">
              saves {formatTokenCount(tokenInfo.rawTokens - tokenInfo.frameCount * 52)} tokens vs raw frames
            </div>
          </div>
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
        {!pipelineError ? <button className="btn btn-ghost processing-cancel" onClick={cancel}>Cancel processing</button> : null}
      </div>
    </main>
  )
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
