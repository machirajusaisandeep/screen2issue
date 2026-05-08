import { Settings } from 'lucide-react'
import { getSurfaceLabel, type RuntimeCapabilities } from '@/lib/runtime/capabilities'

interface AppBarProps {
  step: number
  onJump: (step: number) => void
  runtimeCapabilities: RuntimeCapabilities
  onOpenSettings: () => void
}

const STEPS = ['Upload', 'Process', 'Review', 'Enhance', 'Export']

export function AppBar({ step, onJump, runtimeCapabilities, onOpenSettings }: AppBarProps) {
  return (
    <header className="appbar">
      <div className="brand" onClick={() => onJump(0)}>
        <img src="/favicon.svg" alt="" aria-hidden="true" className="brand-mark" />
        <span className="brand-name">screen2issue</span>
        <span className="brand-version mono">v0.1</span>
      </div>

      <nav className="steps">
        {STEPS.map((label, i) => {
          const cls = i === step ? 'active' : i < step ? 'done' : ''
          return (
            <div
              key={i}
              className={`step ${cls}`}
              onClick={() => onJump(i)}
              style={{ cursor: 'pointer' }}
            >
              <span className="num">{i + 1}</span>
              <span>{label}</span>
            </div>
          )
        })}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
