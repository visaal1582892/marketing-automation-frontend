import { useEffect, useRef, useState } from 'react'
import campaignsApi from '../api/campaigns'
import Icon from './Icon'

/**
 * Inline priority editor.
 *
 * Shows the current priority badge with a tiny "edit" affordance; clicking it
 * opens a popover with HIGH / MEDIUM / LOW options. Selecting a value calls
 * `PATCH /campaigns/:id/priority` and notifies the parent on success so it
 * can refresh the campaign list / drawer.
 *
 * Designed to be used wherever a priority badge already lives (approval
 * cards, brief drawer header, etc.).  Renders read-only when `editable=false`.
 */
const OPTIONS = [
  { value: 'HIGH',   label: 'High',   tone: 'rose'    },
  { value: 'MEDIUM', label: 'Medium', tone: 'amber'   },
  { value: 'LOW',    label: 'Low',    tone: 'emerald' },
]

const TONE = {
  rose:    'bg-rose-50    text-rose-700    ring-rose-200',
  amber:   'bg-amber-50   text-amber-700   ring-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  slate:   'bg-slate-100  text-slate-600   ring-slate-200',
}

export default function PriorityEditor({
  campaignId,
  value,
  editable = false,
  size      = 'sm',          // 'sm' | 'md'
  onChanged,                 // (updatedCampaign) => void
  onError,                   // (errorMessage)    => void
}) {
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClickAway = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('mousedown', onClickAway)
    return () => window.removeEventListener('mousedown', onClickAway)
  }, [open])

  const select = async (next) => {
    if (next === value || saving) { setOpen(false); return }
    setSaving(true)
    try {
      const { data } = await campaignsApi.updatePriority(campaignId, next)
      onChanged?.(data)
    } catch (e) {
      onError?.(e?.response?.data?.message || 'Failed to update priority')
    } finally {
      setSaving(false)
      setOpen(false)
    }
  }

  const tone = OPTIONS.find(o => o.value === value)?.tone || 'slate'
  const label = OPTIONS.find(o => o.value === value)?.label || value || '—'
  const padding = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-xs'

  if (!editable) {
    return (
      <span className={`inline-flex items-center rounded-full font-medium ring-1 ${TONE[tone]} ${padding}`}>
        {label}
      </span>
    )
  }

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        title="Change priority"
        className={`inline-flex items-center gap-1 rounded-full font-medium ring-1 transition
                    hover:brightness-95 disabled:opacity-60 ${TONE[tone]} ${padding}`}
      >
        {saving ? <Icon name="clock" className="h-3 w-3 animate-pulse" /> : null}
        {label}
        <Icon name="chevron" className="h-3 w-3 rotate-90 opacity-70" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-[140px] overflow-hidden
                        rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-xs uppercase
                          tracking-wider text-slate-500">Set priority</div>
          {OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => select(opt.value)}
              disabled={saving}
              className={`flex w-full items-center justify-between px-3 py-2 text-xs transition
                          hover:bg-slate-50 ${opt.value === value ? 'bg-brand-50/40' : ''}`}
            >
              <span className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${
                  opt.tone === 'rose' ? 'bg-rose-500' :
                  opt.tone === 'amber' ? 'bg-amber-500' :
                  'bg-emerald-500'
                }`} />
                {opt.label}
              </span>
              {opt.value === value && (
                <Icon name="check" className="h-3.5 w-3.5 text-brand-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </span>
  )
}
