import { createContext, useCallback, useContext, useState, useRef, useEffect } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((message, type = 'info', timeoutMs = 3500, onClick = null) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((curr) => [...curr, { id, message, type, timeoutMs, onClick }])
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
      <div className="pointer-events-none fixed top-4 right-4 z-[9999] flex flex-col gap-3">
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} dismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ t, dismiss }) {
  const [isHovered, setIsHovered] = useState(false)
  const timerRef = useRef(null)

  const startTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      dismiss(t.id)
    }, t.timeoutMs || 3500)
  }, [t.id, t.timeoutMs, dismiss])

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  useEffect(() => {
    if (isHovered) {
      clearTimer()
    } else {
      startTimer()
    }
    return clearTimer
  }, [isHovered, startTimer, clearTimer])

  return (
          <div
            onClick={() => { if (t.onClick) { t.onClick(); dismiss(t.id) } }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onFocus={() => setIsHovered(true)}
            onBlur={() => setIsHovered(false)}
            className={`pointer-events-auto w-[340px] overflow-hidden rounded-2xl p-4 text-sm shadow-xl ring-1 backdrop-blur-md transition-all relative group
                        ${t.onClick ? 'cursor-pointer hover:shadow-2xl hover:scale-[1.02]' : ''}
                        ${t.type === 'success'
                          ? 'bg-emerald-50/90 text-emerald-900 ring-emerald-200/60 shadow-emerald-900/5'
                          : t.type === 'error'
                          ? 'bg-rose-50/90 text-rose-900 ring-rose-200/60 shadow-rose-900/5'
                          : t.type === 'notify'
                          ? 'bg-white/95 text-slate-800 ring-slate-200/60 shadow-slate-900/5'
                          : 'bg-white/90 text-slate-800 ring-slate-200/60 shadow-slate-900/5'}`}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); dismiss(t.id) }}
              className={`absolute top-3 right-3 rounded-lg p-1.5 opacity-50 transition hover:opacity-100
                          ${t.type === 'success' ? 'hover:bg-emerald-100 text-emerald-700' :
                            t.type === 'error' ? 'hover:bg-rose-100 text-rose-700' :
                            'hover:bg-slate-100 text-slate-500'}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="flex items-start gap-3 pr-8">
              {t.type === 'success' && (
                <div className="rounded-full bg-emerald-100 p-1 shrink-0">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {t.type === 'error' && (
                <div className="rounded-full bg-rose-100 p-1 shrink-0">
                  <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              )}
              {t.type === 'info' && (
                <div className="rounded-full bg-blue-100 p-1 shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
              {t.type === 'notify' && (
                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500 animate-pulse" />
              )}
              
              <div className="min-w-0 flex-1 pt-0.5">
                <p className={`text-sm font-semibold leading-snug 
                              ${t.type === 'error' ? 'text-rose-900' : 
                                t.type === 'success' ? 'text-emerald-900' : 'text-slate-800'}`}>
                  {t.message}
                </p>
                {t.onClick && (
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-brand-500 group-hover:text-brand-600 transition-colors">
                    Click to view action &rarr;
                  </p>
                )}
              </div>
            </div>
          </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
