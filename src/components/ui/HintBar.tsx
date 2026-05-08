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
    </footer>
  )
}
