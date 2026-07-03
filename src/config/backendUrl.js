/**
 * Backend URL helpers — source of truth: VITE_API_BASE_URL
 *   Dev:  .env.local  (e.g. http://localhost:8080/)
 *   Prod: .env.production or Vercel Environment Variables (set before build)
 */

function normalizeBackendRoot(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/, '')
}

function configuredBackendRoot() {
  const configured = import.meta.env.VITE_API_BASE_URL
  if (!configured || !String(configured).trim()) return ''
  return normalizeBackendRoot(configured)
}

/** Backend origin without trailing slash or /api suffix. */
export function getBackendBaseUrl() {
  const fromEnv = configuredBackendRoot()
  if (fromEnv) return fromEnv

  // Deployed SPA on Vercel with /api rewrites — same-origin calls when env missing at build.
  if (import.meta.env.PROD && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  if (import.meta.env.DEV) {
    console.warn('[Config] VITE_API_BASE_URL is not set. Add it to .env.local')
  }
  return ''
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
