export type AppSurface = 'desktop' | 'web' | 'pwa'

export type RuntimeCapabilities = {
  surface: AppSurface
  supportsBundledLocalEngine: boolean
  showLocalEngineActions: boolean
  localEngineBaseUrl: string
}

type RuntimeOverrides = Partial<RuntimeCapabilities>

declare global {
  interface Navigator {
    standalone?: boolean
  }

  interface Window {
    __SCREEN2ISSUE_RUNTIME__?: RuntimeOverrides
    __TAURI_INTERNALS__?: unknown
  }
}

const DEFAULT_LOCAL_ENGINE_BASE_URL = 'http://127.0.0.1:8765'

export function resolveRuntimeCapabilities(): RuntimeCapabilities {
  const overrides = window.__SCREEN2ISSUE_RUNTIME__ ?? {}
  const surface = overrides.surface ?? detectSurface()
  const supportsBundledLocalEngine = overrides.supportsBundledLocalEngine ?? surface === 'desktop'
  const showLocalEngineActions =
    overrides.showLocalEngineActions ?? (surface === 'desktop' || import.meta.env.DEV)

  return {
    surface,
    supportsBundledLocalEngine,
    showLocalEngineActions,
    localEngineBaseUrl: overrides.localEngineBaseUrl ?? DEFAULT_LOCAL_ENGINE_BASE_URL,
  }
}

export function getSurfaceLabel(surface: AppSurface): string {
  if (surface === 'desktop') return 'mac app'
  if (surface === 'pwa') return 'pwa'
  return 'web app'
}

export function hasTauriRuntime(): boolean {
  return (
    typeof window.__TAURI_INTERNALS__ !== 'undefined' ||
    window.location.hostname === 'tauri.localhost' ||
    window.location.hostname.endsWith('.tauri.localhost') ||
    window.location.protocol === 'tauri:'
  )
}

function detectSurface(): AppSurface {
  if (hasTauriRuntime()) return 'desktop'
  if (isStandalonePwa()) return 'pwa'
  return 'web'
}

function isStandalonePwa(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    navigator.standalone === true
  )
}
