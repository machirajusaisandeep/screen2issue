import { MonitorUp } from 'lucide-react'

export function SmallScreenGuard() {
  return (
    <aside className="small-screen-guard" role="status">
      <MonitorUp size={28} aria-hidden="true" />
      <strong>Use a tablet or desktop to edit evidence</strong>
      <span>Screen2Issue supports the complete workflow from 768px wide. Your project remains on this device.</span>
    </aside>
  )
}
