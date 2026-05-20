import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../components/Toast'
import campaignsApi from '../../api/campaigns'
import { masterApi, granularTasksApi } from '../../api/masterData'
import { enumsApi } from '../../api/enums'
import api from '../../api/client'
import AppSelect from '../../components/AppSelect'
import tasksApi from '../../api/tasks'
import Icon from '../../components/Icon'
import campaignSpecsApi from '../../api/campaignSpecs'

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

// ─── Radio group (single-select pill tiles with inline indicator) ─────────────

function RadioGroup({ name, value, onChange, options, hasError, disabled }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const optVal  = opt.value ?? opt.id ?? opt.code ?? ''
        const optLabel = opt.label ?? opt.name ?? ''
        const checked  = value === optVal
        return (
          <label
            key={optVal}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm
              font-medium cursor-pointer transition select-none whitespace-nowrap
              ${disabled ? 'cursor-not-allowed opacity-50' : ''}
              ${checked
                ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-300'
                : hasError
                  ? 'border-red-300 bg-white text-slate-600 hover:border-red-400 hover:bg-red-50/30'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50/40'
              }`}
          >
            <input
              type="radio"
              name={name}
              value={optVal}
              checked={checked}
              disabled={disabled}
              onChange={() => !disabled && onChange({ target: { name, value: optVal } })}
              className="sr-only"
            />
            {/* Custom radio indicator */}
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all
              ${checked
                ? 'border-brand-500 bg-brand-500'
                : hasError ? 'border-red-300' : 'border-slate-300'}`}>
              {checked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
            </span>
            <span className="leading-snug">{optLabel}</span>
          </label>
        )
      })}
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

// ─── Generic multi-select dropdown ───────────────────────────────────────────

