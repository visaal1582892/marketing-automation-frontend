import { useEffect, useRef, useState } from 'react'
import { Client } from '@stomp/stompjs'
import { tokenStorage } from '../api/client'
import { buildWsUrl } from '../config/backendUrl'

const MAX_RETRIES  = 4
const BASE_DELAY   = 3_000   // 3 s → 6 s → 12 s → 24 s
const MAX_DELAY    = 30_000  // cap at 30 s

/**
 * Real-time chat hook using STOMP over native WebSocket.
 *
 * @param {string|null} taskId        - Work task ID. Pass null to skip.
 * @param {boolean}     active        - Whether the chat panel is open.
 * @param {number|null} currentUserId - The logged-in user's ID (to filter own typing events).
 */
export default function useTaskChat(taskId, active, currentUserId) {
  const [messages,    setMessages]    = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [typingUsers, setTypingUsers] = useState([])

  const clientRef      = useRef(null)
  const typingTimers   = useRef({})
  const retryCount     = useRef(0)
  const retryTimer     = useRef(null)
  const destroyed      = useRef(false)  // set on cleanup to abort pending retries

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

  const appendMessages = (msgs) => setMessages(msgs)

  useEffect(() => {
    if (!taskId || !active) return

    const token = tokenStorage.get()
    if (!token) return

    const wsUrl = buildWsUrl()
    if (!wsUrl) {
      // Relative VITE_API_BASE_URL (e.g. Vercel proxy) — skip WebSocket
      console.warn('[Chat] VITE_API_BASE_URL is relative; real-time chat disabled. Set a full backend URL to enable it.')
      return
    }

    destroyed.current  = false
    retryCount.current = 0

    // ── Schedule a reconnect with exponential backoff ───────────────────────
    const scheduleReconnect = () => {
      if (destroyed.current) return
      if (retryTimer.current) return           // already scheduled — ignore duplicate call
      if (retryCount.current >= MAX_RETRIES) {
        console.warn(`[Chat] WebSocket failed after ${MAX_RETRIES} attempts — giving up. Check that the backend is reachable.`)
        return
      }
      const delay = Math.min(BASE_DELAY * 2 ** retryCount.current, MAX_DELAY)
      retryCount.current += 1
      retryTimer.current = setTimeout(() => {
        retryTimer.current = null              // allow next disconnect to schedule again
        if (!destroyed.current) clientRef.current?.activate()
      }, delay)
    }

    const client = new Client({
      brokerURL:         wsUrl,
      reconnectDelay:    10000,        // manual exponential backoff via scheduleReconnect
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      connectHeaders: {
        Authorization:                `Bearer ${token}`,
        'ngrok-skip-browser-warning': 'true',
      },

      onConnect: () => {
        retryCount.current = 0
        setIsConnected(true)

        // Chat messages
        client.subscribe(`/topic/chat/${taskId}`, (frame) => {
          try {
            const msg = JSON.parse(frame.body)
            setMessages((prev) => [...prev, msg])
          } catch { /* ignore malformed frames */ }
        })

        // Typing indicators
        client.subscribe(`/topic/typing/${taskId}`, (frame) => {
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
      },

      onDisconnect: () => {
        setIsConnected(false)
        setTypingUsers([])
        scheduleReconnect()
      },

      onStompError: () => {
        setIsConnected(false)
        setTypingUsers([])
        scheduleReconnect()
      },

      // Suppress the WebSocket-level error from propagating further;
      // the browser already logs one line for it — no need to add more.
      onWebSocketError: () => {
        setIsConnected(false)
      },
    })

    client.activate()
    clientRef.current = client

    return () => {
      destroyed.current = true
      if (retryTimer.current) clearTimeout(retryTimer.current)
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
