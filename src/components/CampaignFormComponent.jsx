import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from './Toast'
import { masterApi, granularTasksApi, eventCategoryApi, eventCampaignTaskApi } from '../api/masterData'
import tasksApi from '../api/tasks'
import api from '../api/client'
import Icon from './Icon'
import PosStoreMultiSelect from './PosStoreMultiSelect'
import PosLocationMultiSelect from './PosLocationMultiSelect'
import MultiSelectDropdown from './MultiSelectDropdown'
import AppSelect from './AppSelect'
import SingleSelectDropdown from './SingleSelectDropdown'

const FILE_TYPE_MAP = {
  jpg: 'Image', jpeg: 'Image', png: 'Image', gif: 'Image', webp: 'Image', svg: 'Graphic',
  mp4: 'Video', mov: 'Video', avi: 'Video', webm: 'Video', wmv: 'Video',
  pdf: 'PDF Document', doc: 'Document', docx: 'Document',
  xls: 'Spreadsheet', xlsx: 'Spreadsheet',
  ppt: 'Presentation', pptx: 'Presentation',
}

function friendlyFileName(url, index) {
  const ext = (url || '').split('?')[0].toLowerCase().split('.').pop()
  const type = FILE_TYPE_MAP[ext]
  return type ? `${type} ${index + 1}` : `Attachment ${index + 1}`
}

function parseOpts(raw) {
  if (!raw) return []
  try { const p = JSON.parse(raw); if (Array.isArray(p)) return p } catch { }
  return String(raw).split(',').map(s => s.trim()).filter(Boolean)
}

function parseJsonArr(s) {
  if (!s) return []
  if (Array.isArray(s)) return s.map(String)
  try { const p = JSON.parse(s); if (Array.isArray(p)) return p.map(String) } catch { }
  return []
}

