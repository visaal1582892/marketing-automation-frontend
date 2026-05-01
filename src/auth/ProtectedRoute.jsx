import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

/**
 * Wrap any route that should only render for authenticated users.
 *
 * Props:
 *   requireRole  – single role string OR array of allowed roles
 *   excludeRole  – single role string OR array of roles that CANNOT access
 *
 * Multi-role aware: a user passes the requireRole check if they hold ANY of
 * their roles that matches any entry in the allowed list.
 */
export default function ProtectedRoute({ children, requireRole, excludeRole }) {
  const { isAuthenticated, user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        Loading...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // All roles the current user holds, lower-cased for comparison.
  const userRoles = (user?.roles ?? []).map(r => r.toLowerCase())

  if (requireRole) {
    const allowed = Array.isArray(requireRole)
      ? requireRole.map(r => r.toLowerCase())
      : [requireRole.toLowerCase()]
    // Pass if the user holds at least one of the allowed roles.
    if (!allowed.some(r => userRoles.includes(r))) {
      return <Navigate to="/dashboard" replace />
    }
  }

  if (excludeRole) {
    const excluded = Array.isArray(excludeRole)
      ? excludeRole.map(r => r.toLowerCase())
      : [excludeRole.toLowerCase()]
    // Block if the user holds any of the excluded roles.
    if (excluded.some(r => userRoles.includes(r))) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return children
}
