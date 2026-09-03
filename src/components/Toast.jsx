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

  /** Recursively extract the real message from a (possibly nested) JSON error object */
  function extractMessage(raw) {
    if (!raw) return 'An error occurred'
    
    if (typeof raw === 'object') {
      if (raw.message) return extractMessage(raw.message)
      if (raw.error) return extractMessage(raw.error)
      if (raw.detail) return extractMessage(raw.detail)
      if (raw.response?.data) return extractMessage(raw.response.data)
      return 'An error occurred'
    }

    if (typeof raw !== 'string') {
      return 'An error occurred'
    }

    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null) {
        // Try common message fields first, then recurse into .response
        if (parsed.message) return extractMessage(parsed.message)
        if (parsed.error) return extractMessage(parsed.error)
        if (parsed.detail) return extractMessage(parsed.detail)
        if (parsed.errors?.[0]) return extractMessage(parsed.errors[0])
        if (parsed.response?.message) return extractMessage(parsed.response.message)
        if (parsed.response?.errors?.[0]) return extractMessage(parsed.response.errors[0])
        
        // If we parsed it but couldn't find a good message, don't return the whole JSON
        return 'An error occurred'
      }
    } catch { /* not JSON, just return the string */ }
    
    // Check if there is an embedded JSON at the end of the string (e.g., "Error: 400 - {...}")
    const firstBrace = raw.indexOf('{')
    const lastBrace = raw.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const possibleJson = raw.substring(firstBrace, lastBrace + 1)
      try {
        const parsed = JSON.parse(possibleJson)
        if (typeof parsed === 'object' && parsed !== null) {
          const extracted = extractMessage(parsed)
          if (extracted && extracted !== 'An error occurred') {
            // User requested to ONLY show the extracted message, without the prefix.
            return extracted
          }
        }
      } catch { /* ignore */ }
    }
    
    return raw
  }

  // Wrap error handler to auto-extract JSON messages
  api.error = (m) => push(extractMessage(m), 'error')

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-[9999] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => { if (t.onClick) { t.onClick(); dismiss(t.id) } }}
            className={`pointer-events-auto min-w-[280px] max-w-sm rounded-xl px-4 py-3 text-sm
                        font-medium shadow-lg ring-1 backdrop-blur transition-all relative
                        ${t.onClick ? 'cursor-pointer hover:shadow-xl' : ''}
                        ${t.type === 'success'
                          ? 'bg-accent-50/95 text-accent-800 ring-accent-200'
                          : t.type === 'error'
                          ? 'bg-red-50/95 text-red-800 ring-red-200'
                          : t.type === 'notify'
                          ? 'bg-white/98 text-slate-800 ring-slate-200 shadow-slate-200/80'
                          : 'bg-slate-50/95 text-slate-800 ring-slate-200'}`}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); dismiss(t.id) }}
              className="absolute top-2 right-2 inline-flex items-center rounded-md p-1 opacity-60 hover:opacity-100 transition-opacity"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {t.type === 'notify' && (
              <div className="flex items-start gap-2.5 pr-5">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug">{t.message}</p>
                  {t.onClick && (
                    <p className="mt-0.5 text-[11px] text-brand-500 font-normal">Click to view →</p>
                  )}
                </div>
              </div>
            )}
            {t.type !== 'notify' && <span className="pr-5">{t.message}</span>}
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