function NewTaskFileUpload({ taskId, stagedFiles = [], onFilesAdd, onFileRemove }) {
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)
  const toast = useToast()

  const uploadOne = async (file) => {
    try {
      const fd = new FormData(); fd.append('files', file)
      const res = await api.post('/upload/asset', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const url = res.data?.urls?.[0]
      if (!url) throw new Error(res.data?.errors?.[0] || 'Upload failed')
      return url
    } catch (err) {
      throw new Error(err?.response?.data?.message || err?.message || 'Upload failed')
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
        const msg = err.message || 'Upload failed'
        toast.error(msg)
        onFilesAdd(taskId, [{ ...entry, uploading: false, error: msg }], true)
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
      const msg = err.message || 'Upload failed'
      toast.error(msg)
      onFilesAdd(taskId, [{ ...entry, uploading: false, error: msg }], true)
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
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : f.error ? (
                <Icon name="alertCircle" className="h-3.5 w-3.5 shrink-0 text-red-400" />
              ) : (
                <Icon name="fileText" className="h-3.5 w-3.5 shrink-0 text-brand-400" />
              )}
              <span className={`flex-1 truncate ${f.error ? 'text-red-600' : 'text-slate-700'}`} title={f.error || undefined}>
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
  const [pendingUploads, setPendingUploads] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)
  const toast = useToast()

  const savedFiles = workTask.fileUrls || []
  const savedNames = workTask.fileOriginalNames || []
  const markedSet = new Set(markedUrls)
  const markedCount = markedUrls.length

  const uploadOne = async (file) => {
    try {
      const fd = new FormData(); fd.append('files', file)
      const res = await api.post('/upload/asset', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const url = res.data?.urls?.[0]
      if (!url) throw new Error(res.data?.errors?.[0] || 'Upload failed')
      return { url, name: file.name }
    } catch (err) {
      throw new Error(err?.response?.data?.message || err?.message || 'Upload failed')
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
        const result = await uploadOne(entry.file)
        succeeded.push(result)
        setPendingUploads(prev => prev.filter(p => p.id !== entry.id))
      } catch (err) {
        const msg = err?.response?.data?.message || err?.message || 'Upload failed'
        toast.error(msg)
        setPendingUploads(prev => prev.map(p => p.id === entry.id
          ? { ...p, uploading: false, error: msg }
          : p))
      }
    }

    if (succeeded.length > 0 && campaign?.campaignId && workTask?.taskId) {
      try {
        await tasksApi.addTaskFiles(workTask.taskId, campaign.campaignId,
          succeeded.map(f => f.url), succeeded.map(f => f.name))
        await onChanged?.()
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
      const result = await uploadOne(entry.file)
      setPendingUploads(prev => prev.filter(p => p.id !== id))
      if (campaign?.campaignId && workTask?.taskId) {
        await tasksApi.addTaskFiles(workTask.taskId, campaign.campaignId, [result.url], [result.name])
        await onChanged?.()
      }
      toast.success('File added.')
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Upload failed'
      toast.error(msg)
      setPendingUploads(prev => prev.map(p => p.id === id
        ? { ...p, uploading: false, error: msg }
        : p))
    }
  }

  const dismissPending = (id) => setPendingUploads(prev => prev.filter(p => p.id !== id))

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

      {savedFiles.length > 0 && (
        <ul className="space-y-1">
          {savedFiles.map((url, i) => {
            const name = savedNames[i] || friendlyFileName(url, i)
            const isMarked = markedSet.has(url)
            return (
              <li key={url} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition
                ${isMarked ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
                <Icon name="fileText" className="h-3.5 w-3.5 shrink-0 text-red-400" />
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

      {!readOnly && pendingUploads.length > 0 && (
        <ul className="space-y-1">
          {pendingUploads.map(p => (
            <li key={p.id} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs
              ${p.error ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
              {p.uploading ? (
                <svg className="h-3.5 w-3.5 animate-spin text-brand-400 shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <Icon name="alertCircle" className="h-3.5 w-3.5 text-red-400 shrink-0" />
              )}
              <span className={`flex-1 truncate ${p.error ? 'text-red-600' : 'text-slate-600'}`} title={p.error || undefined}>
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

      {!readOnly && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleAdd(Array.from(e.dataTransfer.files)) }}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed
            cursor-pointer py-5 transition select-none
            ${dragOver ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/30'}`}>
          <Icon name="upload" className={`h-5 w-5 ${dragOver ? 'text-brand-500' : 'text-slate-400'}`} />
          <p className={`text-xs font-medium ${dragOver ? 'text-brand-600' : 'text-slate-500'}`}>Click or drag files here</p>
          <input ref={fileInputRef} type="file" multiple className="hidden"
            onChange={e => { handleAdd(Array.from(e.target.files)); e.target.value = '' }} />
        </div>
      )}
    </div>
  )
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
      {q.fieldType === 'TEXT' && <input type="text" value={answer ?? ''} onChange={e => onChange(e.target.value)} className={cls} placeholder="Your answer…" />}
      {q.fieldType === 'NUMBER' && <input type="number" value={answer ?? ''} onChange={e => onChange(e.target.value)} className={cls} placeholder="0" />}
      {q.fieldType === 'TEXTAREA' && <textarea rows={3} value={answer ?? ''} onChange={e => onChange(e.target.value)} className={`${cls} resize-none`} placeholder="Your answer…" />}
      {q.fieldType === 'DATE' && <input type="date" value={answer ?? ''} onChange={e => onChange(e.target.value)} className={cls} />}
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



const OTHER_OPT = { value: 'Other', label: 'Other (specify below)' }

/**
 * Small wrapper that guarantees the input receives focus when it first
 * appears.  Uses requestAnimationFrame so the focus call wins against the
 * stale mouse-click that revealed the input (dropdown selection).
 */
function AutoFocusInput({ className, value, onChange, placeholder }) {
  const ref = useRef(null)
  useEffect(() => {
    const raf = requestAnimationFrame(() => ref.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <input ref={ref} className={className} value={value} onChange={onChange} placeholder={placeholder} />
  )
}

function SectionCard({ id, title, icon, children, accent = 'brand' }) {
  const colors = {
    brand: 'border-l-brand-500 bg-brand-50/30',
    violet: 'border-l-violet-400 bg-violet-50/30',
    amber: 'border-l-amber-400 bg-amber-50/20',
    emerald: 'border-l-emerald-400 bg-emerald-50/20',
    sky: 'border-l-sky-400 bg-sky-50/20',
    rose: 'border-l-rose-400 bg-rose-50/20',
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

export default function CampaignFormComponent({
  initialData = {},
  isEditMode = false,
  onSubmit,
  onCancel,
  submitting = false,
  headerTitle,
  headerSubtitle,
  statusBadge,
  onDeleteCampaign,
  canDeleteCampaign = false,
  deletingCampaign = false,
}) {
  const toast = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)
  const contentRef = useRef(null)

  // Master data
  const [depts, setDepts] = useState([])
  const [taskTypes, setTaskTypes] = useState([])
  const [audiences, setAudiences] = useState([])
  const [bizObjs, setBizObjs] = useState([])
  const [languages, setLanguages] = useState([])
  const [tones, setTones] = useState([])
  const [offerTypes, setOfferTypes] = useState([])
  const [spTypes, setSpTypes] = useState([])
  const [budgets, setBudgets] = useState([])
  const [vendorTs, setVendorTs] = useState([])
  const [kpis, setKpis] = useState([])
  const [outputs, setOutputs] = useState([])
  const [availableTasks, setAvailableTasks] = useState([])
  const [businessVerticals, setBusinessVerticals] = useState([])
  const [filteredEventCategories, setFilteredEventCategories] = useState([])
  const [loadingMaster, setLoadingMaster] = useState(true)
  const [mappedTaskTypeIds, setMappedTaskTypeIds] = useState(null)

  // New / Added task selections
  const [newTaskSelections, setNewTaskSelections] = useState(() => {
    if (isEditMode) return {} // In edit mode, additional tasks starts empty

    const map = {}
    const workTasks = Array.isArray(initialData.workTasks) ? initialData.workTasks : []
    const deliverableRows = (Array.isArray(initialData.deliverables) && initialData.deliverables.length > 0)
      ? initialData.deliverables
      : workTasks.filter(wt => wt.granularTaskId && wt.status !== 'CANCELLED')

    deliverableRows.forEach(d => {
      const gid = String(d.granularTaskId || d.taskId)
      if (!gid) return
      const wt = workTasks.find(t => String(t.granularTaskId || t.taskId) === gid)
      const questionnaire = {}
      if (Array.isArray(wt?.questionnaire)) {
        wt.questionnaire.forEach(q => {
          if (q.questionId != null && q.answerValue != null && String(q.answerValue).trim() !== '') {
            questionnaire[q.questionId] = q.answerValue
          }
        })
      } else if (d.questionnaire) {
        Object.assign(questionnaire, d.questionnaire)
      }
      map[gid] = { granularTaskId: gid, questionnaire, stagedFiles: [] }
    })
    return map
  })

  const [taskQuestions, setTaskQuestions] = useState({})
  const [loadingQs, setLoadingQs] = useState({})

  // Existing task question editing (for Edit mode existing DB tasks)
  const [expandedTask, setExpandedTask] = useState(null)
  const [existingTaskQs, setExistingTaskQs] = useState({})
  const [existingTaskAns, setExistingTaskAns] = useState({})
  const [loadingExistQs, setLoadingExistQs] = useState({})

  // Files
  const [newFiles, setNewFiles] = useState([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  // Task deletion state
  const [taskFileRemovals, setTaskFileRemovals] = useState({})
  const [pendingTaskDeletions, setPendingTaskDeletions] = useState(new Set())
  const [localWorkTasks, setLocalWorkTasks] = useState(
    () => isEditMode ? (initialData.workTasks || []).filter(t => t.status !== 'CANCELLED') : []
  )
  const [confirmDeleteCampaign, setConfirmDeleteCampaign] = useState(false)

  // Form state
  const [form, setForm] = useState({
    businessVerticalId: initialData.businessVerticalId || '5', // Defaulted to 5 for testing
    eventCategoryId: initialData.eventCategoryId ? String(initialData.eventCategoryId) : '1', // Defaulted to 1 for testing
    departmentId: initialData.departmentId || '',
    businessObjective: '',
    businessObjectiveOther: '',
    customStoreIds: initialData.customStoreIds || '',
    contactNumber: initialData.contactNumber || '',
    taskTypeId: [],
    audienceTypeIds: [],
    audienceTypeOther: '',
    languages: [],
    languageOther: '',
    hasOffer: initialData.hasOffer || 'NO',
    offerTypeId: '',
    offerTypeOther: '',
    keyMessage: initialData.keyMessage || '',
    supportingProof: '',
    supportingProofOther: '',
    tones: [],
    toneOther: '',
    priority: initialData.priority || 'MEDIUM',
    budgetTier: '',
    budgetTierOther: '',
    vendorRequired: initialData.vendorRequired || 'NO',
    vendorTypeIds: [],
    vendorTypeOther: '',
    kpiType: '',
    kpiTypeOther: '',
    expectedOutput: '',
    expectedOutputOther: '',
  })

  // Target Locations
  const [targetLocations, setTargetLocations] = useState(() => {
    if (initialData.selectedCountryCodes || initialData.selectedStateCodes || initialData.selectedCityCodes) {
      return {
        countryCodes: (initialData.selectedCountryCodes || []).map(String),
        stateCodes: (initialData.selectedStateCodes || []).map(String),
        cityCodes: (initialData.selectedCityCodes || []).map(String)
      }
    }
    if (Array.isArray(initialData.locations) && initialData.locations.length > 0) {
      const countryCodes = [...new Set(initialData.locations.map(l => l.countryCode).filter(Boolean))].map(String)
      const stateCodes = [...new Set(initialData.locations.map(l => l.stateCode || l.stateSubName).filter(Boolean))].map(String)
      const cityCodes = initialData.locations.filter(l => l.locationType === 'CITY').map(l => l.cityCode || l.citySubName).filter(Boolean).map(String)
      return { countryCodes, stateCodes, cityCodes }
    }
    return { countryCodes: [], stateCodes: [], cityCodes: [] }
  })

  // Stores
  const [stores, setStores] = useState(() => {
    let list = []
    if (Array.isArray(initialData.stores) && initialData.stores.length > 0) {
      list = [...initialData.stores]
    }
    if (initialData.customStoreIds) {
      list.push({ id: 'OTHER_CUSTOM_OPTION', storeId: 'OTHER_CUSTOM_OPTION', name: 'Other (Not Listed)' })
    }
    return list
  })

  // Existing files
  const [existingFiles, setExistingFiles] = useState(() => {
    if (!initialData.fileUrls) return []
    return (initialData.fileUrls || []).map((url, i) => ({
      url,
      name: initialData.fileOriginalNames?.[i] || friendlyFileName(url, i),
      isExisting: true,
      removed: false,
    }))
  })

  const [errors, setErrors] = useState({})
  const existingIds = useMemo(() => new Set(localWorkTasks.map(t => String(t.granularTaskId))), [localWorkTasks])
  const masterLoadedRef = useRef(false)

  // Fetch Master Data
  useEffect(() => {
    const nb = setter => d => setter([...d.map(i => ({ value: i.id, label: i.name })), OTHER_OPT])
    Promise.all([
      masterApi.list('departments').then(d => setDepts(d.map(i => ({ value: i.id, label: i.name })))),
      masterApi.list('business-verticals').then(d => setBusinessVerticals(d.map(i => ({ value: String(i.id), label: i.name })))),
      masterApi.list('task-types').then(d => setTaskTypes(d.map(i => ({ value: i.id, label: i.name, subtitle: i.taskTypeName })))),
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
    ]).catch(() => { }).finally(() => setLoadingMaster(false))
  }, [])

  // Cascading fetch for Event Categories when Business Vertical changes
  useEffect(() => {
    if (form.businessVerticalId) {
      eventCategoryApi.getByVertical(form.businessVerticalId)
        .then(cats => setFilteredEventCategories(cats.map(c => ({ value: String(c.id), label: c.name }))))
        .catch(() => setFilteredEventCategories([]))
    } else {
      setFilteredEventCategories([])
    }
  }, [form.businessVerticalId])

  // Fetch mapped task types when Vertical and Event Category are selected
  useEffect(() => {
    if (form.eventCategoryId && form.businessVerticalId) {
      eventCampaignTaskApi.getTasks(form.eventCategoryId, form.businessVerticalId)
        .then(d => {
          const mapped = d || []
          setMappedTaskTypeIds(mapped)
        })
        .catch(() => {
          setMappedTaskTypeIds([])
        })
    } else {
      setMappedTaskTypeIds(null)
    }
    setField('taskTypeId', [])
  }, [form.eventCategoryId, form.businessVerticalId])

  // Strict UX State Resets
  const handleBusinessVerticalChange = (bvId) => {
    setForm(prev => ({ ...prev, businessVerticalId: bvId, eventCategoryId: '' }))
  }

  const handleEventCategoryChange = (ecId) => {
    setForm(prev => ({ ...prev, eventCategoryId: ecId }))
  }

  // Resolve Master Option selections
  useEffect(() => {
    if (loadingMaster || masterLoadedRef.current) return
    masterLoadedRef.current = true

    const resolveId = (allOpts, storedVal) => {
      if (!storedVal) return { selected: '', other: '' }
      return allOpts.find(o => String(o.value) === String(storedVal) && o.value !== 'Other')
        ? { selected: storedVal, other: '' }
        : { selected: 'Other', other: storedVal }
    }

    const resolveIdArr = (allOpts, storedJsonOrArr) => {
      const rawArr = parseJsonArr(storedJsonOrArr)
      const knownIds = rawArr.filter(v => allOpts.some(o => String(o.value) === String(v) && o.value !== 'Other'))
      const otherText = rawArr.filter(v => !allOpts.some(o => String(o.value) === String(v)))[0] || ''
      return { selected: [...knownIds, ...(otherText ? ['Other'] : [])], other: otherText }
    }

    const biz = resolveId(bizObjs, initialData.businessObjectiveId || initialData.businessObjective)
    const off = resolveId(offerTypes, initialData.offerTypeId || initialData.offerType)
    const sp = resolveId(spTypes, initialData.supportingProofId || initialData.supportingProof)
    const bgt = resolveId(budgets, initialData.budgetTierId || initialData.budgetTier)
    const kpi = resolveId(kpis, initialData.kpiTypeId || initialData.kpiType)
    const exp = resolveId(outputs, initialData.expectedOutputId || initialData.expectedOutput)

    const aud = resolveIdArr(audiences, initialData.audienceTypeId || initialData.audience)
    const lng = resolveIdArr(languages, initialData.languageIds || initialData.language)
    const ton = resolveIdArr(tones, initialData.toneIds || initialData.tone)
    const vnd = resolveIdArr(vendorTs, initialData.vendorTypeIds || initialData.vendorType)

    setForm(prev => ({
      ...prev,
      businessObjective: biz.selected, businessObjectiveOther: biz.other,
      offerTypeId: off.selected, offerTypeOther: off.other,
      supportingProof: sp.selected, supportingProofOther: sp.other,
      budgetTier: bgt.selected, budgetTierOther: bgt.other,
      kpiType: kpi.selected, kpiTypeOther: kpi.other,
      expectedOutput: exp.selected, expectedOutputOther: exp.other,
      audienceTypeIds: aud.selected, audienceTypeOther: aud.other,
      languages: lng.selected, languageOther: lng.other,
      tones: ton.selected, toneOther: ton.other,
      vendorTypeIds: vnd.selected, vendorTypeOther: vnd.other,
    }))
  }, [loadingMaster, initialData])

  // Fetch questions for initial task selections (for clone / initial payload)
  useEffect(() => {
    const taskIds = Object.keys(newTaskSelections)
    if (taskIds.length === 0) return
    taskIds.forEach(tid => {
      if (!taskQuestions[tid]) {
        granularTasksApi.getQuestions(tid)
          .then(data => setTaskQuestions(prev => ({ ...prev, [tid]: data || [] })))
          .catch(() => setTaskQuestions(prev => ({ ...prev, [tid]: [] })))
      }
    })
  }, [newTaskSelections])

  // Outside click handler for task picker
  useEffect(() => {
    const h = (e) => {
      if (newTaskDropRef.current && !newTaskDropRef.current.contains(e.target))
        setNewTaskDropOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const setField = (name, value) => setForm(prev => ({ ...prev, [name]: value }))

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

  // Existing DB task questions (Edit mode)
  const toggleExistingTask = async (taskId, granularTaskId) => {
    if (expandedTask === taskId) { setExpandedTask(null); return }
    setExpandedTask(taskId)

    if (!existingTaskQs[granularTaskId]) {
      setLoadingExistQs(prev => ({ ...prev, [granularTaskId]: true }))
      try {
        const qs = await granularTasksApi.getQuestions(granularTaskId)
        setExistingTaskQs(prev => ({ ...prev, [granularTaskId]: qs || [] }))
        if (taskId && qs?.length > 0 && !existingTaskAns[taskId]) {
          try {
            const rawAnswers = await tasksApi.getAnswers(taskId)
            const answerMap = {}
            for (const a of (rawAnswers?.data || [])) {
              answerMap[a.questionId] = a.answerValue ?? a.answer ?? ''
            }
            setExistingTaskAns(prev => ({ ...prev, [taskId]: answerMap }))
          } catch { }
        }
      } catch {
        setExistingTaskQs(prev => ({ ...prev, [granularTaskId]: [] }))
      } finally {
        setLoadingExistQs(prev => ({ ...prev, [granularTaskId]: false }))
      }
    }
  }

  const updateExistingTaskAnswer = (workTaskId, questionId, value) =>
    setExistingTaskAns(prev => ({
      ...prev,
      [workTaskId]: { ...(prev[workTaskId] || {}), [questionId]: value },
    }))

  const toggleTaskFileRemoval = (workTaskId, url) => {
    setTaskFileRemovals(prev => {
      const current = new Set(prev[workTaskId] || [])
      if (current.has(url)) { current.delete(url) } else { current.add(url) }
      return { ...prev, [workTaskId]: current }
    })
  }

  const toggleTaskDeletion = (taskId) => {
    if (isEditMode) {
      setPendingTaskDeletions(prev => {
        const next = new Set(prev)
        if (next.has(taskId)) next.delete(taskId); else next.add(taskId)
        return next
      })
    } else {
      setLocalWorkTasks(prev => prev.filter(t => t.taskId !== taskId))
    }
  }

  // File Upload Handlers
  const uploadFiles = async (files) => {
    if (!files.length) return
    const entries = Array.from(files).map(f => ({
      id: Math.random().toString(36).slice(2), name: f.name, url: null, uploading: true, error: null, file: f,
    }))
    setNewFiles(prev => [...prev, ...entries])
    setUploadingFiles(true)
    for (const entry of entries) {
      let url = null; let errorMsg = null
      try {
        const fd = new FormData(); fd.append('files', entry.file)
        const res = await api.post('/upload/asset', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        url = res.data?.urls?.[0] || null
        if (!url) errorMsg = res.data?.errors?.[0] || 'Upload failed'
      } catch (err) {
        errorMsg = err?.response?.data?.message || err?.message || 'Upload failed'
      }
      if (errorMsg) toast.error(errorMsg)
      setNewFiles(prev => prev.map(f => f.id === entry.id ? { ...f, url, uploading: false, error: errorMsg } : f))
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
      errorMsg = err?.response?.data?.message || err?.message || 'Upload failed'
    }
    if (errorMsg) toast.error(errorMsg)
    setNewFiles(prev => prev.map(f => f.id === id ? { ...f, url, uploading: false, error: errorMsg } : f))
    setUploadingFiles(false)
  }

  const handleFileSelect = (e) => { const s = Array.from(e.target.files); e.target.value = ''; uploadFiles(s) }
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); uploadFiles(Array.from(e.dataTransfer.files)) }
  const toggleRemoveExisting = (url) => setExistingFiles(prev => prev.map(f => f.url === url ? { ...f, removed: !f.removed } : f))

  // Validation & Submit
  const handleSave = async () => {
    const newErrs = {}

    if (!form.businessVerticalId) newErrs.businessVerticalId = 'Business Vertical is required'
    if (!form.eventCategoryId) newErrs.eventCategoryId = 'Event Category is required'
    if (!form.departmentId) newErrs.departmentId = 'Department is required'
    if (!form.businessObjective) newErrs.businessObjective = 'Business Objective is required'
    if ((targetLocations.countryCodes || []).length === 0 && (targetLocations.stateCodes || []).length === 0 && (targetLocations.cityCodes || []).length === 0) {
      newErrs.targetLocations = 'Select at least one location'
    }
    if (!form.contactNumber?.trim()) newErrs.contactNumber = 'Contact Number is required'

    if (!form.audienceTypeIds || form.audienceTypeIds.length === 0) newErrs.audienceType = 'Audience Type is required'
    if (!form.languages || form.languages.length === 0) newErrs.language = 'Language is required'
    if (!form.tones || form.tones.length === 0) newErrs.tone = 'Tone / Style is required'

    if (form.hasOffer === 'YES') {
      if (!form.offerTypeId) newErrs.offerTypeId = 'Offer Type is required'
      if (!form.supportingProof) newErrs.supportingProof = 'Supporting Proof is required'
      if (!form.keyMessage?.trim()) newErrs.keyMessage = 'Key Message is required'
    }

    if (!form.priority) newErrs.priority = 'Priority is required'
    if (!form.budgetTier) newErrs.budgetTier = 'Budget Tier is required'
    if (!form.kpiType) newErrs.kpiType = 'KPI Type is required'
    if (!form.expectedOutput) newErrs.expectedOutput = 'Expected Output is required'

    if (form.vendorRequired === 'YES') {
      if (!form.vendorTypeIds || form.vendorTypeIds.length === 0) newErrs.vendorType = 'Vendor Type is required'
    }

    if (!isEditMode && Object.keys(newTaskSelections).length === 0 && localWorkTasks.length === 0) {
      newErrs.tasks = 'Select at least one task'
    }

    for (const taskId of Object.keys(newTaskSelections)) {
      const qs = taskQuestions[taskId] || []
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

    if (Object.keys(newErrs).length > 0) {
      setErrors(newErrs)
      showToast('Please fill in all mandatory fields.', 'error')

      const firstErrKey = Object.keys(newErrs)[0]
      const sectionMap = {
        businessVerticalId: 'campaign-info',
        eventCategoryId: 'campaign-info',
        departmentId: 'campaign-info',
        businessObjective: 'campaign-info',
        targetLocations: 'campaign-info',
        contactNumber: 'campaign-info',
        audienceType: 'audience',
        language: 'audience',
        tone: 'audience',
        offerTypeId: 'offer',
        supportingProof: 'offer',
        keyMessage: 'offer',
        priority: 'budget',
        budgetTier: 'budget',
        kpiType: 'budget',
        expectedOutput: 'budget',
        vendorType: 'budget',
        tasks: 'tasks',
      }
      const targetId = sectionMap[firstErrKey] || 'campaign-info'
      const el = document.getElementById(targetId) || contentRef.current
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      return
    }

    const resolve = (val, other) => val === 'Other' ? (other?.trim() || null) : (val || null)
    const resolveArr = (arr, other) => {
      const r = (arr || []).filter(v => v !== 'Other')
      if (arr?.includes('Other') && other?.trim()) r.push(other.trim())
      return r.length ? r : null
    }

    const newTaskSpecs = Object.keys(newTaskSelections).map(taskId => {
      const qn = newTaskSelections[taskId]?.questionnaire || {}
      const answers = Object.entries(qn)
        .filter(([, v]) => v != null && String(v).trim() !== '')
        .map(([questionId, answerValue]) => ({ questionId, answerValue }))
      const staged = (newTaskSelections[taskId]?.stagedFiles || []).filter(f => f.url)
      const fileUrls = staged.map(f => f.url)
      const fileNames = staged.map(f => f.name || f.url.split('/').pop())
      return {
        granularTaskId: taskId,
        questionnaireAnswers: answers,
        ...(fileUrls.length > 0 && { fileUrls, fileOriginalNames: fileNames }),
      }
    })

    const isOtherSelected = stores.some(s => (s.storeId || s.id) === 'OTHER_CUSTOM_OPTION')
    const payloadStores = stores.filter(s => (s.storeId || s.id) !== 'OTHER_CUSTOM_OPTION')

    const payload = {
      businessVerticalId: form.businessVerticalId || null,
      eventCategoryId: form.eventCategoryId ? Number(form.eventCategoryId) : null,
      departmentId: form.departmentId || null,
      customStoreIds: isOtherSelected ? form.customStoreIds?.trim() || null : null,
      contactNumber: form.contactNumber?.trim() || null,
      businessObjective: resolve(form.businessObjective, form.businessObjectiveOther),
      audienceTypeId: resolveArr(form.audienceTypeIds, form.audienceTypeOther),
      language: resolveArr(form.languages, form.languageOther),
      hasOffer: form.hasOffer,
      offerTypeId: form.hasOffer === 'YES' ? resolve(form.offerTypeId, form.offerTypeOther) : null,
      keyMessage: form.hasOffer === 'YES' ? form.keyMessage || null : null,
      supportingProof: form.hasOffer === 'YES' ? resolve(form.supportingProof, form.supportingProofOther) : null,
      tone: resolveArr(form.tones, form.toneOther),
      priority: form.priority || null,
      budgetTier: resolve(form.budgetTier, form.budgetTierOther),
      vendorRequired: form.vendorRequired,
      vendorType: form.vendorRequired === 'YES' ? resolveArr(form.vendorTypeIds, form.vendorTypeOther) : null,
      kpiType: resolve(form.kpiType, form.kpiTypeOther),
      expectedOutput: resolve(form.expectedOutput, form.expectedOutputOther),
      targetLocation: [...(targetLocations.countryCodes || []), ...(targetLocations.stateCodes || []), ...(targetLocations.cityCodes || [])].join(','),
      selectedCountryCodes: targetLocations.countryCodes || [],
      selectedStateCodes: targetLocations.stateCodes || [],
      selectedCityCodes: targetLocations.cityCodes || [],
      stores: payloadStores,
      newTaskSpecs: newTaskSpecs.length > 0 ? newTaskSpecs : undefined,
      taskSpecs: newTaskSpecs.length > 0 ? newTaskSpecs : undefined,
      newFileUrls: newFiles.filter(f => f.url).map(f => f.url),
      newFileOriginalNames: newFiles.filter(f => f.url).map(f => f.name || f.url.split('/').pop()),
      fileUrls: newFiles.filter(f => f.url).map(f => f.url),
      fileOriginalNames: newFiles.filter(f => f.url).map(f => f.name || f.url.split('/').pop()),
      removedFileUrls: existingFiles.filter(f => f.removed).map(f => f.url),
    }

    const meta = {
      pendingTaskDeletions: Array.from(pendingTaskDeletions),
      taskFileRemovals,
      existingTaskAns,
    }

    await onSubmit(payload, meta)
  }

  const selectedTypeStrs = form.taskTypeId.map(String)
  const newTasks = useMemo(() => {
    let filtered = availableTasks
      .filter(t => t.taskId !== 'TASK-AUTO-CONTENT')
      .filter(t => !existingIds.has(String(t.taskId)))
      
    if (mappedTaskTypeIds !== null) {
      filtered = filtered.filter(t => mappedTaskTypeIds.includes(String(t.taskTypeId)))
    }
    
    return filtered.filter(t => selectedTypeStrs.length === 0 || selectedTypeStrs.includes(String(t.taskTypeId)))
  }, [availableTasks, existingIds, selectedTypeStrs, mappedTaskTypeIds])

  const taskOptions = useMemo(() => {
    return newTasks.map(t => ({
      id: String(t.taskId),
      name: t.taskName,
      subtitle: t.taskTypeName || ''
    }))
  }, [newTasks])

  const selectedTaskIds = useMemo(() => Object.keys(newTaskSelections), [newTaskSelections])

  const handleTaskMultiSelectChange = (selectedIds) => {
    setNewTaskSelections(prev => {
      const next = {}
      selectedIds.forEach(id => {
        next[id] = prev[id] || { granularTaskId: id, questionnaire: {}, stagedFiles: [] }
        if (!taskQuestions[id]) {
          setLoadingQs(p => ({ ...p, [id]: true }))
          granularTasksApi.getQuestions(id)
            .then(data => setTaskQuestions(p => ({ ...p, [id]: data || [] })))
            .catch(() => setTaskQuestions(p => ({ ...p, [id]: [] })))
            .finally(() => setLoadingQs(p => ({ ...p, [id]: false })))
        }
      })
      return next
    })
  }

  const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 transition'
  const removedCount = existingFiles.filter(f => f.removed).length

  return (
    <div className="mx-auto max-w-6xl w-full p-4 sm:p-6 lg:p-8">
      <div className="w-full rounded-2xl bg-white shadow-lg ring-1 ring-slate-200 flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-gradient-to-r from-brand-50 to-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
              <Icon name={isEditMode ? "edit" : "plus"} className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{headerTitle}</h3>
              <p className="text-xs text-slate-500">{headerSubtitle || 'Fill details · Add tasks · Upload reference files'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge}
            <button onClick={onCancel} className="ml-2 rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loadingMaster ? (
          <div className="flex-1 flex items-center justify-center gap-3 py-20 text-slate-400">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span className="text-sm font-medium">Loading form data…</span>
          </div>
        ) : (
          <div className="flex flex-1">
            <div ref={contentRef} className="flex-1 px-8 py-6 space-y-8">

              {/* 1 – Campaign Info */}
              <SectionCard id="campaign-info" title="Campaign Info" icon="fileText" accent="brand">

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel required>Department</FieldLabel>
                    <SingleSelectDropdown value={form.departmentId} onChange={v => setField('departmentId', v)} options={depts} placeholder="Select department…" hasError={!!errors.departmentId} />
                  </div>
                  <div>
                    <FieldLabel required>Business Objective</FieldLabel>
                    <SingleSelectDropdown value={form.businessObjective}
                      onChange={v => { setField('businessObjective', v); if (v !== 'Other') setField('businessObjectiveOther', '') }}
                      options={bizObjs} hasError={!!errors.businessObjective} />
                    {form.businessObjective === 'Other' && (
                      <AutoFocusInput key="biz-other" className={`mt-2 ${inputCls}`} value={form.businessObjectiveOther}
                        onChange={e => setField('businessObjectiveOther', e.target.value)} placeholder="Describe the objective…" />
                    )}
                  </div>

                  <div className="col-span-1 sm:col-span-2">
                    <FieldLabel required>Target Locations</FieldLabel>
                    <PosLocationMultiSelect
                      value={targetLocations}
                      onChange={setTargetLocations}
                      hasError={!!errors.targetLocations}
                    />
                  </div>
                </div>

                {/* Hidden for testing purposes */}
                <div className="hidden">
                  <div>
                    <FieldLabel required>Business Vertical</FieldLabel>
                    <SingleSelectDropdown
                      value={form.businessVerticalId}
                      onChange={handleBusinessVerticalChange}
                      options={businessVerticals}
                      placeholder="Select business vertical…"
                      hasError={!!errors.businessVerticalId}
                    />
                  </div>
                  <div>
                    <FieldLabel required>Event Category</FieldLabel>
                    <SingleSelectDropdown
                      value={form.eventCategoryId}
                      onChange={handleEventCategoryChange}
                      options={filteredEventCategories}
                      placeholder={form.businessVerticalId ? "Select event category…" : "Select vertical first…"}
                      disabled={!form.businessVerticalId}
                      hasError={!!errors.eventCategoryId}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div>
                    <FieldLabel>Store(s)</FieldLabel>
                    <PosStoreMultiSelect
                      value={stores}
                      onChange={setStores}
                      hasError={!!errors.stores}
                    />
                    {stores.some(s => (s.storeId || s.id) === 'OTHER_CUSTOM_OPTION') && (
                      <div className="mt-2">
                        <FieldLabel>Custom / Unlisted Stores</FieldLabel>
                        <textarea
                          rows={2}
                          className={`${inputCls} resize-none`}
                          value={form.customStoreIds}
                          onChange={e => setField('customStoreIds', e.target.value)}
                          placeholder="Enter custom store IDs or locations (comma or newline separated)…"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <FieldLabel required>Contact Number</FieldLabel>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      className={`${inputCls} ${!form.contactNumber?.trim() || errors.contactNumber ? 'border-red-300 focus:ring-red-200 focus:border-red-400' : ''}`}
                      value={form.contactNumber}
                      onChange={e => setField('contactNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Enter contact number…" />
                  </div>
                </div>
              </SectionCard>

              {/* 2 – Audience & Tone */}
              <SectionCard id="audience" title="Audience & Tone" icon="users" accent="violet">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <FieldLabel required>Audience Type</FieldLabel>
                    <MultiSelectDropdown value={form.audienceTypeIds} onChange={v => setField('audienceTypeIds', v)} options={audiences} hasError={!!errors.audienceType} />
                    {form.audienceTypeIds.includes('Other') && (
                      <AutoFocusInput key="aud-other" className={`mt-2 ${inputCls}`} value={form.audienceTypeOther}
                        onChange={e => setField('audienceTypeOther', e.target.value)} placeholder="Describe the audience…" />
                    )}
                  </div>
                  <div>
                    <FieldLabel required>Language</FieldLabel>
                    <MultiSelectDropdown value={form.languages} onChange={v => setField('languages', v)} options={languages} hasError={!!errors.language} />
                    {form.languages.includes('Other') && (
                      <AutoFocusInput key="lang-other" className={`mt-2 ${inputCls}`} value={form.languageOther}
                        onChange={e => setField('languageOther', e.target.value)} placeholder="Specify language…" />
                    )}
                  </div>
                  <div>
                    <FieldLabel required>Tone / Style</FieldLabel>
                    <MultiSelectDropdown value={form.tones} onChange={v => setField('tones', v)} options={tones} hasError={!!errors.tone} />
                    {form.tones.includes('Other') && (
                      <AutoFocusInput key="tone-other" className={`mt-2 ${inputCls}`} value={form.toneOther}
                        onChange={e => setField('toneOther', e.target.value)} placeholder="Specify tone…" />
                    )}
                  </div>
                </div>
              </SectionCard>

              {/* 3 – Offer & Messaging */}
              <SectionCard id="offer" title="Offer & Messaging" icon="tag" accent="amber">
                <YesNoToggle value={form.hasOffer} onChange={v => setField('hasOffer', v)} label="Campaign has an offer?" />
                {form.hasOffer === 'YES' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    <div>
                      <FieldLabel required={form.hasOffer === 'YES'}>Offer Type</FieldLabel>
                      <SingleSelectDropdown value={form.offerTypeId}
                        onChange={v => { setField('offerTypeId', v); if (v !== 'Other') setField('offerTypeOther', '') }}
                        options={offerTypes} hasError={!!errors.offerTypeId} />
                      {form.offerTypeId === 'Other' && (
                        <AutoFocusInput key="offer-other" className={`mt-2 ${inputCls}`} value={form.offerTypeOther}
                          onChange={e => setField('offerTypeOther', e.target.value)} placeholder="Specify…" />
                      )}
                    </div>
                    <div>
                      <FieldLabel required={form.hasOffer === 'YES'}>Supporting Proof</FieldLabel>
                      <SingleSelectDropdown value={form.supportingProof}
                        onChange={v => { setField('supportingProof', v); if (v !== 'Other') setField('supportingProofOther', '') }}
                        options={spTypes} hasError={!!errors.supportingProof} />
                      {form.supportingProof === 'Other' && (
                        <AutoFocusInput key="sp-other" className={`mt-2 ${inputCls}`} value={form.supportingProofOther}
                          onChange={e => setField('supportingProofOther', e.target.value)} placeholder="Specify…" />
                      )}
                    </div>
                    <div>
                      <FieldLabel required={form.hasOffer === 'YES'}>Key Message</FieldLabel>
                      <textarea rows={3} value={form.keyMessage}
                        onChange={e => setField('keyMessage', e.target.value)}
                        className={`${inputCls} resize-none ${errors.keyMessage ? 'border-red-300 focus:ring-red-200 focus:border-red-400' : ''}`} placeholder="Core offer message…" />
                    </div>
                  </div>
                )}
              </SectionCard>

              {/* 4 – Budget & KPIs */}
              <SectionCard id="budget" title="Budget & KPIs" icon="trendingUp" accent="emerald">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <FieldLabel required>Priority</FieldLabel>
                    <SingleSelectDropdown value={form.priority} onChange={v => setField('priority', v)}
                      options={[{ value: 'HIGH', label: 'High' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'LOW', label: 'Low' }]} hasError={!!errors.priority} />
                  </div>
                  <div>
                    <FieldLabel required>Budget Tier</FieldLabel>
                    <SingleSelectDropdown value={form.budgetTier}
                      onChange={v => { setField('budgetTier', v); if (v !== 'Other') setField('budgetTierOther', '') }}
                      options={budgets} hasError={!!errors.budgetTier} />
                    {form.budgetTier === 'Other' && (
                      <AutoFocusInput key="budget-other" className={`mt-2 ${inputCls}`} value={form.budgetTierOther}
                        onChange={e => setField('budgetTierOther', e.target.value)} placeholder="Specify budget…" />
                    )}
                  </div>
                  <div>
                    <FieldLabel required>KPI Type</FieldLabel>
                    <SingleSelectDropdown value={form.kpiType}
                      onChange={v => { setField('kpiType', v); if (v !== 'Other') setField('kpiTypeOther', '') }}
                      options={kpis} hasError={!!errors.kpiType} />
                    {form.kpiType === 'Other' && (
                      <AutoFocusInput key="kpi-other" className={`mt-2 ${inputCls}`} value={form.kpiTypeOther}
                        onChange={e => setField('kpiTypeOther', e.target.value)} placeholder="Specify KPI…" />
                    )}
                  </div>
                  <div>
                    <FieldLabel required>Expected Output</FieldLabel>
                    <SingleSelectDropdown value={form.expectedOutput}
                      onChange={v => { setField('expectedOutput', v); if (v !== 'Other') setField('expectedOutputOther', '') }}
                      options={outputs} hasError={!!errors.expectedOutput} />
                    {form.expectedOutput === 'Other' && (
                      <AutoFocusInput key="output-other" className={`mt-2 ${inputCls}`} value={form.expectedOutputOther}
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
                      <FieldLabel required={form.vendorRequired === 'YES'}>Vendor Type</FieldLabel>
                      <MultiSelectDropdown value={form.vendorTypeIds} onChange={v => setField('vendorTypeIds', v)} options={vendorTs} hasError={!!errors.vendorType} />
                      {form.vendorTypeIds.includes('Other') && (
                        <AutoFocusInput key="vendor-other" className={`mt-2 ${inputCls}`} value={form.vendorTypeOther}
                          onChange={e => setField('vendorTypeOther', e.target.value)} placeholder="Specify vendor type…" />
                      )}
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* 5 – Tasks */}
              <SectionCard id="tasks" title="Tasks & Deliverables" icon="checkSquare" accent="sky">
                {/* Existing DB tasks (Edit mode) */}
                {isEditMode && localWorkTasks.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Existing Tasks
                      <span className="ml-1 normal-case font-normal text-slate-400">· click to edit answers · trash = mark for deletion · restore to undo</span>
                    </p>
                    <div className="space-y-2">
                      {localWorkTasks.map(d => {
                        const markedDelete = pendingTaskDeletions.has(d.taskId)
                        const taskName = d.granularTaskName || d.granularTaskId
                        const statusLabel = d.status ? d.status.replace(/_/g, ' ') : 'PENDING'
                        const isExpanded = !markedDelete && expandedTask === d.taskId
                        const qs = existingTaskQs[d.granularTaskId] || []
                        const ans = existingTaskAns[d.taskId] || {}
                        const loadingQ = loadingExistQs[d.granularTaskId]

                        const statusColors = {
                          ASSIGNED: 'text-blue-600 bg-blue-50',
                          HELD: 'text-amber-600 bg-amber-50',
                          ACCEPTED: 'text-indigo-600 bg-indigo-50',
                          IN_PROGRESS: 'text-emerald-600 bg-emerald-50',
                          MARKETING_REVIEW: 'text-purple-600 bg-purple-50',
                          REQUESTOR_REVIEW: 'text-violet-600 bg-violet-50',
                          REWORK: 'text-orange-600 bg-orange-50',
                          COMPLETED: 'text-green-600 bg-green-50',
                          CANCELLED: 'text-slate-500 bg-slate-100',
                        }
                        const statusCls = statusColors[d.status] || 'text-slate-500 bg-slate-100'

                        return (
                          <div key={d.taskId}
                            className={`rounded-xl border-2 transition ${markedDelete ? 'border-red-300 bg-red-50 opacity-60'
                                : isExpanded ? 'border-sky-300 bg-sky-50/30'
                                  : 'border-slate-200 bg-white hover:border-sky-200'
                              }`}>
                            <div className="flex items-center gap-2 px-3 py-2">
                              <button type="button"
                                onClick={() => !markedDelete && toggleExistingTask(d.taskId, d.granularTaskId)}
                                className="flex items-center gap-2 flex-1 text-left min-w-0">
                                <Icon name="chevron" className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} />
                                <span className={`text-xs font-semibold shrink-0 ${markedDelete ? 'line-through text-red-400' : 'text-brand-700'}`}>{d.taskId}</span>
                                <span className={`text-sm font-medium truncate ${markedDelete ? 'line-through text-red-400' : 'text-slate-700'}`}>{taskName}</span>
                                {markedDelete && <span className="text-xs text-red-500 font-medium shrink-0">· Will be deleted on save</span>}
                              </button>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0 ${statusCls}`}>
                                {statusLabel}
                              </span>
                              {markedDelete ? (
                                <button type="button" onClick={() => toggleTaskDeletion(d.taskId)}
                                  className="shrink-0 flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
                                  <Icon name="refresh" className="h-3 w-3" /> Restore
                                </button>
                              ) : (
                                <button type="button" onClick={() => toggleTaskDeletion(d.taskId)}
                                  className="shrink-0 rounded-full p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
                                  <Icon name="trash" className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            {isExpanded && (
                              <div className="border-t border-sky-200 px-4 pb-4 pt-3 space-y-4 bg-sky-50/20">
                                <div className="space-y-3">
                                  {loadingQ ? (
                                    <div className="text-xs text-slate-400">Loading questions…</div>
                                  ) : qs.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No task-specific questions.</p>
                                  ) : (
                                    qs.map(q => (
                                      <TaskQuestion key={q.questionId} q={q} answer={ans[q.questionId] ?? ''}
                                        onChange={v => updateExistingTaskAnswer(d.taskId, q.questionId, v)} />
                                    ))
                                  )}
                                </div>
                                <div className="pt-3 border-t border-sky-200">
                                  <TaskFilesPanel workTask={d} campaign={initialData}
                                    markedUrls={[...(taskFileRemovals[d.taskId] || [])]}
                                    onToggleRemoval={url => toggleTaskFileRemoval(d.taskId, url)} />
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Filter tasks by task type */}
                <div className="mb-4">
                  <FieldLabel>Task Type <span className="text-slate-400 font-normal">(filter only)</span></FieldLabel>
                  <MultiSelectDropdown 
                    value={form.taskTypeId} 
                    onChange={v => setField('taskTypeId', v)} 
                    options={mappedTaskTypeIds === null ? [] : taskTypes.filter(tt => mappedTaskTypeIds.includes(String(tt.value)))} 
                    placeholder={
                      mappedTaskTypeIds === null
                        ? "Select Vertical & Event first..."
                        : mappedTaskTypeIds.length === 0
                        ? "No task types mapped (contact Marketing team)"
                        : "Filter by mapped task types..."
                    }
                    disabled={mappedTaskTypeIds === null || mappedTaskTypeIds.length === 0}
                  />
                </div>

                {/* Select and configure tasks */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    {isEditMode ? 'Add More Tasks' : 'Select Tasks'}
                    {selectedTaskIds.length > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center h-4 w-4 rounded-full bg-brand-600 text-white text-[10px] font-bold">
                        {selectedTaskIds.length}
                      </span>
                    )}
                  </p>

                  <div className="space-y-3">
                    {mappedTaskTypeIds !== null && mappedTaskTypeIds.length === 0 ? (
                      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 shadow-2xs">
                        <Icon name="alertCircle" className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-amber-900">No task types mapped for this combination</p>
                          <p className="mt-0.5 text-amber-700">
                            No allowable task types have been configured for this Business Vertical and Event Category. Please contact the Marketing team to configure task type mappings.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <MultiSelectDropdown
                        options={taskOptions}
                        value={selectedTaskIds}
                        onChange={handleTaskMultiSelectChange}
                        placeholder={
                          mappedTaskTypeIds === null
                            ? "Select Vertical & Event first…"
                            : isEditMode
                            ? "Search and select tasks to add…"
                            : "Search and select tasks…"
                        }
                        disabled={mappedTaskTypeIds === null}
                        hasError={!!errors.tasks}
                      />
                    )}

                    {/* Per-task cards */}
                    {selectedTaskIds.length > 0 && (
                      <div className="space-y-3">
                        {selectedTaskIds.map(tid => {
                          const t = availableTasks.find(x => String(x.taskId) === String(tid))
                          const qs = taskQuestions[tid] || []
                          const loadQs = loadingQs[tid]
                          const staged = newTaskSelections[tid]?.stagedFiles || []
                          return (
                            <div key={tid} className="rounded-xl border-2 border-brand-200 bg-brand-50/30">
                              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-brand-100">
                                <span className="text-sm font-semibold text-slate-800 flex-1">{t?.taskName || tid}</span>
                                {t?.taskTypeName && <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5">{t.taskTypeName}</span>}
                                <button type="button" onClick={() => toggleNewTask(tid)} className="shrink-0 rounded-full p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
                                  <Icon name="x" className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <div className="px-4 pt-3 pb-4 space-y-3">
                                {loadQs ? (
                                  <div className="text-xs text-slate-400">Loading questions…</div>
                                ) : qs.length === 0 ? (
                                  <p className="text-xs text-slate-400 italic">No task-specific questions.</p>
                                ) : (
                                  qs.map(q => (
                                    <TaskQuestion key={q.questionId} q={q}
                                      answer={newTaskSelections[tid]?.questionnaire?.[q.questionId]}
                                      onChange={v => updateTaskAnswer(tid, q.questionId, v)} />
                                  ))
                                )}
                                <div className="pt-3 border-t border-brand-100">
                                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Reference Files</p>
                                  <NewTaskFileUpload taskId={tid} stagedFiles={staged} onFilesAdd={addNewTaskStagedFiles} onFileRemove={removeNewTaskStagedFile} />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>

              {/* 6 – Files */}
              <SectionCard id="files" title="Campaign Files" icon="paperclip" accent="rose">
                {existingFiles.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Uploaded Files
                      {removedCount > 0 && <span className="ml-2 text-red-500 font-medium">({removedCount} marked for removal)</span>}
                    </p>
                    <ul className="space-y-1.5">
                      {existingFiles.map((f, i) => (
                        <li key={i} className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition ${f.removed ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
                          <Icon name="fileText" className={`h-4 w-4 shrink-0 ${f.removed ? 'text-red-400' : 'text-brand-500'}`} />
                          <a href={f.url} target="_blank" rel="noopener noreferrer" className={`flex-1 text-sm truncate ${f.removed ? 'line-through text-slate-400' : 'text-brand-600 hover:underline'}`}>{f.name}</a>
                          <button type="button" onClick={() => toggleRemoveExisting(f.url)} className={`shrink-0 rounded-full p-1 transition ${f.removed ? 'bg-red-100 text-red-500' : 'text-slate-400 hover:text-red-500'}`}>
                            <Icon name={f.removed ? "undo" : "trash"} className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Add New Files</p>
                  <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
                    className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer py-7 transition ${dragOver ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-slate-50/50 hover:border-brand-300'}`}>
                    <Icon name="upload" className={`h-7 w-7 ${dragOver ? 'text-brand-500' : 'text-slate-400'}`} />
                    <p className={`text-sm font-medium ${dragOver ? 'text-brand-600' : 'text-slate-500'}`}>{uploadingFiles ? 'Uploading…' : 'Click or drag files here'}</p>
                    <p className="text-xs text-slate-400">Supports images, PDFs, documents</p>
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
                  </div>

                  {newFiles.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {newFiles.map(f => (
                        <li key={f.id} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${f.error ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
                          <Icon name={f.error ? "alertCircle" : "fileText"} className="h-3.5 w-3.5 shrink-0 text-red-400" />
                          <span className={`flex-1 truncate ${f.error ? 'text-red-600' : 'text-slate-700'}`}>{f.error ? `${f.name} — ${f.error}` : f.name}</span>
                          {f.error && f.file && <button type="button" onClick={() => retryNewFile(f.id)} className="shrink-0 text-brand-600 font-medium hover:underline">Retry</button>}
                          {f.url && !f.uploading && <a href={f.url} target="_blank" rel="noopener noreferrer" className="shrink-0 font-medium text-brand-600 hover:underline">View</a>}
                          {!f.uploading && <button type="button" onClick={() => setNewFiles(p => p.filter(x => x.id !== f.id))} className="shrink-0 text-slate-400 hover:text-red-500"><Icon name="x" className="h-3.5 w-3.5" /></button>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </SectionCard>

            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="border-t border-slate-100 shrink-0 bg-slate-50/50 rounded-b-2xl">
          {confirmDeleteCampaign && (
            <div className="flex items-center gap-3 px-6 py-3 bg-red-50 border-b border-red-200">
              <Icon name="alertCircle" className="h-4 w-4 text-red-500 shrink-0" />
              <span className="flex-1 text-sm text-red-700 font-medium">Permanently delete campaign #{initialData.campaignId}?</span>
              <button type="button" disabled={deletingCampaign} onClick={onDeleteCampaign} className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 transition">
                <Icon name="trash" className="h-3.5 w-3.5" /> Delete
              </button>
              <button type="button" onClick={() => setConfirmDeleteCampaign(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white transition">Cancel</button>
            </div>
          )}

          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4 text-xs text-slate-500">
              {Object.keys(newTaskSelections).length > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white text-[10px] font-bold">{Object.keys(newTaskSelections).length}</span>
                  tasks selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isEditMode && canDeleteCampaign && !confirmDeleteCampaign && (
                <button type="button" onClick={() => setConfirmDeleteCampaign(true)} className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition">
                  <Icon name="trash" className="h-3.5 w-3.5" /> Delete Campaign
                </button>
              )}
              <button onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition">Cancel</button>
              <button onClick={handleSave} disabled={submitting} className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition shadow-sm">
                {submitting ? 'Saving…' : <><Icon name="check" className="h-4 w-4" /> {isEditMode ? 'Save Changes' : 'Submit Request'}</>}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}