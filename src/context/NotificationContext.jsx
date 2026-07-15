import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ensureConnected, subscribe, shutdown } from '../services/stompClient'
import { notificationsApi } from '../api/notifications'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/Toast'

const NotificationContext = createContext(null)

/** Request browser notification permission — returns the final permission state. */
async function requestBrowserPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

/** Fire a native browser notification if tab is hidden or not focused. */
function fireBrowserNotification(title, body, url, navigate) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (!document.hidden && document.hasFocus()) return  // user is watching — skip
  const n = new Notification(title, { body, icon: '/favicon.ico' })
  if (url) n.onclick = () => { window.focus(); navigate(url); n.close() }
}

export function NotificationProvider({ children }) {
  const { user }   = useAuth()
  const toast      = useToast()
  const navigate   = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [unreadCount,   setUnreadCount]   = useState(0)
  const userId     = user?.id
  const [browserNotifStatus, setBrowserNotifStatus] = useState(
    () => 'Notification' in window ? Notification.permission : 'unsupported'
  )

  // Ask for browser notification permission when user logs in
  useEffect(() => {
    if (!userId) return
    requestBrowserPermission().then(setBrowserNotifStatus)
  }, [userId])

  const enableBrowserNotifications = useCallback(async () => {
    const result = await requestBrowserPermission()
    setBrowserNotifStatus(result)
  }, [])

  // ── Load initial notifications from REST ─────────────────────────────────
  useEffect(() => {
    if (!userId) return
    notificationsApi.getAll()
      .then(data => {
        setNotifications(data)
        setUnreadCount(data.filter(n => !n.read).length)
      })
      .catch(() => {}) // silently fail — bell shows 0 if load fails
  }, [userId])

  // ── Own the single shared STOMP connection for the whole session ──────────
  // The connection is opened once on login and torn down on logout. All other
  // hooks (chat, typing, unread watcher) reuse this same client.
  useEffect(() => {
    if (!userId) return

    if (!ensureConnected()) return // no WebSocket URL configured — real-time disabled

    const unsubscribe = subscribe(`/topic/notifications/${userId}`, frame => {
      try {
        const msg = JSON.parse(frame.body)

        // RESOLVED signal — re-fetch from REST so state mirrors DB exactly
        if (msg.type === 'RESOLVED') {
          notificationsApi.getAll()
            .then(data => {
              setNotifications(data)
              setUnreadCount(data.filter(n => !n.read).length)
            })
            .catch(() => {})
          return
        }

        // New notification push
        setNotifications(prev => [msg, ...prev])
        setUnreadCount(c => c + 1)
        // In-app toast (when tab is visible)
        toast.notify(
          msg.message,
          msg.url ? () => navigate(msg.url) : null
        )
        // Browser notification (when tab is hidden / not focused)
        fireBrowserNotification('New Notification', msg.message, msg.url, navigate)
      } catch { /* ignore malformed frame */ }
    })

    return () => {
      unsubscribe()
      shutdown() // logout / provider teardown closes the single connection
    }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────────────────

  const markRead = useCallback(async (id) => {
    await notificationsApi.markRead(id)
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
  }, [])

  const markAllRead = useCallback(async () => {
    await notificationsApi.markAllRead()
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [])

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, markRead, markAllRead,
      browserNotifStatus, enableBrowserNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider')
  return ctx
}
