import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { useNotifications } from '../context/NotificationContext'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const unread = notifications.filter(n => !n.read)
  const [open, setOpen] = useState(false)
  const panelRef        = useRef(null)
  const navigate        = useNavigate()

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleClick = async (n) => {
    if (!n.read) await markRead(n.id)
    setOpen(false)
    if (n.url) navigate(n.url)
  }

  return (
    <div ref={panelRef} className="relative shrink-0">
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg
                   text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        aria-label="Notifications"
      >
        <Icon name="bell" className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center
                           rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl
                        border border-slate-100 bg-white shadow-xl shadow-slate-200/60">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-800">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-medium text-brand-600 hover:text-brand-700 transition"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <ul className="max-h-[420px] overflow-y-auto divide-y divide-slate-50">
            {unread.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-slate-400">
                No unread notifications
              </li>
            ) : (
              unread.map(n => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={`w-full px-4 py-3 text-left transition hover:bg-slate-50
                                ${!n.read ? 'bg-brand-50/40' : ''}`}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Unread dot */}
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full
                                        ${n.read ? 'bg-transparent' : 'bg-brand-500'}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-[13px] leading-snug
                                       ${n.read ? 'text-slate-600' : 'font-medium text-slate-800'}`}>
                          {n.message}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>

          {/* Footer */}
          {unread.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2.5 text-center">
              <span className="text-xs text-slate-400">
                {unread.length} unread notification{unread.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
