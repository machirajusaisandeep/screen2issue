import { MonitorCog, Moon, Settings, ShieldCheck, Sun } from 'lucide-react'
import type { RuntimeCapabilities } from '@/lib/runtime/capabilities'
import { getSurfaceLabel } from '@/lib/runtime/capabilities'
import type { ThemePreference } from '@/types/extensions'

interface AppBarProps {
  step: number
  onJump: (step: number) => void
  runtimeCapabilities: RuntimeCapabilities
  onOpenSettings: () => void
  onOpenPrivacy: () => void
  themePreference: ThemePreference
  onCycleTheme: () => void
}

const STEPS = ['Upload', 'Process', 'Review', 'Enhance', 'Export']

export function AppBar({
  step,
  onJump,
  runtimeCapabilities,
  onOpenSettings,
  onOpenPrivacy,
  themePreference,
  onCycleTheme,
}: AppBarProps) {
  const ThemeIcon = themePreference === 'dark' ? Moon : themePreference === 'light' ? Sun : MonitorCog
  return (
    <header className="appbar">
      <button className="brand" onClick={() => onJump(0)} aria-label="Go to upload">
        <img src="/favicon.svg" alt="" aria-hidden="true" className="brand-mark" />
        <span className="brand-name">screen2issue</span>
        <span className="brand-beta mono">beta</span>
      </button>

      <nav className="steps" aria-label="Report workflow">
        {STEPS.map((label, i) => {
          const cls = i === step ? 'active' : i < step ? 'done' : ''
          return (
            <button
              key={i}
              className={`step ${cls}`}
              onClick={() => onJump(i)}
              aria-current={i === step ? 'step' : undefined}
            >
              <span className="num">{i + 1}</span>
              <span>{label}</span>
            </button>
          )
        })}
      </nav>

      <div className="appbar-actions">
        <span className="surface-label mono">{getSurfaceLabel(runtimeCapabilities.surface)}</span>
        <button
          className="btn btn-ghost btn-icon"
          onClick={onOpenPrivacy}
          title="Privacy and storage"
          aria-label="Open privacy and storage details"
        >
          <ShieldCheck size={16} />
        </button>
        <button
          className="btn btn-ghost btn-icon"
          onClick={onCycleTheme}
          title={`Theme: ${themePreference}`}
          aria-label={`Theme is ${themePreference}. Change theme`}
        >
          <ThemeIcon size={16} />
        </button>
        <button
          className="btn btn-ghost btn-icon"
          onClick={onOpenSettings}
          title="AI Settings"
          aria-label="Open AI settings"
        >
          <Settings size={15} />
        </button>
      </div>
    </header>
  )
}
