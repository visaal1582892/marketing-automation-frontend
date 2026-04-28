import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

/**
 * Wrap any route that should only render for authenticated users.
 *
 * Props:
 *   requireRole   – single role string OR array of allowed roles
 *   excludeRole   – single role string OR array of roles that CANNOT access
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

  const userRole = user?.role?.toLowerCase() ?? ''

  if (requireRole) {
    const allowed = Array.isArray(requireRole)
      ? requireRole.map(r => r.toLowerCase())
      : [requireRole.toLowerCase()]
    if (!allowed.includes(userRole)) {
      return <Navigate to="/dashboard" replace />
    }
  }

  if (excludeRole) {
    const excluded = Array.isArray(excludeRole)
      ? excludeRole.map(r => r.toLowerCase())
      : [excludeRole.toLowerCase()]
    if (excluded.includes(userRole)) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return children
}
