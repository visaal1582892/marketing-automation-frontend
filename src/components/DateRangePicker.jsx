/**
 * Lightweight date-range picker.
 *
 * Props:
 *   from     string | null  — ISO date string 'YYYY-MM-DD'
 *   to       string | null  — ISO date string 'YYYY-MM-DD'
 *   onChange ({ from, to }) — called when selection changes
 *   placeholder string      — label when no dates are selected (default 'All dates')
 */
import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

function toISO(d) {
  if (!d) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtShort(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}

function buildGrid(year, month) {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const grid  = []
  for (let i = 0; i < first.getDay(); i++) grid.push(null)
  for (let d = 1; d <= last.getDate(); d++) grid.push(new Date(year, month, d))
  return grid
}

function inRange(iso, from, to) {
  if (!from) return false
  const s = from
  const e = to ?? from
  const [lo, hi] = s <= e ? [s, e] : [e, s]
  return iso > lo && iso < hi
}

export default function DateRangePicker({ from, to, onChange, placeholder = 'All dates', maxDate }) {
  const today = new Date()
  // maxDate as ISO string for comparison; default: today (no future dates)
  const maxISO = maxDate !== undefined ? maxDate : toISO(today)
  const [open,      setOpen]      = useState(false)
  const [stage,     setStage]     = useState('start')
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [hovered,   setHovered]   = useState(null)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const openPicker = () => {
    setStage(from ? 'end' : 'start')
    if (from) {
      const d = new Date(from + 'T00:00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
    setOpen(true)
  }

  const clear = (e) => {
    e?.stopPropagation()
    onChange({ from: null, to: null })
    setHovered(null)
    setOpen(false)
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const handleDay = (day) => {
    if (!day) return
    const iso = toISO(day)
    if (maxISO && iso > maxISO) return   // block future dates
    if (stage === 'start') {
      onChange({ from: iso, to: null })
      setStage('end')
    } else {
      if (!from || iso < from) {
        onChange({ from: iso, to: from })
      } else {
        onChange({ from, to: iso })
      }
      setOpen(false)
      setStage('start')
      setHovered(null)
    }
  }

  const dayStyle = (day) => {
    if (!day) return ''
    const iso = toISO(day)
    if (maxISO && iso > maxISO) return 'text-slate-300 cursor-not-allowed'
    const hovIso = hovered ? toISO(hovered) : null
    const effectiveTo = stage === 'end' && hovIso && from
      ? (hovIso >= from ? hovIso : from)
      : to
    const effectiveFrom = stage === 'end' && hovIso && from
      ? (hovIso >= from ? from : hovIso)
      : from

    const isStart  = iso === from
    const isEnd    = iso === to
    const isHov    = iso === hovIso && stage === 'end'
    const isInRange = inRange(iso, effectiveFrom, effectiveTo)

    if (isStart || isEnd || (isHov && !to)) {
      return 'bg-brand-600 text-white font-semibold rounded-lg'
    }
    if (isInRange) {
      return 'bg-brand-100 text-brand-800 rounded-lg'
    }
    return 'text-slate-700 hover:bg-slate-100 rounded-lg'
  }

  const label = from
    ? to
      ? `${fmtShort(from)}  →  ${fmtShort(to)}`
      : `From ${fmtShort(from)}`
    : placeholder

  const hasSelection = Boolean(from)
  const grid = buildGrid(viewYear, viewMonth)

  return (
    <div ref={ref} className="relative inline-block">
      {/* Trigger button */}
      <button
        type="button"
        onClick={openPicker}
        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition select-none
          ${hasSelection
            ? 'border-brand-400 bg-brand-50 text-brand-700'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
      >
        <Icon name="calendar" className="h-3.5 w-3.5 shrink-0" />
        <span className="whitespace-nowrap">{label}</span>
        {hasSelection && (
          <span
            onClick={clear}
            className="rounded p-0.5 hover:bg-brand-100 cursor-pointer text-brand-500"
            title="Clear dates"
          >
            <Icon name="x" className="h-3 w-3" />
          </span>
        )}
      </button>

      {/* Calendar popover */}
      {open && (
        <div className="absolute left-0 top-full z-[100] mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">

          {/* Stage hint */}
          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-brand-600">
            {stage === 'start' ? 'Select start date' : 'Select end date'}
          </p>

          {/* Month nav */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 transition"
            >
              <Icon name="chevron" className="h-4 w-4 rotate-180" />
            </button>
            <span className="text-sm font-semibold text-slate-800">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 transition"
            >
              <Icon name="chevron" className="h-4 w-4" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="mb-1 grid grid-cols-7">
            {DAYS.map(d => (
              <div key={d} className="py-1 text-center text-[10px] font-semibold text-slate-400">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {grid.map((day, i) => {
              if (!day) return <div key={i} />
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDay(day)}
                  onMouseEnter={() => stage === 'end' && (!maxISO || toISO(day) <= maxISO) && setHovered(day)}
                  onMouseLeave={() => setHovered(null)}
                  className={`flex aspect-square w-full items-center justify-center text-xs transition ${dayStyle(day)}`}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>

          {/* Clear link */}
          {hasSelection && (
            <button
              type="button"
              onClick={clear}
              className="mt-3 w-full text-center text-xs text-slate-400 hover:text-brand-600 transition"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  )
}
