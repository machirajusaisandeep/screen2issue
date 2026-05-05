interface AppBarProps {
  step: number
  onJump: (step: number) => void
}

const STEPS = ['Upload', 'Process', 'Review', 'Enhance', 'Export']

export function AppBar({ step, onJump }: AppBarProps) {
  return (
    <header className="appbar">
      <div className="brand" onClick={() => onJump(0)}>
        <div className="brand-mark" aria-hidden="true" />
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

      <div className="privacy-badge">
        <span className="privacy-dot" aria-hidden="true" />
        <span>local-first · no cloud upload</span>
      </div>
    </header>
  )
}
