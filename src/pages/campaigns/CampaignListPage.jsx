import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Rights } from '../../constants/rights'
import AppSelect from '../../components/AppSelect'
import { DATA_TABLE_CLASS, DataTableColGroup, TableStatusRow, dataTableStyle } from '../../components/dataTable'
import DateRangePicker from '../../components/DateRangePicker'
import Pagination from '../../components/Pagination'
import { useToast } from '../../components/Toast'
import campaignsApi from '../../api/campaigns'
import { masterApi, granularTasksApi } from '../../api/masterData'
import tasksApi from '../../api/tasks'
import api from '../../api/client'
import Icon from '../../components/Icon'
import RequestBriefDrawer from '../../components/RequestBriefDrawer'
import useDebounce from '../../hooks/useDebounce'
import MapplsLocationMultiSelect from '../../components/MapplsLocationMultiSelect'
import { parseTargetLocations, serializeTargetLocations } from '../../utils/targetLocations'

// ─── Status / Priority helpers ────────────────────────────────────────────────

const CAMPAIGN_STATUS_STYLES = {
  IN_PROGRESS:                'bg-blue-50 text-blue-700 ring-blue-200',
  MANAGER_QC_REVIEW:          'bg-purple-50 text-purple-700 ring-purple-200',
  REQUESTOR_QC_REVIEW:        'bg-violet-50 text-violet-700 ring-violet-200',
  COMPLETED:                  'bg-green-50 text-green-700 ring-green-200',
  REJECTED:                   'bg-red-50 text-red-700 ring-red-200',
  CANCELLED:                  'bg-slate-100 text-slate-500 ring-slate-200',
}

const CAMPAIGN_STATUS_LABELS = {
  IN_PROGRESS:                'In Progress',
  MANAGER_QC_REVIEW:          'Manager QC Review',
  REQUESTOR_QC_REVIEW:        'Requestor QC Review',
  COMPLETED:                  'Completed',
  REJECTED:                   'Rejected',
  CANCELLED:                  'Cancelled',
}

function CampaignStatusBadge({ status }) {
  const cls = CAMPAIGN_STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {CAMPAIGN_STATUS_LABELS[status] || status}
    </span>
  )
}

