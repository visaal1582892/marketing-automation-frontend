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

  const hasRole = useCallback((roleName) =>
    Boolean(user && user.role && user.role.toLowerCase() === roleName.toLowerCase()),
  [user])

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(token && user),
      isAdmin:            Boolean(user?.role?.toLowerCase() === 'admin'),
      isRequestor:        Boolean(user?.role?.toLowerCase() === 'requestor'),
      isMarketingManager: Boolean(user?.role?.toLowerCase() === 'marketing manager'),
      isMarketingCreator: Boolean(user?.role?.toLowerCase() === 'marketing creator'),
      isHead:             Boolean(user?.role?.toLowerCase() === 'head'),
      isRegionalManager:  Boolean(user?.role?.toLowerCase() === 'regional manager'),
      /** Returns true if current user has ANY of the given role names (case-insensitive). */
      hasAnyRole: (...roles) => Boolean(user?.role && roles.some(r => r.toLowerCase() === user.role.toLowerCase())),
      hasRole,
      login,
      logout,
    }),
    [user, token, loading, hasRole, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
