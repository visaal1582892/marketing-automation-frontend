import { useEffect, useRef, useState, useCallback } from 'react'
import { Client } from '@stomp/stompjs'
import { tokenStorage } from '../api/client'

const MAX_RETRIES = 4
const BASE_DELAY  = 5_000   // 5 s → 10 s → 20 s → 40 s
const MAX_DELAY   = 60_000  // cap at 60 s

/**
 * Derives the backend WebSocket URL from VITE_API_BASE_URL.
 * Returns null if the env var is missing or is a relative URL (e.g. "/api"),
 * because relative URLs can't be upgraded to an absolute ws(s):// URL —
 * attempting it would silently connect to the frontend host instead.
 */
function buildWsUrl() {
  const raw = (import.meta.env.VITE_API_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/, '')

  if (!raw.startsWith('http://') && !raw.startsWith('https://')) return null
  return raw.replace(/^http/, 'ws') + '/ws'
}

/**
 * Subscribes to /topic/chat/:taskId for every supplied taskId.
 * When a message arrives from someone other than currentUserId,
 * and that task's chat is not currently open, the unread counter increments.
 *
 * @param {string[]}    taskIds       - All collaboration task IDs to watch.
 * @param {number|null} currentUserId - Logged-in user's ID (own messages never count).
 * @param {string|null} openTaskId    - taskId whose chat modal is currently open (if any).
 * @returns {{ unreadCounts: Object.<string,number>, clearUnread: Function }}
 */
export default function useUnreadWatcher(taskIds, currentUserId, openTaskId) {
  const [unreadCounts, setUnreadCounts] = useState({})
  const clientRef   = useRef(null)
  const openTaskRef = useRef(openTaskId)
  const retryCount  = useRef(0)
  const retryTimer  = useRef(null)
  const destroyed   = useRef(false)

  // Keep the ref in sync so the subscription closure always sees the latest value.
  useEffect(() => { openTaskRef.current = openTaskId }, [openTaskId])

  const clearUnread = useCallback((taskId) => {
    setUnreadCounts((prev) => ({ ...prev, [taskId]: 0 }))
  }, [])

  useEffect(() => {
    if (!taskIds?.length) return

    const token = tokenStorage.get()
    if (!token) return

    const wsUrl = buildWsUrl()
    if (!wsUrl) {
      // Relative or missing VITE_API_BASE_URL — skip WebSocket silently.
      // Set the env var to a full backend URL (e.g. https://your-backend.ngrok-free.app)
      // to enable real-time unread badge updates.
      return
    }

    destroyed.current  = false
    retryCount.current = 0

    const scheduleReconnect = () => {
      if (destroyed.current) return
      if (retryCount.current >= MAX_RETRIES) {
        console.warn('[UnreadWatcher] WebSocket failed after max retries — unread badge updates paused.')
        return
      }
      const delay = Math.min(BASE_DELAY * 2 ** retryCount.current, MAX_DELAY)
      retryCount.current += 1
      retryTimer.current = setTimeout(() => {
        if (!destroyed.current) clientRef.current?.activate()
      }, delay)
    }

    const client = new Client({
      brokerURL: wsUrl,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
        'ngrok-skip-browser-warning': 'true',
      },
      reconnectDelay: 0, // manual exponential backoff via scheduleReconnect

      onConnect: () => {
        retryCount.current = 0
        taskIds.forEach((taskId) => {
          client.subscribe(`/topic/chat/${taskId}`, (frame) => {
            try {
              const msg = JSON.parse(frame.body)
              if (Number(msg.userId) === Number(currentUserId)) return
              if (openTaskRef.current === taskId) return
              setUnreadCounts((prev) => ({
                ...prev,
                [taskId]: (prev[taskId] || 0) + 1,
              }))
            } catch { /* ignore malformed frames */ }
          })
        })
      },

      onDisconnect:    () => scheduleReconnect(),
      onStompError:    () => scheduleReconnect(),
      onWebSocketError: () => { /* browser already logs one line; no need to add more */ },
    })

    client.activate()
    clientRef.current = client

    return () => {
      destroyed.current = true
      if (retryTimer.current) clearTimeout(retryTimer.current)
      client.deactivate()
      clientRef.current = null
    }
  }, [JSON.stringify(taskIds), currentUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { unreadCounts, clearUnread }
}
