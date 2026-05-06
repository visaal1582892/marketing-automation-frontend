import { useEffect, useRef, useState } from 'react'
import { Client } from '@stomp/stompjs'
import { tokenStorage } from '../api/client'

/**
 * Real-time chat hook using STOMP over native WebSocket.
 *
 * @param {string|null} taskId        - Work task ID. Pass null to skip.
 * @param {boolean}     active        - Whether the chat panel is open.
 * @param {number|null} currentUserId - The logged-in user's ID (to filter own typing events).
 */
export default function useTaskChat(taskId, active, currentUserId) {
  const [messages,     setMessages]     = useState([])
  const [isConnected,  setIsConnected]  = useState(false)
  const [typingUsers,  setTypingUsers]  = useState([]) // [{ userId, userName }]

  const clientRef      = useRef(null)
  const typingTimers   = useRef({})    // { [userId]: timeoutId }

  const appendMessages = (msgs) => setMessages(msgs)

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
    if (clientRef.current?.connected && taskId) {
      clientRef.current.publish({
        destination: `/app/typing/${taskId}`,
        body: JSON.stringify({ isTyping }),
      })
    }
  }

  useEffect(() => {
    if (!taskId || !active) return

    const token = tokenStorage.get()
    if (!token) return

    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'https://return-atlas-hexagram.ngrok-free.dev/')
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
      reconnectDelay: 5000,
      onConnect: () => {
        setIsConnected(true)

        // Chat messages
        client.subscribe(`/topic/chat/${taskId}`, (frame) => {
          try {
            const msg = JSON.parse(frame.body)
            setMessages((prev) => [...prev, msg])
          } catch { /* ignore */ }
        })

        // Typing events
        client.subscribe(`/topic/typing/${taskId}`, (frame) => {
          try {
            const event = JSON.parse(frame.body)
            const uid = event.userId

            // Never show our own typing indicator
            if (currentUserId && Number(uid) === Number(currentUserId)) return

            if (event.isTyping) {
              setTypingUsers((prev) => {
                const without = prev.filter((u) => u.userId !== uid)
                return [...without, { userId: uid, userName: event.userName }]
              })
              // Auto-clear after 3 s if no follow-up event arrives
              if (typingTimers.current[uid]) clearTimeout(typingTimers.current[uid])
              typingTimers.current[uid] = setTimeout(() => {
                setTypingUsers((prev) => prev.filter((u) => u.userId !== uid))
                delete typingTimers.current[uid]
              }, 3000)
            } else {
              clearTyping(uid)
            }
          } catch { /* ignore */ }
        })
      },
      onDisconnect: () => { setIsConnected(false); setTypingUsers([]) },
      onStompError:  () => { setIsConnected(false); setTypingUsers([]) },
    })

    client.activate()
    clientRef.current = client

    return () => {
      // Clear all pending timers
      Object.values(typingTimers.current).forEach(clearTimeout)
      typingTimers.current = {}
      client.deactivate()
      clientRef.current = null
      setIsConnected(false)
      setTypingUsers([])
    }
  }, [taskId, active]) // eslint-disable-line react-hooks/exhaustive-deps

  return { messages, isConnected, typingUsers, sendTyping, appendMessages, setMessages }
}
