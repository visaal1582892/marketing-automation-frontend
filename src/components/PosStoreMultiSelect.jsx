import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import useDebounce from '../hooks/useDebounce'
import { posDataApi } from '../api/posData'
import DynamicPillsTrigger from './DynamicPillsTrigger'

const DEFAULT_DEBOUNCE_MS = 500
const DEFAULT_MIN_QUERY_LENGTH = 4

export default function PosStoreMultiSelect({
  value = [],
  onChange,
  placeholder = 'Search store by ID or Pincode (min 4 chars)…',
  hasError = false,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  minQueryLength = DEFAULT_MIN_QUERY_LENGTH,
}) {
  const selectedStores = useMemo(() => value ?? [], [value])

  const [inputValue, setInputValue] = useState('')
  const [options, setOptions] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [coords, setCoords] = useState(null)

  const containerRef = useRef(null)
  const dropdownRef = useRef(null)
  const debouncedQuery = useDebounce(inputValue.trim(), debounceMs)

  useEffect(() => {
    const handleOutsideClick = (event) => {
      const isClickInsideContainer = containerRef.current && containerRef.current.contains(event.target)
      const isClickInsideDropdown = dropdownRef.current && dropdownRef.current.contains(event.target)
      if (!isClickInsideContainer && !isClickInsideDropdown) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      })
    }
  }

  useEffect(() => {
    if (dropdownOpen) {
      updateCoords()
      
      let isAutoScrolling = false
      const timer = setTimeout(() => {
        if (dropdownRef.current && containerRef.current) {
          const rect = dropdownRef.current.getBoundingClientRect()
          if (rect.bottom > window.innerHeight) {
            const scrollAmount = rect.bottom - window.innerHeight + 20
            isAutoScrolling = true
            setTimeout(() => { isAutoScrolling = false }, 500)
            let parent = containerRef.current.parentElement
            let scrolled = false
            while (parent && parent !== document.documentElement) {
              const style = window.getComputedStyle(parent)
              if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                parent.scrollBy({ top: scrollAmount, behavior: 'smooth' })
                scrolled = true
                break
              }
              parent = parent.parentElement
            }
            if (!scrolled) window.scrollBy({ top: scrollAmount, behavior: 'smooth' })
          }
        }
      }, 10)

      const handleScroll = (e) => {
        if (isAutoScrolling) {
          updateCoords()
          return
        }
        if (dropdownRef.current && dropdownRef.current.contains(e.target)) return
        setDropdownOpen(false)
      }

      const handleResize = () => setDropdownOpen(false)

      window.addEventListener('scroll', handleScroll, true)
      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('scroll', handleScroll, true)
        window.removeEventListener('resize', handleResize)
        clearTimeout(timer)
      }
    }
  }, [dropdownOpen])

  useEffect(() => {
    let cancelled = false

    async function loadSuggestions() {
      if (!debouncedQuery || debouncedQuery.length < minQueryLength) {
        setOptions([])
        setFetchError('')
        return
      }

      setIsLoading(true)
      setFetchError('')

      try {
        const results = await posDataApi.searchStores(debouncedQuery)
        if (cancelled) return
        setOptions(results)
      } catch (error) {
        if (cancelled) return
        const serverMessage = error?.response?.data?.message
        console.error('[Stores] Fetch error:', serverMessage || error?.message || error)
        setOptions([])
        setFetchError(serverMessage || 'Failed to fetch stores')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadSuggestions()
    return () => { cancelled = true }
  }, [debouncedQuery, minQueryLength])

  const toggleStore = useCallback((store) => {
    const isSelected = selectedStores.some(item => item.storeId === store.storeId)
    if (isSelected) {
      onChange?.(selectedStores.filter(item => item.storeId !== store.storeId))
    } else {
      onChange?.([...selectedStores, store])
    }
  }, [onChange, selectedStores])

  const removeStore = useCallback((storeId) => {
    onChange?.(selectedStores.filter(item => item.storeId !== storeId))
  }, [onChange, selectedStores])

  const selectedItemsForTrigger = selectedStores.map(s => ({
    id: s.storeId,
    name: `${s.storeId} - ${s.pinCode || 'N/A'}`
  }))

  const displayOptions = useMemo(() => {
    return [...options].sort((a, b) => {
      const aSelected = selectedStores.some(item => item.storeId === a.storeId)
      const bSelected = selectedStores.some(item => item.storeId === b.storeId)
      if (aSelected && !bSelected) return -1
      if (!aSelected && bSelected) return 1
      return 0
    })
  }, [options, selectedStores])

  const portalContent = dropdownOpen && coords ? createPortal(
    <div
      ref={dropdownRef}
      className="absolute z-[9999] mt-1 max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white py-1.5 text-sm shadow-xl ring-1 ring-black/5 focus:outline-none"
      style={{ top: coords.top, left: coords.left, width: coords.width }}
    >
      <div className="sticky top-0 bg-white px-2 pb-2 pt-1 border-b border-slate-100 z-10">
        <div className="relative">
          <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          {isLoading && (
            <svg
              className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-brand-400"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          )}
          <input
            type="text"
            className="w-full pl-8 pr-8 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        </div>
      </div>
      
      {debouncedQuery.length > 0 && debouncedQuery.length < minQueryLength ? (
        <div className="relative cursor-default select-none px-4 py-2 text-slate-500">
          Please enter at least {minQueryLength} characters to search...
        </div>
      ) : fetchError ? (
        <div className="relative cursor-default select-none px-4 py-2 text-red-500">
          {fetchError}
        </div>
      ) : isLoading ? (
        <div className="relative cursor-default select-none px-4 py-2 text-slate-500">
          Searching...
        </div>
      ) : displayOptions.length === 0 && debouncedQuery.length >= minQueryLength ? (
        <div className="relative cursor-default select-none px-4 py-2 text-slate-500">
          No stores found.
        </div>
      ) : (
        displayOptions.map((store) => {
          const isSelected = selectedStores.some(item => item.storeId === store.storeId)
          return (
            <div
              key={store.storeId}
              className={`relative flex cursor-pointer select-none items-center gap-2.5 px-3 py-2 transition-colors hover:bg-brand-50 ${isSelected ? 'bg-brand-50' : ''}`}
              onClick={() => toggleStore(store)}
            >
              <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${isSelected ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'}`}>
                {isSelected && (
                  <svg viewBox="0 0 12 12" fill="none" style={{ width: '10px', height: '10px' }}>
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div className="flex flex-col">
                <span className={`block truncate ${isSelected ? 'font-medium text-brand-800' : 'font-normal text-slate-700'}`}>
                  {store.storeId} - {store.pinCode || 'N/A'}
                </span>
                <span className="block truncate text-xs text-slate-500 mt-0.5">
                  {store.name}
                </span>
              </div>
            </div>
          )
        })
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        className={`w-full p-0 rounded-lg border shadow-sm transition-colors bg-white text-left 
          ${hasError ? 'border-red-400 ring-1 ring-red-200' :
            dropdownOpen ? 'border-brand-500 ring-1 ring-brand-200' : 'border-slate-300 hover:border-slate-400'}`}
        onClick={() => {
          setDropdownOpen(!dropdownOpen)
        }}
      >
        <DynamicPillsTrigger
          selectedItems={selectedItemsForTrigger}
          placeholder="Select store(s)…"
          onRemove={removeStore}
          isOpen={dropdownOpen}
        />
      </button>

      {portalContent}
    </div>
  )
}
