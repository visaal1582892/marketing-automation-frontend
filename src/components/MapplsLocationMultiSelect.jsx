import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icon'
import useDebounce from '../hooks/useDebounce'
import { locationsApi } from '../api/locations'
import { getLocationLabel, isSameLocation, normalizeLocationItem } from '../utils/targetLocations'

const DEFAULT_DEBOUNCE_MS = 500
const DEFAULT_MIN_QUERY_LENGTH = 2

async function fetchLocationSuggestions(query, pod) {
  try {
    const data = await locationsApi.suggest(query, pod)
    const items = Array.isArray(data?.suggestedLocations) ? data.suggestedLocations : []
    return items
      .map(item => normalizeLocationItem({
        eLoc: item.eLoc,
        placeName: item.placeName,
        placeAddress: item.placeAddress,
      }))
      .filter(Boolean)
  } catch (error) {
    const status = error?.response?.status
    const message = error?.response?.data?.message
    if (status) {
      console.error('[Locations] HTTP error:', status, message || error.message)
    } else {
      console.error('[Locations] Network error:', error?.message ?? error)
    }
    throw error
  }
}

/**
 * Controlled multi-select for Mappls Autosuggest locations.
 *
 * @param {object[]} value           Selected locations ({ eLoc, placeName, placeAddress })
 * @param {(items: object[]) => void} onChange
 * @param {string}   [placeholder]
 * @param {string}   [pod]           Optional Mappls pod filter (e.g. STATE, CITY, DIST, LC).
 *                                  Omit to allow states, cities, districts, and localities.
 * @param {boolean}  [hasError]
 * @param {number}   [visibleLimit]
 * @param {number}   [debounceMs]
 * @param {number}   [minQueryLength]
 */
export default function MapplsLocationMultiSelect({
  value = [],
  onChange,
  placeholder = 'Search state, city, district or locality…',
  pod,
  hasError = false,
  visibleLimit = 2,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  minQueryLength = DEFAULT_MIN_QUERY_LENGTH,
}) {
  const selectedLocations = useMemo(
    () => (value ?? []).map(normalizeLocationItem).filter(Boolean),
    [value],
  )

  const [inputValue, setInputValue] = useState('')
  const [options, setOptions] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [expanded, setExpanded] = useState(false)

  const containerRef = useRef(null)
  const debouncedQuery = useDebounce(inputValue.trim(), debounceMs)

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadSuggestions() {
      if (!debouncedQuery || debouncedQuery.length < minQueryLength) {
        setOptions([])
        setFetchError('')
        setDropdownOpen(false)
        return
      }

      setIsLoading(true)
      setFetchError('')

      try {
        const results = await fetchLocationSuggestions(debouncedQuery, pod)
        if (cancelled) return
        setOptions(results)
        setDropdownOpen(true)
      } catch (error) {
        if (cancelled) return
        const serverMessage = error?.response?.data?.message
        console.error('[Locations] Fetch error:', serverMessage || error?.message || error)
        setOptions([])
        setFetchError(serverMessage || 'Failed to fetch locations')
        setDropdownOpen(true)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadSuggestions()
    return () => { cancelled = true }
  }, [debouncedQuery, pod, minQueryLength])

  const addLocation = useCallback((location) => {
    const normalized = normalizeLocationItem(location)
    if (!normalized) return
    if (selectedLocations.some(item => isSameLocation(item, normalized))) return
    onChange?.([...selectedLocations, normalized])
    setInputValue('')
    setOptions([])
    setFetchError('')
    setDropdownOpen(false)
  }, [onChange, selectedLocations])

  const removeLocation = useCallback((location) => {
    onChange?.(selectedLocations.filter(item => !isSameLocation(item, location)))
  }, [onChange, selectedLocations])

  const visibleSelected = expanded ? selectedLocations : selectedLocations.slice(0, visibleLimit)
  const hiddenCount = selectedLocations.length - visibleLimit
  const showDropdown = dropdownOpen && (isLoading || fetchError || options.length > 0)

  return (
    <div ref={containerRef} className="relative">
      {selectedLocations.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {visibleSelected.map((location) => (
            <span
              key={location.eLoc}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5
                         text-xs font-medium text-brand-800 ring-1 ring-brand-200"
            >
              <Icon name="mapPin" className="h-3 w-3 shrink-0 text-brand-500" />
              <span className="truncate" title={getLocationLabel(location)}>
                {getLocationLabel(location)}
              </span>
              <button
                type="button"
                onClick={() => removeLocation(location)}
                className="ml-0.5 text-brand-500 transition hover:text-red-500"
                aria-label={`Remove ${getLocationLabel(location)}`}
              >
                <Icon name="x" className="h-3 w-3" />
              </button>
            </span>
          ))}
          {!expanded && hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="inline-flex items-center rounded-full bg-brand-600 px-2 py-0.5 text-xs
                         font-semibold text-white transition hover:bg-brand-700"
            >
              +{hiddenCount} more
            </button>
          )}
          {expanded && hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-xs text-slate-400 transition hover:text-slate-600"
            >
              Show less
            </button>
          )}
        </div>
      )}

      <div className="relative">
        <Icon
          name="mapPin"
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
        />
        {isLoading && (
          <svg
            className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-brand-400"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        )}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setDropdownOpen(true)
          }}
          onFocus={() => {
            if (options.length > 0 || fetchError || isLoading) setDropdownOpen(true)
          }}
          placeholder={selectedLocations.length === 0 ? placeholder : 'Add another location…'}
          className={`w-full rounded-lg border py-2 pl-9 pr-9 text-sm text-slate-800
                      placeholder-slate-400 shadow-sm transition focus:outline-none focus:ring-2
                      ${hasError && selectedLocations.length === 0
            ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
            : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'}`}
        />
      </div>

      {showDropdown && (
        <div
          className="absolute left-0 top-full z-dropdown mt-1 w-full rounded-md border border-slate-200
                     bg-white shadow-lg"
          role="listbox"
          aria-label="Location suggestions"
        >
          <ul className="max-h-60 list-none overflow-y-auto overscroll-contain py-1 [scrollbar-width:thin]">
            {isLoading && (
              <li className="px-3 py-2 text-sm text-slate-500">Searching locations…</li>
            )}
            {!isLoading && fetchError && (
              <li className="px-3 py-2 text-sm text-red-600">{fetchError}</li>
            )}
            {!isLoading && !fetchError && options.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-500">No locations found.</li>
            )}
            {!isLoading && !fetchError && options.map((option) => {
              const alreadyAdded = selectedLocations.some(item => isSameLocation(item, option))
              return (
                <li key={option.eLoc}>
                  <button
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => addLocation(option)}
                    className={`w-full px-3 py-2 text-left transition
                      ${alreadyAdded
                        ? 'cursor-not-allowed opacity-40'
                        : 'hover:bg-brand-50 hover:text-brand-700'}`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon name="mapPin" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800">{option.placeName}</div>
                        {option.placeAddress && (
                          <div className="truncate text-xs text-slate-500">{option.placeAddress}</div>
                        )}
                      </div>
                      {alreadyAdded && (
                        <span className="ml-auto shrink-0 text-xs text-slate-400">Added</span>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="flex items-center gap-1.5 border-t border-slate-100 px-3 py-1.5">
            <span className="text-xs text-slate-400">Powered by Mappls</span>
          </div>
        </div>
      )}
    </div>
  )
}