function PriorityBadge({ priority }) {
  const map = {
    HIGH:   'bg-red-50 text-red-700 ring-red-200',
    MEDIUM: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
    LOW:    'bg-green-50 text-green-700 ring-green-200',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${map[priority] || 'bg-slate-100 text-slate-600'}`}>
      {priority || '—'}
    </span>
  )
}

// ─── File display helpers ─────────────────────────────────────────────────────

const FILE_TYPE_MAP = {
  jpg: 'Image', jpeg: 'Image', png: 'Image', gif: 'Image', webp: 'Image', svg: 'Graphic',
  mp4: 'Video', mov: 'Video', avi: 'Video', webm: 'Video', wmv: 'Video',
  pdf: 'PDF Document', doc: 'Document', docx: 'Document',
  xls: 'Spreadsheet', xlsx: 'Spreadsheet',
  ppt: 'Presentation', pptx: 'Presentation',
}

function friendlyFileName(url, index) {
  const ext  = (url || '').split('?')[0].toLowerCase().split('.').pop()
  const type = FILE_TYPE_MAP[ext]
  return type ? `${type} ${index + 1}` : `Attachment ${index + 1}`
}

// ─── Per-task file row used inside the edit-modal "Task Files" section ────────
// Renders the file management panel for a single work task.
// Designed to be embedded inside a task's expanded panel — no outer wrapper or header.
/**
 * Lightweight per-task file upload for the "Add More Tasks" panel in the edit modal.
 * Stores staged file entries (id, name, url, uploading, error) in parent state via callbacks,
 * handles sequential uploads, per-file progress, and retry.
 */
function NewTaskFileUpload({ taskId, stagedFiles = [], onFilesAdd, onFileRemove }) {
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)
  const toast   = useToast()

  const uploadOne = async (file) => {
    try {
      const fd = new FormData(); fd.append('files', file)
      const res = await api.post('/upload/asset', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const url = res.data?.urls?.[0]
      if (!url) throw new Error(res.data?.errors?.[0] || 'Upload failed')
      return url
    } catch (err) {
      throw new Error((err?.response?.data?.message || err?.message || 'Upload failed').slice(0, 60))
    }
  }

  const handleFiles = async (files) => {
    if (!files?.length) return
    const entries = Array.from(files).map(f => ({
      id: Math.random().toString(36).slice(2), name: f.name, url: null, uploading: true, error: null, file: f,
    }))
    onFilesAdd(taskId, entries)
    for (const entry of entries) {
      try {
        const url = await uploadOne(entry.file)
        onFilesAdd(taskId, [{ ...entry, url, uploading: false, error: null }], true)
      } catch (err) {
        onFilesAdd(taskId, [{ ...entry, uploading: false, error: err.message }], true)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const retry = async (entry) => {
    onFilesAdd(taskId, [{ ...entry, uploading: true, error: null }], true)
    try {
      const url = await uploadOne(entry.file)
      onFilesAdd(taskId, [{ ...entry, url, uploading: false, error: null }], true)
    } catch (err) {
      onFilesAdd(taskId, [{ ...entry, uploading: false, error: err.message }], true)
    }
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)) }}
        onClick={() => fileRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed
          cursor-pointer py-4 transition select-none
          ${dragOver ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-slate-50/50 hover:border-brand-300 hover:bg-brand-50/30'}`}>
        <Icon name="upload" className={`h-5 w-5 ${dragOver ? 'text-brand-500' : 'text-slate-400'}`} />
        <p className={`text-xs font-medium ${dragOver ? 'text-brand-600' : 'text-slate-500'}`}>Click or drag files here</p>
        <p className="text-[10px] text-slate-400">Images, PDFs, documents</p>
        <input ref={fileRef} type="file" multiple className="hidden"
          onChange={e => { handleFiles(Array.from(e.target.files)); e.target.value = '' }} />
      </div>

      {stagedFiles.length > 0 && (
        <ul className="space-y-1">
          {stagedFiles.map(f => (
            <li key={f.id} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs
              ${f.error ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
              {f.uploading ? (
                <svg className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : f.error ? (
                <Icon name="alertCircle" className="h-3.5 w-3.5 shrink-0 text-red-400" />
              ) : (
                <Icon name="fileText" className="h-3.5 w-3.5 shrink-0 text-brand-400" />
              )}
              <span className={`flex-1 truncate ${f.error ? 'text-red-600' : 'text-slate-700'}`}>
                {f.error ? `${f.name} — ${f.error}` : f.name}
              </span>
              {f.uploading && <span className="shrink-0 text-[10px] text-slate-400">Uploading…</span>}
              {f.error && f.file && (
                <button type="button" onClick={() => retry(f)}
                  className="shrink-0 text-xs font-medium text-brand-600 hover:underline">Retry</button>
              )}
              {f.url && !f.uploading && (
                <a href={f.url} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 text-[10px] font-medium text-brand-600 hover:underline">View</a>
              )}
              {!f.uploading && (
                <button type="button" onClick={() => onFileRemove(taskId, f.url || f.id)}
                  className="shrink-0 rounded-full p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
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

function TaskFilesPanel({ workTask, campaign, onChanged, markedUrls = [], onToggleRemoval, readOnly = false }) {
  // pendingUploads: per-file in-progress / failed entries { id, name, uploading, error, file }
  const [pendingUploads, setPendingUploads] = useState([])
  const [dragOver,  setDragOver]  = useState(false)
  const fileInputRef = useRef(null)
  const toast = useToast()

  const savedFiles = workTask.fileUrls || []
  const savedNames = workTask.fileOriginalNames || []
  const markedSet  = new Set(markedUrls)
  const markedCount = markedUrls.length

  const uploadOne = async (file, id) => {
    try {
      const fd = new FormData(); fd.append('files', file)
      const res = await api.post('/upload/asset', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const url = res.data?.urls?.[0]
      if (!url) throw new Error(res.data?.errors?.[0] || 'Upload failed')
      return { url, name: file.name }
    } catch (err) {
      const raw = err?.response?.data?.message || err?.message || 'Upload failed'
      throw new Error(raw.length > 60 ? 'Upload failed' : raw)
    }
  }

  const handleAdd = async (selectedFiles) => {
    if (!selectedFiles?.length) return
    const entries = Array.from(selectedFiles).map(file => ({
      id: Math.random().toString(36).slice(2), name: file.name, uploading: true, error: null, file,
    }))
    setPendingUploads(prev => [...prev, ...entries])

    const succeeded = []
    for (const entry of entries) {
      try {
        const result = await uploadOne(entry.file, entry.id)
        succeeded.push(result)
        setPendingUploads(prev => prev.filter(p => p.id !== entry.id)) // remove on success
      } catch (err) {
        setPendingUploads(prev => prev.map(p => p.id === entry.id
          ? { ...p, uploading: false, error: err.message }
          : p))
      }
    }

    if (succeeded.length > 0) {
      try {
        await tasksApi.addTaskFiles(workTask.taskId, campaign.campaignId,
          succeeded.map(f => f.url), succeeded.map(f => f.name))
        await onChanged()
        toast.success(`${succeeded.length} file${succeeded.length !== 1 ? 's' : ''} added.`)
      } catch {
        toast.error('Files uploaded but could not be saved. Please try again.')
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const retryUpload = async (id) => {
    const entry = pendingUploads.find(p => p.id === id)
    if (!entry?.file) return
    setPendingUploads(prev => prev.map(p => p.id === id ? { ...p, uploading: true, error: null } : p))
    try {
      const result = await uploadOne(entry.file, id)
      setPendingUploads(prev => prev.filter(p => p.id !== id))
      await tasksApi.addTaskFiles(workTask.taskId, campaign.campaignId, [result.url], [result.name])
      await onChanged()
      toast.success('File added.')
    } catch (err) {
      setPendingUploads(prev => prev.map(p => p.id === id
        ? { ...p, uploading: false, error: err.message || 'Upload failed' }
        : p))
    }
  }

  const dismissPending = (id) => setPendingUploads(prev => prev.filter(p => p.id !== id))

  const anyUploading = pendingUploads.some(p => p.uploading)

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        Reference Files
        {savedFiles.length > 0 && (
          <span className="ml-1.5 normal-case font-medium text-violet-600">({savedFiles.length})</span>
        )}
        {markedCount > 0 && (
          <span className="ml-2 text-red-500 normal-case font-medium">({markedCount} marked for removal)</span>
        )}
      </p>

      {/* Saved files */}
      {savedFiles.length > 0 && (
        <ul className="space-y-1">
          {savedFiles.map((url, i) => {
            const name = savedNames[i] || friendlyFileName(url, i)
            const isMarked = markedSet.has(url)
            return (
              <li key={url} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition
                ${isMarked ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
                <Icon name="fileText" className={`h-3.5 w-3.5 shrink-0 ${isMarked ? 'text-red-400' : 'text-red-400'}`} />
                <span className={`flex-1 truncate ${isMarked ? 'line-through text-slate-400' : 'text-slate-700'}`}>{name}</span>
                {!isMarked && (
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 text-brand-600 hover:underline font-medium">View</a>
                )}
                {!readOnly && (
                  <button type="button" onClick={() => onToggleRemoval?.(url)}
                    title={isMarked ? 'Undo remove' : 'Remove file'}
                    className={`shrink-0 rounded-full p-0.5 transition
                      ${isMarked
                        ? 'bg-red-100 text-red-500 hover:bg-red-200'
                        : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}>
                    {isMarked
                      ? <Icon name="undo" className="h-3.5 w-3.5" />
                      : <Icon name="trash" className="h-3.5 w-3.5" />}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* In-progress / failed pending uploads (hidden in read-only) */}
      {!readOnly && pendingUploads.length > 0 && (
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
              {p.error && (
                <button type="button" onClick={() => retryUpload(p.id)}
                  className="shrink-0 text-xs font-medium text-brand-600 hover:underline">Retry</button>
              )}
              {!p.uploading && (
                <button type="button" onClick={() => dismissPending(p.id)}
                  className="shrink-0 rounded-full p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
                  <Icon name="x" className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Drop zone (hidden in read-only) */}
      {!readOnly && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleAdd(Array.from(e.dataTransfer.files)) }}
          onClick={() => !anyUploading && fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed
            cursor-pointer py-5 transition select-none
            ${dragOver ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/30'}`}>
          <Icon name="upload" className={`h-5 w-5 ${dragOver ? 'text-brand-500' : 'text-slate-400'}`} />
          <p className={`text-xs font-medium ${dragOver ? 'text-brand-600' : 'text-slate-500'}`}>Click or drag files here</p>
          <input ref={fileInputRef} type="file" multiple className="hidden"
            onChange={e => { handleAdd(Array.from(e.target.files)); e.target.value = '' }} />
        </div>
      )}
      {readOnly && savedFiles.length === 0 && (
        <p className="text-xs text-slate-400 italic">No reference files uploaded.</p>
      )}
    </div>
  )
}

// ─── Shared helpers for Edit Campaign modal ───────────────────────────────────

function parseOpts(raw) {
  if (!raw) return []
  try { const p = JSON.parse(raw); if (Array.isArray(p)) return p } catch {}
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

function parseJsonArr(s) {
  if (!s) return []
  try { const p = JSON.parse(s); if (Array.isArray(p)) return p } catch {}
  return []
}

function TaskQuestion({ q, answer, onChange, readOnly = false }) {
  const req = q.required ?? q.isRequired
  const getMulti = () => { try { return JSON.parse(answer || '[]') } catch { return [] } }
  const cls = `w-full rounded-lg border px-3 py-2 text-sm transition
    ${readOnly
      ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-default'
      : 'border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500'}`
  if (readOnly) {
    const display = (() => {
      if (!answer && answer !== 0) return <span className="text-slate-400 italic">—</span>
      if (q.fieldType === 'MULTISELECT') {
        const vals = getMulti()
        return vals.length ? <span className="flex flex-wrap gap-1">{vals.map(v => <span key={v} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{v}</span>)}</span> : <span className="text-slate-400 italic">—</span>
      }
      return <span>{String(answer)}</span>
    })()
    return (
      <div>
        <p className="text-xs font-medium text-slate-700 mb-1">{q.questionText}</p>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 min-h-[36px]">{display}</div>
      </div>
    )
  }
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1.5">
        {q.questionText}{req && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {q.fieldType === 'TEXT'     && <input type="text"   value={answer ?? ''} onChange={e => onChange(e.target.value)} className={cls} placeholder="Your answer…" />}
      {q.fieldType === 'NUMBER'   && <input type="number" value={answer ?? ''} onChange={e => onChange(e.target.value)} className={cls} placeholder="0" />}
      {q.fieldType === 'TEXTAREA' && <textarea rows={3} value={answer ?? ''} onChange={e => onChange(e.target.value)} className={`${cls} resize-none`} placeholder="Your answer…" />}
      {q.fieldType === 'DATE'     && <input type="date"   value={answer ?? ''} onChange={e => onChange(e.target.value)} className={cls} />}
      {q.fieldType === 'DROPDOWN' && (
        <AppSelect value={answer ?? ''} onChange={onChange} options={parseOpts(q.options)} placeholder="Select…" />
      )}
      {q.fieldType === 'MULTISELECT' && (
        <div className="flex flex-wrap gap-2 mt-1">
          {parseOpts(q.options).map(opt => {
            const sel = getMulti(); const checked = sel.includes(opt)
            return (
              <label key={opt} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs cursor-pointer transition
                ${checked ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                <input type="checkbox" checked={checked} className="h-3.5 w-3.5 accent-brand-600"
                  onChange={() => { const n = checked ? sel.filter(x => x !== opt) : [...sel, opt]; onChange(JSON.stringify(n)) }} />
                {opt}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EditSelect({ value, onChange, options, placeholder = 'Select…', hasError }) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  const items      = options.map(o => ({ value: o.value ?? '', label: o.label ?? '' }))
  const selected   = items.find(o => o.value === value)
  const filtered   = search ? items.filter(o => o.label.toLowerCase().includes(search.toLowerCase())) : items
  const showSearch = items.length > 6

  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const pick = val => { onChange(val); setOpen(false); setSearch('') }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen(o => !o); setSearch('') }}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5
          text-sm shadow-sm transition text-left bg-white
          ${hasError ? 'border-red-400 ring-1 ring-red-200' :
            open ? 'border-brand-500 ring-2 ring-brand-200' : 'border-slate-300 hover:border-slate-400'}`}>
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <Icon name="chevron" className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-[200] mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          {showSearch && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5
                    text-xs placeholder-slate-400 focus:outline-none focus:border-brand-400" />
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
              : filtered.map(o => (
                <button key={o.value} type="button" onClick={() => pick(o.value)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm
                    hover:bg-brand-50 hover:text-brand-700 transition text-left
                    ${o.value === value ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700'}`}>
                  <span>{o.label}</span>
                  {o.value === value && <Icon name="check" className="h-3.5 w-3.5 text-brand-600 shrink-0" />}
                </button>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}

function EditMultiSelect({ values, onToggle, options, placeholder = 'Select…', hasError }) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  const items      = options.map(o => ({ value: o.value ?? '', label: o.label ?? '' }))
  const filtered   = search ? items.filter(o => o.label.toLowerCase().includes(search.toLowerCase())) : items
  const selected   = items.filter(o => values.includes(o.value))
  const showSearch = items.length > 5

  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen(o => !o); setSearch('') }}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5
          text-sm shadow-sm transition text-left min-h-[34px] bg-white
          ${hasError ? 'border-red-400 ring-1 ring-red-200' :
            open ? 'border-brand-500 ring-2 ring-brand-200' : 'border-slate-300 hover:border-slate-400'}`}>
        {selected.length === 0 ? (
          <span className="text-slate-400">{placeholder}</span>
        ) : selected.length === 1 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700 max-w-[80%] truncate">
            <span className="truncate">{selected[0].label}</span>
            <button type="button" onClick={e => { e.stopPropagation(); onToggle(selected[0].value) }}
              className="shrink-0 hover:text-red-600 transition leading-none">×</button>
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
        <Icon name="chevron" className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-[200] mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          {showSearch && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5
                    text-xs placeholder-slate-400 focus:outline-none focus:border-brand-400" />
              </div>
            </div>
          )}
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0
              ? <p className="px-3 py-2 text-xs text-slate-400 italic">No results</p>
              : filtered.map(o => {
                const isChecked = values.includes(o.value)
                return (
                  <button key={o.value} type="button" onClick={() => onToggle(o.value)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition text-left
                      ${isChecked ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors
                      ${isChecked ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'}`}>
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

// ─── Edit Campaign Modal ──────────────────────────────────────────────────────

const OTHER_OPT = { value: 'Other', label: 'Other (specify below)' }

const EDIT_NAV = [
  { id: 'campaign-info', label: 'Campaign Info',    icon: 'fileText'  },
  { id: 'audience',      label: 'Audience & Tone',  icon: 'users'     },
  { id: 'offer',         label: 'Offer & Messaging',icon: 'tag'       },
  { id: 'budget',        label: 'Budget & KPIs',    icon: 'trendingUp'},
  { id: 'tasks',         label: 'Tasks',            icon: 'checkSquare'},
  { id: 'files',         label: 'Files',            icon: 'paperclip' },
]

function SectionCard({ id, title, icon, children, accent = 'brand' }) {
  const colors = {
    brand:  'border-l-brand-500 bg-brand-50/30',
    violet: 'border-l-violet-400 bg-violet-50/30',
    amber:  'border-l-amber-400 bg-amber-50/20',
    emerald:'border-l-emerald-400 bg-emerald-50/20',
    sky:    'border-l-sky-400 bg-sky-50/20',
    rose:   'border-l-rose-400 bg-rose-50/20',
  }
  return (
    <section id={id} className={`rounded-xl border border-slate-200 border-l-4 ${colors[accent]}`}>
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-slate-200/80 bg-white/60 rounded-t-xl">
        <Icon name={icon} className="h-4 w-4 text-slate-500" />
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      </div>
      <div className="px-5 py-4 space-y-4">
        {children}
      </div>
    </section>
  )
}

function FieldLabel({ children, required }) {
  return (
    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
      {children}{required && <span className="text-red-400 ml-0.5 normal-case">*</span>}
    </label>
  )
}

function YesNoToggle({ value, onChange, label }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex rounded-lg overflow-hidden border border-slate-200 shrink-0">
        {['YES', 'NO'].map(v => (
          <button key={v} type="button" onClick={() => onChange(v)}
            className={`px-4 py-1.5 text-xs font-semibold transition ${value === v
              ? 'bg-brand-600 text-white'
              : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
            {v === 'YES' ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  )
}

function EditCampaignModal({ campaign, onClose, onSuccess }) {
  const toast     = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)
  const contentRef = useRef(null)
  const [activeSection, setActiveSection] = useState('campaign-info')

  // Master data
  const [depts,      setDepts]      = useState([])
  const [taskTypes,  setTaskTypes]  = useState([])
  const [audiences,  setAudiences]  = useState([])
  const [bizObjs,   setBizObjs]   = useState([])
  const [languages, setLanguages] = useState([])
  const [tones,     setTones]     = useState([])
  const [offerTypes,setOfferTypes]= useState([])
  const [spTypes,   setSpTypes]   = useState([])
  const [budgets,   setBudgets]   = useState([])
  const [vendorTs,  setVendorTs]  = useState([])
  const [kpis,      setKpis]      = useState([])
  const [outputs,   setOutputs]   = useState([])
  const [availableTasks, setAvailableTasks] = useState([])
  const [loadingMaster,  setLoadingMaster]  = useState(true)

  // New task selections
  const [newTaskSelections, setNewTaskSelections] = useState({})
  const [taskQuestions,     setTaskQuestions]      = useState({})
  const [loadingQs,         setLoadingQs]          = useState({})
  const [newTaskDropOpen,   setNewTaskDropOpen]    = useState(false)
  const [newTaskSearch,     setNewTaskSearch]      = useState('')
  const newTaskDropRef = useRef(null)

  // Existing task question editing
  const [expandedTask,       setExpandedTask]       = useState(null)  // granularTaskId
  const [existingTaskQs,     setExistingTaskQs]     = useState({})    // granularTaskId → DynamicQuestion[]
  const [existingTaskAns,    setExistingTaskAns]    = useState({})    // workTaskId → { questionId: value }
  const [loadingExistQs,     setLoadingExistQs]     = useState({})    // granularTaskId → bool

  // Work tasks loaded from detail API (list-view campaigns don't carry workTasks)
  const [detailWorkTasks, setDetailWorkTasks] = useState(campaign.workTasks || [])

  // Files – existing (with optional remove) + new uploads
  // existingFiles is populated from the detail API on mount (list-view campaign has no fileUrls)
  const [existingFiles, setExistingFiles] = useState([])
  const [newFiles,       setNewFiles]       = useState([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [dragOver,       setDragOver]       = useState(false)
  const fileInputRef = useRef(null)

  const [saving, setSaving] = useState(false)

  // Deletion state — tasks
  const [taskFileRemovals,   setTaskFileRemovals]   = useState({})   // { workTaskId: Set<url> }

  const toggleTaskFileRemoval = (workTaskId, url) => {
    setTaskFileRemovals(prev => {
      const current = new Set(prev[workTaskId] || [])
      if (current.has(url)) { current.delete(url) } else { current.add(url) }
      return { ...prev, [workTaskId]: current }
    })
  }

  // Staged task deletions — applied on Save (not immediately sent to server)
  const [pendingTaskDeletions, setPendingTaskDeletions] = useState(new Set())
  // Local copy of non-cancelled work tasks so we can remove tasks from UI without a round-trip
  const [localWorkTasks, setLocalWorkTasks] = useState(
    () => (campaign.workTasks || detailWorkTasks || []).filter(t => t.status !== 'CANCELLED')
  )
  // Deletion state — campaign
  const [confirmDeleteCampaign, setConfirmDeleteCampaign] = useState(false)
  const [deletingCampaign,      setDeletingCampaign]      = useState(false)

  const DELETABLE_STATUSES = new Set(['ASSIGNED', 'HELD', 'ACCEPTED'])
  const canDeleteTask = (t) => !t.status || DELETABLE_STATUSES.has(t.status)
  const canDeleteCampaign = localWorkTasks.every(t => canDeleteTask(t) || pendingTaskDeletions.has(t.taskId))

  const toggleTaskDeletion = (taskId) => {
    setPendingTaskDeletions(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId)
      return next
    })
  }

  // Form state
  const [form, setForm] = useState({
    departmentId:           campaign.departmentId || '',
    businessObjective:      '',
    businessObjectiveOther: '',
    storeId:                campaign.storeId        || '',
    contactNumber:          campaign.contactNumber  || '',
      taskTypeId:             [],
    audienceTypeIds:        [],
    audienceTypeOther:      '',
    languages:              [],
    languageOther:          '',
    hasOffer:               campaign.hasOffer || 'NO',
    offerTypeId:            '',
    offerTypeOther:         '',
    keyMessage:             campaign.keyMessage || '',
    supportingProof:        '',
    supportingProofOther:   '',
    tones:                  [],
    toneOther:              '',
    priority:               campaign.priority || 'MEDIUM',
    budgetTier:             '',
    budgetTierOther:        '',
    vendorRequired:         campaign.vendorRequired || 'NO',
    vendorTypeIds:          [],
    vendorTypeOther:        '',
    kpiType:                '',
    kpiTypeOther:           '',
    expectedOutput:         '',
    expectedOutputOther:    '',
  })

  const [targetLocations, setTargetLocations] = useState(() =>
    parseTargetLocations(campaign.targetLocation),
  )

  // Track which granular task types are already in the campaign (to filter the "Add Tasks" picker)
  const existingIds = useMemo(() => new Set(localWorkTasks.map(t => String(t.granularTaskId))), [localWorkTasks])
  const masterLoadedRef = useRef(false)

  // Load master data + existing campaign files
  useEffect(() => {
    const nb = setter => d => setter([...d.map(i => ({ value: i.id, label: i.name })), OTHER_OPT])
    Promise.all([
      masterApi.list('departments').then(d => setDepts(d.map(i => ({ value: i.id, label: i.name })))),
      masterApi.list('task-types').then(d => setTaskTypes(d.map(i => ({ value: i.id, label: i.name })))),
      masterApi.list('audiences').then(nb(setAudiences)),
      masterApi.list('business-objectives').then(nb(setBizObjs)),
      masterApi.list('languages').then(nb(setLanguages)),
      masterApi.list('tones').then(nb(setTones)),
      masterApi.list('offer-types').then(nb(setOfferTypes)),
      masterApi.list('supporting-proofs').then(nb(setSpTypes)),
      masterApi.list('budget-tiers').then(nb(setBudgets)),
      masterApi.list('vendor-types').then(nb(setVendorTs)),
      masterApi.list('kpi-types').then(nb(setKpis)),
      masterApi.list('expected-outputs').then(nb(setOutputs)),
      masterApi.list('granular-tasks').then(d => setAvailableTasks(d)),
      campaignsApi.getById(campaign.campaignId).then(res => {
        const c = res.data
        setExistingFiles(
          (c.fileUrls || []).map((url, i) => ({
            url,
            name: c.fileOriginalNames?.[i] || friendlyFileName(url, i),
            removed: false,
          }))
        )
        // Populate work tasks and deliverables from detail (list-view doesn't include them)
        if (c.workTasks?.length) {
          setDetailWorkTasks(c.workTasks)
          setLocalWorkTasks(c.workTasks.filter(t => t.status !== 'CANCELLED'))
        }
        if (c.deliverables?.length) setLocalDeliverables(c.deliverables)
        // Sync plain-text fields that list-view campaign object may not carry
        if (c.storeId       != null) setForm(prev => ({ ...prev, storeId:       c.storeId }))
        if (c.contactNumber != null) setForm(prev => ({ ...prev, contactNumber: c.contactNumber }))
      }).catch(() => {}),
    ]).catch(() => {}).finally(() => setLoadingMaster(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-populate selects once master data loaded
  useEffect(() => {
    if (loadingMaster || masterLoadedRef.current) return
    masterLoadedRef.current = true
    const resolveId = (allOpts, storedVal) => {
      if (!storedVal) return { selected: '', other: '' }
      return allOpts.find(o => o.value === storedVal && o.value !== 'Other')
        ? { selected: storedVal, other: '' }
        : { selected: 'Other', other: storedVal }
    }
    const resolveIdArr = (allOpts, storedJson) => {
      const rawArr    = parseJsonArr(storedJson)
      const knownIds  = rawArr.filter(v => allOpts.some(o => o.value === v && o.value !== 'Other'))
      const otherText = rawArr.filter(v => !allOpts.some(o => o.value === v))[0] || ''
      return { selected: [...knownIds, ...(otherText ? ['Other'] : [])], other: otherText }
    }
    const biz = resolveId(bizObjs,    campaign.businessObjectiveId)
    const off = resolveId(offerTypes, campaign.offerTypeId)
    const sp  = resolveId(spTypes,    campaign.supportingProofId)
    const bgt = resolveId(budgets,    campaign.budgetTierId)
    const kpi = resolveId(kpis,       campaign.kpiTypeId)
    const exp = resolveId(outputs,    campaign.expectedOutputId)
    const aud = resolveIdArr(audiences, campaign.audienceTypeId)
    const lng = resolveIdArr(languages, campaign.languageIds)
    const ton = resolveIdArr(tones,     campaign.toneIds)
    const vnd = resolveIdArr(vendorTs,  campaign.vendorTypeIds)
    setForm(prev => ({
      ...prev,
      businessObjective: biz.selected, businessObjectiveOther: biz.other,
      offerTypeId:       off.selected, offerTypeOther:         off.other,
      supportingProof:   sp.selected,  supportingProofOther:   sp.other,
      budgetTier:        bgt.selected, budgetTierOther:        bgt.other,
      kpiType:           kpi.selected, kpiTypeOther:           kpi.other,
      expectedOutput:    exp.selected, expectedOutputOther:    exp.other,
      audienceTypeIds:   aud.selected, audienceTypeOther:      aud.other,
      languages:         lng.selected, languageOther:          lng.other,
      tones:             ton.selected, toneOther:              ton.other,
      vendorTypeIds:     vnd.selected, vendorTypeOther:        vnd.other,
    }))
  }, [loadingMaster]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll-spy for sidebar nav
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const handler = () => {
      for (const { id } of [...EDIT_NAV].reverse()) {
        const sec = el.querySelector(`#${id}`)
        if (sec && sec.offsetTop - el.scrollTop <= 80) { setActiveSection(id); break }
      }
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [loadingMaster])

  const scrollTo = (id) => {
    const el = contentRef.current?.querySelector(`#${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Close Add-Tasks dropdown on outside click
  useEffect(() => {
    const h = (e) => {
      if (newTaskDropRef.current && !newTaskDropRef.current.contains(e.target))
        setNewTaskDropOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const setField    = (name, value) => setForm(prev => ({ ...prev, [name]: value }))
  const toggleMulti = (name, val)   => setForm(prev => {
    const arr = prev[name] || []
    return { ...prev, [name]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] }
  })

  // Existing task question helpers
  const toggleExistingTask = async (taskId, granularTaskId) => {
    if (expandedTask === taskId) { setExpandedTask(null); return }
    setExpandedTask(taskId)

    // Load questions if not already cached for this granular task type
    if (!existingTaskQs[granularTaskId]) {
      setLoadingExistQs(prev => ({ ...prev, [granularTaskId]: true }))
      try {
        const qs = await granularTasksApi.getQuestions(granularTaskId)
        setExistingTaskQs(prev => ({ ...prev, [granularTaskId]: qs || [] }))

        // Pre-fill existing answers
        if (taskId && qs?.length > 0 && !existingTaskAns[taskId]) {
          try {
            const rawAnswers = await tasksApi.getAnswers(taskId)
            const answerMap = {}
            for (const a of (rawAnswers?.data || [])) {
              answerMap[a.questionId] = a.answerValue ?? a.answer ?? ''
            }
            setExistingTaskAns(prev => ({ ...prev, [taskId]: answerMap }))
          } catch { /* answers optional — start blank */ }
        }
      } catch {
        setExistingTaskQs(prev => ({ ...prev, [granularTaskId]: [] }))
      } finally {
        setLoadingExistQs(prev => ({ ...prev, [granularTaskId]: false }))
      }
    } else if (taskId && !existingTaskAns[taskId]) {
      // Questions already loaded — just load answers for this specific task
      try {
        const rawAnswers = await tasksApi.getAnswers(taskId)
        const answerMap = {}
        for (const a of (rawAnswers?.data || [])) {
          answerMap[a.questionId] = a.answerValue ?? a.answer ?? ''
        }
        setExistingTaskAns(prev => ({ ...prev, [taskId]: answerMap }))
      } catch { /* answers optional */ }
    }
  }

  const updateExistingTaskAnswer = (workTaskId, questionId, value) =>
    setExistingTaskAns(prev => ({
      ...prev,
      [workTaskId]: { ...(prev[workTaskId] || {}), [questionId]: value },
    }))

  // Task helpers
  const toggleNewTask = (taskId) => {
    setNewTaskSelections(prev => {
      if (prev[taskId]) { const n = { ...prev }; delete n[taskId]; return n }
      return { ...prev, [taskId]: { granularTaskId: taskId, questionnaire: {}, stagedFiles: [] } }
    })
    if (!taskQuestions[taskId]) {
      setLoadingQs(prev => ({ ...prev, [taskId]: true }))
      granularTasksApi.getQuestions(taskId)
        .then(data => setTaskQuestions(prev => ({ ...prev, [taskId]: data || [] })))
        .catch(() => setTaskQuestions(prev => ({ ...prev, [taskId]: [] })))
        .finally(() => setLoadingQs(prev => ({ ...prev, [taskId]: false })))
    }
  }
  const updateTaskAnswer = (taskId, questionId, value) =>
    setNewTaskSelections(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], questionnaire: { ...prev[taskId]?.questionnaire, [questionId]: value } }
    }))

  /**
   * @param {string} taskId
   * @param {Array} files  - file entry objects { id, name, url, uploading, error, file? }
   * @param {boolean} patch - if true, update existing entries by id instead of appending
   */
  const addNewTaskStagedFiles = (taskId, files, patch = false) =>
    setNewTaskSelections(prev => {
      const existing = prev[taskId]?.stagedFiles || []
      const updated = patch
        ? existing.map(e => { const upd = files.find(f => f.id === e.id); return upd ? { ...e, ...upd } : e })
        : [...existing, ...files]
      return { ...prev, [taskId]: { ...prev[taskId], stagedFiles: updated } }
    })

  const removeNewTaskStagedFile = (taskId, urlOrId) =>
    setNewTaskSelections(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        stagedFiles: (prev[taskId]?.stagedFiles || []).filter(f => f.url !== urlOrId && f.id !== urlOrId),
      }
    }))

  // File helpers
  const uploadFiles = async (files) => {
    if (!files.length) return
    // Add per-file placeholder entries immediately
    const entries = Array.from(files).map(f => ({
      id: Math.random().toString(36).slice(2), name: f.name, url: null, uploading: true, error: null, file: f,
    }))
    setNewFiles(prev => [...prev, ...entries])
    setUploadingFiles(true)
    // Upload ONE AT A TIME — sequential to avoid overwhelming the image server
    for (const entry of entries) {
      let url = null; let errorMsg = null
      try {
        const fd = new FormData(); fd.append('files', entry.file)
        const res = await api.post('/upload/asset', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        url = res.data?.urls?.[0] || null
        if (!url) errorMsg = res.data?.errors?.[0] || 'Upload failed'
      } catch (err) {
        const raw = err?.response?.data?.message || err?.message || 'Upload failed'
        errorMsg = raw.length > 60 ? 'Upload failed' : raw
      }
      setNewFiles(prev => prev.map(f => f.id === entry.id
        ? { ...f, url, uploading: false, error: errorMsg }
        : f))
    }
    setUploadingFiles(false)
  }
  const retryNewFile = async (id) => {
    const entry = newFiles.find(f => f.id === id)
    if (!entry?.file) return
    setNewFiles(prev => prev.map(f => f.id === id ? { ...f, uploading: true, error: null } : f))
    setUploadingFiles(true)
    let url = null; let errorMsg = null
    try {
      const fd = new FormData(); fd.append('files', entry.file)
      const res = await api.post('/upload/asset', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      url = res.data?.urls?.[0] || null
      if (!url) errorMsg = res.data?.errors?.[0] || 'Upload failed'
    } catch (err) {
      const raw = err?.response?.data?.message || err?.message || 'Upload failed'
      errorMsg = raw.length > 60 ? 'Upload failed' : raw
    }
    setNewFiles(prev => prev.map(f => f.id === id ? { ...f, url, uploading: false, error: errorMsg } : f))
    setUploadingFiles(false)
  }
  const handleFileSelect = (e) => { const s = Array.from(e.target.files); e.target.value = ''; uploadFiles(s) }
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); uploadFiles(Array.from(e.dataTransfer.files)) }

  const toggleRemoveExisting = (url) =>
    setExistingFiles(prev => prev.map(f => f.url === url ? { ...f, removed: !f.removed } : f))

  const handleSave = async () => {
    for (const taskId of Object.keys(newTaskSelections)) {
      const qs  = taskQuestions[taskId] || []
      const ans = newTaskSelections[taskId]?.questionnaire || {}
      for (const q of qs) {
        if (!(q.required ?? q.isRequired)) continue
        const v = ans[q.questionId]
        const empty = q.fieldType === 'MULTISELECT'
          ? (() => { try { return JSON.parse(v || '[]').length === 0 } catch { return true } })()
          : (v == null || String(v).trim() === '')
        if (empty) {
          const task = availableTasks.find(t => String(t.taskId) === taskId)
          showToast(`"${q.questionText}" is required for task "${task?.taskName || taskId}".`, 'error')
          return
        }
      }
    }
    if (!form.contactNumber?.trim()) {
      showToast('Contact Number is required.', 'error')
      return
    }
    setSaving(true)
    try {
      // Apply staged task deletions first
      for (const taskId of pendingTaskDeletions) {
        await campaignsApi.deleteTask(campaign.campaignId, taskId)
        setLocalWorkTasks(prev => prev.filter(t => t.taskId !== taskId))
      }
      setPendingTaskDeletions(new Set())

      const resolve     = (val, other) => val === 'Other' ? (other?.trim() || null) : (val || null)
      const resolveArr  = (arr, other) => {
        const r = arr.filter(v => v !== 'Other')
        if (arr.includes('Other') && other?.trim()) r.push(other.trim())
        return r.length ? r : null
      }
      const newTaskSpecs = Object.keys(newTaskSelections).map(taskId => {
        const qn      = newTaskSelections[taskId]?.questionnaire || {}
        const answers = Object.entries(qn)
          .filter(([, v]) => v != null && String(v).trim() !== '')
          .map(([questionId, answerValue]) => ({ questionId, answerValue }))
        const staged    = (newTaskSelections[taskId]?.stagedFiles || []).filter(f => f.url)
        const fileUrls  = staged.map(f => f.url)
        const fileNames = staged.map(f => f.name || f.url.split('/').pop())
        return {
          granularTaskId: taskId,
          questionnaireAnswers: answers,
          ...(fileUrls.length > 0 && { fileUrls, fileOriginalNames: fileNames }),
        }
      })
      const payload = {
        departmentId:      form.departmentId || null,
        storeId:           form.storeId?.trim()       || null,
        contactNumber:     form.contactNumber?.trim() || null,
        businessObjective: resolve(form.businessObjective, form.businessObjectiveOther),
        audienceTypeId:    resolveArr(form.audienceTypeIds, form.audienceTypeOther),
        language:          resolveArr(form.languages, form.languageOther),
        hasOffer:          form.hasOffer,
        offerTypeId:       form.hasOffer === 'YES' ? resolve(form.offerTypeId, form.offerTypeOther) : null,
        keyMessage:        form.hasOffer === 'YES' ? form.keyMessage || null : null,
        supportingProof:   form.hasOffer === 'YES' ? resolve(form.supportingProof, form.supportingProofOther) : null,
        tone:              resolveArr(form.tones, form.toneOther),
        priority:          form.priority || null,
        budgetTier:        resolve(form.budgetTier, form.budgetTierOther),
        vendorRequired:    form.vendorRequired,
        vendorType:        form.vendorRequired === 'YES' ? resolveArr(form.vendorTypeIds, form.vendorTypeOther) : null,
        kpiType:           resolve(form.kpiType, form.kpiTypeOther),
        expectedOutput:    resolve(form.expectedOutput, form.expectedOutputOther),
        targetLocation:    serializeTargetLocations(targetLocations),
        newTaskSpecs:      newTaskSpecs.length > 0 ? newTaskSpecs : undefined,
        newFileUrls:          newFiles.filter(f => f.url).map(f => f.url),
        newFileOriginalNames: newFiles.filter(f => f.url).map(f => f.name || f.url.split('/').pop()),
        removedFileUrls:      existingFiles.filter(f => f.removed).map(f => f.url),
      }
      await campaignsApi.requestorEdit(campaign.campaignId, payload)

      // Process task file removals (marked for removal in task panels)
      for (const [taskId, urlSet] of Object.entries(taskFileRemovals)) {
        for (const url of urlSet) {
          try { await tasksApi.removeTaskFile(taskId, url) } catch { /* continue on error */ }
        }
      }
      if (Object.values(taskFileRemovals).some(s => s.size > 0)) {
        setTaskFileRemovals({})
      }

      // Persist any edited questionnaire answers for existing tasks
      const answerSaves = Object.entries(existingTaskAns).map(async ([workTaskId, ansMap]) => {
        const answers = Object.entries(ansMap)
          .filter(([, v]) => v != null && String(v).trim() !== '')
          .map(([questionId, answerValue]) => ({ questionId, answerValue }))
        if (answers.length > 0) {
          await tasksApi.submitAnswers(workTaskId, answers)
        }
      })
      await Promise.all(answerSaves)

      showToast('Campaign updated successfully!', 'success')
      onSuccess()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save changes.', 'error')
    } finally { setSaving(false) }
  }

  // Task deletion is now staged — actual API call happens in handleSave

  const handleDeleteCampaign = async () => {
    setDeletingCampaign(true)
    try {
      await campaignsApi.deleteCampaign(campaign.campaignId)
      showToast('Campaign deleted successfully.', 'success')
      onSuccess()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to delete campaign.', 'error')
      setDeletingCampaign(false)
      setConfirmDeleteCampaign(false)
    }
  }

  // Filter tasks available to add:
  // 1. exclude tasks already in this campaign
  // 2. when task types are selected, only show tasks matching those types (normalize both sides
  //    to strings — form values may be numbers or strings depending on how they were loaded)
  const selectedTypeStrs = form.taskTypeId.map(String)
  const newTasks = availableTasks
    .filter(t => t.taskId !== 'TASK-AUTO-CONTENT')
    .filter(t => !existingIds.has(String(t.taskId)))
    .filter(t => selectedTypeStrs.length === 0 || selectedTypeStrs.includes(String(t.taskTypeId)))
  const inputCls   = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 transition'
  const removedCount = existingFiles.filter(f => f.removed).length

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[92vh]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-gradient-to-r from-brand-50 to-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
              <Icon name="edit" className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Edit Campaign <span className="text-brand-600">#{campaign.campaignId}</span></h3>
              <p className="text-xs text-slate-500">Update details · Add tasks · Manage files</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CampaignStatusBadge status={campaign.status} />
            <button onClick={onClose} className="ml-2 rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loadingMaster ? (
          <div className="flex-1 flex items-center justify-center gap-3 py-20 text-slate-400">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span className="text-sm font-medium">Loading form data…</span>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">

            {/* ── Sidebar nav ── */}
            <nav className="w-44 shrink-0 border-r border-slate-100 py-4 px-3 space-y-0.5 overflow-y-auto bg-slate-50/60">
              {EDIT_NAV.map(s => (
                <button key={s.id} type="button" onClick={() => scrollTo(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition
                    ${activeSection === s.id
                      ? 'bg-brand-100 text-brand-700 shadow-sm'
                      : 'text-slate-500 hover:bg-white hover:text-slate-800'}`}>
                  <Icon name={s.icon} className="h-3.5 w-3.5 shrink-0" />
                  {s.label}
                </button>
              ))}
            </nav>

            {/* ── Scrollable content ── */}
            <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* 1 – Campaign Info */}
              <SectionCard id="campaign-info" title="Campaign Info" icon="fileText" accent="brand">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Department</FieldLabel>
                    <EditSelect value={form.departmentId} onChange={v => setField('departmentId', v)} options={depts} placeholder="Select department…" />
                  </div>
                  <div>
                    <FieldLabel>Business Objective</FieldLabel>
                    <EditSelect value={form.businessObjective}
                      onChange={v => { setField('businessObjective', v); if (v !== 'Other') setField('businessObjectiveOther', '') }}
                      options={bizObjs} />
                    {form.businessObjective === 'Other' && (
                      <input className={`mt-2 ${inputCls}`} value={form.businessObjectiveOther}
                        onChange={e => setField('businessObjectiveOther', e.target.value)} placeholder="Describe the objective…" />
                    )}
                  </div>
                  <div>
                    <FieldLabel>Task Type <span className="text-slate-400 font-normal">(filter only)</span></FieldLabel>
                    <EditMultiSelect values={form.taskTypeId}
                      onToggle={v => toggleMulti('taskTypeId', v)}
                      options={taskTypes} />
                  </div>
                  <div>
                    <FieldLabel>Target Locations</FieldLabel>
                    <MapplsLocationMultiSelect
                      value={targetLocations}
                      onChange={setTargetLocations}
                      placeholder="Search state, city, district or locality…"
                      visibleLimit={3}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div>
                    <FieldLabel>Store ID</FieldLabel>
                    <input className={inputCls} value={form.storeId}
                      onChange={e => setField('storeId', e.target.value)}
                      placeholder="Enter store ID…" />
                  </div>
                  <div>
                    <FieldLabel>Contact Number <span className="text-red-500">*</span></FieldLabel>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      className={`${inputCls} ${!form.contactNumber?.trim() ? 'border-red-300 focus:ring-red-200 focus:border-red-400' : ''}`}
                      value={form.contactNumber}
                      onChange={e => setField('contactNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Enter contact number…" />
                  </div>
                </div>
              </SectionCard>

              {/* 2 – Audience & Tone */}
              <SectionCard id="audience" title="Audience & Tone" icon="users" accent="violet">
                <div className="space-y-4">
                  <div>
                    <FieldLabel>Audience Type</FieldLabel>
                    <EditMultiSelect values={form.audienceTypeIds} onToggle={v => toggleMulti('audienceTypeIds', v)} options={audiences} />
                    {form.audienceTypeIds.includes('Other') && (
                      <input className={`mt-2 ${inputCls}`} value={form.audienceTypeOther}
                        onChange={e => setField('audienceTypeOther', e.target.value)} placeholder="Describe the audience…" />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>Language</FieldLabel>
                      <EditMultiSelect values={form.languages} onToggle={v => toggleMulti('languages', v)} options={languages} />
                      {form.languages.includes('Other') && (
                        <input className={`mt-2 ${inputCls}`} value={form.languageOther}
                          onChange={e => setField('languageOther', e.target.value)} placeholder="Specify language…" />
                      )}
                    </div>
                    <div>
                      <FieldLabel>Tone / Style</FieldLabel>
                      <EditMultiSelect values={form.tones} onToggle={v => toggleMulti('tones', v)} options={tones} />
                      {form.tones.includes('Other') && (
                        <input className={`mt-2 ${inputCls}`} value={form.toneOther}
                          onChange={e => setField('toneOther', e.target.value)} placeholder="Specify tone…" />
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* 3 – Offer & Messaging */}
              <SectionCard id="offer" title="Offer & Messaging" icon="tag" accent="amber">
                <YesNoToggle value={form.hasOffer} onChange={v => setField('hasOffer', v)} label="Campaign has an offer?" />
                {form.hasOffer === 'YES' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    <div>
                      <FieldLabel>Offer Type</FieldLabel>
                      <EditSelect value={form.offerTypeId}
                        onChange={v => { setField('offerTypeId', v); if (v !== 'Other') setField('offerTypeOther', '') }}
                        options={offerTypes} />
                      {form.offerTypeId === 'Other' && (
                        <input className={`mt-2 ${inputCls}`} value={form.offerTypeOther}
                          onChange={e => setField('offerTypeOther', e.target.value)} placeholder="Specify…" />
                      )}
                    </div>
                    <div>
                      <FieldLabel>Supporting Proof</FieldLabel>
                      <EditSelect value={form.supportingProof}
                        onChange={v => { setField('supportingProof', v); if (v !== 'Other') setField('supportingProofOther', '') }}
                        options={spTypes} />
                      {form.supportingProof === 'Other' && (
                        <input className={`mt-2 ${inputCls}`} value={form.supportingProofOther}
                          onChange={e => setField('supportingProofOther', e.target.value)} placeholder="Specify…" />
                      )}
                    </div>
                    <div>
                      <FieldLabel>Key Message</FieldLabel>
                      <textarea rows={3} value={form.keyMessage}
                        onChange={e => setField('keyMessage', e.target.value)}
                        className={`${inputCls} resize-none`} placeholder="Core offer message…" />
                    </div>
                  </div>
                )}
              </SectionCard>

              {/* 4 – Budget & KPIs */}
              <SectionCard id="budget" title="Budget & KPIs" icon="trendingUp" accent="emerald">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <FieldLabel>Priority</FieldLabel>
                    <EditSelect value={form.priority} onChange={v => setField('priority', v)}
                      options={[{value:'HIGH',label:'High'},{value:'MEDIUM',label:'Medium'},{value:'LOW',label:'Low'}]} />
                  </div>
                  <div>
                    <FieldLabel>Budget Tier</FieldLabel>
                    <EditSelect value={form.budgetTier}
                      onChange={v => { setField('budgetTier', v); if (v !== 'Other') setField('budgetTierOther', '') }}
                      options={budgets} />
                    {form.budgetTier === 'Other' && (
                      <input className={`mt-2 ${inputCls}`} value={form.budgetTierOther}
                        onChange={e => setField('budgetTierOther', e.target.value)} placeholder="Specify budget…" />
                    )}
                  </div>
                  <div>
                    <FieldLabel>KPI Type</FieldLabel>
                    <EditSelect value={form.kpiType}
                      onChange={v => { setField('kpiType', v); if (v !== 'Other') setField('kpiTypeOther', '') }}
                      options={kpis} />
                    {form.kpiType === 'Other' && (
                      <input className={`mt-2 ${inputCls}`} value={form.kpiTypeOther}
                        onChange={e => setField('kpiTypeOther', e.target.value)} placeholder="Specify KPI…" />
                    )}
                  </div>
                  <div>
                    <FieldLabel>Expected Output</FieldLabel>
                    <EditSelect value={form.expectedOutput}
                      onChange={v => { setField('expectedOutput', v); if (v !== 'Other') setField('expectedOutputOther', '') }}
                      options={outputs} />
                    {form.expectedOutput === 'Other' && (
                      <input className={`mt-2 ${inputCls}`} value={form.expectedOutputOther}
                        onChange={e => setField('expectedOutputOther', e.target.value)} placeholder="Specify output…" />
                    )}
                  </div>
                </div>
                <div className="pt-1">
                  <YesNoToggle value={form.vendorRequired}
                    onChange={v => { setField('vendorRequired', v); if (v === 'NO') { setField('vendorTypeIds', []); setField('vendorTypeOther', '') } }}
                    label="Vendor required?" />
                  {form.vendorRequired === 'YES' && (
                    <div className="mt-3 pl-1">
                      <FieldLabel>Vendor Type</FieldLabel>
                      <EditMultiSelect values={form.vendorTypeIds} onToggle={v => toggleMulti('vendorTypeIds', v)} options={vendorTs} />
                      {form.vendorTypeIds.includes('Other') && (
                        <input className={`mt-2 ${inputCls}`} value={form.vendorTypeOther}
                          onChange={e => setField('vendorTypeOther', e.target.value)} placeholder="Specify vendor type…" />
                      )}
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* 5 – Tasks */}
              <SectionCard id="tasks" title="Tasks" icon="checkSquare" accent="sky">
                {/* Existing tasks — expandable to view/edit task questions */}
                {localWorkTasks.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Existing Tasks
                      <span className="ml-1 normal-case font-normal text-slate-400">· click to edit answers · trash = mark for deletion · restore to undo · applied on Save</span>
                    </p>
                    <div className="space-y-2">
                      {localWorkTasks.map(d => {
                        const deletable      = canDeleteTask(d)
                        const markedDelete   = pendingTaskDeletions.has(d.taskId)
                        const taskName       = d.granularTaskName || d.granularTaskId
                        const statusLabel    = d.status ? d.status.replace(/_/g, ' ') : 'PENDING'
                        const isExpanded     = !markedDelete && expandedTask === d.taskId
                        const qs             = existingTaskQs[d.granularTaskId] || []
                        const ans            = existingTaskAns[d.taskId] || {}
                        const loadingQ       = loadingExistQs[d.granularTaskId]

                        const statusColors = {
                          ASSIGNED:             'text-blue-600 bg-blue-50',
                          HELD:                 'text-amber-600 bg-amber-50',
                          ACCEPTED:             'text-indigo-600 bg-indigo-50',
                          IN_PROGRESS:          'text-emerald-600 bg-emerald-50',
                          MANAGER_QC_REVIEW:    'text-purple-600 bg-purple-50',
                          REQUESTOR_QC_REVIEW:  'text-violet-600 bg-violet-50',
                          REWORK:               'text-orange-600 bg-orange-50',
                          COMPLETED:            'text-green-600 bg-green-50',
                          CANCELLED:            'text-slate-500 bg-slate-100',
                        }
                        const statusCls = statusColors[d.status] || 'text-slate-500 bg-slate-100'

                        return (
                          <div key={d.taskId}
                            className={`rounded-xl border-2 transition ${
                              markedDelete   ? 'border-red-300 bg-red-50 opacity-60'
                              : isExpanded   ? 'border-sky-300 bg-sky-50/30'
                              : 'border-slate-200 bg-white hover:border-sky-200'
                            }`}>
                            {/* Task header row */}
                            <div className="flex items-center gap-2 px-3 py-2">
                              {/* Expand/collapse toggle */}
                              <button type="button"
                                onClick={() => !markedDelete && toggleExistingTask(d.taskId, d.granularTaskId)}
                                className="flex items-center gap-2 flex-1 text-left min-w-0"
                                title={markedDelete ? 'Marked for deletion' : 'Click to view / edit task-specific questions'}>
                                <Icon
                                  name="chevron"
                                  className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                                />
                                <span className={`text-xs font-semibold shrink-0 ${markedDelete ? 'line-through text-red-400' : 'text-brand-700'}`}>{d.taskId}</span>
                                <span className={`text-sm font-medium truncate ${markedDelete ? 'line-through text-red-400' : 'text-slate-700'}`}>{taskName}</span>
                                {markedDelete && (
                                  <span className="text-xs text-red-500 font-medium shrink-0">· Will be deleted on save</span>
                                )}
                              </button>

                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0 ${statusCls} ${d.status === 'HELD' ? 'animate-pulse ring-1 ring-amber-400' : ''}`}>
                                {statusLabel}
                              </span>

                              {deletable ? (
                                markedDelete ? (
                                  <button type="button"
                                    onClick={() => toggleTaskDeletion(d.taskId)}
                                    title="Restore task"
                                    className="shrink-0 flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
                                    <Icon name="refresh" className="h-3 w-3" />
                                    Restore
                                  </button>
                                ) : (
                                  <button type="button"
                                    onClick={() => toggleTaskDeletion(d.taskId)}
                                    title="Mark task for deletion"
                                    className="shrink-0 rounded-full p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
                                    <Icon name="trash" className="h-3.5 w-3.5" />
                                  </button>
                                )
                              ) : (
                                <span title={`Cannot delete — task is ${statusLabel}`}
                                  className="shrink-0 rounded-full p-1.5 text-slate-200 cursor-not-allowed">
                                  <Icon name="trash" className="h-3.5 w-3.5" />
                                </span>
                              )}
                            </div>

                            {/* Expandable questionnaire + files panel */}
                            {isExpanded && (() => {
                              const READONLY_STATUSES = new Set(['COMPLETED','IN_PROGRESS','MANAGER_QC_REVIEW','REQUESTOR_QC_REVIEW','REWORK','ACCEPTED'])
                              const isReadOnly = READONLY_STATUSES.has(d.status)
                              return (
                                <div className="border-t border-sky-200 px-4 pb-4 pt-3 space-y-4 bg-sky-50/20">
                                  {isReadOnly && (
                                    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                      <Icon name="lock" className="h-3.5 w-3.5 shrink-0" />
                                      Read-only — task is {d.status?.replace(/_/g,' ')}. Editing not allowed.
                                    </div>
                                  )}

                                  {/* Questions section */}
                                  <div className="space-y-3">
                                    {loadingQ ? (
                                      <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                        </svg>
                                        Loading questions…
                                      </div>
                                    ) : qs.length === 0 ? (
                                      <p className="text-xs text-slate-400 italic">No task-specific questions for this task type.</p>
                                    ) : (
                                      <>
                                        <p className="text-xs text-sky-700 font-medium">Task-specific answers</p>
                                        {qs.map(q => (
                                          <TaskQuestion
                                            key={q.questionId}
                                            q={q}
                                            answer={ans[q.questionId] ?? ''}
                                            onChange={isReadOnly ? undefined : (v => updateExistingTaskAnswer(d.taskId, q.questionId, v))}
                                            readOnly={isReadOnly}
                                          />
                                        ))}
                                      </>
                                    )}
                                  </div>

                                  {/* Task-level reference files */}
                                  <div className="pt-3 border-t border-sky-200">
                                    <TaskFilesPanel
                                      workTask={d}
                                      campaign={campaign}
                                      readOnly={isReadOnly}
                                      onChanged={async () => {
                                        try {
                                          const res = await campaignsApi.getById(campaign.campaignId)
                                          if (res.data?.workTasks) setDetailWorkTasks(res.data.workTasks)
                                        } catch { /* ignore */ }
                                      }}
                                      markedUrls={isReadOnly ? [] : [...(taskFileRemovals[d.taskId] || [])]}
                                      onToggleRemoval={isReadOnly ? undefined : ((url) => toggleTaskFileRemoval(d.taskId, url))}
                                    />
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Add new tasks — multi-search-select + per-task question/file cards */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Add More Tasks
                    {Object.keys(newTaskSelections).length > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center h-4 w-4 rounded-full bg-brand-600 text-white text-[10px] font-bold">
                        {Object.keys(newTaskSelections).length}
                      </span>
                    )}
                  </p>
                  {newTasks.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">All available tasks are already in this campaign.</p>
                  ) : (
                    <div className="space-y-3">
                      {/* Multi-search-select dropdown */}
                      <div ref={newTaskDropRef} className="relative">
                        {/* Trigger chip row */}
                        <div
                          onClick={() => setNewTaskDropOpen(o => !o)}
                          className="min-h-[38px] flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 cursor-pointer hover:border-brand-400 transition">
                          {Object.keys(newTaskSelections).length === 0 ? (
                            <span className="text-sm text-slate-400 select-none">Search and select tasks to add…</span>
                          ) : (
                            Object.keys(newTaskSelections).map(tid => {
                              const t = newTasks.find(x => String(x.taskId) === String(tid))
                              return (
                                <span key={tid} className="inline-flex items-center gap-1 rounded-full bg-brand-100 text-brand-800 text-xs font-medium px-2 py-0.5">
                                  {t?.taskName || tid}
                                  <button type="button" onClick={e => { e.stopPropagation(); toggleNewTask(tid) }}
                                    className="ml-0.5 rounded-full hover:bg-brand-200 p-0.5 transition">
                                    <Icon name="x" className="h-2.5 w-2.5" />
                                  </button>
                                </span>
                              )
                            })
                          )}
                          <Icon name="chevron"
                            className={`ml-auto h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform ${newTaskDropOpen ? 'rotate-90' : ''}`} />
                        </div>

                        {/* Dropdown panel */}
                        {newTaskDropOpen && (
                          <div className="absolute z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                            <div className="px-3 py-2 border-b border-slate-100">
                              <input autoFocus type="text" value={newTaskSearch}
                                onChange={e => setNewTaskSearch(e.target.value)}
                                placeholder="Search tasks…"
                                className="w-full text-sm rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5
                                  focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition"
                                onClick={e => e.stopPropagation()} />
                            </div>
                            <ul className="max-h-52 overflow-y-auto">
                              {newTasks
                                .filter(t => !newTaskSearch || t.taskName.toLowerCase().includes(newTaskSearch.toLowerCase()))
                                .map(t => {
                                  const isSel = Boolean(newTaskSelections[String(t.taskId)])
                                  return (
                                    <li key={t.taskId}>
                                      <button type="button"
                                        onClick={() => { toggleNewTask(String(t.taskId)); setNewTaskSearch('') }}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition
                                          ${isSel ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-slate-50'}`}>
                                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition
                                          ${isSel ? 'border-brand-500 bg-brand-500' : 'border-slate-300 bg-white'}`}>
                                          {isSel && <Icon name="check" className="h-2.5 w-2.5 text-white" />}
                                        </span>
                                        <span className="flex-1">{t.taskName}</span>
                                        {t.taskTypeName && (
                                          <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 shrink-0">{t.taskTypeName}</span>
                                        )}
                                      </button>
                                    </li>
                                  )
                                })}
                              {newTasks.filter(t => !newTaskSearch || t.taskName.toLowerCase().includes(newTaskSearch.toLowerCase())).length === 0 && (
                                <li className="px-4 py-3 text-xs text-slate-400 italic">No tasks match.</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Per-task cards */}
                      {Object.keys(newTaskSelections).length > 0 && (
                        <div className="space-y-3">
                          {Object.keys(newTaskSelections).map(tid => {
                            const t       = newTasks.find(x => String(x.taskId) === String(tid))
                            const qs      = taskQuestions[tid] || []
                            const loadQs  = loadingQs[tid]
                            const staged  = newTaskSelections[tid]?.stagedFiles || []
                            return (
                              <div key={tid} className="rounded-xl border-2 border-brand-200 bg-brand-50/30">
                                {/* Card header */}
                                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-brand-100">
                                  <span className="text-sm font-semibold text-slate-800 flex-1">{t?.taskName || tid}</span>
                                  {t?.taskTypeName && (
                                    <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5">{t.taskTypeName}</span>
                                  )}
                                  <button type="button" onClick={() => toggleNewTask(tid)}
                                    className="shrink-0 rounded-full p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                                    title="Remove this task">
                                    <Icon name="x" className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                {/* Questions */}
                                <div className="px-4 pt-3 pb-4 space-y-3">
                                  {loadQs ? (
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                      <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                      </svg>
                                      Loading questions…
                                    </div>
                                  ) : qs.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No task-specific questions.</p>
                                  ) : (
                                    qs.map(q => (
                                      <TaskQuestion key={q.questionId} q={q}
                                        answer={newTaskSelections[tid]?.questionnaire?.[q.questionId]}
                                        onChange={v => updateTaskAnswer(tid, q.questionId, v)} />
                                    ))
                                  )}

                                  {/* Per-task file upload */}
                                  <div className="pt-3 border-t border-brand-100">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                      Reference Files
                                      {staged.filter(f => f.url).length > 0 && (
                                        <span className="ml-1.5 normal-case font-medium text-brand-600">
                                          ({staged.filter(f => f.url).length})
                                        </span>
                                      )}
                                    </p>
                                    <NewTaskFileUpload
                                      taskId={tid}
                                      stagedFiles={staged}
                                      onFilesAdd={addNewTaskStagedFiles}
                                      onFileRemove={removeNewTaskStagedFile}
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* 6 – Files */}
              <SectionCard id="files" title="Campaign Files" icon="paperclip" accent="rose">
                {/* Existing files */}
                {existingFiles.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Uploaded Files
                      {removedCount > 0 && (
                        <span className="ml-2 text-red-500 normal-case font-medium">({removedCount} marked for removal)</span>
                      )}
                    </p>
                    <ul className="space-y-1.5">
                      {existingFiles.map((f, i) => (
                        <li key={i}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition
                            ${f.removed ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                          <Icon name="fileText" className={`h-4 w-4 shrink-0 ${f.removed ? 'text-red-400' : 'text-brand-500'}`} />
                          <a href={f.url} target="_blank" rel="noopener noreferrer"
                            className={`flex-1 text-sm truncate ${f.removed ? 'line-through text-slate-400' : 'text-brand-600 hover:underline'}`}>
                            {f.name}
                          </a>
                          <button type="button" onClick={() => toggleRemoveExisting(f.url)}
                            title={f.removed ? 'Undo remove' : 'Remove file'}
                            className={`shrink-0 rounded-full p-1 transition ${f.removed
                              ? 'bg-red-100 text-red-500 hover:bg-red-200'
                              : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}>
                            {f.removed
                              ? <Icon name="undo" className="h-3.5 w-3.5" />
                              : <Icon name="trash" className="h-3.5 w-3.5" />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* New file upload */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Add New Files</p>
                  {/* Drop zone */}
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer py-7 transition
                      ${dragOver ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-slate-50/50 hover:border-brand-300 hover:bg-brand-50/30'}`}>
                    {uploadingFiles ? (
                      <svg className="h-6 w-6 animate-spin text-brand-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                    ) : (
                      <Icon name="upload" className={`h-7 w-7 ${dragOver ? 'text-brand-500' : 'text-slate-400'}`} />
                    )}
                    <p className={`text-sm font-medium ${dragOver ? 'text-brand-600' : 'text-slate-500'}`}>
                      {uploadingFiles ? 'Uploading…' : 'Click or drag files here'}
                    </p>
                    <p className="text-xs text-slate-400">Supports images, PDFs, documents</p>
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
                  </div>

                  {/* Newly added files list */}
                  {newFiles.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {newFiles.map(f => (
                        <li key={f.id} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs
                          ${f.error ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
                          {f.uploading ? (
                            <svg className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                          ) : f.error ? (
                            <Icon name="alertCircle" className="h-3.5 w-3.5 shrink-0 text-red-400" />
                          ) : (
                            <Icon name="fileText" className="h-3.5 w-3.5 shrink-0 text-red-400" />
                          )}
                          <span className={`flex-1 truncate ${f.error ? 'text-red-600' : 'text-slate-700'}`}>
                            {f.error ? `${f.name} — ${f.error}` : f.name}
                          </span>
                          {f.uploading && <span className="shrink-0 text-slate-400">Uploading…</span>}
                          {f.error && f.file && (
                            <button type="button" onClick={() => retryNewFile(f.id)}
                              className="shrink-0 text-xs font-medium text-brand-600 hover:underline">Retry</button>
                          )}
                          {f.url && !f.uploading && (
                            <a href={f.url} target="_blank" rel="noopener noreferrer"
                              className="shrink-0 font-medium text-brand-600 hover:underline">View</a>
                          )}
                          {!f.uploading && (
                            <button type="button" onClick={() => setNewFiles(p => p.filter(x => x.id !== f.id))}
                              className="shrink-0 rounded-full p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
                              <Icon name="x" className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </SectionCard>


            </div>{/* end scrollable content */}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="border-t border-slate-100 shrink-0 bg-slate-50/50 rounded-b-2xl">

          {/* Delete campaign confirmation bar */}
          {confirmDeleteCampaign && (
            <div className="flex items-center gap-3 px-6 py-3 bg-red-50 border-b border-red-200">
              <Icon name="alertCircle" className="h-4 w-4 text-red-500 shrink-0" />
              <span className="flex-1 text-sm text-red-700 font-medium">
                Permanently delete campaign #{campaign.campaignId} and all its data? This cannot be undone.
              </span>
              <button type="button" disabled={deletingCampaign}
                onClick={handleDeleteCampaign}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition">
                {deletingCampaign
                  ? <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  : <Icon name="trash" className="h-3.5 w-3.5" />}
                Yes, delete campaign
              </button>
              <button type="button" onClick={() => setConfirmDeleteCampaign(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white transition">
                Cancel
              </button>
            </div>
          )}

          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4 text-xs text-slate-500">
              {Object.keys(newTaskSelections).length > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white text-[10px] font-bold">{Object.keys(newTaskSelections).length}</span>
                  new task{Object.keys(newTaskSelections).length !== 1 ? 's' : ''} to add
                </span>
              )}
              {newFiles.filter(f => f.url).length > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-bold">{newFiles.filter(f => f.url).length}</span>
                  new file{newFiles.filter(f => f.url).length !== 1 ? 's' : ''} to upload
                </span>
              )}
              {pendingTaskDeletions.size > 0 && (
                <span className="flex items-center gap-1.5 text-red-500">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">{pendingTaskDeletions.size}</span>
                  task{pendingTaskDeletions.size !== 1 ? 's' : ''} to delete
                </span>
              )}
              {removedCount > 0 && (
                <span className="flex items-center gap-1.5 text-red-500">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">{removedCount}</span>
                  file{removedCount !== 1 ? 's' : ''} to remove
                </span>
              )}
              {(() => {
                const taskRemovedCount = Object.values(taskFileRemovals).reduce((sum, s) => sum + s.size, 0)
                return taskRemovedCount > 0 ? (
                  <span className="flex items-center gap-1.5 text-red-500">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">{taskRemovedCount}</span>
                    task file{taskRemovedCount !== 1 ? 's' : ''} to remove
                  </span>
                ) : null
              })()}
            </div>
            <div className="flex items-center gap-3">
              {/* Delete campaign button — only when no tasks have started */}
              {canDeleteCampaign && !confirmDeleteCampaign && (
                <button type="button" onClick={() => setConfirmDeleteCampaign(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 hover:border-red-300 transition">
                  <Icon name="trash" className="h-3.5 w-3.5" /> Delete Campaign
                </button>
              )}
              <button onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition shadow-sm">
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Saving…
                  </>
                ) : (
                  <><Icon name="check" className="h-4 w-4" /> Save Changes</>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Helpers shared with CampaignRow ─────────────────────────────────────────

const fmtRequestorDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'

const ROW_TERMINAL = ['COMPLETED', 'REJECTED', 'CANCELLED']

const REQUEST_TABLE_COLS = [128, 112, 132, 92, 124, 52, 248]
const REQUEST_TABLE_MIN_WIDTH = REQUEST_TABLE_COLS.reduce((s, w) => s + w, 0)
const requestorCellCls = 'min-w-0 overflow-hidden px-4 py-3'

// ─── Memoised table row for RequestorCampaignView ────────────────────────────

const CampaignRow = memo(function CampaignRow({
  campaign: c,
  bookmarkingId,
  isLoading,
  onToggleBookmark,
  onViewBrief,
  onClone,
  onEdit,
}) {
  const taskCount           = c.taskCount ?? (c.workTasks || []).length
  const doneCount           = c.completedTaskCount ?? (c.workTasks || []).filter(t => t.status === 'COMPLETED').length
  const hasRework           = c.hasRework   ?? (c.workTasks || []).some(t => t.status === 'REWORK')
  const hasQcReview         = c.hasQcReview ?? (c.workTasks || []).some(t => t.status === 'MANAGER_QC_REVIEW' || t.status === 'REQUESTOR_QC_REVIEW')
  const hasUnansweredComments = !!c.hasUnansweredComments
  const canEdit             = !ROW_TERMINAL.includes(c.status)
  const isBookmarked        = !!c.bookmarked

  return (
    <tr className={`transition hover:bg-slate-50/70 ${hasUnansweredComments ? 'bg-sky-50/40' : ''}`}>
      <td className={requestorCellCls}>
        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-600">{c.campaignId}</span>
      </td>
      <td className={requestorCellCls}><PriorityBadge priority={c.priority} /></td>
      <td className={requestorCellCls}>
        <CampaignStatusBadge status={c.status} />
      </td>
      <td className={`${requestorCellCls} text-slate-600`}>
        <div className="flex items-center gap-2 flex-wrap">
          {taskCount === 0
            ? <span className="italic text-slate-400">None yet</span>
            : <span>{doneCount}/{taskCount} done</span>}
          {hasRework && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 ring-1 ring-orange-200">
              ↩ Rework
            </span>
          )}
          {hasQcReview && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 ring-1 ring-purple-200">
              ⏳ QC
            </span>
          )}
          {hasUnansweredComments && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500" />
              </span>
              New comment
            </span>
          )}
        </div>
      </td>
      <td className={`${requestorCellCls} text-slate-500`}>{fmtRequestorDate(c.createdAt)}</td>

      {/* Bookmark toggle */}
      <td className="min-w-0 px-2 py-3 text-center">
        <button
          onClick={(e) => onToggleBookmark(e, c.campaignId)}
          disabled={bookmarkingId === c.campaignId}
          title={isBookmarked ? 'Remove bookmark' : 'Bookmark this request'}
          className={`rounded p-1 transition ${isBookmarked
            ? 'text-amber-500 hover:text-amber-700'
            : 'text-slate-300 hover:text-amber-400'}`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24"
            fill={isBookmarked ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
        </button>
      </td>

      <td className={`${requestorCellCls} text-right`}>
        <div className="flex flex-wrap items-center justify-end gap-1.5 pr-1">
          <button
            type="button"
            onClick={() => onViewBrief(c.campaignId)}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800"
          >
            <Icon name="eye" className="h-3.5 w-3.5" /> Brief
          </button>
          <button
            type="button"
            onClick={(e) => onClone(e, c.campaignId)}
            title="Clone this request"
            className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
          >
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            Clone
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => onEdit(c)}
              disabled={isLoading}
              title={isLoading ? 'Loading…' : 'Edit campaign'}
              className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="edit" className="h-3.5 w-3.5 shrink-0" /> Edit
            </button>
          )}
        </div>
      </td>
    </tr>
  )
})

// ─── Requestor campaign-level view ───────────────────────────────────────────

function RequestorCampaignView({ onTotalChange, onNewRequest }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const toast     = useToast()

  const PAGE_SIZE = 20

  // ── Data state ─────────────────────────────────────────────────────────────
  const [campaigns,     setCampaigns]     = useState([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages,    setTotalPages]    = useState(0)
  const [page,          setPage]          = useState(0)
  const [loading,       setLoading]       = useState(true)
  const [refreshSeed,   setRefreshSeed]   = useState(0)

  const [briefId,      setBriefId]      = useState(null)
  const [editCampaign, setEditCampaign] = useState(null)

  // ── Column filters ──────────────────────────────────────────────────────────
  const [fCampaign,  setFCampaign]  = useState('')
  const [fTaskType,  setFTaskType]  = useState('')
  const [fPriority,  setFPriority]  = useState('')
  const [fStatus,    setFStatus]    = useState(() => new URLSearchParams(location.search).get('status') || '')
  const [fDateFrom,  setFDateFrom]  = useState(null)
  const [fDateTo,    setFDateTo]    = useState(null)
  const [activeTab,  setActiveTab]  = useState('all')

  // ── Debounced text filters ─────────────────────────────────────────────────
  const dCampaign = useDebounce(fCampaign)

  // ── Reset page when filters/tab change ────────────────────────────────────
  useEffect(() => { setPage(0) },
    [dCampaign, fTaskType, fPriority, fStatus, fDateFrom, fDateTo, activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    setLoading(true)
    const params = {
      page, size: PAGE_SIZE,
      ...(dCampaign  && { campaignId: dCampaign  }),
      ...(fTaskType  && { taskType:   fTaskType  }),
      ...(fPriority  && { priority:   fPriority  }),
      ...(fStatus    && { status:     fStatus    }),
      ...(fDateFrom  && { dateFrom:   fDateFrom  }),
      ...(fDateTo    && { dateTo:     fDateTo    }),
    }

    // For the bookmarked tab, use the dedicated bookmarked endpoint
    const req = activeTab === 'bookmarked'
      ? campaignsApi.getBookmarked()
      : campaignsApi.list(params)

    req.then(res => {
        if (!alive) return
        if (activeTab === 'bookmarked') {
          // Bookmarked endpoint returns a plain array (not paged)
          const list = res.data || []
          setCampaigns(list)
          setTotalElements(list.length)
          setTotalPages(1)
          onTotalChange?.(list.length)
        } else {
          const raw = res.data
          if (Array.isArray(raw)) {
            setCampaigns(raw)
            setTotalElements(raw.length)
            setTotalPages(1)
            onTotalChange?.(raw.length)
          } else {
            const d = raw || {}
            setCampaigns(d.content || [])
            setTotalElements(d.totalElements || 0)
            setTotalPages(d.totalPages || 0)
            onTotalChange?.(d.totalElements || 0)
          }
        }
      })
      .catch(() => { if (alive) toast.error?.('Failed to load campaigns') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [dCampaign, fTaskType, fPriority, fStatus, fDateFrom, fDateTo, page, activeTab, refreshSeed, location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Bookmark handling ─────────────────────────────────────────────────────
  const [bookmarkingId, setBookmarkingId] = useState(null)

  const toggleBookmark = useCallback(async (e, campaignId) => {
    e.stopPropagation()
    setBookmarkingId(campaignId)
    try {
      const res = await campaignsApi.toggleBookmark(campaignId)
      const isNow = res.data?.bookmarked ?? false
      // Optimistically update the bookmarked flag in the list
      setCampaigns(prev => prev.map(c =>
        c.campaignId === campaignId ? { ...c, bookmarked: isNow } : c
      ))
    } catch {
      toast.error?.('Failed to update bookmark.')
    } finally {
      setBookmarkingId(null)
    }
  }, [toast]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClone = useCallback((e, campaignId) => {
    e.stopPropagation()
    navigate(`/campaigns/new?cloneFrom=${campaignId}`)
  }, [navigate])

  // ── Master data for filter dropdowns ──────────────────────────────────────
  const [allTaskTypes, setAllTaskTypes] = useState([])
  useEffect(() => {
    masterApi.list('task-types').then(d => setAllTaskTypes(d.map(t => t.name).sort())).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const PRIORITY_OPTS = ['HIGH', 'MEDIUM', 'LOW']
  const STATUS_OPTS   = ['IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED']

  const TERMINAL = ['COMPLETED', 'REJECTED', 'CANCELLED']

  const hasFilters = !!(fCampaign || fTaskType || fPriority || fStatus || fDateFrom || fDateTo)
  const clearAll   = () => {
    setFCampaign(''); setFTaskType(''); setFPriority(''); setFStatus('')
    setFDateFrom(null); setFDateTo(null)
    if (location.search) navigate('/campaigns', { replace: true })
  }

  const colFilterCls = `w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600
    placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-300 focus:border-brand-400`
  const filterWrapCls = 'min-w-0 w-full [&_.app-select__control]:!min-h-[28px] [&_.app-select__control]:!h-[28px]'

  const filtered = campaigns   // server already filtered; keep variable name for template compatibility

  // ── Stable callbacks for CampaignRow ───────────────────────────────────────
  const cbViewBrief = useCallback((id) => setBriefId(id), [setBriefId])
  const cbEdit      = useCallback((campaign) => setEditCampaign(campaign), [setEditCampaign])

  const tabs = [
    { id: 'all',        label: 'All Requests', count: activeTab === 'all'        ? totalElements : null },
    { id: 'bookmarked', label: '★ Bookmarked',  count: activeTab === 'bookmarked' ? totalElements : null },
  ]

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Tabs + New Request */}
      <div className="shrink-0 flex items-center justify-between gap-2 flex-wrap border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ring-1 ${
                activeTab === tab.id
                  ? 'bg-brand-600 text-white ring-brand-600 shadow-sm'
                  : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              <span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                activeTab === tab.id ? 'bg-white/30 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        {onNewRequest && (
          <button
            onClick={onNewRequest}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition"
          >
            <Icon name="plus" className="h-3.5 w-3.5" /> New Request
          </button>
        )}
      </div>

      {/* Date range + row count + clear */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            from={fDateFrom}
            to={fDateTo}
            onChange={({ from, to }) => { setFDateFrom(from); setFDateTo(to) }}
            placeholder="All dates"
            maxDate={new Date().toISOString().slice(0, 10)}
          />
          <span className="text-xs text-slate-400">{totalElements} campaign{totalElements !== 1 ? 's' : ''}</span>
        </div>
        {hasFilters && (
          <button onClick={clearAll}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition">
            <Icon name="x" className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="w-full flex-1 overflow-auto">
            <table
              className={DATA_TABLE_CLASS}
              style={dataTableStyle(REQUEST_TABLE_MIN_WIDTH)}
            >
              <DataTableColGroup widths={REQUEST_TABLE_COLS} />
              <thead className="sticky top-0 z-20 bg-slate-50">
                <tr className="bg-slate-50">
                  <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Campaign</th>
                  <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Priority</th>
                  <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Status</th>
                  <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Tasks</th>
                  <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Submitted</th>
                  <th className="min-w-0 border-b border-slate-100 px-2 pb-1 pt-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500" title="Bookmark">★</th>
                  <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                    Actions
                  </th>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="min-w-0 bg-slate-50 px-3 pb-2 pt-1 align-top">
                    <input value={fCampaign} onChange={e => setFCampaign(e.target.value)} placeholder="Filter…" className={colFilterCls} />
                  </td>
                  <td className="min-w-0 bg-slate-50 px-3 pb-2 pt-1 align-top">
                    <div className={filterWrapCls}>
                      <AppSelect className="w-full" value={fPriority} onChange={setFPriority} options={PRIORITY_OPTS} placeholder="All" size="sm" isSearchable menuPortal />
                    </div>
                  </td>
                  <td className="min-w-0 bg-slate-50 px-3 pb-2 pt-1 align-top">
                    <div className={filterWrapCls}>
                      <AppSelect className="w-full" value={fStatus} onChange={setFStatus} options={STATUS_OPTS.map(v => ({ value: v, label: CAMPAIGN_STATUS_LABELS[v] || v }))} placeholder="All" size="sm" isSearchable menuPortal />
                    </div>
                  </td>
                  <td className="min-w-0 bg-slate-50 px-3 pb-2 pt-1" />
                  <td className="min-w-0 bg-slate-50 px-3 pb-2 pt-1" />
                  <td className="min-w-0 bg-slate-50 px-2 pb-2 pt-1" />
                  <td className="min-w-0 bg-slate-50 px-3 pb-2 pt-1" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <TableStatusRow colSpan={7}>
                    <span className="inline-flex items-center gap-2 text-sm text-slate-400">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Loading…
                    </span>
                  </TableStatusRow>
                ) : filtered.length === 0 ? (
                  <TableStatusRow colSpan={7}>
                    <Icon name="inbox" className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                    <p className="text-sm text-slate-500">
                      {activeTab === 'bookmarked' ? 'No bookmarked requests yet.' : 'No requests found.'}
                    </p>
                    {hasFilters && (
                      <button onClick={clearAll} className="mt-2 text-xs text-brand-600 hover:underline">
                        Clear filters
                      </button>
                    )}
                  </TableStatusRow>
                ) : filtered.map((c) => (
                  <CampaignRow
                    key={c.campaignId}
                    campaign={c}
                    bookmarkingId={bookmarkingId}
                    isLoading={loading}
                    onToggleBookmark={toggleBookmark}
                    onViewBrief={cbViewBrief}
                    onClone={handleClone}
                    onEdit={cbEdit}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-4 py-1">
            <Pagination
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              loading={loading}
            />
          </div>
        </div>

      {/* Brief drawer */}
      {briefId && (
        <RequestBriefDrawer
          campaignId={briefId}
          onClose={() => setBriefId(null)}
          onCommentAnswered={({ campaignId, hasUnansweredComments }) => {
            setCampaigns(prev => prev.map(c =>
              c.campaignId === campaignId ? { ...c, hasUnansweredComments } : c
            ))
          }}
          onCampaignChanged={(updated) => {
            setCampaigns(prev => prev.map(c =>
              c.campaignId === updated.campaignId
                ? { ...c, hasUnansweredComments: !!updated.hasUnansweredComments }
                : c
            ))
          }}
        />
      )}

      {/* Edit Campaign modal */}
      {editCampaign && (
        <EditCampaignModal
          campaign={editCampaign}
          onClose={() => setEditCampaign(null)}
          onSuccess={() => { setEditCampaign(null); setRefreshSeed(s => s + 1) }}
        />
      )}
    </div>
  )
}

// ─── Standard campaign-level view (non-requestor) ────────────────────────────

function CampaignTableView({ campaigns, loading, onRefresh, refreshing }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const filtered = campaigns.filter((c) => {
    const q = search.toLowerCase()
    return (
      !q ||
      c.requestorName?.toLowerCase().includes(q) ||
      c.departmentName?.toLowerCase().includes(q) ||
      c.status?.toLowerCase().includes(q)
    )
  })

  if (loading) return <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="relative w-full max-w-sm">
        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm
            placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500"
          placeholder="Search by type, requestor, department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center">
          <Icon name="inbox" className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">No requests found.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[760px] divide-y divide-slate-200 text-sm sm:min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  {['#', 'Requestor', 'Department', 'Priority', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.campaignId} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-600">{c.campaignId}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.requestorName || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.departmentName || '—'}</td>
                    <td className="px-4 py-3"><PriorityBadge priority={c.priority} /></td>
                    <td className="px-4 py-3"><CampaignStatusBadge status={c.status} /></td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/campaigns/${c.campaignId}`)}
                        className="flex items-center gap-1 text-brand-600 hover:text-brand-800 text-xs font-medium"
                      >
                        <Icon name="eye" className="h-3.5 w-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CampaignListPage() {
  const { hasRight } = useAuth()
  const toast     = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)
  const navigate  = useNavigate()
  const location  = useLocation()

  const [campaigns,     setCampaigns]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [requestorTotal, setRequestorTotal] = useState(0)
  const [successBanner, setSuccessBanner] = useState(
    location.state?.justSubmitted
      ? 'Your request was submitted successfully.'
      : null
  )

  const canCreateCampaign = hasRight(Rights.CREATE_CAMPAIGN)
  const isRequestorView = hasRight(Rights.VIEW_OWN_CAMPAIGNS)

  const load = async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)

    try {
      if (!isRequestorView) {
        // Non-requestor path: load all campaigns (manager / admin view)
        const res = await campaignsApi.list()
        const list = res.data?.content || res.data || []
        setCampaigns(Array.isArray(list) ? list : [])
      }
      // Requestor path: RequestorCampaignView handles its own data loading
    } catch {
      showToast('Failed to load requests', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
    if (location.state?.justSubmitted) {
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Success banner */}
      {successBanner && (
        <div className="shrink-0 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <svg className="h-5 w-5 shrink-0 text-green-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          <p className="flex-1 text-sm font-medium text-green-800">{successBanner}</p>
          <button onClick={() => setSuccessBanner(null)} className="text-green-500 hover:text-green-700 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Action bar — non-requestors only (requestor gets New Request inside tabs row) */}
      {!isRequestorView && (
        <div className="shrink-0 flex items-center justify-end gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            title="Refresh"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <svg className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      )}

      {/* View */}
      <div className="flex-1 min-h-0 h-full">
        {isRequestorView ? (
          <RequestorCampaignView
            onTotalChange={setRequestorTotal}
            onNewRequest={canCreateCampaign ? () => navigate('/campaigns/new') : null}
          />
        ) : loading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>
        ) : (
          <CampaignTableView
            campaigns={campaigns}
            loading={loading}
            onRefresh={() => load(true)}
            refreshing={refreshing}
          />
        )}
      </div>
    </div>
  )
}
