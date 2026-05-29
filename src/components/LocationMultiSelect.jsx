import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

function useNominatim() {
  const timerRef = useRef(null)
  const search = (q, setSuggestions, setLoading, setOpen) => {
    if (!q || q.length < 3) { setSuggestions([]); setOpen(false); return }
    setLoading(true)
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=in&limit=10&format=json&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
      .then((r) => r.json())
      .then((data) => {
        const seen  = new Set()
        const items = []
        for (const item of data) {
          const a = item.address || {}
          const parts = [
            a.city || a.town || a.village || a.county || a.district || a.suburb,
            a.state_district,
            a.state,
          ].filter(Boolean)
          const label = [...new Set(parts)].join(', ') || item.display_name
          if (!seen.has(label)) { seen.add(label); items.push(label) }
        }
        setSuggestions(items)
        setOpen(items.length > 0)
      })
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false))
  }
  const debounced = (q, ...args) => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(q, ...args), 400)
  }
  return debounced
}

export default function LocationMultiSelect({ selected, onChange, hasError, visibleLimit = 2 }) {
  const [query,       setQuery]       = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open,        setOpen]        = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [expanded,    setExpanded]    = useState(false)
  const ref     = useRef(null)
  const searchNominatim = useNominatim()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleInput = (e) => {
    const q = e.target.value
    setQuery(q)
    searchNominatim(q, setSuggestions, setLoading, setOpen)
  }

  const pick = (label) => {
    if (!selected.includes(label)) onChange([...selected, label])
    setQuery('')
    setSuggestions([])
    setOpen(false)
  }

  const remove = (label) => onChange(selected.filter((s) => s !== label))

  const visible     = expanded ? selected : selected.slice(0, visibleLimit)
  const hiddenCount = selected.length - visibleLimit

  return (
    <div ref={ref} className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2 items-center">
          {visible.map((loc) => (
            <span key={loc}
              className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5
                text-xs font-medium text-brand-800 ring-1 ring-brand-200">
              <Icon name="mapPin" className="h-3 w-3 shrink-0 text-brand-500" />
              <span className="max-w-[120px] truncate">{loc}</span>
              <button type="button" onClick={() => remove(loc)}
                className="ml-0.5 text-brand-500 hover:text-red-500 transition">
                <Icon name="x" className="h-3 w-3" />
              </button>
            </span>
          ))}
          {!expanded && hiddenCount > 0 && (
            <button type="button" onClick={() => setExpanded(true)}
              className="inline-flex items-center rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-brand-700 transition">
              +{hiddenCount} more
            </button>
          )}
          {expanded && hiddenCount > 0 && (
            <button type="button" onClick={() => setExpanded(false)}
              className="text-xs text-slate-400 hover:text-slate-600 transition">
              Show less
            </button>
          )}
        </div>
      )}

      <div className="relative">
        <Icon name="mapPin" className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        {loading && (
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-brand-400"
            fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        )}
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
          placeholder={selected.length === 0 ? 'Search city, district or state…' : 'Add another location…'}
          className={`w-full rounded-lg border pl-9 pr-9 py-2 text-sm text-slate-800
            placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 transition
            ${hasError && selected.length === 0
              ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
              : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'}`}
        />
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="max-h-56 overflow-y-auto py-1">
            {suggestions.map((label, idx) => {
              const alreadyAdded = selected.includes(label)
              return (
                <button key={idx} type="button" onClick={() => !alreadyAdded && pick(label)}
                  disabled={alreadyAdded}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 text-sm text-left transition
                    ${alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-brand-50 hover:text-brand-700'}`}>
                  <span className="flex items-center gap-2">
                    <Icon name="mapPin" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="text-slate-700">{label}</span>
                  </span>
                  {alreadyAdded && <span className="text-xs text-slate-400">Added</span>}
                </button>
              )
            })}
          </div>
          <div className="border-t border-slate-100 px-3 py-1.5 flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Powered by OpenStreetMap</span>
          </div>
        </div>
      )}
    </div>
  )
}
