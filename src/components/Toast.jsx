import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((message, type = 'info', timeoutMs = 3500, onClick = null) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((curr) => [...curr, { id, message, type, onClick }])
    setTimeout(() => {
      setToasts((curr) => curr.filter((t) => t.id !== id))
    }, timeoutMs)
  }, [])

  const dismiss = useCallback((id) => {
    setToasts((curr) => curr.filter((t) => t.id !== id))
  }, [])

  const api = {
    success:  (m) => push(m, 'success'),
    error:    (m) => push(m, 'error'),
    info:     (m) => push(m, 'info'),
    /** Bell-style notification popup with optional click-to-navigate */
    notify:   (m, onClick) => push(m, 'notify', 6000, onClick),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-[9999] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => { if (t.onClick) { t.onClick(); dismiss(t.id) } }}
            className={`pointer-events-auto min-w-[280px] max-w-sm rounded-xl px-4 py-3 text-sm
                        font-medium shadow-lg ring-1 backdrop-blur transition-all
                        ${t.onClick ? 'cursor-pointer hover:shadow-xl' : ''}
                        ${t.type === 'success'
                          ? 'bg-accent-50/95 text-accent-800 ring-accent-200'
                          : t.type === 'error'
                          ? 'bg-red-50/95 text-red-800 ring-red-200'
                          : t.type === 'notify'
                          ? 'bg-white/98 text-slate-800 ring-slate-200 shadow-slate-200/80'
                          : 'bg-slate-50/95 text-slate-800 ring-slate-200'}`}
          >
            {t.type === 'notify' && (
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug">{t.message}</p>
                  {t.onClick && (
                    <p className="mt-0.5 text-[11px] text-brand-500 font-normal">Click to view →</p>
                  )}
                </div>
              </div>
            )}
            {t.type !== 'notify' && t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