function GenericMultiSelect({ name, values, onChange, options, placeholder = 'Select…', hasError }) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  const items = options.map((o) => ({
    value: o.value ?? o.id ?? '',
    label: o.label ?? o.name ?? '',
  }))
  const filtered  = search
    ? items.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : items
  const selected  = items.filter((o) => values.includes(o.value))
  const showSearch = items.length > 5

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggle = (val) => {
    const next = values.includes(val)
      ? values.filter((v) => v !== val)
      : [...values, val]
    onChange({ target: { name, value: next } })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setSearch('') }}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5
          text-sm shadow-sm transition text-left min-h-[34px]
          ${hasError ? 'border-red-400 ring-1 ring-red-200' :
            open ? 'border-brand-500 ring-2 ring-brand-200' : 'border-slate-300 hover:border-slate-400'}`}
      >
        {selected.length === 0 ? (
          <span className="text-slate-400">{placeholder}</span>
        ) : selected.length === 1 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700 max-w-[80%] truncate">
            <span className="truncate">{selected[0].label}</span>
            <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); toggle(selected[0].value) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggle(selected[0].value) } }}
              className="shrink-0 cursor-pointer hover:text-red-600 transition leading-none">×</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700 max-w-[55%] truncate">
              <span className="truncate">{selected[0].label}</span>
            </span>
            <span className="inline-flex items-center rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
              +{selected.length - 1} more
            </span>
          </span>
        )}
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
            {filtered.length === 0
              ? <p className="px-3 py-2 text-xs text-slate-400 italic">No results</p>
              : filtered.map((o) => {
                const isChecked = values.includes(o.value)
                return (
                  <button key={o.value} type="button" onClick={() => toggle(o.value)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition text-left
                      ${isChecked ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors
                      ${isChecked ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'}`}
                      style={{ width: '16px', height: '16px' }}>
                      {isChecked && (
                        <svg viewBox="0 0 12 12" fill="none" style={{ width: '9px', height: '9px' }}>
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className={`text-sm ${isChecked ? 'text-brand-800 font-medium' : 'text-slate-700'}`}>{o.label}</span>
                  </button>
                )
              })
            }
          </div>
          {values.length > 0 && (
            <div className="border-t border-slate-100 px-3 py-1.5 flex items-center justify-between">
              <span className="text-xs text-slate-500">{values.length} selected</span>
              <button type="button" onClick={() => setOpen(false)}
                className="text-xs font-medium text-brand-600 hover:text-brand-700">Done</button>
            </div>
          )}
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
                  <span role="button" tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); onToggle(t) }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onToggle(t) } }}
                    className="ml-0.5 cursor-pointer hover:text-red-600 transition">
                    <Icon name="x" className="h-3 w-3" />
                  </span>
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
  onRemove,
  questions = [],
  onQuestionnaireChange,
  questionnaireFieldErrors = {},
  stagedFiles = [],
  fileUploading = false,
  onFilesAdd,
  onFileRemove,
  onFileUploadStateChange,
}) {
  const answers        = spec.questionnaire || {}
  const fileInputRef   = useRef(null)
  const [dragOver,     setDragOver]     = useState(false)
  // Local per-file upload tracking: { id, name, uploading, error, file }
  const [pendingUploads, setPendingUploads] = useState([])

  const uploadOne = async (file, id) => {
    setPendingUploads(prev => prev.map(p => p.id === id ? { ...p, uploading: true, error: null } : p))
    try {
      const fd = new FormData()
      fd.append('files', file)
      const res = await api.post('/upload/asset', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const url = res.data?.urls?.[0]
      if (!url) throw new Error(res.data?.errors?.[0] || 'Upload failed')
      onFilesAdd?.([{ url, name: file.name }])
      setPendingUploads(prev => prev.filter(p => p.id !== id)) // remove on success
    } catch (err) {
      const raw = err?.response?.data?.message || err?.message || 'Upload failed'
      setPendingUploads(prev => prev.map(p => p.id === id
        ? { ...p, uploading: false, error: raw.length > 60 ? 'Upload failed' : raw }
        : p))
    }
  }

  const startUploads = async (selectedFiles) => {
    if (!selectedFiles?.length) return
    const entries = Array.from(selectedFiles).map(file => ({
      id: Math.random().toString(36).slice(2), name: file.name, uploading: true, error: null, file,
    }))
    setPendingUploads(prev => [...prev, ...entries])
    onFileUploadStateChange?.(true)
    for (const entry of entries) {
      await uploadOne(entry.file, entry.id)
    }
    onFileUploadStateChange?.(false)
  }

  const retryUpload = (id) => {
    const entry = pendingUploads.find(p => p.id === id)
    if (entry?.file) uploadOne(entry.file, id)
  }

  const dismissUpload = (id) => setPendingUploads(prev => prev.filter(p => p.id !== id))

  const handleFileSelect = (e) => { startUploads(Array.from(e.target.files)); e.target.value = '' }
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); startUploads(Array.from(e.dataTransfer.files)) }

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
      <div className="flex items-start justify-between gap-2 px-4 py-2.5 bg-brand-50 border-b border-brand-100 rounded-t-xl">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
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

      <div className="p-5">
        {questions.length > 0 && (
          <div className="mt-2 pt-4 border-t border-slate-100 space-y-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Task-specific questions
            </p>
            {questions.map((q, idx) => {
              const req = q.required ?? q.isRequired
              const qErr = questionnaireFieldErrors[q.questionId]
              return (
                <div key={q.questionId}>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {idx + 1}. {q.questionText}
                    {req && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {q.fieldType === 'TEXT' && (
                    <input
                      type="text"
                      value={answers[q.questionId] ?? ''}
                      onChange={(e) => onQuestionnaireChange(q.questionId, e.target.value)}
                      className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-800 shadow-sm
                        focus:outline-none focus:ring-2 transition
                        ${qErr ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'}`}
                      placeholder="Your answer…"
                    />
                  )}
                  {q.fieldType === 'NUMBER' && (
                    <input
                      type="number"
                      value={answers[q.questionId] ?? ''}
                      onChange={(e) => onQuestionnaireChange(q.questionId, e.target.value)}
                      className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-800 shadow-sm
                        focus:outline-none focus:ring-2 transition
                        ${qErr ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'}`}
                      placeholder="0"
                    />
                  )}
                  {q.fieldType === 'TEXTAREA' && (
                    <textarea
                      rows={4}
                      value={answers[q.questionId] ?? ''}
                      onChange={(e) => onQuestionnaireChange(q.questionId, e.target.value)}
                      className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-800 shadow-sm resize-y
                        focus:outline-none focus:ring-2 transition
                        ${qErr ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'}`}
                      placeholder="Your answer…"
                    />
                  )}
                  {q.fieldType === 'DATE' && (
                    <input
                      type="date"
                      value={answers[q.questionId] ?? ''}
                      onChange={(e) => onQuestionnaireChange(q.questionId, e.target.value)}
                      className={`w-full rounded-lg border px-3 py-1.5 text-sm text-slate-800 shadow-sm
                        focus:outline-none focus:ring-2 transition
                        ${qErr ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'}`}
                    />
                  )}
                  {q.fieldType === 'DROPDOWN' && (
                    <AppSelect
                      value={answers[q.questionId] ?? ''}
                      onChange={v => onQuestionnaireChange(q.questionId, v)}
                      options={parseQuestionOptions(q.options)}
                      placeholder="Select…"
                    />
                  )}
                  {q.fieldType === 'MULTISELECT' && (
                    <div className="flex flex-wrap gap-2">
                      {parseQuestionOptions(q.options).map((opt) => {
                        const curSelected = getMultiValues(q.questionId)
                        const checked = curSelected.includes(opt)
                        return (
                          <label
                            key={opt}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs cursor-pointer transition
                              ${checked ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
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

        {/* ── Per-task reference files ── */}
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Task Reference Files
            {stagedFiles.length > 0 && (
              <span className="ml-1.5 normal-case font-medium text-violet-600">({stagedFiles.length} staged)</span>
            )}
          </p>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !fileUploading && fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed
              cursor-pointer py-6 transition select-none
              ${dragOver ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-slate-50/50 hover:border-brand-300 hover:bg-brand-50/30'}`}>
            <Icon name="upload" className={`h-6 w-6 ${dragOver ? 'text-brand-500' : 'text-slate-400'}`} />
            <p className={`text-sm font-medium ${dragOver ? 'text-brand-600' : 'text-slate-500'}`}>Click or drag files here</p>
            <p className="text-xs text-slate-400">Supports images, PDFs, documents</p>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
          </div>

          {/* In-progress / failed uploads */}
          {pendingUploads.length > 0 && (
            <ul className="space-y-1">
              {pendingUploads.map(p => (
                <li key={p.id} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs
                  ${p.error ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
                  {p.uploading ? (
                    <svg className="h-3.5 w-3.5 animate-spin text-brand-400 shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  ) : (
                    <Icon name="alertCircle" className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  )}
                  <span className={`flex-1 truncate ${p.error ? 'text-red-600' : 'text-slate-600'}`}>
                    {p.error ? `${p.name} — ${p.error}` : p.name}
                  </span>
                  {p.uploading && <span className="shrink-0 text-slate-400">Uploading…</span>}
                  {p.error && <button type="button" onClick={() => retryUpload(p.id)}
                    className="shrink-0 text-xs font-medium text-brand-600 hover:underline">Retry</button>}
                  {!p.uploading && <button type="button" onClick={() => dismissUpload(p.id)}
                    className="shrink-0 text-slate-400 hover:text-red-500 transition">
                    <Icon name="x" className="h-3.5 w-3.5" />
                  </button>}
                </li>
              ))}
            </ul>
          )}

          {/* Successfully staged files */}
          {stagedFiles.length > 0 && (
            <ul className="space-y-1">
              {stagedFiles.map((f) => (
                <li key={f.url} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">
                  <Icon name="fileText" className="h-3.5 w-3.5 shrink-0 text-red-400" />
                  <span className="flex-1 truncate text-slate-700">{f.name}</span>
                  <a href={f.url} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 text-brand-600 hover:underline font-medium">View</a>
                  <button type="button" onClick={() => onFileRemove?.(f.url)} title="Remove"
                    className="shrink-0 text-slate-400 hover:text-red-500 transition">
                    <Icon name="x" className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Campaign Files upload section ───────────────────────────────────────────

function CampaignFilesSection({ files, onFilesChange, uploading, setUploading }) {
  const fileInputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const uploadOne = async (file, id) => {
    const fd = new FormData()
    fd.append('files', file)
    const res = await tasksApi.uploadAssets(fd)
    const url = res.data?.urls?.[0] || null
    if (!url) throw new Error(res.data?.errors?.[0] || 'Upload failed')
    return url
  }

  const runUpload = async (file, id) => {
    try {
      const url = await uploadOne(file, id)
      onFilesChange(prev => prev.map(f => f.id === id ? { ...f, url, uploading: false } : f))
    } catch (err) {
      const raw = err?.response?.data?.message || err?.message || 'Upload failed'
      const msg = raw.length > 60 ? 'Upload failed' : raw
      onFilesChange(prev => prev.map(f => f.id === id ? { ...f, uploading: false, error: msg } : f))
    }
  }

  const retryFile = async (id) => {
    const entry = files.find(f => f.id === id)
    if (!entry?.file) return
    onFilesChange(prev => prev.map(f => f.id === id ? { ...f, uploading: true, error: null } : f))
    setUploading(true)
    await runUpload(entry.file, id)
    setUploading(false)
  }

  const handleFileSelect = async (e) => {
    const selected = Array.from(e.target.files || [])
    if (!selected.length) return
    e.target.value = ''

    const blocked = selected.filter(f => /\.(docx?)$/i.test(f.name))
    blocked.forEach(f => {
      const id = Math.random().toString(36).slice(2)
      onFilesChange(prev => [...prev, { id, name: f.name, url: null, uploading: false, error: 'DOC/DOCX not allowed — convert to PDF', file: f }])
    })
    const allowed = selected.filter(f => !/\.(docx?)$/i.test(f.name))
    if (!allowed.length) return

    // Add a placeholder per file immediately so the user sees all of them
    const entries = allowed.map(f => ({ id: Math.random().toString(36).slice(2), name: f.name, url: null, uploading: true, error: null, file: f }))
    onFilesChange(prev => [...prev, ...entries])
    setUploading(true)

    // Upload ONE AT A TIME — concurrent uploads overwhelm the external image server
    for (const entry of entries) {
      await runUpload(entry.file, entry.id)
    }
    setUploading(false)
  }

  const removeFile = (id) => onFilesChange(prev => prev.filter(f => f.id !== id))

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFileSelect({ target: { files: Array.from(e.dataTransfer.files) } })
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed
          cursor-pointer py-6 transition select-none
          ${dragOver ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-slate-50/50 hover:border-brand-300 hover:bg-brand-50/30'}`}>
        <Icon name="upload" className={`h-6 w-6 ${dragOver ? 'text-brand-500' : 'text-slate-400'}`} />
        <p className={`text-sm font-medium ${dragOver ? 'text-brand-600' : 'text-slate-500'}`}>Click or drag files here</p>
        <p className="text-xs text-slate-400">Images, PDFs, excels, ZIPs and more</p>
        <input ref={fileInputRef} type="file" multiple className="hidden"
          accept="image/*,video/*,.pdf,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.doc,.docx,.zip"
          onChange={handleFileSelect} />
      </div>
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map(f => (
            <li key={f.id || f.url} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs
              ${f.uploading ? 'border-slate-200 bg-white'
                : f.error   ? 'border-red-200 bg-red-50'
                : 'border-slate-200 bg-white'}`}>
              {f.uploading ? (
                <svg className="h-3.5 w-3.5 animate-spin text-brand-400 shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : f.error ? (
                <Icon name="alertCircle" className="h-3.5 w-3.5 text-red-400 shrink-0" />
              ) : (
                <Icon name="fileText" className="h-3.5 w-3.5 text-red-400 shrink-0" />
              )}
              <span className={`flex-1 truncate ${f.error ? 'text-red-600' : 'text-slate-700'}`}>
                {f.uploading ? f.name : f.error ? `${f.name} — ${f.error}` : f.name}
              </span>
              {f.uploading && <span className="shrink-0 text-slate-400">Uploading…</span>}
              {f.error && f.file && (
                <button type="button" onClick={() => retryFile(f.id)}
                  className="shrink-0 text-xs font-medium text-brand-600 hover:underline">Retry</button>
              )}
              {f.url && !f.uploading && (
                <a href={f.url} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 font-medium text-brand-600 hover:underline">View</a>
              )}
              {!f.uploading && (
                <button type="button" onClick={() => removeFile(f.id)}
                  className="shrink-0 text-slate-400 hover:text-red-500 transition">
                  <Icon name="x" className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
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

  const VISIBLE_LIMIT = 2
  const visible = expanded ? selected : selected.slice(0, VISIBLE_LIMIT)
  const hiddenCount = selected.length - VISIBLE_LIMIT

  return (
    <div ref={ref} className="relative">
      {/* Selected tags — compact: show first 2, collapse the rest */}
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
  const [searchParams] = useSearchParams()
  const cloneSourceId = searchParams.get('cloneFrom') // present on /campaigns/new?cloneFrom=<id>
  const { user }   = useAuth()
  const toast      = useToast()
  const showToast  = (msg, type = 'info') => toast[type]?.(msg)
  const navigate   = useNavigate()

  // Master data from DB tables
  const [depts,              setDepts]              = useState([])
  const [taskTypes,          setTaskTypes]          = useState([])
  const [audiences,          setAudiences]          = useState([])
  const [businessObjectives, setBusinessObjectives] = useState([])
  const [languages,          setLanguages]          = useState([])
  const [tones,              setTones]              = useState([])
  const [offerTypes,         setOfferTypes]         = useState([])
  const [supportingProofs,   setSupportingProofs]   = useState([])
  const [budgetTierOpts,     setBudgetTierOpts]     = useState([])
  const [vendorTypes,        setVendorTypes]        = useState([])
  const [kpiTypeOpts,        setKpiTypeOpts]        = useState([])
  const [expectedOutputOpts, setExpectedOutputOpts] = useState([])
  const [allAvailableTasks,  setAllAvailableTasks]  = useState([])
  const [loadingTasks,       setLoadingTasks]       = useState(true)

  // Campaign Specifications — hierarchical selects
  const [campaignTypes,       setCampaignTypes]       = useState([])
  const [businessVerticals,   setBusinessVerticals]   = useState([])
  const [businessTypeOpts,    setBusinessTypeOpts]    = useState([])   // filtered by selected vertical
  const [storeFormatOpts,     setStoreFormatOpts]     = useState([])   // filtered by selected business type

  // Enum options — only priorities remain as Java enum (not admin-configurable)
  const [enumOpts, setEnumOpts] = useState({ priorities: [] })

  const [form, setForm] = useState({
    departmentId:            user?.departmentId || '',
    businessObjective:       '',
    businessObjectiveOther:  '',
    campaignTypeId:          '',
    businessVerticalId:      '',
    businessTypeId:          '',
    storeFormatTypeId:       '',
    taskTypeId:              [],
    audienceTypeIds:         [],
    audienceTypeOther:       '',
    languages:               [],
    languageOther:           '',
    hasOffer:                'NO',
    offerTypeId:             '',
    offerTypeOther:          '',
    keyMessage:              '',
    supportingProof:         '',
    supportingProofOther:    '',
    tones:                   [],
    toneOther:               '',
    priority:                'MEDIUM',
    budgetTier:              '',
    budgetTierOther:         '',
    vendorRequired:          'NO',
    vendorTypeIds:           [],
    vendorTypeOther:         '',
    kpiType:                 '',
    kpiTypeOther:            '',
    expectedOutput:          '',
    expectedOutputOther:     '',
  })

  // { [taskId]: { granularTaskId, questionnaire } }
  const [deliverables,  setDeliverables]  = useState({})
  /** Granular task id → questions */
  const [taskQuestions, setTaskQuestions] = useState({})
  // Selected locations array
  const [targetLocations, setTargetLocations] = useState([])

  // Campaign-level supporting files
  const [campaignFiles,     setCampaignFiles]     = useState([]) // [{ name, url, uploading, error }]
  const [uploadingFiles,    setUploadingFiles]     = useState(false)

  // Per-task staged files — uploaded immediately on select, linked to work tasks after campaign creation
  // { [granularTaskId]: [{ url: string, name: string }] }
  const [taskStagedFiles,   setTaskStagedFiles]   = useState({})
  // { [granularTaskId]: boolean }
  const [taskFileUploading, setTaskFileUploading] = useState({})

  const addStagedFiles = (granularTaskId, newFiles) =>
    setTaskStagedFiles(prev => ({
      ...prev,
      [granularTaskId]: [...(prev[granularTaskId] || []), ...newFiles],
    }))

  const removeStagedFile = (granularTaskId, url) =>
    setTaskStagedFiles(prev => ({
      ...prev,
      [granularTaskId]: (prev[granularTaskId] || []).filter(f => f.url !== url),
    }))

  // Validation errors
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // All master-data selects now use item.id as the submitted value (not the display name).
    const nb  = (setter) => (d) => setter([...d.map(normaliseById), OTHER_OPTION])
    const nbM = (setter) => (d) => setter([...d.map(normaliseById), OTHER_OPTION]) // multi-select same

    masterApi.list('departments').then((d) => setDepts(d.map(normaliseById))).catch(() => {})
    masterApi.list('task-types').then((d) => setTaskTypes(d.map(normaliseById))).catch(() => {})
    masterApi.list('audiences').then(nbM(setAudiences)).catch(() => {})
    masterApi.list('business-objectives').then(nb(setBusinessObjectives)).catch(() => {})
    masterApi.list('languages').then(nbM(setLanguages)).catch(() => {})
    masterApi.list('tones').then(nbM(setTones)).catch(() => {})
    masterApi.list('offer-types').then(nb(setOfferTypes)).catch(() => {})
    masterApi.list('supporting-proofs').then(nb(setSupportingProofs)).catch(() => {})
    masterApi.list('budget-tiers').then(nb(setBudgetTierOpts)).catch(() => {})
    masterApi.list('vendor-types').then(nbM(setVendorTypes)).catch(() => {})
    masterApi.list('kpi-types').then(nb(setKpiTypeOpts)).catch(() => {})
    masterApi.list('expected-outputs').then(nb(setExpectedOutputOpts)).catch(() => {})
    masterApi.list('campaign-types').then((d) => setCampaignTypes(d.map(normaliseById))).catch(() => {})
    masterApi.list('business-verticals').then((d) => setBusinessVerticals(d.map(normaliseById))).catch(() => {})

    masterApi.list('granular-tasks').then((d) => setAllAvailableTasks(d))
      .catch(() => {}).finally(() => setLoadingTasks(false))

    enumsApi.getCampaignFormOptions().then((data) => setEnumOpts(data)).catch(() => {})
  }, [])

  // Cascade: load Business Types when Business Vertical changes
  useEffect(() => {
    if (!form.businessVerticalId) { setBusinessTypeOpts([]); return }
    campaignSpecsApi.getBusinessTypesByVertical(form.businessVerticalId)
      .then((d) => setBusinessTypeOpts(d.map(normaliseById)))
      .catch(() => setBusinessTypeOpts([]))
  }, [form.businessVerticalId])

  // Cascade: load Store Format Types when Business Type changes
  useEffect(() => {
    if (!form.businessTypeId) { setStoreFormatOpts([]); return }
    campaignSpecsApi.getStoreFormatsByBusinessType(form.businessTypeId)
      .then((d) => setStoreFormatOpts(d.map(normaliseById)))
      .catch(() => setStoreFormatOpts([]))
  }, [form.businessTypeId])

  // Filter granular tasks by ALL selected task types (union); show all when nothing is selected.
  // Normalize both sides to strings — master-data IDs arrive as numbers from the API but the
  // select stores the raw JS value, causing strict-equality mismatches without this coercion.
  const selectedTypeIdStrs = form.taskTypeId.map(String)
  const availableTasks = (selectedTypeIdStrs.length > 0
    ? allAvailableTasks.filter(t => selectedTypeIdStrs.includes(String(t.taskTypeId)))
    : allAvailableTasks
  ).filter(t => t.taskId !== 'TASK-AUTO-CONTENT')

  // Pre-populate form when cloning a campaign (query param ?cloneFrom=<id>)
  const [cloneLoading, setCloneLoading] = useState(!!cloneSourceId)
  useEffect(() => {
    if (!cloneSourceId) return
    setCloneLoading(true)
    campaignsApi.getById(cloneSourceId)
      .then(res => {
        const c = res.data
        if (!c) return
        const parseArr = (v) => { try { const p = JSON.parse(v); if (Array.isArray(p)) return p } catch {} return [] }
        setForm(prev => ({
          ...prev,
          departmentId:           c.departmentId           || prev.departmentId,
          businessObjective:      c.businessObjectiveId    || c.businessObjective || '',
          taskTypeId:             parseArr(c.taskTypeId),
          audienceTypeIds:        parseArr(c.audienceTypeId),
          languages:              parseArr(c.languageIds),
          hasOffer:               c.hasOffer               || 'NO',
          offerTypeId:            c.offerTypeId            || '',
          keyMessage:             c.keyMessage             || '',
          supportingProof:        c.supportingProofId      || c.supportingProof || '',
          tones:                  parseArr(c.toneIds),
          priority:               c.priority               || 'MEDIUM',
          budgetTier:             c.budgetTierId           || c.budgetTier || '',
          vendorRequired:         c.vendorRequired         || 'NO',
          vendorTypeIds:          parseArr(c.vendorTypeIds),
          kpiType:                c.kpiTypeId              || c.kpiType || '',
          expectedOutput:         c.expectedOutputId       || c.expectedOutput || '',
        }))
        if (c.targetLocation) {
          try {
            const locs = JSON.parse(c.targetLocation)
            if (Array.isArray(locs)) setTargetLocations(locs)
          } catch {
            if (c.targetLocation) setTargetLocations([c.targetLocation])
          }
        }
        if (Array.isArray(c.deliverables) && c.deliverables.length > 0) {
          const preDeliverables = {}
          c.deliverables.forEach((d) => {
            if (d.granularTaskId) {
              preDeliverables[d.granularTaskId] = {
                granularTaskId: d.granularTaskId,
                questionnaire: {},
              }
            }
          })
          setDeliverables(preDeliverables)
        }
      })
      .catch(() => showToast('Failed to load source campaign for cloning.', 'error'))
      .finally(() => setCloneLoading(false))
  }, [cloneSourceId]) // eslint-disable-line react-hooks/exhaustive-deps

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
        next.offerTypeId          = ''
        next.offerTypeOther       = ''
        next.keyMessage           = ''
        next.supportingProof      = ''
        next.supportingProofOther = ''
      }
      // When toggling vendor off, clear vendor type selections
      if (name === 'vendorRequired' && value === 'NO') {
        next.vendorTypeIds  = []
        next.vendorTypeOther = ''
      }
      // Cascade: clear child when parent changes
      if (name === 'businessVerticalId') {
        next.businessTypeId   = ''
        next.storeFormatTypeId = ''
      }
      if (name === 'businessTypeId') {
        next.storeFormatTypeId = ''
      }
      // Clear "other" text when a different option is selected
      if (name === 'businessObjective' && value !== 'Other')  next.businessObjectiveOther = ''
      if (name === 'offerTypeId'       && value !== 'Other')  next.offerTypeOther         = ''
      if (name === 'supportingProof'   && value !== 'Other')  next.supportingProofOther   = ''
      if (name === 'budgetTier'        && value !== 'Other')  next.budgetTierOther        = ''
      if (name === 'kpiType'           && value !== 'Other')  next.kpiTypeOther           = ''
      if (name === 'expectedOutput'    && value !== 'Other')  next.expectedOutputOther    = ''
      // Multi-select: clear "other" text when "Other" is deselected
      if (name === 'audienceTypeIds'   && !value.includes('Other')) next.audienceTypeOther  = ''
      if (name === 'languages'         && !value.includes('Other')) next.languageOther      = ''
      if (name === 'tones'             && !value.includes('Other')) next.toneOther          = ''
      if (name === 'vendorTypeIds'     && !value.includes('Other')) next.vendorTypeOther    = ''
      return next
    })
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
    // When task types change, remove any deliverables that no longer belong to a selected type
    if (name === 'taskTypeId') {
      const newTypeIds = value // already an array from GenericMultiSelect
      if (newTypeIds.length === 0) {
        setDeliverables({})
      } else {
        const newTypeIdStrs = newTypeIds.map(String)
        setDeliverables(prev => {
          const next = {}
          Object.entries(prev).forEach(([taskId, spec]) => {
            // Object keys are always strings; t.taskId may be a number — compare as strings
            const task = allAvailableTasks.find(t => String(t.taskId) === taskId)
            if (task && newTypeIdStrs.includes(String(task.taskTypeId))) {
              next[taskId] = spec
            }
          })
          return next
        })
      }
    }
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

  const validate = () => {
    const e = {}

    // Section 1
    if (targetLocations.length === 0) e.targetLocations = 'Select at least one location'
    if (!form.businessObjective) e.businessObjective = 'Required'
    else if (form.businessObjective === 'Other' && !form.businessObjectiveOther?.trim())
      e.businessObjectiveOther = 'Please specify your custom business objective'
    if (!form.campaignTypeId)     e.campaignTypeId     = 'Required'
    if (!form.businessVerticalId) e.businessVerticalId = 'Required'
    if (form.businessVerticalId && businessTypeOpts.length > 0 && !form.businessTypeId)   e.businessTypeId   = 'Required'
    if (form.businessTypeId    && storeFormatOpts.length > 0 && !form.storeFormatTypeId) e.storeFormatTypeId = 'Required'

    // Section 2
    if (form.taskTypeId.length === 0) e.taskTypeId = 'Select at least one task type'

    // Section 3
    if (form.audienceTypeIds.length === 0) e.audienceTypeIds = 'Select at least one audience type'
    else if (form.audienceTypeIds.includes('Other') && !form.audienceTypeOther?.trim())
      e.audienceTypeOther = 'Please specify the custom audience type'
    if (form.languages.length === 0)       e.languages       = 'Select at least one language'
    else if (form.languages.includes('Other') && !form.languageOther?.trim())
      e.languageOther = 'Please specify the language'

    // Section 4 — all fields only required when there IS an offer
    if (form.hasOffer === 'YES') {
      if (!form.offerTypeId) e.offerTypeId = 'Required'
      else if (form.offerTypeId === 'Other' && !form.offerTypeOther?.trim())
        e.offerTypeOther = 'Please specify the offer type'
      if (!form.keyMessage?.trim()) e.keyMessage = 'Required'
      if (form.supportingProof === 'Other' && !form.supportingProofOther?.trim())
        e.supportingProofOther = 'Please specify the supporting proof'
    }
    if (form.tones.length === 0) e.tones = 'Select at least one tone / style'
    else if (form.tones.includes('Other') && !form.toneOther?.trim())
      e.toneOther = 'Please specify the custom tone'

    // Section 5 — deliverables
    if (Object.keys(deliverables).length === 0) {
      e.deliverables = 'Select at least one deliverable'
    } else {
      const taskQaErrs = {}
      Object.entries(deliverables).forEach(([taskId, spec]) => {
        const qs = taskQuestions[taskId] || []
        const ans = spec.questionnaire || {}
        const qaFields = {}
        for (const q of qs) {
          if (!(q.required ?? q.isRequired)) continue
          const raw = ans[q.questionId]
          let empty = true
          if (q.fieldType === 'MULTISELECT') {
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
      if (Object.keys(taskQaErrs).length) e.taskQa = taskQaErrs
    }

    // Section 6
    if (!form.priority) e.priority = 'Required'

    // Section 7
    if (!form.budgetTier) e.budgetTier = 'Required'
    else if (form.budgetTier === 'Other' && !form.budgetTierOther?.trim())
      e.budgetTierOther = 'Please specify the budget tier'
    if (form.vendorRequired === 'YES' && form.vendorTypeIds.length === 0)
      e.vendorTypeIds = 'Select at least one vendor type'
    else if (form.vendorRequired === 'YES' && form.vendorTypeIds.includes('Other') && !form.vendorTypeOther?.trim())
      e.vendorTypeOther = 'Please specify the vendor type'

    // Section 8
    if (!form.kpiType) e.kpiType = 'Required'
    else if (form.kpiType === 'Other' && !form.kpiTypeOther?.trim())
      e.kpiTypeOther = 'Please specify the KPI type'
    if (!form.expectedOutput) e.expectedOutput = 'Required'
    else if (form.expectedOutput === 'Other' && !form.expectedOutputOther?.trim())
      e.expectedOutputOther = 'Please specify the expected output'

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
      // Single-select: send the ID if a known option, or the free-text if "Other"
      const resolve = (val, other) => val === 'Other' ? (other?.trim() || null) : (val || null)
      // Multi-select: send JSON array of IDs; free-text for "Other" appended as plain string
      const resolveMultiArr = (arr, other) => {
        const result = arr.filter((v) => v !== 'Other')
        if (arr.includes('Other') && other?.trim()) result.push(other.trim())
        return result.length > 0 ? result : null
      }

      // Derive task types from the actually-selected deliverables (not from the filter dropdown).
      // Object keys are strings; t.taskId may be a number — compare as strings.
      const derivedTaskTypeIds = [...new Set(
        Object.keys(deliverables)
          .map(tid => allAvailableTasks.find(t => String(t.taskId) === tid)?.taskTypeId)
          .filter(Boolean)
          .map(String)
      )]

      const payload = {
        departmentId:        form.departmentId || null,
        businessObjective:   resolve(form.businessObjective, form.businessObjectiveOther),
        campaignTypeId:      form.campaignTypeId      || null,
        businessVerticalId:  form.businessVerticalId  || null,
        businessTypeId:      form.businessTypeId      || null,
        storeFormatTypeId:   form.storeFormatTypeId   || null,
        taskTypeId:        derivedTaskTypeIds.length > 0 ? derivedTaskTypeIds : null,
        // multi-select fields — sent as JSON arrays to the backend List<String> fields
        audienceTypeId:    resolveMultiArr(form.audienceTypeIds, form.audienceTypeOther),
        language:          resolveMultiArr(form.languages,       form.languageOther),
        tone:              resolveMultiArr(form.tones,           form.toneOther),
        hasOffer:          form.hasOffer,
        offerTypeId:       form.hasOffer === 'YES' ? resolve(form.offerTypeId, form.offerTypeOther) : null,
        keyMessage:        form.hasOffer === 'YES' ? form.keyMessage || null : null,
        supportingProof:   form.hasOffer === 'YES' ? resolve(form.supportingProof, form.supportingProofOther) : null,
        priority:          form.priority || null,
        budgetTier:        resolve(form.budgetTier, form.budgetTierOther),
        vendorRequired:    form.vendorRequired,
        vendorType:        form.vendorRequired === 'YES'
          ? resolveMultiArr(form.vendorTypeIds, form.vendorTypeOther) : null,
        kpiType:           resolve(form.kpiType, form.kpiTypeOther),
        expectedOutput:    resolve(form.expectedOutput, form.expectedOutputOther),
        targetLocation:    JSON.stringify(targetLocations),
        fileUrls:          campaignFiles.filter(f => f.url).map(f => f.url),
        fileOriginalNames: campaignFiles.filter(f => f.url).map(f => f.name || f.url.split('/').pop()),
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
            ...(questionnaireAnswers.length > 0 ? { questionnaireAnswers } : {}),
          }
        }),
      }
      console.log('[Form] Payload:', payload)
      const result = await campaignsApi.create(payload)
      console.log('[Form] Success:', result)

      // Link any per-task staged files to the newly created work tasks.
      // Use allSettled so one failure doesn't prevent the others from being saved.
      const newCampaignId = result.data?.campaignId
      const hasStagedFiles = newCampaignId &&
        Object.values(taskStagedFiles).some(arr => arr.filter(f => f.url).length > 0)
      if (hasStagedFiles) {
        const detail    = await campaignsApi.getById(newCampaignId).catch(() => null)
        const workTasks = detail?.data?.workTasks || []

        const linkJobs = workTasks
          .map(wt => {
            const gid   = String(wt.granularTaskId)
            const files = (taskStagedFiles[gid] || []).filter(f => f.url)
            if (!files.length) return null
            return { wt, files }
          })
          .filter(Boolean)

        if (linkJobs.length) {
          const outcomes = await Promise.allSettled(
            linkJobs.map(({ wt, files }) =>
              tasksApi.addTaskFiles(
                wt.taskId,
                newCampaignId,
                files.map(f => f.url),
                files.map(f => f.name),
              )
            )
          )
          const failCount = outcomes.filter(o => o.status === 'rejected').length
          if (failCount > 0) {
            console.warn('[Form] Some task file links failed:', outcomes)
            showToast(
              `Campaign submitted, but files for ${failCount} task${failCount > 1 ? 's' : ''} could not be linked. You can add them via Edit.`,
              'info'
            )
          }
        }
      }

      showToast('Request submitted successfully!', 'success')
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

  if (cloneLoading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
      <svg className="h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <span className="text-sm">Loading clone source…</span>
    </div>
  )

  return (
    <div className="mx-auto max-w-4xl space-y-3 pb-10">
      {/* Page header */}
      <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {cloneSourceId ? 'Clone Request' : 'New Marketing Request'}
          </h2>
          {cloneSourceId && (
            <p className="mt-0.5 text-xs text-amber-600 font-medium">
              Cloned from campaign #{cloneSourceId} — review and edit before submitting.
            </p>
          )}
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

        {/* ── Card 1: Campaign Specifications · Audience ── */}
        <Card>
          {/* §1 Campaign Specifications */}
          <SectionLabel number="1" title="Campaign Specifications" />

          {/* Row 1: Business Objective + Campaign Type */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <FormGroup label="Business Objective" required error={errors.businessObjective || errors.businessObjectiveOther}>
              <div data-has-error={!!(errors.businessObjective || errors.businessObjectiveOther) || undefined}>
                <Select name="businessObjective" value={form.businessObjective} onChange={handleChange}
                  options={businessObjectives} placeholder="Select…" hasError={!!errors.businessObjective} />
              </div>
              {form.businessObjective === 'Other' && (
                <input className={`mt-1.5 ${errors.businessObjectiveOther ? errorInputCls : inputCls}`}
                  name="businessObjectiveOther" value={form.businessObjectiveOther} onChange={handleChange}
                  placeholder="Specify your objective…" />
              )}
            </FormGroup>

            <FormGroup label="Campaign Type" required error={errors.campaignTypeId}>
              <RadioGroup
                name="campaignTypeId"
                value={form.campaignTypeId}
                onChange={handleChange}
                options={campaignTypes}
                hasError={!!errors.campaignTypeId}
              />
            </FormGroup>
          </div>

          <Divider />

          {/* Business Vertical — radio */}
          <FormGroup label="Business Vertical" required error={errors.businessVerticalId}>
            <RadioGroup
              name="businessVerticalId"
              value={form.businessVerticalId}
              onChange={handleChange}
              options={businessVerticals}
              hasError={!!errors.businessVerticalId}
            />
          </FormGroup>

          {/* Business Type — shown only after a vertical is chosen AND options exist */}
          {form.businessVerticalId && businessTypeOpts.length > 0 && (
            <div className="mt-3">
              <FormGroup label="Business Type" required error={errors.businessTypeId}>
                <RadioGroup
                  name="businessTypeId"
                  value={form.businessTypeId}
                  onChange={handleChange}
                  options={businessTypeOpts}
                  hasError={!!errors.businessTypeId}
                />
              </FormGroup>
            </div>
          )}

          {/* Store / Format Type — shown only after a business type is chosen AND options exist */}
          {form.businessVerticalId && form.businessTypeId && storeFormatOpts.length > 0 && (
            <div className="mt-3">
              <FormGroup label="Store / Format Type" required error={errors.storeFormatTypeId}>
                <RadioGroup
                  name="storeFormatTypeId"
                  value={form.storeFormatTypeId}
                  onChange={handleChange}
                  options={storeFormatOpts}
                  hasError={!!errors.storeFormatTypeId}
                />
              </FormGroup>
            </div>
          )}

          <Divider />

          {/* Task Type — end of Campaign Specifications */}
          <FormGroup label="Task Type" required error={errors.taskTypeId}
            hint="Select one or more task types — only matching tasks will appear in Deliverables">
            <GenericMultiSelect
              name="taskTypeId"
              values={form.taskTypeId}
              onChange={handleChange}
              options={taskTypes}
              placeholder="Select task type(s)…"
              hasError={!!errors.taskTypeId}
            />
          </FormGroup>
        </Card>

        {/* ── Card 1b: Location + Audience ── */}
        <Card>
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

          <Divider />

          {/* §2 Audience */}
          <SectionLabel number="2" title="Target Audience" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormGroup label="Audience Type" required error={errors.audienceTypeIds || errors.audienceTypeOther}>
              <div data-has-error={!!(errors.audienceTypeIds || errors.audienceTypeOther) || undefined}>
                <GenericMultiSelect
                  name="audienceTypeIds" values={form.audienceTypeIds} onChange={handleChange}
                  options={audiences} placeholder="Select audience types…" hasError={!!errors.audienceTypeIds}
                />
              </div>
              {form.audienceTypeIds.includes('Other') && (
                <input className={`mt-1.5 ${errors.audienceTypeOther ? errorInputCls : inputCls}`}
                  name="audienceTypeOther" value={form.audienceTypeOther} onChange={handleChange}
                  placeholder="Specify the audience…" />
              )}
            </FormGroup>
            <FormGroup label="Language" required error={errors.languages || errors.languageOther}>
              <div data-has-error={!!(errors.languages || errors.languageOther) || undefined}>
                <GenericMultiSelect
                  name="languages" values={form.languages} onChange={handleChange}
                  options={languages} placeholder="Select languages…" hasError={!!errors.languages}
                />
              </div>
              {form.languages.includes('Other') && (
                <input className={`mt-1.5 ${errors.languageOther ? errorInputCls : inputCls}`}
                  name="languageOther" value={form.languageOther} onChange={handleChange}
                  placeholder="Specify the language…" />
              )}
            </FormGroup>
            <FormGroup label="Tone / Style" required error={errors.tones || errors.toneOther}>
              <div data-has-error={!!(errors.tones || errors.toneOther) || undefined}>
                <GenericMultiSelect
                  name="tones" values={form.tones} onChange={handleChange}
                  options={tones} placeholder="Select tones…" hasError={!!errors.tones}
                />
              </div>
              {form.tones.includes('Other') && (
                <input className={`mt-1.5 ${errors.toneOther ? errorInputCls : inputCls}`}
                  name="toneOther" value={form.toneOther} onChange={handleChange}
                  placeholder="Specify the tone / style…" />
              )}
            </FormGroup>
          </div>
        </Card>

        {/* ── Card 2: Offer & Messaging ── */}
        <Card>
          <SectionLabel number="3" title="Offer & Messaging" />
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <div className="w-full shrink-0 sm:w-36">
              <FormGroup label="Is there an Offer?">
                <Select name="hasOffer" value={form.hasOffer} onChange={handleChange}
                  options={[{ value: 'YES', label: 'Yes' }, { value: 'NO', label: 'No' }]} />
              </FormGroup>
            </div>

            {form.hasOffer === 'YES' && (
              <div className="grid flex-1 grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 sm:grid-cols-3">
                <FormGroup label="Offer Type" required error={errors.offerTypeId || errors.offerTypeOther}>
                  <div data-has-error={!!(errors.offerTypeId || errors.offerTypeOther) || undefined}>
                    <Select name="offerTypeId" value={form.offerTypeId} onChange={handleChange}
                      options={offerTypes} placeholder="Select…" hasError={!!errors.offerTypeId} />
                  </div>
                  {form.offerTypeId === 'Other' && (
                    <input className={`mt-1.5 ${errors.offerTypeOther ? errorInputCls : inputCls}`}
                      name="offerTypeOther" value={form.offerTypeOther} onChange={handleChange}
                      placeholder="Specify the offer type…" />
                  )}
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
                <FormGroup label="Supporting Proof" error={errors.supportingProofOther}>
                  <div data-has-error={!!errors.supportingProofOther || undefined}>
                    <Select name="supportingProof" value={form.supportingProof} onChange={handleChange}
                      options={supportingProofs} placeholder="Select…" />
                  </div>
                  {form.supportingProof === 'Other' && (
                    <input className={`mt-1.5 ${errors.supportingProofOther ? errorInputCls : inputCls}`}
                      name="supportingProofOther" value={form.supportingProofOther} onChange={handleChange}
                      placeholder="Specify the supporting proof…" />
                  )}
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
                // Object keys are strings; t.taskId may be a number — compare as strings
                const task = allAvailableTasks.find((t) => String(t.taskId) === taskId)
                if (!task) return null
                return (
                  <DeliverableCard
                    key={taskId}
                    task={task}
                    spec={deliverables[taskId]}
                    onRemove={(id) => toggleTask({ taskId: id })}
                    questions={taskQuestions[taskId] || []}
                    onQuestionnaireChange={(qid, val) => updateDeliverableQuestionnaire(taskId, qid, val)}
                    questionnaireFieldErrors={errors.taskQa?.[taskId] || {}}
                    stagedFiles={taskStagedFiles[taskId] || []}
                    fileUploading={taskFileUploading[taskId] || false}
                    onFilesAdd={(files) => addStagedFiles(taskId, files)}
                    onFileRemove={(url) => removeStagedFile(taskId, url)}
                    onFileUploadStateChange={(v) =>
                      setTaskFileUploading(prev => ({ ...prev, [taskId]: v }))
                    }
                  />
                )
              })}
            </div>
          )}
        </Card>

        {/* ── Card 4: Timelines · Budget · KPIs ── */}
        <Card>
          <SectionLabel number="5" title="Timelines & Priority" />  {/* intentionally 5 not 4 since files is new 7 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormGroup label="Priority" required error={errors.priority}>
              <div data-has-error={!!errors.priority || undefined}>
                <Select name="priority" value={form.priority} onChange={handleChange}
                  options={enumOpts.priorities} hasError={!!errors.priority} />
              </div>
            </FormGroup>
            <FormGroup label="Budget" required error={errors.budgetTier || errors.budgetTierOther}>
              <div data-has-error={!!(errors.budgetTier || errors.budgetTierOther) || undefined}>
                <Select name="budgetTier" value={form.budgetTier} onChange={handleChange}
                  options={budgetTierOpts} placeholder="Select…" hasError={!!errors.budgetTier} />
              </div>
              {form.budgetTier === 'Other' && (
                <input className={`mt-1.5 ${errors.budgetTierOther ? errorInputCls : inputCls}`}
                  name="budgetTierOther" value={form.budgetTierOther} onChange={handleChange}
                  placeholder="Specify the budget…" />
              )}
            </FormGroup>
            <FormGroup label="Vendor Required?">
              <Select name="vendorRequired" value={form.vendorRequired} onChange={handleChange}
                options={[{ value: 'YES', label: 'Yes' }, { value: 'NO', label: 'No' }]} />
            </FormGroup>
            {form.vendorRequired === 'YES' && (
              <FormGroup label="Vendor Type" required error={errors.vendorTypeIds || errors.vendorTypeOther}>
                <div data-has-error={!!(errors.vendorTypeIds || errors.vendorTypeOther) || undefined}>
                  <GenericMultiSelect
                    name="vendorTypeIds" values={form.vendorTypeIds} onChange={handleChange}
                    options={vendorTypes} placeholder="Select vendor types…" hasError={!!errors.vendorTypeIds}
                  />
                </div>
                {form.vendorTypeIds.includes('Other') && (
                  <input className={`mt-1.5 ${errors.vendorTypeOther ? errorInputCls : inputCls}`}
                    name="vendorTypeOther" value={form.vendorTypeOther} onChange={handleChange}
                    placeholder="Specify the vendor type…" />
                )}
              </FormGroup>
            )}
          </div>

          <Divider />

          <SectionLabel number="6" title="Success Metrics (KPIs)" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormGroup label="KPI Type" required error={errors.kpiType || errors.kpiTypeOther}>
              <div data-has-error={!!(errors.kpiType || errors.kpiTypeOther) || undefined}>
                <Select name="kpiType" value={form.kpiType} onChange={handleChange}
                  options={kpiTypeOpts} placeholder="Select…" hasError={!!errors.kpiType} />
              </div>
              {form.kpiType === 'Other' && (
                <input className={`mt-1.5 ${errors.kpiTypeOther ? errorInputCls : inputCls}`}
                  name="kpiTypeOther" value={form.kpiTypeOther} onChange={handleChange}
                  placeholder="Specify the KPI…" />
              )}
            </FormGroup>
            <FormGroup label="Expected Output" required error={errors.expectedOutput || errors.expectedOutputOther}>
              <div data-has-error={!!(errors.expectedOutput || errors.expectedOutputOther) || undefined}>
                <Select name="expectedOutput" value={form.expectedOutput} onChange={handleChange}
                  options={expectedOutputOpts} placeholder="Select…" hasError={!!errors.expectedOutput} />
              </div>
              {form.expectedOutput === 'Other' && (
                <input className={`mt-1.5 ${errors.expectedOutputOther ? errorInputCls : inputCls}`}
                  name="expectedOutputOther" value={form.expectedOutputOther} onChange={handleChange}
                  placeholder="Specify the expected output…" />
              )}
            </FormGroup>
          </div>
        </Card>

        {/* ── Card 5: Supporting Files ── */}
        <Card>
          <SectionLabel number="7" title="Related / Supporting Files" />
          <p className="text-xs text-slate-500 mb-3">
            Upload any reference files for this campaign (briefs, brand guides, images, etc.).
            These files will be visible in all task briefs for this campaign.
          </p>
          <CampaignFilesSection
            files={campaignFiles}
            onFilesChange={setCampaignFiles}
            uploading={uploadingFiles}
            setUploading={setUploadingFiles}
          />
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
                {errors.taskTypeId        && <li>{errors.taskTypeId}</li>}
                {errors.targetLocations  && <li>{errors.targetLocations}</li>}
                {errors.audienceTypeIds  && <li>{errors.audienceTypeIds}</li>}
                {errors.languages        && <li>{errors.languages}</li>}
                {errors.tones            && <li>{errors.tones}</li>}
                {errors.offerTypeId      && <li>Offer Type is required</li>}
                {errors.keyMessage       && <li>Key Message is required</li>}
                {errors.deliverables     && <li>{errors.deliverables}</li>}
                {errors.taskQa && <li>Answer all required task-specific questions under Deliverables</li>}
                {errors.priority         && <li>Priority is required</li>}
                {errors.budgetTier       && <li>Budget Tier is required</li>}
                {errors.vendorTypeIds    && <li>{errors.vendorTypeIds}</li>}
                {errors.kpiType          && <li>KPI Type is required</li>}
                {errors.expectedOutput   && <li>Expected Output is required</li>}
              </ul>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:gap-3">
          <button type="button" onClick={() => navigate('/campaigns')}
            className="w-full rounded-lg border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition sm:w-auto">
            Cancel
          </button>
          <button type="submit" disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white
              hover:bg-brand-700 disabled:opacity-60 transition sm:w-auto">
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

/** All dropdowns (including departments and master-data selects) use the DB id as the submitted value. */
function normaliseById(item) {
  return { value: item.id, label: item.name }
}

/** Sentinel option appended to every list that supports free-text "Other". */
const OTHER_OPTION = { value: 'Other', label: 'Other (specify below)' }
