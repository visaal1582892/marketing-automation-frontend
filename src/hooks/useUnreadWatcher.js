import { useEffect, useRef, useState, useCallback } from 'react'
import { Client } from '@stomp/stompjs'
import { tokenStorage } from '../api/client'

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
  const clientRef    = useRef(null)
  const openTaskRef  = useRef(openTaskId)

  // Keep the ref in sync so the subscription closure always sees the latest value.
  useEffect(() => { openTaskRef.current = openTaskId }, [openTaskId])

  const clearUnread = useCallback((taskId) => {
    setUnreadCounts((prev) => ({ ...prev, [taskId]: 0 }))
  }, [])

  useEffect(() => {
    if (!taskIds?.length) return

    const token = tokenStorage.get()
    if (!token) return

    const apiBase = (import.meta.env.VITE_API_BASE_URL || '')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/api$/, '')
    const wsUrl = apiBase.replace(/^http/, 'ws') + '/ws'

    const client = new Client({
      brokerURL: wsUrl,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
        'ngrok-skip-browser-warning': 'true',
      },
      reconnectDelay: 8000,
      onConnect: () => {
        taskIds.forEach((taskId) => {
          client.subscribe(`/topic/chat/${taskId}`, (frame) => {
            try {
              const msg = JSON.parse(frame.body)
              // Ignore own messages, and ignore if that chat is currently open.
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
    })

    client.activate()
    clientRef.current = client

    return () => {
      client.deactivate()
      clientRef.current = null
    }
  }, [JSON.stringify(taskIds), currentUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { unreadCounts, clearUnread }
}
