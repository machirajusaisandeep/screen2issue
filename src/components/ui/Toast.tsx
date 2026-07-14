import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  onDone: () => void
}

export function Toast({ message, onDone }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onDone, 200)
    }, 2200)
    return () => clearTimeout(t)
  }, [onDone])

  if (!visible) return null
  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="dot" aria-hidden="true" />
      {message}
    </div>
  )
}
