import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { tokenStorage, userStorage } from '../api/client'
import { rightsFromToken } from '../utils/jwt'

const AuthContext = createContext(null)

/** Merge stored user with rights from payload or JWT (legacy session fallback). */
function normalizeUser(rawUser, token) {
  if (!rawUser) return null
  const rights = Array.isArray(rawUser.rights) && rawUser.rights.length
    ? rawUser.rights
    : rightsFromToken(token)
  return { ...rawUser, rights: rights ?? [] }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => normalizeUser(userStorage.get(), tokenStorage.get()))
  const [token, setToken] = useState(() => tokenStorage.get())
  const [loading, setLoading] = useState(false)

  const persistUser = useCallback((rawUser, activeToken) => {
    const normalized = normalizeUser(rawUser, activeToken ?? tokenStorage.get())
    if (normalized) userStorage.set(normalized)
    setUser(normalized)
    return normalized
  }, [])

  // Re-hydrate session from /auth/me when token present but user/rights missing.
  useEffect(() => {
    let alive = true
    const storedToken = tokenStorage.get()
    const storedUser = userStorage.get()
    const needsRefresh = storedToken && (
      !storedUser || !Array.isArray(storedUser.rights) || storedUser.rights.length === 0
    )

    if (needsRefresh) {
      setLoading(true)
      api.get('/auth/me')
        .then((res) => { if (alive) persistUser(res.data, storedToken) })
        .catch(() => { if (alive) logout() })
        .finally(() => { if (alive) setLoading(false) })
    }
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    tokenStorage.set(data.token)
    const normalized = normalizeUser(data.user, data.token)
    userStorage.set(normalized)
    setToken(data.token)
    setUser(normalized)
    return normalized
  }, [])

  const logout = useCallback(() => {
    tokenStorage.clear()
    userStorage.clear()
    setToken(null)
    setUser(null)
  }, [])

  /**
   * Returns true if the current user holds the given role name (case-insensitive).
   * Checks user.roles array (multi-role aware).
   */
  const hasRole = useCallback((roleName) => {
    const roles = user?.roles
    if (!roles || !roleName) return false
    return roles.some(r => r.toLowerCase() === roleName.toLowerCase())
  }, [user])

  const rights = useMemo(
    () => (user?.rights ?? []).map(r => String(r).toUpperCase()),
    [user],
  )

  const hasRight = useCallback((right) => {
    if (!right) return false
    return rights.includes(String(right).toUpperCase())
  }, [rights])

  const hasAnyRight = useCallback((...required) => {
    const flat = required.flat().filter(Boolean)
    if (!flat.length) return false
    return flat.some(r => rights.includes(String(r).toUpperCase()))
  }, [rights])

  const value = useMemo(() => {
    const roles = user?.roles ?? []

    const hasAnyRole = (...roleNames) =>
      roles.some(r => roleNames.some(n => n.toLowerCase() === r.toLowerCase()))

    // Roles that cannot be assigned tasks by the routing engine.
    const NON_WORKER_ROLES = [
      'requestor', 'admin', 'marketing manager', 'procurement manager',
      'manager', 'regional manager',
    ]
    // True when the user holds at least one execution (worker) role, even if they
    // also hold a manager/admin role. Rights-based equivalent: VIEW_MY_TASKS.
    const isWorker = hasAnyRight('VIEW_MY_TASKS') ||
      roles.some(r => !NON_WORKER_ROLES.includes(r.toLowerCase()))

    const isManager = hasAnyRight('ACCESS_MANAGER_TOOLS') ||
      hasAnyRole('marketing manager', 'procurement manager', 'manager')

    return {
      user,
      token,
      rights,
      loading,
      isAuthenticated: Boolean(token && user),
      // Boolean flags — true when user holds that role (or any of the combined roles)
      isAdmin:               hasAnyRole('admin'),
      isRequestor:           hasAnyRole('requestor'),
      isMarketingManager:    hasAnyRole('marketing manager', 'manager') || hasAnyRight('ACCESS_MANAGER_TOOLS'),
      isProcurementManager:  hasAnyRole('procurement manager'),
      isMarketingCreator:    hasAnyRole('marketing creator', 'mart content executive'),
      isHead:                false,
      isRegionalManager:     hasAnyRole('regional manager'),
      isManager,
      /** True if the user holds at least one worker (execution) role. */
      isWorker,
      /** Returns true if the current user holds ANY of the provided role names (case-insensitive). */
      hasAnyRole,
      hasRole,
      hasRight,
      hasAnyRight,
      login,
      logout,
    }
  }, [user, token, rights, loading, hasRole, hasRight, hasAnyRight, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
