/**
 * Target location helpers — supports legacy string arrays and Mappls objects.
 * Stored shape: [{ eLoc, placeName, placeAddress }]
 */

export function normalizeLocationItem(item) {
  if (item == null || item === '') return null
  if (typeof item === 'string') {
    const label = item.trim()
    if (!label) return null
    return { eLoc: `legacy:${label}`, placeName: label, placeAddress: '' }
  }
  if (typeof item === 'object') {
    const placeName = String(item.placeName ?? item.name ?? '').trim()
    if (!placeName) return null
    const eLoc = item.eLoc ? String(item.eLoc) : `legacy:${placeName}`
    return {
      eLoc,
      placeName,
      placeAddress: String(item.placeAddress ?? item.address ?? '').trim(),
    }
  }
  return null
}

export function parseTargetLocations(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map(normalizeLocationItem).filter(Boolean)
  }
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeLocationItem).filter(Boolean)
    }
  } catch {
    /* plain string fallback */
  }
  const single = normalizeLocationItem(raw)
  return single ? [single] : []
}

export function getLocationLabel(item) {
  const loc = normalizeLocationItem(item)
  if (!loc) return ''
  return loc.placeName
}

export function formatTargetLocations(raw) {
  return parseTargetLocations(raw)
    .map(getLocationLabel)
    .filter(Boolean)
    .join(', ')
}

export function serializeTargetLocations(locations) {
  const normalized = (locations ?? [])
    .map(normalizeLocationItem)
    .filter(Boolean)
  return JSON.stringify(normalized)
}

export function isSameLocation(a, b) {
  const left = normalizeLocationItem(a)
  const right = normalizeLocationItem(b)
  if (!left || !right) return false
  if (left.eLoc && right.eLoc && !left.eLoc.startsWith('legacy:') && !right.eLoc.startsWith('legacy:')) {
    return left.eLoc === right.eLoc
  }
  return left.placeName.toLowerCase() === right.placeName.toLowerCase()
}
