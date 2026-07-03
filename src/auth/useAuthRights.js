import { useCallback, useMemo } from 'react'
import { useAuth } from './AuthContext'

/**
 * Rights-based permission helpers.
 * Prefer this over role checks for new UI gates.
 */
export function useAuthRights() {
  const { rights, user } = useAuth()

  const normalized = useMemo(
    () => (rights ?? []).map(r => String(r).toUpperCase()),
    [rights],
  )

  const hasRight = useCallback((right) => {
    if (!right) return false
    return normalized.includes(String(right).toUpperCase())
  }, [normalized])

  const hasAnyRight = useCallback((...required) => {
    const flat = required.flat().filter(Boolean)
    if (!flat.length) return false
    return flat.some(r => normalized.includes(String(r).toUpperCase()))
  }, [normalized])

  const hasAllRights = useCallback((...required) => {
    const flat = required.flat().filter(Boolean)
    if (!flat.length) return false
    return flat.every(r => normalized.includes(String(r).toUpperCase()))
  }, [normalized])

  return { rights: normalized, user, hasRight, hasAnyRight, hasAllRights }
}
