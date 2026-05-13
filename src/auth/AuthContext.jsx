import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { tokenStorage, userStorage } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => userStorage.get())
  const [token, setToken] = useState(() => tokenStorage.get())
  const [loading, setLoading] = useState(false)

  // If we already have a token but no cached user, try to fetch /auth/me.
  useEffect(() => {
    let alive = true
    if (token && !user) {
      setLoading(true)
      api.get('/auth/me')
        .then((res) => { if (alive) { setUser(res.data); userStorage.set(res.data) } })
        .catch(() => { if (alive) logout() })
        .finally(() => { if (alive) setLoading(false) })
    }
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    tokenStorage.set(data.token)
    userStorage.set(data.user)
    setToken(data.token)
    setUser(data.user)
    return data.user
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

  const value = useMemo(() => {
    const roles = user?.roles ?? []

    const hasAnyRole = (...roleNames) =>
      roles.some(r => roleNames.some(n => n.toLowerCase() === r.toLowerCase()))

    // Roles that cannot be assigned tasks by the routing engine.
    const NON_WORKER_ROLES = ['requestor', 'admin', 'marketing manager', 'procurement manager', 'head', 'regional manager']
    // True when the user holds at least one execution (worker) role, even if they
    // also hold a manager/admin role.  Used to gate My Tasks / Collaborations.
    const isWorker = roles.some(r => !NON_WORKER_ROLES.includes(r.toLowerCase()))

    return {
      user,
      token,
      loading,
      isAuthenticated: Boolean(token && user),
      // Boolean flags — true when user holds that role (or any of the combined roles)
      isAdmin:               hasAnyRole('admin'),
      isRequestor:           hasAnyRole('requestor'),
      isMarketingManager:    hasAnyRole('marketing manager'),
      isProcurementManager:  hasAnyRole('procurement manager'),
      isMarketingCreator:    hasAnyRole('marketing creator'),
      isHead:                hasAnyRole('head'),
      isRegionalManager:     hasAnyRole('regional manager'),
      /** True if the user holds at least one worker (execution) role. */
      isWorker,
      /** Returns true if the current user holds ANY of the provided role names (case-insensitive). */
      hasAnyRole,
      hasRole,
      login,
      logout,
    }
  }, [user, token, loading, hasRole, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
