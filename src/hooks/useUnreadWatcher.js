import { useEffect, useRef, useState, useCallback } from 'react'
import { ensureConnected, subscribe } from '../services/stompClient'

/**
 * Subscribes to /topic/chat/:taskId for every supplied taskId on the single
 * shared STOMP client. When a message arrives from someone other than
 * currentUserId, and that task's chat is not currently open, the unread
 * counter increments.
 *
 * This hook never opens its own WebSocket — it reuses the shared connection
 * owned by NotificationProvider and only manages its own topic subscriptions.
 *
 * @param {string[]}    taskIds       - All collaboration task IDs to watch.
 * @param {number|null} currentUserId - Logged-in user's ID (own messages never count).
 * @param {string|null} openTaskId    - taskId whose chat modal is currently open (if any).
 * @returns {{ unreadCounts: Object.<string,number>, clearUnread: Function }}
 */
export default function useUnreadWatcher(taskIds, currentUserId, openTaskId) {
  const [unreadCounts, setUnreadCounts] = useState({})
  const openTaskRef = useRef(openTaskId)

  // Keep the ref in sync so the subscription closure always sees the latest value.
  useEffect(() => { openTaskRef.current = openTaskId }, [openTaskId])

  const clearUnread = useCallback((taskId) => {
    setUnreadCounts((prev) => ({ ...prev, [taskId]: 0 }))
  }, [])

  useEffect(() => {
    if (!taskIds?.length) return

    if (!ensureConnected()) return // no WebSocket URL configured — unread updates disabled

    const unsubscribers = taskIds.map((taskId) =>
      subscribe(`/topic/chat/${taskId}`, (frame) => {
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
    )

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [JSON.stringify(taskIds), currentUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { unreadCounts, clearUnread }
}
