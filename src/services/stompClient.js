import { Client } from '@stomp/stompjs'
import { tokenStorage } from '../api/client'
import { buildWsUrl } from '../config/backendUrl'

/**
 * Single shared STOMP client for the whole app.
 *
 * Exactly one WebSocket connection exists per logged-in user. Every hook and
 * context (chat, typing, notifications, unread watcher) subscribes through this
 * service instead of instantiating its own Client, which eliminates the
 * duplicate HTTP 101 upgrade requests caused by multiple concurrent sockets.
 *
 * Reconnection is delegated entirely to STOMP's built-in reconnectDelay — there
 * is no second custom reconnect loop. On every (re)connect, all registered
 * subscriptions are re-created automatically.
 */

const RECONNECT_DELAY_MS   = 5_000
const HEARTBEAT_INCOMING_MS = 4_000
const HEARTBEAT_OUTGOING_MS = 4_000

let client = null
let connected = false
let subscriptionCounter = 0

const subscriptions  = new Map() // id -> { destination, callback, handle }
const statusListeners = new Set() // (isConnected: boolean) => void

function notifyStatus(value) {
  connected = value
  statusListeners.forEach((listener) => {
    try {
      listener(value)
    } catch (err) {
      console.error('[stomp] status listener threw', err)
    }
  })
}

function activateSubscription(entry) {
  entry.handle = client.subscribe(entry.destination, entry.callback)
}

function reestablishAllSubscriptions() {
  subscriptions.forEach((entry) => {
    // Old broker-side subscriptions die with the previous socket, so the stale
    // handle is discarded and a fresh subscription is created on reconnect.
    entry.handle = null
    activateSubscription(entry)
  })
}

/**
 * Create and activate the single client if it does not already exist.
 * Idempotent: repeated calls never spawn a second connection or a second
 * activate() while one is already active or reconnecting.
 *
 * @returns {Client|null} the shared client, or null when no WebSocket URL is configured.
 */
export function ensureConnected() {
  if (client) return client

  const wsUrl = buildWsUrl()
  if (!wsUrl) {
    console.warn('[stomp] VITE_API_BASE_URL is relative or missing; real-time features disabled.')
    return null
  }

  client = new Client({
    brokerURL:         wsUrl,
    reconnectDelay:    RECONNECT_DELAY_MS,
    heartbeatIncoming: HEARTBEAT_INCOMING_MS,
    heartbeatOutgoing: HEARTBEAT_OUTGOING_MS,

    // Refresh auth header on every (re)connect so a rotated token stays valid.
    beforeConnect: () => {
      client.connectHeaders = {
        Authorization:                `Bearer ${tokenStorage.get()}`,
        'ngrok-skip-browser-warning': 'true',
      }
    },

    onConnect: () => {
      notifyStatus(true)
      reestablishAllSubscriptions()
    },

    onWebSocketClose: () => notifyStatus(false),
    onDisconnect:     () => notifyStatus(false),

    onStompError: (frame) => {
      notifyStatus(false)
      console.error('[stomp] broker error', frame?.headers?.message, frame?.body)
    },

    onWebSocketError: () => notifyStatus(false),
  })

  client.activate()
  return client
}

/**
 * Register a topic subscription on the shared client. The subscription is
 * tracked centrally and re-created automatically after any reconnect.
 *
 * @param {string}   destination STOMP destination, e.g. /topic/chat/42
 * @param {Function} callback    frame handler
 * @returns {Function} unsubscribe function (safe to call multiple times)
 */
export function subscribe(destination, callback) {
  ensureConnected()

  const id = ++subscriptionCounter
  const entry = { destination, callback, handle: null }
  subscriptions.set(id, entry)

  if (client && connected) activateSubscription(entry)

  return () => {
    const tracked = subscriptions.get(id)
    if (!tracked) return
    if (tracked.handle) {
      try {
        tracked.handle.unsubscribe()
      } catch (err) {
        console.error('[stomp] unsubscribe failed', err)
      }
    }
    subscriptions.delete(id)
  }
}

/**
 * Publish a frame on the shared client. No-op (with a warning) when the
 * connection is not currently open, so callers never crash on transient drops.
 */
export function publish(params) {
  if (!client || !connected) {
    console.warn('[stomp] publish skipped — not connected', params?.destination)
    return false
  }
  client.publish(params)
  return true
}

export function isConnected() {
  return connected
}

/**
 * Subscribe to connection-status changes. Immediately invokes the listener with
 * the current state so callers can render without waiting for the next event.
 *
 * @param {(isConnected: boolean) => void} listener
 * @returns {Function} unregister function
 */
export function onStatusChange(listener) {
  statusListeners.add(listener)
  listener(connected)
  return () => statusListeners.delete(listener)
}

/**
 * Tear down the single connection and clear all subscriptions. Called on logout
 * so the next login starts a clean, single connection.
 */
export function shutdown() {
  subscriptions.forEach((entry) => {
    if (entry.handle) {
      try {
        entry.handle.unsubscribe()
      } catch (err) {
        console.error('[stomp] unsubscribe during shutdown failed', err)
      }
    }
  })
  subscriptions.clear()

  if (client) {
    client.deactivate()
    client = null
  }
  notifyStatus(false)
}
