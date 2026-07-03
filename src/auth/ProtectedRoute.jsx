import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

/**
 * Wrap any route that should only render for authenticated users.
 *
 * Props:
 *   requireRole       – single role string OR array (legacy; ignored when rights props set)
 *   requireRight      – single right string (must hold)
 *   requireAnyRight   – right string OR array — pass if user holds ANY
 *   excludeRole       – role(s) that CANNOT access
 *   requireWorkerRole – deprecated; equivalent to requireRight VIEW_MY_TASKS
 *   fallback          – redirect target when denied (default /dashboard)
 *
 * When requireRight / requireAnyRight is set, only rights are checked (no role bypass).
 */
export default function ProtectedRoute({
  children,
  requireRole,
  requireRight,
  requireAnyRight,
  excludeRole,
  requireWorkerRole,
  fallback = '/dashboard',
}) {
  const { isAuthenticated, user, loading, hasRight, hasAnyRight } = useAuth()
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

  const userRoles = (user?.roles ?? []).map(r => r.toLowerCase())
  const hasRightsGate = Boolean(requireRight || requireAnyRight || requireWorkerRole)

  if (requireRight && !hasRight(requireRight)) {
    return <Navigate to={fallback} replace />
  }

  if (requireAnyRight) {
    const required = Array.isArray(requireAnyRight) ? requireAnyRight : [requireAnyRight]
    if (!hasAnyRight(...required)) {
      return <Navigate to={fallback} replace />
    }
  }

  if (requireWorkerRole && !hasRight('VIEW_MY_TASKS')) {
    return <Navigate to={fallback} replace />
  }

  if (!hasRightsGate && requireRole) {
    const allowed = Array.isArray(requireRole)
      ? requireRole.map(r => r.toLowerCase())
      : [requireRole.toLowerCase()]
    if (!allowed.some(r => userRoles.includes(r))) {
      return <Navigate to={fallback} replace />
    }
  }

  if (excludeRole) {
    const excluded = Array.isArray(excludeRole)
      ? excludeRole.map(r => r.toLowerCase())
      : [excludeRole.toLowerCase()]
    if (excluded.some(r => userRoles.includes(r))) {
      return <Navigate to={fallback} replace />
    }
  }

  return children
}
