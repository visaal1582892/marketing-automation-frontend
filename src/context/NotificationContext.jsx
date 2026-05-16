import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Client } from '@stomp/stompjs'
import { tokenStorage } from '../api/client'
import { notificationsApi } from '../api/notifications'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/Toast'

const NotificationContext = createContext(null)

function buildWsUrl() {
  // const raw = (import.meta.env.VITE_API_BASE_URL || 'https://exemplify-kinsman-prison.ngrok-free.dev/')
  const raw = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/, '')
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) return null
  return raw.replace(/^http/, 'ws') + '/ws'
}

export function NotificationProvider({ children }) {
  const { user }   = useAuth()
  const toast      = useToast()
  const navigate   = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [unreadCount,   setUnreadCount]   = useState(0)
  const clientRef = useRef(null)
  const userId    = user?.id

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

    const client = new Client({
      brokerURL:        wsUrl,
      reconnectDelay:   5000,
      connectHeaders:   { Authorization: `Bearer ${tokenStorage.get()}` },
      onConnect: () => {
        client.subscribe(`/topic/notifications/${userId}`, frame => {
          try {
            const notification = JSON.parse(frame.body)
            setNotifications(prev => [notification, ...prev])
            setUnreadCount(c => c + 1)
            // Real-time popup — click navigates to the notification URL
            toast.notify(
              notification.message,
              notification.url ? () => navigate(notification.url) : null
            )
          } catch { /* ignore malformed frame */ }
        })
      },
    })

    client.activate()
    clientRef.current = client

    return () => {
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
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider')
  return ctx
}
