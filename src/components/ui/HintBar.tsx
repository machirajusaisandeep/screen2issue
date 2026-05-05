import type { RuntimeCapabilities } from '@/lib/runtime/capabilities'

interface HintItem {
  k: string
  l: string
}

interface HintBarProps {
  items: HintItem[]
  runtimeCapabilities: RuntimeCapabilities
}

export function HintBar({ items, runtimeCapabilities }: HintBarProps) {
  return (
    <footer className="hintbar">
      <div className="hintbar-group">
        {items.map((it, i) => (
          <div key={i} className="hint-item">
            <span className="kbd">{it.k}</span>
            <span>{it.l}</span>
          </div>
        ))}
      </div>
      <div className="hintbar-group">
        <div className="hint-item">
          <span>
            {runtimeCapabilities.surface === 'desktop'
              ? 'desktop runtime · bundled helper'
              : runtimeCapabilities.surface === 'pwa'
                ? 'installed pwa · browser-only'
                : 'browser-native · works offline'}
          </span>
        </div>
      </div>
    </footer>
  )
}
