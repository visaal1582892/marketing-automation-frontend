import { useAuthRights } from '../auth/useAuthRights'

/**
 * Conditionally render children when the user holds required right(s).
 *
 * @param {string|string[]} right   – single right or array (any match passes when mode='any')
 * @param {'any'|'all'}     mode    – 'any' (default) or 'all'
 * @param {React.ReactNode} fallback – optional content when denied
 */
export default function HasRight({ right, mode = 'any', fallback = null, children }) {
  const { hasAnyRight, hasAllRights } = useAuthRights()

  const required = Array.isArray(right) ? right : [right]
  const allowed = mode === 'all'
    ? hasAllRights(...required)
    : hasAnyRight(...required)

  if (!allowed) return fallback
  return children
}
