/**
 * Backend URL helpers — source of truth: VITE_API_BASE_URL in .env.local
 * Example: VITE_API_BASE_URL=http://localhost:8080/
 */

function normalizeBackendRoot(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/, '')
}

/** Backend origin without trailing slash or /api suffix. */
export function getBackendBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL
  if (!configured || !String(configured).trim()) {
    console.warn('[Config] VITE_API_BASE_URL is not set. Add it to .env.local')
    return ''
  }
  return normalizeBackendRoot(configured)
}

/** Axios base URL — always ends with /api */
export function getApiBaseUrl() {
  const root = getBackendBaseUrl()
  if (!root) return ''
  return root.endsWith('/api') ? root : `${root}/api`
}

/** STOMP WebSocket URL derived from backend origin. Null when relative/missing. */
export function buildWsUrl() {
  const raw = getBackendBaseUrl()
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) return null
  return raw.replace(/^http/, 'ws') + '/ws'
}
