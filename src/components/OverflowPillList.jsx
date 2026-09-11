import { useState } from 'react'
import Icon from './Icon'

const COLOR_THEMES = {
  brand:   'bg-brand-50 text-brand-700 border-brand-200/60 ring-1 ring-brand-100/70',
  violet:  'bg-violet-50 text-violet-700 border-violet-200/60 ring-1 ring-violet-200/70',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 ring-1 ring-emerald-200/70',
  amber:   'bg-amber-50 text-amber-800 border-amber-200/60 ring-1 ring-amber-200/70',
  indigo:  'bg-indigo-50 text-indigo-700 border-indigo-200/60 ring-1 ring-indigo-200/70',
  sky:     'bg-sky-50 text-sky-700 border-sky-200/60 ring-1 ring-sky-200/70',
  slate:   'bg-slate-100 text-slate-700 border-slate-200/60 ring-1 ring-slate-200/70',
  rose:    'bg-rose-50 text-rose-700 border-rose-200/60 ring-1 ring-rose-200/70',
}

/**
 * Reusable component for rendering multiple items as sleek badge pills
 * with +N overflow toggle ("+N" / "less").
 */
export default function OverflowPillList({
  items = [],
  maxVisible = 2,
  color = 'brand',
  emptyText = '—',
  icon = null,
  className = '',
}) {
  const [expanded, setExpanded] = useState(false)

  const normalized = (items || [])
    .map(item => {
      if (!item) return ''
      if (typeof item === 'string') return item
      return item.name || item.label || item.title || String(item)
    })
    .filter(Boolean)

  if (normalized.length === 0) {
    return <span className="text-xs italic text-slate-400">{emptyText}</span>
  }

  const colorStyle = COLOR_THEMES[color] || COLOR_THEMES.brand
  const visible    = expanded ? normalized : normalized.slice(0, maxVisible)
  const overflow   = normalized.length - maxVisible

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {visible.map((text, idx) => (
        <span
          key={`${text}-${idx}`}
          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium border ${colorStyle}`}
        >
          {icon && <Icon name={icon} className="h-3 w-3 shrink-0 opacity-70" />}
          {text}
        </span>
      ))}

      {!expanded && overflow > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(true)
          }}
          title={normalized.slice(maxVisible).join(', ')}
          className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200 ring-1 ring-slate-200/60 transition hover:bg-slate-200 hover:text-slate-900"
        >
          +{overflow}
        </button>
      )}

      {expanded && overflow > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(false)
          }}
          className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200 ring-1 ring-slate-200/60 transition hover:bg-slate-200 hover:text-slate-900"
        >
          less
        </button>
      )}
    </div>
  )
}
