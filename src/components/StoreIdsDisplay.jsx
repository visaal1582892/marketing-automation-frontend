import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

/**
 * Normalizes regular store IDs from various input shapes (array of strings,
 * array of store objects { storeId, ... }, comma-separated strings, etc.)
 */
function normalizeStoreList(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw
      .map(item => {
        if (!item) return null
        if (typeof item === 'object' && item.storeId) return String(item.storeId).trim()
        return String(item).trim()
      })
      .filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw.split(',').map(s => s.trim()).filter(Boolean)
  }
  return [String(raw).trim()].filter(Boolean)
}

/**
 * Normalizes custom store IDs from strings (single or comma-separated) or arrays.
 */
function normalizeCustomList(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map(s => String(s).trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw.split(',').map(s => s.trim()).filter(Boolean)
  }
  return [String(raw).trim()].filter(Boolean)
}

/**
 * StoreIdsDisplay
 *
 * Clean, borderless clickable badge UI for displaying store IDs in table cells.
 *
 * Props:
 *  - storeIds: array of strings, array of objects ({storeId}), or comma-separated string
 *  - customStoreId / customStoreIds: string or comma-separated string
 *  - stores, storeId: fallbacks for backward compatibility
 *  - className: optional wrapper styles
 */
export default function StoreIdsDisplay({
  storeIds,
  customStoreId,
  customStoreIds,
  stores,
  storeId,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, showAbove: false })
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)

  // Normalize inputs completely inside component (DRY)
  let rawStores = storeIds ?? stores ?? storeId
  if (Array.isArray(rawStores) && rawStores.length === 0) {
    rawStores = (stores && stores.length > 0) ? stores : storeId
  }
  const regularStores = normalizeStoreList(rawStores)
  const customStores = normalizeCustomList(customStoreId ?? customStoreIds)
  const totalCount = regularStores.length + customStores.length

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const popoverWidth = 240
      const popoverEstimatedHeight = 180

      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const showAbove = spaceBelow < popoverEstimatedHeight && spaceAbove > spaceBelow

      let left = rect.left + window.scrollX
      if (left + popoverWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - popoverWidth - 16)
      }

      setCoords({
        top: showAbove ? rect.top + window.scrollY - 6 : rect.bottom + window.scrollY + 6,
        left,
        showAbove,
      })
    }
  }

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event) {
      const inTrigger = triggerRef.current && triggerRef.current.contains(event.target)
      const inPopover = popoverRef.current && popoverRef.current.contains(event.target)
      if (!inTrigger && !inPopover) {
        setIsOpen(false)
      }
    }

    function handleScroll(event) {
      // Allow scrolling inside popover without closing
      if (popoverRef.current && popoverRef.current.contains(event.target)) {
        return
      }
      setIsOpen(false)
    }

    function handleResize() {
      setIsOpen(false)
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true) // Capture phase to catch table container scroll
    window.addEventListener('resize', handleResize)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleToggle = (e) => {
    // Stop propagation so table row / card clicks are never triggered
    e.preventDefault()
    e.stopPropagation()
    if (!isOpen) {
      updateCoords()
    }
    setIsOpen(prev => !prev)
  }

  // ── 0 Store IDs ──
  if (totalCount === 0) {
    return <span className={`text-slate-400 italic text-xs ${className}`}>—</span>
  }

  // ── Exactly 1 Store ID (No popover required) ──
  if (totalCount === 1) {
    if (regularStores.length === 1) {
      return (
        <span className={`inline-flex items-center text-xs font-medium text-slate-700 tabular-nums ${className}`}>
          {regularStores[0]}
        </span>
      )
    }

    // Single custom store ID (clean amber styling matching TaskManagementPage)
    return (
      <span
        className={`inline-flex items-center text-xs font-normal text-amber-700 truncate max-w-[160px] ${className}`}
        title={`Custom Store: ${customStores[0]}`}
      >
        Custom: {customStores[0]}
      </span>
    )
  }

  // ── Multiple Store IDs (1st store + borderless (+N) remainder badge) ──
  const isFirstCustom = regularStores.length === 0
  const firstStoreId = isFirstCustom ? customStores[0] : regularStores[0]
  const remainderCount = totalCount - 1

  return (
    <div className={`inline-flex items-center ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="group inline-flex items-center gap-1.5 py-0.5 text-xs font-medium text-slate-700 hover:text-slate-900 focus:outline-none transition cursor-pointer"
        title="Click to view all Store IDs"
      >
        {isFirstCustom ? (
          <span className="font-normal text-amber-700 truncate max-w-[140px]">
            Custom: {firstStoreId}
          </span>
        ) : (
          <span className="font-medium text-slate-700">
            {firstStoreId}
          </span>
        )}

        <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-800 transition">
          +{remainderCount}
        </span>
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            onClick={(e) => {
              e.stopPropagation()
            }}
            style={{
              position: 'absolute',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 9999,
              transform: coords.showAbove ? 'translateY(-100%)' : 'none',
            }}
            className="min-w-[220px] max-w-[320px] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <Icon name="building" className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-bold text-slate-800">
                  Store IDs ({totalCount})
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsOpen(false)
                }}
                className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="Close"
              >
                <Icon name="x" className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Standard Store IDs */}
            {regularStores.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Standard Stores ({regularStores.length})
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {regularStores.map((id, idx) => (
                    <span
                      key={`${id}-${idx}`}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-mono bg-slate-100 text-slate-700"
                    >
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Store IDs — Clean Amber highlight without stars */}
            {customStores.length > 0 && (
              <div className={`${regularStores.length > 0 ? 'mt-2.5 pt-2 border-t border-slate-100' : ''} space-y-1.5`}>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 block">
                  Custom Stores ({customStores.length})
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {customStores.map((id, idx) => (
                    <span
                      key={`custom-${id}-${idx}`}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-mono bg-amber-50 text-amber-800"
                    >
                      Custom: {id}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
