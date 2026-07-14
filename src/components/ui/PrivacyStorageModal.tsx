import { useEffect, useRef } from 'react'
import { Database, Download, HardDrive, ShieldCheck, X } from 'lucide-react'
import type { RuntimeCapabilities } from '@/lib/runtime/capabilities'
import type { LocalEngineStatus } from '@/lib/localEngine/types'
import { createDiagnosticExport } from '@/lib/diagnostics'
import { downloadText } from '@/lib/download'

interface PrivacyStorageModalProps {
  open: boolean
  storageLabel: string | null
  hasDraft: boolean
  onClearDraft: () => void
  onClose: () => void
  runtime: RuntimeCapabilities
  localEngineStatus: LocalEngineStatus
}

export function PrivacyStorageModal({ open, storageLabel, hasDraft, onClearDraft, onClose, runtime, localEngineStatus }: PrivacyStorageModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') {
        const dialog = closeRef.current?.closest('[role="dialog"]')
        const focusable = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
        if (!focusable?.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      previousFocus.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="privacy-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <div className="modal-eyebrow mono">LOCAL-FIRST BOUNDARY</div>
            <h2 id="privacy-title">Privacy & local storage</h2>
          </div>
          <button ref={closeRef} className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close privacy details">
            <X size={18} />
          </button>
        </header>

        <div className="privacy-grid">
          <article className="privacy-card">
            <ShieldCheck size={20} aria-hidden="true" />
            <div><strong>Core workflow stays local</strong><p>Video decoding, frame extraction, OCR, review, and export run on this device.</p></div>
          </article>
          <article className="privacy-card">
            <Database size={20} aria-hidden="true" />
            <div><strong>Derived project autosave</strong><p>Report fields and derived frame images may be stored in IndexedDB. The original recording is never autosaved.</p></div>
          </article>
          <article className="privacy-card">
            <HardDrive size={20} aria-hidden="true" />
            <div><strong>External AI is explicit</strong><p>Selected text or frames leave the device only after you configure a provider and run a clearly labeled AI action.</p></div>
          </article>
        </div>

        <div className="storage-summary">
          <span><strong>Browser storage</strong><small>{storageLabel ?? 'Storage estimate unavailable'}</small></span>
          <button className="btn" onClick={onClearDraft} disabled={!hasDraft}>Clear saved project</button>
        </div>
        <div className="storage-summary">
          <span><strong>Shareable diagnostics</strong><small>Reviewable JSON with no recordings, frames, API keys, or telemetry.</small></span>
          <button className="btn" onClick={() => downloadText(JSON.stringify(createDiagnosticExport(runtime, localEngineStatus), null, 2), 'screen2issue-diagnostics.json', 'application/json')}>
            <Download size={15} /> Export diagnostics
          </button>
        </div>
      </section>
    </div>
  )
}
