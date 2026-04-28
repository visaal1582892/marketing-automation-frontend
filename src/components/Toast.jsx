import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((message, type = 'info', timeoutMs = 3500) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((curr) => [...curr, { id, message, type }])
    setTimeout(() => {
      setToasts((curr) => curr.filter((t) => t.id !== id))
    }, timeoutMs)
  }, [])

  const api = {
    success: (m) => push(m, 'success'),
    error:   (m) => push(m, 'error'),
    info:    (m) => push(m, 'info'),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto min-w-[260px] max-w-sm rounded-lg px-4 py-2.5 text-sm
                        font-medium shadow-md ring-1 backdrop-blur
                        ${t.type === 'success'
                          ? 'bg-accent-50/95 text-accent-800 ring-accent-200'
                          : t.type === 'error'
                          ? 'bg-brand-50/95 text-brand-800 ring-brand-200'
                          : 'bg-slate-50/95 text-slate-800 ring-slate-200'}`}
          >
            {t.message}
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
