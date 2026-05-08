import { useEffect } from 'react'
import Icon from './Icon'

/**
 * Centered, accessible modal with backdrop blur, ESC-to-close, scroll-lock.
 * Compact density to match the rest of the UI.
 */
export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const sizeClass =
    size === 'sm' ? 'max-w-md' :
    size === 'lg' ? 'max-w-3xl' :
    'max-w-lg'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4
                 bg-slate-900/45 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative w-full ${sizeClass} rounded-xl bg-white shadow-2xl
                    ring-1 ring-slate-200/60`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-5" style={{ maxHeight: 'calc(90vh - 8rem)' }}>{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 rounded-b-xl
                             border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
