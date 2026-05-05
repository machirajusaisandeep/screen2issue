interface HintItem {
  k: string
  l: string
}

interface HintBarProps {
  items: HintItem[]
}

export function HintBar({ items }: HintBarProps) {
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
          <span>browser-native · works offline</span>
        </div>
      </div>
    </footer>
  )
}
