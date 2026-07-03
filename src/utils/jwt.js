/**
 * Decode JWT payload (no signature verification — client-side hydration only).
 * Backend validates the token on every API call.
 */
export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

/** Extract rights array from JWT claims. */
export function rightsFromToken(token) {
  const claims = decodeJwtPayload(token)
  if (!claims) return []
  const rights = claims.rights
  return Array.isArray(rights) ? rights : []
}
