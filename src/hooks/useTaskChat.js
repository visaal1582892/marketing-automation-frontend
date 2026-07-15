import { useEffect, useRef, useState } from 'react'
import { ensureConnected, subscribe, publish, isConnected, onStatusChange } from '../services/stompClient'

/**
 * Real-time chat hook using the single shared STOMP client.
 *
 * It never creates its own WebSocket — it subscribes to the chat and typing
 * topics on the shared connection and cleans those subscriptions up on unmount,
 * leaving the underlying connection (owned by NotificationProvider) untouched.
 *
 * @param {string|null} taskId        - Work task ID. Pass null to skip.
 * @param {boolean}     active        - Whether the chat panel is open.
 * @param {number|null} currentUserId - The logged-in user's ID (to filter own typing events).
 */
export default function useTaskChat(taskId, active, currentUserId) {
  const [messages,    setMessages]    = useState([])
  const [isConn,      setIsConn]      = useState(false)
  const [typingUsers, setTypingUsers] = useState([])

  const typingTimers = useRef({})

  // ── Clear a user from the typing list ──────────────────────────────────────
  const clearTyping = (userId) => {
    if (typingTimers.current[userId]) {
      clearTimeout(typingTimers.current[userId])
      delete typingTimers.current[userId]
    }
    setTypingUsers((prev) => prev.filter((u) => u.userId !== userId))
  }

  // ── Send our own typing state to the server ─────────────────────────────────
  const sendTyping = (isTyping) => {
    if (taskId && isConnected()) {
      publish({
        destination: `/app/typing/${taskId}`,
        body: JSON.stringify({ isTyping }),
      })
    }
  }

  const appendMessages = (msgs) => setMessages(msgs)

  useEffect(() => {
    if (!taskId || !active) return

    if (!ensureConnected()) return // no WebSocket URL configured — real-time chat disabled

    const stopStatus = onStatusChange(setIsConn)

    const unsubChat = subscribe(`/topic/chat/${taskId}`, (frame) => {
      try {
        const msg = JSON.parse(frame.body)
        setMessages((prev) => [...prev, msg])
      } catch { /* ignore malformed frames */ }
    })

    const unsubTyping = subscribe(`/topic/typing/${taskId}`, (frame) => {
      try {
        const event = JSON.parse(frame.body)
        const uid = event.userId
        if (currentUserId && Number(uid) === Number(currentUserId)) return

        if (event.isTyping) {
          setTypingUsers((prev) => {
            const without = prev.filter((u) => u.userId !== uid)
            return [...without, { userId: uid, userName: event.userName }]
          })
          if (typingTimers.current[uid]) clearTimeout(typingTimers.current[uid])
          typingTimers.current[uid] = setTimeout(() => {
            setTypingUsers((prev) => prev.filter((u) => u.userId !== uid))
            delete typingTimers.current[uid]
          }, 3000)
        } else {
          clearTyping(uid)
        }
      } catch { /* ignore malformed frames */ }
    })

    return () => {
      stopStatus()
      unsubChat()
      unsubTyping()
      Object.values(typingTimers.current).forEach(clearTimeout)
      typingTimers.current = {}
      setTypingUsers([])
    }
  }, [taskId, active]) // eslint-disable-line react-hooks/exhaustive-deps

  return { messages, isConnected: isConn, typingUsers, sendTyping, appendMessages, setMessages }
}
