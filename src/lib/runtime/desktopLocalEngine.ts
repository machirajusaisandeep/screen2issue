import { checkHealth } from '@/lib/localEngine/client'
import type { LocalEngineHealth } from '@/lib/localEngine/types'
import type { RuntimeCapabilities } from '@/lib/runtime/capabilities'

type StartLocalEngineResponse = {
  message?: string
  pid?: number
  status?: 'already_running' | 'helper_ready' | 'port_conflict' | 'starting'
}

const DEFAULT_START_TIMEOUT_MS = 30_000
const POLL_INTERVAL_MS = 400

export async function startBundledLocalEngine(
  runtimeCapabilities: RuntimeCapabilities,
): Promise<StartLocalEngineResponse> {
  if (!runtimeCapabilities.supportsBundledLocalEngine) {
    return { status: 'already_running', message: 'Bundled local engine is not available.' }
  }

  const { invoke } = await import('@tauri-apps/api/core')

  return invoke('start_local_engine') as Promise<StartLocalEngineResponse>
}

export async function waitForLocalEngineHealth(
  timeoutMs = DEFAULT_START_TIMEOUT_MS,
): Promise<LocalEngineHealth> {
  const startedAt = Date.now()
  let lastError: unknown

  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await checkHealth()
    } catch (error) {
      lastError = error
      await wait(POLL_INTERVAL_MS)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Timed out waiting for the bundled local engine to become ready.')
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
