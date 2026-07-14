import { useCallback, useEffect, useState } from 'react'
import type { ThemePreference } from '@/types/extensions'

const THEME_KEY = 's2i.theme'

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem(THEME_KEY)
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
  })
  const [systemDark, setSystemDark] = useState(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true,
  )

  const resolvedTheme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return
    const handleChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const setPreference = useCallback((next: ThemePreference) => {
    localStorage.setItem(THEME_KEY, next)
    setPreferenceState(next)
  }, [])

  const cyclePreference = useCallback(() => {
    const next: ThemePreference = preference === 'system' ? 'dark' : preference === 'dark' ? 'light' : 'system'
    setPreference(next)
  }, [preference, setPreference])

  return { preference, resolvedTheme, setPreference, cyclePreference }
}
