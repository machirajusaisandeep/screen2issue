import type { EnvironmentMetadata } from '@/types/report'

type NavigatorWithUAData = Navigator & {
  userAgentData?: {
    platform?: string
  }
  standalone?: boolean
}

export function captureEnvironmentMetadata(): EnvironmentMetadata {
  const nav = navigator as NavigatorWithUAData

  return {
    userAgent: nav.userAgent,
    language: nav.language,
    languages: Array.from(nav.languages ?? [nav.language]),
    platform: nav.userAgentData?.platform ?? nav.platform ?? 'unknown',
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    screen: `${window.screen.width}x${window.screen.height}`,
    devicePixelRatio: window.devicePixelRatio || 1,
    standalone:
      window.matchMedia('(display-mode: standalone)').matches || Boolean(nav.standalone),
  }
}
