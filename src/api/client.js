import axios from 'axios'

const TOKEN_KEY = 'ma_token'
const USER_KEY  = 'ma_user'
const DEFAULT_BACKEND_URL = 'https://parking-polio-robbing.ngrok-free.dev'

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_BACKEND_URL).trim()
const normalisedBaseUrl = configuredBaseUrl.replace(/\/+$/, '')
const apiBaseUrl = normalisedBaseUrl.endsWith('/api')
  ? normalisedBaseUrl
  : `${normalisedBaseUrl}/api`

export const tokenStorage = {
  get:  () => localStorage.getItem(TOKEN_KEY),
  set:  (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export const userStorage = {
  get: () => {
    const raw = localStorage.getItem(USER_KEY)
    try { return raw ? JSON.parse(raw) : null } catch { return null }
  },
  set: (u) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
  clear: () => localStorage.removeItem(USER_KEY),
}

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
    // ngrok may return an interstitial HTML page for browser requests.
    // This header forces direct API responses so GET calls don't break.
    'ngrok-skip-browser-warning': 'true',
  },
  timeout: 20000,
})

// Attach JWT to every outgoing request.
api.interceptors.request.use((config) => {
  config.headers['ngrok-skip-browser-warning'] = 'true'
  const token = tokenStorage.get()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Centralised 401/403 handling.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response) {
      if (err.response.status === 401) {
        // Invalid / expired token — clear session and send to login.
        tokenStorage.clear()
        userStorage.clear()
        if (!window.location.pathname.startsWith('/login')) {
          window.location.assign('/login')
        }
      } else if (err.response.status === 403) {
        // Authenticated but wrong role — the stored session may be stale.
        // Clear it and redirect to login so the user can re-authenticate
        // as the correct account.
        tokenStorage.clear()
        userStorage.clear()
        if (!window.location.pathname.startsWith('/login')) {
          window.location.assign('/login?reason=forbidden')
        }
      }
    }
    return Promise.reject(err)
  },
)

export default api
