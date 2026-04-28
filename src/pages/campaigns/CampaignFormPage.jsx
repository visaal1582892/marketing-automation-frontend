import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../components/Toast'
import campaignsApi from '../../api/campaigns'
import { masterApi, granularTasksApi } from '../../api/masterData'
import { enumsApi } from '../../api/enums'
import Icon from '../../components/Icon'

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

function SectionLabel({ number, title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-bold shrink-0">
        {number}
      </span>
      <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{title}</h3>
    </div>
  )
}

function Divider() {
  return <div className="border-t border-slate-100 my-4" />
}

function FormGroup({ label, required, children, hint, error }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint  && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-0.5 text-xs text-red-500 font-medium">{error}</p>}
    </div>
  )
}

const inputCls = `w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm
  text-slate-800 placeholder-slate-400 shadow-sm
  focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200
  transition disabled:opacity-50`

const errorInputCls = `w-full rounded-lg border border-red-400 px-3 py-1.5 text-sm
  text-slate-800 placeholder-slate-400 shadow-sm
  focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100
  transition`

// ─── Single-select dropdown ───────────────────────────────────────────────────

function Select({ name, value, onChange, options, placeholder = 'Select...', disabled, hasError }) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  const items = options.map((o) => ({
    value: o.value ?? o.id ?? o.code ?? '',
    label: o.label ?? o.name ?? '',
  }))

  const selected  = items.find((o) => o.value === value)
  const filtered  = search
    ? items.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : items
  const showSearch = items.length > 6

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const pick = (val) => {
    onChange({ target: { name, value: val } })
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen((o) => !o); setSearch('') } }}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5
          text-sm shadow-sm transition text-left
          ${disabled ? 'cursor-not-allowed opacity-50 bg-slate-50 border-slate-200' : 'bg-white cursor-pointer'}
          ${hasError ? 'border-red-400 ring-1 ring-red-200' :
            open ? 'border-brand-500 ring-2 ring-brand-200' : 'border-slate-300 hover:border-slate-400'}`}
      >
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <Icon name="chevron" className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 ${open ? 'rotate-90' : 'rotate-0'}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          {showSearch && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5
                    text-xs placeholder-slate-400 focus:outline-none focus:border-brand-400"
                />
              </div>
            </div>
          )}
          <div className="max-h-56 overflow-y-auto py-1">
            <button type="button" onClick={() => pick('')}
              className={`w-full flex items-center px-3 py-2 text-sm text-slate-400 italic hover:bg-slate-50 transition text-left
                ${!value ? 'bg-brand-50 text-brand-600 font-medium not-italic' : ''}`}>
              {placeholder}
            </button>
            {filtered.length === 0
              ? <p className="px-3 py-2 text-xs text-slate-400 italic">No results</p>
              : filtered.map((o) => (
                <button key={o.value} type="button" onClick={() => pick(o.value)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm
                    hover:bg-brand-50 hover:text-brand-700 transition text-left
                    ${o.value === value ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700'}`}>
                  <span>{o.label}</span>
                  {o.value === value && <Icon name="check" className="h-3.5 w-3.5 text-brand-600 shrink-0" />}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Multi-select task picker ─────────────────────────────────────────────────

