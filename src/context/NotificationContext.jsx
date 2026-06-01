import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Client } from '@stomp/stompjs'
import { tokenStorage } from '../api/client'
import { notificationsApi } from '../api/notifications'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/Toast'

const NotificationContext = createContext(null)

function buildWsUrl() {
  const raw = (import.meta.env.VITE_API_BASE_URL || 'https://exemplify-kinsman-prison.ngrok-free.dev/')
  // const raw = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/, '')
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) return null
  return raw.replace(/^http/, 'ws') + '/ws'
}

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
  const clientRef  = useRef(null)
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

  // ── Subscribe to STOMP for real-time push ────────────────────────────────
  useEffect(() => {
    if (!userId) return
    const wsUrl = buildWsUrl()
    if (!wsUrl) return

    const MAX_RETRIES = 5
    const BASE_DELAY  = 5_000   // 5 s → 10 s → 20 s → 40 s → 80 s
    const MAX_DELAY   = 120_000 // cap at 2 min
    const retryCount  = { current: 0 }
    const retryTimer  = { current: null }
    const destroyed   = { current: false }

    const scheduleReconnect = () => {
      if (destroyed.current) return
      if (retryTimer.current) return           // already scheduled — ignore duplicate call
      if (retryCount.current >= MAX_RETRIES) {
        console.warn('[Notifications] WebSocket failed after max retries — real-time updates paused.')
        return
      }
      const delay = Math.min(BASE_DELAY * 2 ** retryCount.current, MAX_DELAY)
      retryCount.current += 1
      retryTimer.current = setTimeout(() => {
        retryTimer.current = null              // allow next disconnect to schedule again
        if (!destroyed.current) client.activate()
      }, delay)
    }

    const client = new Client({
      brokerURL:        wsUrl,
      reconnectDelay:   10000, // 5 seconds // manual exponential backoff via scheduleReconnect
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      connectHeaders: {
        Authorization:             `Bearer ${tokenStorage.get()}`,
        'ngrok-skip-browser-warning': 'true',
      },

      onConnect: () => {
        retryCount.current = 0
        client.subscribe(`/topic/notifications/${userId}`, frame => {
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
      },

      onDisconnect:     () => scheduleReconnect(),
      onStompError:     () => scheduleReconnect(),
      onWebSocketError: () => { /* browser already logs one line */ },
    })

    client.activate()
    clientRef.current = client

    return () => {
      destroyed.current = true
      if (retryTimer.current) clearTimeout(retryTimer.current)
      client.deactivate()
      clientRef.current = null
    }
  }, [userId])

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