function TaskMultiSelect({ tasks, selectedIds, onToggle, loading, hasError }) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  const count    = selectedIds.length
  const filtered = search
    ? tasks.filter((t) => t.taskName.toLowerCase().includes(search.toLowerCase()))
    : tasks

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setSearch('') }}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2
          text-sm bg-white shadow-sm transition text-left
          ${hasError ? 'border-red-400 ring-1 ring-red-200' :
            open ? 'border-brand-500 ring-2 ring-brand-200' : 'border-slate-300 hover:border-slate-400'}`}
      >
        {loading ? (
          <span className="text-slate-400">Loading tasks…</span>
        ) : count === 0 ? (
          <span className="text-slate-400">Select deliverables…</span>
        ) : (
          <span className="flex flex-wrap gap-1.5">
            {selectedIds.map((id) => {
              const t = tasks.find((x) => x.taskId === id)
              return t ? (
                <span key={id}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                  {t.taskName}
                  <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(t) }}
                    className="ml-0.5 hover:text-red-600 transition">
                    <Icon name="x" className="h-3 w-3" />
                  </button>
                </span>
              ) : null
            })}
          </span>
        )}
        <Icon name="chevron" className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 ${open ? 'rotate-90' : 'rotate-0'}`} />
      </button>

      {/* Dropdown */}
      {open && !loading && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          {/* Search */}
          {tasks.length > 5 && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tasks…"
                  className="w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5
                    text-xs placeholder-slate-400 focus:outline-none focus:border-brand-400"
                />
              </div>
            </div>
          )}
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-slate-400 italic text-center">No tasks found</p>
            ) : filtered.map((task) => {
              const isChecked = selectedIds.includes(task.taskId)
              return (
                <button
                  key={task.taskId}
                  type="button"
                  onClick={() => onToggle(task)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition
                    ${isChecked ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
                >
                  {/* Checkbox */}
                  <span className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border-2 transition-colors
                    ${isChecked ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'}`}
                    style={{ width: '18px', height: '18px' }}
                  >
                    {isChecked && (
                      <svg viewBox="0 0 12 12" fill="none" style={{ width: '10px', height: '10px' }}>
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${isChecked ? 'text-brand-800' : 'text-slate-700'}`}>
                      {task.taskName}
                    </span>
                    {task.taskTypeName && (
                      <span className="ml-2 text-xs text-slate-400">{task.taskTypeName}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          {count > 0 && (
            <div className="border-t border-slate-100 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-slate-500">{count} task{count !== 1 ? 's' : ''} selected</span>
              <button type="button" onClick={() => setOpen(false)}
                className="text-xs font-medium text-brand-600 hover:text-brand-700">
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Per-task detail card (shown after selection) ─────────────────────────────

function MiniSelect({ label, value, onChange, options, required, hasError }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <p className={`text-xs font-medium mb-1 ${hasError ? 'text-red-500' : 'text-slate-500'}`}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-1 rounded-lg border px-2.5 py-1.5
          text-xs bg-white shadow-sm transition text-left
          ${hasError ? 'border-red-400 ring-1 ring-red-100'
            : open ? 'border-brand-400 ring-1 ring-brand-200' : 'border-slate-300 hover:border-slate-400'}`}
      >
        <span className={selected?.value ? 'text-slate-800 font-medium' : 'text-slate-400'}>
          {selected ? selected.label : 'Select…'}
        </span>
        <Icon name="chevron" className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="max-h-40 overflow-y-auto py-0.5">
            {options.map((o) => (
              <button key={o.value} type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs
                  hover:bg-brand-50 hover:text-brand-700 transition text-left
                  ${o.value === value ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700'}`}
              >
                {o.label}
                {o.value === value && <Icon name="check" className="h-3 w-3 text-brand-600 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function parseQuestionOptions(raw) {
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function DeliverableCard({
  task,
  spec,
  platforms,
  formats,
  quantities,
  onUpdate,
  onRemove,
  fieldErrors,
  questions = [],
  onQuestionnaireChange,
  questionnaireFieldErrors = {},
}) {
  const answers = spec.questionnaire || {}

  const getMultiValues = (qid) => {
    const v = answers[qid]
    if (!v) return []
    try {
      return JSON.parse(v)
    } catch {
      return []
    }
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-100 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand-500 shrink-0" />
          <span className="text-sm font-semibold text-brand-800">{task.taskName}</span>
          {task.taskTypeName && (
            <span className="text-xs text-brand-500 bg-brand-100 rounded-full px-2 py-0.5">{task.taskTypeName}</span>
          )}
          {task.taskCategory && (
            <span className={`text-xs rounded-full px-2 py-0.5 font-medium
              ${task.taskCategory === 'DIGITAL' ? 'bg-sky-100 text-sky-700' : 'bg-orange-100 text-orange-700'}`}>
              {task.taskCategory === 'DIGITAL' ? 'Digital' : 'Offline'}
            </span>
          )}
        </div>
        <button type="button" onClick={() => onRemove(task.taskId)}
          className="rounded-full p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition" title="Remove task">
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-3 gap-3">
          <MiniSelect label="Platform" required
            value={spec.platformId || ''}
            onChange={(v) => onUpdate(task.taskId, 'platformId', v)}
            options={platforms}
            hasError={!!fieldErrors?.platformId}
          />
          <MiniSelect label="Format" required
            value={spec.formatId || ''}
            onChange={(v) => onUpdate(task.taskId, 'formatId', v)}
            options={formats}
            hasError={!!fieldErrors?.formatId}
          />
          <MiniSelect label="Quantity" required
            value={spec.quantity || ''}
            onChange={(v) => onUpdate(task.taskId, 'quantity', v)}
            options={quantities}
            hasError={!!fieldErrors?.quantity}
          />
        </div>

        {fieldErrors && Object.values(fieldErrors).some(Boolean) && (
          <p className="mt-2 text-xs text-red-500">Please fill all required fields for this task.</p>
        )}

        {questions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Task-specific questions
            </p>
            {questions.map((q, idx) => {
              const req = q.required ?? q.isRequired
              const qErr = questionnaireFieldErrors[q.questionId]
              return (
                <div key={q.questionId}>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {idx + 1}. {q.questionText}
                    {req && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {q.fieldType === 'TEXT' && (
                    <input
                      type="text"
                      value={answers[q.questionId] ?? ''}
                      onChange={(e) => onQuestionnaireChange(q.questionId, e.target.value)}
                      data-has-error={qErr || undefined}
                      className={`w-full rounded-lg border px-3 py-1.5 text-sm text-slate-800 shadow-sm
                        focus:outline-none focus:ring-2 transition
                        ${qErr ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'}`}
                      placeholder="Your answer…"
                    />
                  )}
                  {q.fieldType === 'TEXTAREA' && (
                    <textarea
                      rows={2}
                      value={answers[q.questionId] ?? ''}
                      onChange={(e) => onQuestionnaireChange(q.questionId, e.target.value)}
                      data-has-error={qErr || undefined}
                      className={`w-full rounded-lg border px-3 py-1.5 text-sm text-slate-800 shadow-sm resize-none
                        focus:outline-none focus:ring-2 transition
                        ${qErr ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'}`}
                      placeholder="Your answer…"
                    />
                  )}
                  {q.fieldType === 'SELECT' && (
                    <select
                      value={answers[q.questionId] ?? ''}
                      onChange={(e) => onQuestionnaireChange(q.questionId, e.target.value)}
                      className={`w-full rounded-lg border px-3 py-1.5 text-sm text-slate-800 shadow-sm
                        focus:outline-none focus:ring-2 transition
                        ${qErr ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'}`}
                    >
                      <option value="">Select…</option>
                      {parseQuestionOptions(q.options).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                  {q.fieldType === 'MULTI_SELECT' && (
                    <div className="flex flex-wrap gap-2">
                      {parseQuestionOptions(q.options).map((opt) => {
                        const selected = getMultiValues(q.questionId)
                        const checked = selected.includes(opt)
                        return (
                          <label
                            key={opt}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs cursor-pointer
                              ${checked ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-600'}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const cur = getMultiValues(q.questionId)
                                const next = checked
                                  ? cur.filter((x) => x !== opt)
                                  : [...cur, opt]
                                onQuestionnaireChange(q.questionId, JSON.stringify(next))
                              }}
                              className="h-3.5 w-3.5 accent-brand-600"
                            />
                            {opt}
                          </label>
                        )
                      })}
                    </div>
                  )}
                  {qErr && <p className="mt-0.5 text-xs text-red-500">This field is required.</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Location multi-select (OpenStreetMap Nominatim — free, no key needed) ────

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

function LocationMultiSelect({ selected, onChange, hasError }) {
  const [query,       setQuery]       = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open,        setOpen]        = useState(false)
  const [loading,     setLoading]     = useState(false)
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

  return (
    <div ref={ref} className="relative">
      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((loc) => (
            <span key={loc}
              className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5
                text-xs font-medium text-brand-800 ring-1 ring-brand-200">
              <Icon name="mapPin" className="h-3 w-3 shrink-0 text-brand-500" />
              {loc}
              <button type="button" onClick={() => remove(loc)}
                className="ml-0.5 text-brand-500 hover:text-red-500 transition">
                <Icon name="x" className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
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

// ─── Main form ────────────────────────────────────────────────────────────────

export default function CampaignFormPage() {
  const { user }   = useAuth()
  const toast      = useToast()
  const showToast  = (msg, type = 'info') => toast[type]?.(msg)
  const navigate   = useNavigate()

  // Master data from DB tables
  const [depts,      setDepts]      = useState([])
  const [reqTypes,   setReqTypes]   = useState([])
  const [audiences,  setAudiences]  = useState([])
  const [platforms,  setPlatforms]  = useState([])
  const [formats,    setFormats]    = useState([])
  const [offerTypes, setOfferTypes] = useState([])
  const [availableTasks, setAvailableTasks] = useState([])
  const [loadingTasks,   setLoadingTasks]   = useState(true)

  // Enum options fetched from the backend (derived from Java enums)
  const [enumOpts, setEnumOpts] = useState({
    businessObjectives: [],
    languages:          [],
    supportingProofs:   [],
    tones:              [],
    priorities:         [],
    budgetTiers:        [],
    vendorTypes:        [],
    kpiTypes:           [],
    expectedOutputs:    [],
    quantities:         [],
  })

  const [form, setForm] = useState({
    departmentId:      user?.departmentId || '',
    businessObjective: '',
    requirementTypeId: '',
    audienceTypeId:    '',
    language:          '',
    hasOffer:          'NO',
    offerTypeId:       '',
    keyMessage:        '',
    supportingProof:   '',
    tone:              '',
    priority:          'MEDIUM',
    budgetTier:        '',
    vendorRequired:    'NO',
    vendorType:        '',
    kpiType:           '',
    expectedOutput:    '',
  })

  // { [taskId]: { granularTaskId, platformId, formatId, quantity, questionnaire } }
  const [deliverables,  setDeliverables]  = useState({})
  /** Granular task id → questions from GET .../granular-tasks/{id}/questions */
  const [taskQuestions, setTaskQuestions]   = useState({})
  // Selected locations array
  const [targetLocations, setTargetLocations] = useState([])

  // Validation errors
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // DB-backed master data
    masterApi.list('departments').then((d)       => setDepts(d.map(normalise))).catch(() => {})
    masterApi.list('requirement-types').then((d) => setReqTypes(d.map(normalise))).catch(() => {})
    masterApi.list('audiences').then((d)         => setAudiences(d.map(normalise))).catch(() => {})
    masterApi.list('platforms').then((d)        => setPlatforms(d.map(normalise))).catch(() => {})
    masterApi.list('creative-formats').then((d) => setFormats(d.map(normalise))).catch(() => {})
    masterApi.list('offer-types').then((d)      => setOfferTypes(d.map(normalise))).catch(() => {})
    masterApi.list('granular-tasks').then((d)    => setAvailableTasks(d))
      .catch(() => {}).finally(() => setLoadingTasks(false))

    // Enum options (Java enum → {value, label} pairs served by the backend)
    enumsApi.getCampaignFormOptions().then((data) => setEnumOpts(data)).catch(() => {})
  }, [])

  const deliverableTaskIdsKey = Object.keys(deliverables).sort().join('|')

  useEffect(() => {
    const ids = Object.keys(deliverables)
    if (ids.length === 0) {
      setTaskQuestions({})
      return
    }
    let cancelled = false
    Promise.all(
      ids.map((taskId) =>
        granularTasksApi
          .getQuestions(taskId)
          .then((data) => ({ taskId, data: data || [] }))
          .catch(() => ({ taskId, data: [] }))
      )
    ).then((results) => {
      if (cancelled) return
      setTaskQuestions(Object.fromEntries(results.map((r) => [r.taskId, r.data])))
    })
    return () => {
      cancelled = true
    }
  }, [deliverableTaskIdsKey])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      // When toggling offer off, clear all offer-related fields
      if (name === 'hasOffer' && value === 'NO') {
        next.offerTypeId     = ''
        next.keyMessage      = ''
        next.supportingProof = ''
      }
      // When toggling vendor off, clear the selected vendor type
      if (name === 'vendorRequired' && value === 'NO') next.vendorType = ''
      return next
    })
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const toggleTask = (task) => {
    setDeliverables((prev) => {
      if (prev[task.taskId]) {
        const next = { ...prev }
        delete next[task.taskId]
        return next
      }
      return {
        ...prev,
        [task.taskId]: {
          granularTaskId: task.taskId,
          platformId: '',
          formatId: '',
          quantity: '',
          questionnaire: {},
        },
      }
    })
    if (errors.deliverables) setErrors((p) => ({ ...p, deliverables: '' }))
  }

  const updateDeliverableQuestionnaire = (taskId, questionId, value) => {
    setDeliverables((prev) => {
      const spec = prev[taskId] || {}
      return {
        ...prev,
        [taskId]: {
          ...spec,
          questionnaire: { ...spec.questionnaire, [questionId]: value },
        },
      }
    })
    setErrors((prev) => {
      const tq = prev.taskQa?.[taskId]
      if (!tq || !tq[questionId]) return prev
      const nextTask = { ...tq }
      delete nextTask[questionId]
      const nextTq = { ...prev.taskQa, [taskId]: nextTask }
      if (Object.keys(nextTask).length === 0) {
        delete nextTq[taskId]
      }
      return { ...prev, taskQa: Object.keys(nextTq).length ? nextTq : undefined }
    })
  }

  const updateDeliverable = (taskId, field, value) => {
    setDeliverables((prev) => {
      const spec = prev[taskId] || {}
      return { ...prev, [taskId]: { ...spec, [field]: value } }
    })
    setErrors((prev) => {
      const next = { ...prev }
      if (next.tasks?.[taskId]?.[field]) {
        next.tasks = { ...next.tasks, [taskId]: { ...next.tasks[taskId], [field]: '' } }
      }
      return next
    })
  }

  const validate = () => {
    const e = {}

    // Section 1
    if (!form.departmentId)        e.departmentId      = 'Required'
    if (targetLocations.length === 0) e.targetLocations = 'Select at least one location'
    if (!form.businessObjective)   e.businessObjective = 'Required'

    // Section 2
    if (!form.requirementTypeId) e.requirementTypeId = 'Required'

    // Section 3
    if (!form.audienceTypeId) e.audienceTypeId = 'Required'
    if (!form.language)       e.language       = 'Required'

    // Section 4 — all fields only required when there IS an offer
    if (form.hasOffer === 'YES') {
      if (!form.offerTypeId)   e.offerTypeId   = 'Required'
      if (!form.keyMessage?.trim()) e.keyMessage = 'Required'
      if (!form.supportingProof)   e.supportingProof = 'Required'
    }
    if (!form.tone) e.tone = 'Required'

    // Section 5 — deliverables
    if (Object.keys(deliverables).length === 0) {
      e.deliverables = 'Select at least one deliverable'
    } else {
      const taskErrs = {}
      const taskQaErrs = {}
      Object.entries(deliverables).forEach(([taskId, spec]) => {
        const te = {}
        if (!spec.platformId) te.platformId = 'Required'
        if (!spec.formatId)   te.formatId   = 'Required'
        if (!spec.quantity)   te.quantity   = 'Required'
        if (Object.keys(te).length) taskErrs[taskId] = te

        const qs = taskQuestions[taskId] || []
        const ans = spec.questionnaire || {}
        const qaFields = {}
        for (const q of qs) {
          if (!(q.required ?? q.isRequired)) continue
          const raw = ans[q.questionId]
          let empty = true
          if (q.fieldType === 'MULTI_SELECT') {
            try {
              const a = JSON.parse(raw || '[]')
              empty = !Array.isArray(a) || a.length === 0
            } catch {
              empty = true
            }
          } else {
            empty = raw == null || String(raw).trim() === ''
          }
          if (empty) qaFields[q.questionId] = true
        }
        if (Object.keys(qaFields).length) taskQaErrs[taskId] = qaFields
      })
      if (Object.keys(taskErrs).length) e.tasks = taskErrs
      if (Object.keys(taskQaErrs).length) e.taskQa = taskQaErrs
    }

    // Section 6
    if (!form.priority)  e.priority  = 'Required'

    // Section 7
    if (!form.budgetTier) e.budgetTier = 'Required'
    if (form.vendorRequired === 'YES' && !form.vendorType) e.vendorType = 'Required'

    // Section 8
    if (!form.kpiType)       e.kpiType       = 'Required'
    if (!form.expectedOutput) e.expectedOutput = 'Required'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    console.log('[Form] Submit clicked, validating...')

    const isValid = validate()
    console.log('[Form] Validation result:', isValid, 'errors:', errors)

    if (!isValid) {
      showToast('Please fill in all required fields highlighted below.', 'error')
      setTimeout(() => {
        const summary = document.getElementById('form-error-summary')
        if (summary) summary.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
      return
    }

    setSubmitting(true)
    console.log('[Form] Sending payload to backend...')
    try {
      // Replace empty strings with null so Java enum deserialisation doesn't choke
      const cleanForm = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])
      )
      const payload = {
        ...cleanForm,
        targetLocation: JSON.stringify(targetLocations),
        offerType:  form.hasOffer === 'YES' ? form.offerType || null : null,
        vendorType: form.vendorRequired === 'YES' ? form.vendorType || null : null,
        taskSpecs:  Object.values(deliverables).map((d) => {
          const qn = d.questionnaire || {}
          const questionnaireAnswers = Object.entries(qn)
            .filter(([, v]) => {
              if (v == null || String(v).trim() === '') return false
              try {
                const parsed = JSON.parse(v)
                if (Array.isArray(parsed) && parsed.length === 0) return false
              } catch {
                /* non-JSON answer */
              }
              return true
            })
            .map(([questionId, answerValue]) => ({ questionId, answerValue }))
          return {
            granularTaskId: d.granularTaskId,
            platformId:     d.platformId || null,
            formatId:       d.formatId   || null,
            quantity:       d.quantity   || null,
            ...(questionnaireAnswers.length > 0 ? { questionnaireAnswers } : {}),
          }
        }),
      }
      console.log('[Form] Payload:', payload)
      const result = await campaignsApi.create(payload)
      console.log('[Form] Success:', result)
      showToast('Request submitted successfully! Awaiting department approval.', 'success')
      setTimeout(() => navigate('/campaigns', { state: { justSubmitted: true } }), 1000)
    } catch (err) {
      console.error('[Form] Submit error:', err, 'status:', err?.response?.status, 'data:', err?.response?.data)
      const status = err?.response?.status
      const serverMsg = err?.response?.data?.message || err?.response?.data?.error
      const msg = serverMsg
        || (status ? `Submission failed (${status}). Check required fields and try again.` : null)
        || err?.message
        || 'Failed to submit request. Please try again.'
      showToast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedTaskIds = Object.keys(deliverables)
  const platOpts = [{ value: '', label: 'Select platform…' }, ...platforms]
  const fmtOpts  = [{ value: '', label: 'Select format…' },  ...formats]
  const qtyOpts  = [{ value: '', label: 'Select quantity…' }, ...enumOpts.quantities]

  return (
    <div className="mx-auto max-w-4xl space-y-3 pb-10">
      {/* Page header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-lg font-bold text-slate-900">New Marketing Request</h2>
          <p className="text-xs text-slate-500">
            Fields marked <span className="text-red-500 font-medium">*</span> are required.
          </p>
        </div>
        <button type="button" onClick={() => navigate('/campaigns')}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition">
          <Icon name="x" className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-3">

        {/* ── Card 1: Requestor · Campaign Type · Audience ── */}
        <Card>
          {/* §1 Requestor Details */}
          <SectionLabel number="1" title="Requestor Details" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FormGroup label="Requestor Name">
              <input className={inputCls} value={user?.fullName || user?.email || ''} disabled />
            </FormGroup>

            <FormGroup label="Department" required error={errors.departmentId}>
              <div data-has-error={!!errors.departmentId || undefined}>
                <Select name="departmentId" value={form.departmentId} onChange={handleChange}
                  options={depts} placeholder="Select…" hasError={!!errors.departmentId} />
              </div>
            </FormGroup>

            <FormGroup label="Business Objective" required error={errors.businessObjective}>
              <div data-has-error={!!errors.businessObjective || undefined}>
                <Select name="businessObjective" value={form.businessObjective} onChange={handleChange}
                  options={enumOpts.businessObjectives} placeholder="Select…" hasError={!!errors.businessObjective} />
              </div>
            </FormGroup>

            <FormGroup label="Requirement Type" required error={errors.requirementTypeId}>
              <div data-has-error={!!errors.requirementTypeId || undefined}>
                <Select name="requirementTypeId" value={form.requirementTypeId} onChange={handleChange}
                  options={reqTypes} placeholder="Select…" hasError={!!errors.requirementTypeId} />
              </div>
            </FormGroup>
          </div>

          {/* Location spans full width */}
          <div className="mt-3">
            <FormGroup label="Target Location(s)" required error={errors.targetLocations}
              hint="Search cities, districts or states — multiple allowed">
              <div data-has-error={!!errors.targetLocations || undefined}>
                <LocationMultiSelect
                  selected={targetLocations}
                  onChange={(locs) => {
                    setTargetLocations(locs)
                    if (errors.targetLocations) setErrors((prev) => ({ ...prev, targetLocations: '' }))
                  }}
                  hasError={!!errors.targetLocations}
                />
              </div>
            </FormGroup>
          </div>

          <Divider />

          {/* §3 Audience */}
          <SectionLabel number="2" title="Target Audience" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <FormGroup label="Audience Type" required error={errors.audienceTypeId}>
              <div data-has-error={!!errors.audienceTypeId || undefined}>
                <Select name="audienceTypeId" value={form.audienceTypeId} onChange={handleChange}
                  options={audiences} placeholder="Select…" hasError={!!errors.audienceTypeId} />
              </div>
            </FormGroup>
            <FormGroup label="Language" required error={errors.language}>
              <div data-has-error={!!errors.language || undefined}>
                <Select name="language" value={form.language} onChange={handleChange}
                  options={enumOpts.languages} placeholder="Select…" hasError={!!errors.language} />
              </div>
            </FormGroup>
            <FormGroup label="Tone / Style" required error={errors.tone}>
              <div data-has-error={!!errors.tone || undefined}>
                <Select name="tone" value={form.tone} onChange={handleChange}
                  options={enumOpts.tones} placeholder="Select…" hasError={!!errors.tone} />
              </div>
            </FormGroup>
          </div>
        </Card>

        {/* ── Card 2: Offer & Messaging ── */}
        <Card>
          <SectionLabel number="3" title="Offer & Messaging" />
          <div className="flex items-start gap-4">
            <div className="w-36 shrink-0">
              <FormGroup label="Is there an Offer?">
                <Select name="hasOffer" value={form.hasOffer} onChange={handleChange}
                  options={[{ value: 'YES', label: 'Yes' }, { value: 'NO', label: 'No' }]} />
              </FormGroup>
            </div>

            {form.hasOffer === 'YES' && (
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 pl-4 border-l border-slate-100">
                <FormGroup label="Offer Type" required error={errors.offerTypeId}>
                  <div data-has-error={!!errors.offerTypeId || undefined}>
                    <Select name="offerTypeId" value={form.offerTypeId} onChange={handleChange}
                      options={offerTypes} placeholder="Select…" hasError={!!errors.offerTypeId} />
                  </div>
                </FormGroup>
                <FormGroup label="Supporting Proof" required error={errors.supportingProof}>
                  <div data-has-error={!!errors.supportingProof || undefined}>
                    <Select name="supportingProof" value={form.supportingProof} onChange={handleChange}
                      options={enumOpts.supportingProofs} placeholder="Select…" hasError={!!errors.supportingProof} />
                  </div>
                </FormGroup>
                <FormGroup label="Key Message" required error={errors.keyMessage}>
                  <textarea
                    name="keyMessage"
                    value={form.keyMessage}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Core offer message…"
                    data-has-error={!!errors.keyMessage || undefined}
                    className={`w-full rounded-lg border px-3 py-1.5 text-sm text-slate-800
                      placeholder-slate-400 shadow-sm resize-none
                      focus:outline-none focus:ring-2 transition
                      ${errors.keyMessage
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                        : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'}`}
                  />
                </FormGroup>
              </div>
            )}
          </div>
        </Card>

        {/* ── Card 3: Deliverables ── */}
        <Card>
          <SectionLabel number="4" title="Deliverables & Creative Specs" />

          <FormGroup label="Select Tasks" required error={errors.deliverables}>
            <div data-has-error={!!errors.deliverables || undefined}>
              <TaskMultiSelect
                tasks={availableTasks}
                selectedIds={selectedTaskIds}
                onToggle={toggleTask}
                loading={loadingTasks}
                hasError={!!errors.deliverables}
              />
            </div>
          </FormGroup>

          {selectedTaskIds.length > 0 && (
            <div className="mt-3 space-y-2">
              {selectedTaskIds.map((taskId) => {
                const task = availableTasks.find((t) => t.taskId === taskId)
                if (!task) return null
                return (
                  <DeliverableCard
                    key={taskId}
                    task={task}
                    spec={deliverables[taskId]}
                    platforms={platOpts}
                    formats={fmtOpts}
                    quantities={qtyOpts}
                    onUpdate={updateDeliverable}
                    onRemove={(id) => toggleTask({ taskId: id })}
                    fieldErrors={errors.tasks?.[taskId]}
                    questions={taskQuestions[taskId] || []}
                    onQuestionnaireChange={(qid, val) => updateDeliverableQuestionnaire(taskId, qid, val)}
                    questionnaireFieldErrors={errors.taskQa?.[taskId] || {}}
                  />
                )
              })}
            </div>
          )}
        </Card>

        {/* ── Card 4: Timelines · Budget · KPIs ── */}
        <Card>
          <SectionLabel number="5" title="Timelines & Priority" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FormGroup label="Priority" required error={errors.priority}>
              <div data-has-error={!!errors.priority || undefined}>
                <Select name="priority" value={form.priority} onChange={handleChange}
                  options={enumOpts.priorities} hasError={!!errors.priority} />
              </div>
            </FormGroup>
            <FormGroup label="Budget" required error={errors.budgetTier}>
              <div data-has-error={!!errors.budgetTier || undefined}>
                <Select name="budgetTier" value={form.budgetTier} onChange={handleChange}
                  options={enumOpts.budgetTiers} placeholder="Select…" hasError={!!errors.budgetTier} />
              </div>
            </FormGroup>
            <FormGroup label="Vendor Required?">
              <Select name="vendorRequired" value={form.vendorRequired} onChange={handleChange}
                options={[{ value: 'YES', label: 'Yes' }, { value: 'NO', label: 'No' }]} />
            </FormGroup>
            {form.vendorRequired === 'YES' && (
              <FormGroup label="Vendor Type" required error={errors.vendorType}>
                <div data-has-error={!!errors.vendorType || undefined}>
                  <Select name="vendorType" value={form.vendorType} onChange={handleChange}
                    options={enumOpts.vendorTypes} placeholder="Select…" hasError={!!errors.vendorType} />
                </div>
              </FormGroup>
            )}
          </div>

          <Divider />

          <SectionLabel number="6" title="Success Metrics (KPIs)" />
          <div className="grid grid-cols-2 gap-3">
            <FormGroup label="KPI Type" required error={errors.kpiType}>
              <div data-has-error={!!errors.kpiType || undefined}>
                <Select name="kpiType" value={form.kpiType} onChange={handleChange}
                  options={enumOpts.kpiTypes} placeholder="Select…" hasError={!!errors.kpiType} />
              </div>
            </FormGroup>
            <FormGroup label="Expected Output" required error={errors.expectedOutput}>
              <div data-has-error={!!errors.expectedOutput || undefined}>
                <Select name="expectedOutput" value={form.expectedOutput} onChange={handleChange}
                  options={enumOpts.expectedOutputs} placeholder="Select…" hasError={!!errors.expectedOutput} />
              </div>
            </FormGroup>
          </div>
        </Card>

        {/* Validation error summary — shown after a failed submit attempt */}
        {Object.keys(errors).length > 0 && (
          <div id="form-error-summary" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
            <svg className="h-5 w-5 shrink-0 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-700">Please fix the following before submitting:</p>
              <ul className="mt-1 space-y-0.5 text-xs text-red-600 list-disc list-inside">
                {errors.departmentId     && <li>Department is required</li>}
                {errors.businessObjective && <li>Business Objective is required</li>}
                {errors.requirementTypeId && <li>Requirement Type is required</li>}
                {errors.targetLocations  && <li>{errors.targetLocations}</li>}
                {errors.audienceTypeId   && <li>Audience Type is required</li>}
                {errors.language         && <li>Language is required</li>}
                {errors.tone             && <li>Tone / Style is required</li>}
                {errors.offerTypeId      && <li>Offer Type is required</li>}
                {errors.keyMessage       && <li>Key Message is required</li>}
                {errors.supportingProof  && <li>Supporting Proof is required</li>}
                {errors.deliverables     && <li>{errors.deliverables}</li>}
                {errors.tasks && <li>Each selected task needs Platform, Format, and Quantity</li>}
                {errors.taskQa && <li>Answer all required task-specific questions under Deliverables</li>}
                {errors.priority         && <li>Priority is required</li>}
                {errors.budgetTier       && <li>Budget Tier is required</li>}
                {errors.vendorType       && <li>Vendor Type is required when vendor is needed</li>}
                {errors.kpiType          && <li>KPI Type is required</li>}
                {errors.expectedOutput   && <li>Expected Output is required</li>}
              </ul>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={() => navigate('/campaigns')}
            className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button type="submit" disabled={submitting}
            className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white
              hover:bg-brand-700 disabled:opacity-60 transition flex items-center gap-2">
            {submitting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Submitting…
              </>
            ) : (
              <><Icon name="check" className="h-4 w-4" /> Submit Request</>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

function normalise(item) {
  return { value: item.id, label: item.name }
}
