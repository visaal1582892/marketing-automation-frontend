import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../components/Toast'
import campaignsApi from '../../api/campaigns'
import { masterApi, granularTasksApi } from '../../api/masterData'
import tasksApi from '../../api/tasks'
import api from '../../api/client'
import Icon from '../../components/Icon'
import RequestBriefDrawer from '../../components/RequestBriefDrawer'

// ─── Status / Priority helpers ────────────────────────────────────────────────

const CAMPAIGN_STATUS_STYLES = {
  IN_PROGRESS:                'bg-blue-50 text-blue-700 ring-blue-200',
  QC_REVIEW:                  'bg-purple-50 text-purple-700 ring-purple-200',
  COMPLETED:                  'bg-green-50 text-green-700 ring-green-200',
  REJECTED:                   'bg-red-50 text-red-700 ring-red-200',
  CANCELLED:                  'bg-slate-100 text-slate-500 ring-slate-200',
}

const CAMPAIGN_STATUS_LABELS = {
  IN_PROGRESS:                'In Progress',
  QC_REVIEW:                  'QC Review',
  COMPLETED:                  'Completed',
  REJECTED:                   'Rejected',
  CANCELLED:                  'Cancelled',
}

const TASK_STATUS_STYLES = {
  ASSIGNED:    'bg-blue-50 text-blue-700 ring-blue-200',
  IN_PROGRESS: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  REWORK:      'bg-orange-50 text-orange-700 ring-orange-200',
  QC_REVIEW:   'bg-purple-50 text-purple-700 ring-purple-200',
  COMPLETED:   'bg-green-50 text-green-700 ring-green-200',
  CANCELLED:   'bg-slate-100 text-slate-500 ring-slate-200',
  HELD:        'bg-amber-50 text-amber-700 ring-amber-200',
}
const TASK_STATUS_LABELS = {
  ASSIGNED:    'Assigned',
  IN_PROGRESS: 'In Progress',
  REWORK:      'Rework',
  QC_REVIEW:   'QC Review',
  COMPLETED:   'Completed',
  CANCELLED:   'Cancelled',
  HELD:        'Held',
}

function CampaignStatusBadge({ status }) {
  const cls = CAMPAIGN_STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {CAMPAIGN_STATUS_LABELS[status] || status}
    </span>
  )
}

function TaskStatusBadge({ status }) {
  const cls = TASK_STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {TASK_STATUS_LABELS[status] || status}
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

function TaskQuestion({ q, answer, onChange }) {
  const req = q.required ?? q.isRequired
  const getMulti = () => { try { return JSON.parse(answer || '[]') } catch { return [] } }
  const cls = `w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm
    focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 transition`
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
        <select value={answer ?? ''} onChange={e => onChange(e.target.value)} className={cls}>
          <option value="">Select…</option>
          {parseOpts(q.options).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
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
  const [depts,     setDepts]     = useState([])
  const [reqTypes,  setReqTypes]  = useState([])
  const [audiences, setAudiences] = useState([])
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

  // Existing task question editing
  const [expandedTask,       setExpandedTask]       = useState(null)  // granularTaskId
  const [existingTaskQs,     setExistingTaskQs]     = useState({})    // granularTaskId → DynamicQuestion[]
  const [existingTaskAns,    setExistingTaskAns]    = useState({})    // workTaskId → { questionId: value }
  const [loadingExistQs,     setLoadingExistQs]     = useState({})    // granularTaskId → bool

  // Build granularTaskId → workTask lookup once
  const workTaskByGranularId = useMemo(() => {
    const map = {}
    for (const wt of (campaign.workTasks || [])) {
      if (wt.granularTaskId && !map[wt.granularTaskId]) map[wt.granularTaskId] = wt
    }
    return map
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Files – existing (with optional remove) + new uploads
  const [existingFiles, setExistingFiles] = useState(
    () => (campaign.fileUrls || []).map(url => ({ url, name: url.split('/').pop() || url, removed: false }))
  )
  const [newFiles,       setNewFiles]       = useState([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [dragOver,       setDragOver]       = useState(false)
  const fileInputRef = useRef(null)

  const [saving, setSaving] = useState(false)

  // Deletion state — tasks
  const [confirmDeleteTask,  setConfirmDeleteTask]  = useState(null) // { specId, name }
  const [deletingTaskSpecId, setDeletingTaskSpecId] = useState(null)
  // Local copy so we can remove tasks from UI without a round-trip
  const [localDeliverables,  setLocalDeliverables]  = useState(campaign.deliverables || [])
  // Deletion state — campaign
  const [confirmDeleteCampaign, setConfirmDeleteCampaign] = useState(false)
  const [deletingCampaign,      setDeletingCampaign]      = useState(false)

  const DELETABLE_STATUSES = new Set(['ASSIGNED', 'HELD', 'ACCEPTED'])
  const canDeleteTask = (d) => !d.workTaskStatus || DELETABLE_STATUSES.has(d.workTaskStatus)
  const canDeleteCampaign = localDeliverables.every(d => canDeleteTask(d))

  // Form state
  const [form, setForm] = useState({
    departmentId:           campaign.departmentId || '',
    businessObjective:      '',
    businessObjectiveOther: '',
    requirementTypeId:      '',
    requirementTypeOther:   '',
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

  const [targetLocations, setTargetLocations] = useState(() => {
    try { const p = JSON.parse(campaign.targetLocation || '[]'); return Array.isArray(p) ? p : [] } catch { return [] }
  })
  const [locInput, setLocInput] = useState('')

  const existingIds    = useMemo(() => new Set(localDeliverables.map(d => d.granularTaskId)), [localDeliverables])
  const masterLoadedRef = useRef(false)

  // Load master data
  useEffect(() => {
    const nb = setter => d => setter([...d.map(i => ({ value: i.id, label: i.name })), OTHER_OPT])
    Promise.all([
      masterApi.list('departments').then(d => setDepts(d.map(i => ({ value: i.id, label: i.name })))),
      masterApi.list('requirement-types').then(nb(setReqTypes)),
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
    const req = resolveId(reqTypes,   campaign.requirementTypeId)
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
      requirementTypeId: req.selected, requirementTypeOther:   req.other,
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

  const setField    = (name, value) => setForm(prev => ({ ...prev, [name]: value }))
  const toggleMulti = (name, val)   => setForm(prev => {
    const arr = prev[name] || []
    return { ...prev, [name]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] }
  })

  // Existing task question helpers
  const toggleExistingTask = async (granularTaskId) => {
    if (expandedTask === granularTaskId) { setExpandedTask(null); return }
    setExpandedTask(granularTaskId)

    // Load questions if not already cached
    if (!existingTaskQs[granularTaskId]) {
      setLoadingExistQs(prev => ({ ...prev, [granularTaskId]: true }))
      try {
        const qs = await granularTasksApi.getQuestions(granularTaskId)
        setExistingTaskQs(prev => ({ ...prev, [granularTaskId]: qs || [] }))

        // Pre-fill existing answers if we have the work task ID
        const wt = workTaskByGranularId[granularTaskId]
        if (wt?.taskId && qs?.length > 0 && !existingTaskAns[wt.taskId]) {
          try {
            const rawAnswers = await tasksApi.getAnswers(wt.taskId)
            const answerMap = {}
            for (const a of (rawAnswers?.data || [])) {
              answerMap[a.questionId] = a.answerValue ?? a.answer ?? ''
            }
            setExistingTaskAns(prev => ({ ...prev, [wt.taskId]: answerMap }))
          } catch { /* answers optional — start blank */ }
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

  // Task helpers
  const toggleNewTask = (taskId) => {
    setNewTaskSelections(prev => {
      if (prev[taskId]) { const n = { ...prev }; delete n[taskId]; return n }
      return { ...prev, [taskId]: { granularTaskId: taskId, questionnaire: {} } }
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

  // File helpers
  const uploadFiles = async (files) => {
    if (!files.length) return
    const placeholders = files.map(f => ({ name: f.name, url: null, uploading: true, error: null }))
    setNewFiles(prev => [...prev, ...placeholders])
    setUploadingFiles(true)
    try {
      const fd = new FormData()
      files.forEach(f => fd.append('files', f))
      const res  = await api.post('/upload/asset', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const urls = res.data?.urls || []
      setNewFiles(prev => {
        const n = [...prev]; let ui = 0
        for (let i = 0; i < n.length; i++) {
          if (n[i].uploading && n[i].error === null) {
            n[i] = { ...n[i], url: urls[ui++] || null, uploading: false }
            if (ui >= urls.length) break
          }
        }
        return n
      })
    } catch {
      setNewFiles(prev => prev.map(f => f.uploading ? { ...f, uploading: false, error: 'Upload failed' } : f))
    } finally { setUploadingFiles(false) }
  }
  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files)
    e.target.value = ''
    uploadFiles(selected)
  }
  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    uploadFiles(Array.from(e.dataTransfer.files))
  }

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
          const task = availableTasks.find(t => t.taskId === taskId)
          showToast(`"${q.questionText}" is required for task "${task?.taskName || taskId}".`, 'error')
          return
        }
      }
    }
    setSaving(true)
    try {
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
        return { granularTaskId: taskId, questionnaireAnswers: answers }
      })
      const payload = {
        departmentId:      form.departmentId || null,
        businessObjective: resolve(form.businessObjective, form.businessObjectiveOther),
        requirementTypeId: resolve(form.requirementTypeId, form.requirementTypeOther),
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
        targetLocation:    JSON.stringify(targetLocations),
        newTaskSpecs:      newTaskSpecs.length > 0 ? newTaskSpecs : undefined,
        newFileUrls:       newFiles.filter(f => f.url).map(f => f.url),
        removedFileUrls:   existingFiles.filter(f => f.removed).map(f => f.url),
      }
      await campaignsApi.requestorEdit(campaign.campaignId, payload)

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

  const handleDeleteTask = async (specId, taskName) => {
    setDeletingTaskSpecId(specId)
    try {
      await campaignsApi.deleteTask(campaign.campaignId, specId)
      setLocalDeliverables(prev => prev.filter(d => d.specId !== specId))
      showToast(`Task "${taskName}" removed.`, 'success')
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to delete task.', 'error')
    } finally {
      setDeletingTaskSpecId(null)
      setConfirmDeleteTask(null)
    }
  }

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

  const newTasks   = availableTasks.filter(t => !existingIds.has(t.taskId))
  const inputCls   = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 transition'
  const removedCount = existingFiles.filter(f => f.removed).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
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
                    <FieldLabel required>Requirement Type</FieldLabel>
                    <EditSelect value={form.requirementTypeId}
                      onChange={v => { setField('requirementTypeId', v); if (v !== 'Other') setField('requirementTypeOther', '') }}
                      options={reqTypes} />
                    {form.requirementTypeId === 'Other' && (
                      <input className={`mt-2 ${inputCls}`} value={form.requirementTypeOther}
                        onChange={e => setField('requirementTypeOther', e.target.value)} placeholder="Specify requirement type…" />
                    )}
                  </div>
                  <div>
                    <FieldLabel>Target Locations</FieldLabel>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {targetLocations.map(loc => (
                        <span key={loc} className="inline-flex items-center gap-1 rounded-full bg-brand-100 text-brand-700 px-2.5 py-0.5 text-xs font-medium">
                          {loc}
                          <button type="button" onClick={() => setTargetLocations(p => p.filter(l => l !== loc))}
                            className="ml-0.5 rounded-full hover:bg-brand-200 p-0.5 transition"><Icon name="x" className="h-2.5 w-2.5" /></button>
                        </span>
                      ))}
                    </div>
                    <input className={inputCls} value={locInput} onChange={e => setLocInput(e.target.value)}
                      placeholder="Type a location and press Enter…"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && locInput.trim()) {
                          e.preventDefault()
                          setTargetLocations(p => [...new Set([...p, locInput.trim()])])
                          setLocInput('')
                        }
                      }} />
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
                {localDeliverables.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Existing Tasks
                      <span className="ml-1 normal-case font-normal text-slate-400">· click a task to edit its answers · only un-started tasks can be deleted</span>
                    </p>
                    <div className="space-y-2">
                      {localDeliverables.map(d => {
                        const deletable      = canDeleteTask(d)
                        const isDeleting     = deletingTaskSpecId === d.specId
                        const confirmingThis = confirmDeleteTask?.specId === d.specId
                        const taskName       = d.granularTaskName || d.granularTaskId
                        const statusLabel    = d.workTaskStatus ? d.workTaskStatus.replace('_', ' ') : 'PENDING'
                        const isExpanded     = expandedTask === d.granularTaskId
                        const wt             = workTaskByGranularId[d.granularTaskId]
                        const qs             = existingTaskQs[d.granularTaskId] || []
                        const ans            = wt ? (existingTaskAns[wt.taskId] || {}) : {}
                        const loadingQ       = loadingExistQs[d.granularTaskId]

                        const statusColors = {
                          ASSIGNED:    'text-blue-600 bg-blue-50',
                          HELD:        'text-amber-600 bg-amber-50',
                          ACCEPTED:    'text-indigo-600 bg-indigo-50',
                          IN_PROGRESS: 'text-emerald-600 bg-emerald-50',
                          QC_REVIEW:   'text-purple-600 bg-purple-50',
                          REWORK:      'text-orange-600 bg-orange-50',
                          COMPLETED:   'text-green-600 bg-green-50',
                          CANCELLED:   'text-slate-500 bg-slate-100',
                        }
                        const statusCls = statusColors[d.workTaskStatus] || 'text-slate-500 bg-slate-100'

                        return (
                          <div key={d.specId || d.granularTaskId}
                            className={`rounded-xl border-2 transition ${
                              isExpanded     ? 'border-sky-300 bg-sky-50/30'
                              : confirmingThis ? 'border-red-300 bg-red-50'
                              : 'border-slate-200 bg-white hover:border-sky-200'
                            }`}>
                            {/* Task header row */}
                            <div className="flex items-center gap-2 px-3 py-2">
                              {/* Expand/collapse toggle */}
                              <button type="button"
                                onClick={() => !confirmingThis && toggleExistingTask(d.granularTaskId)}
                                className="flex items-center gap-2 flex-1 text-left min-w-0"
                                title="Click to view / edit task-specific questions">
                                <Icon
                                  name="chevron"
                                  className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                                />
                                <span className="text-sm text-slate-700 font-medium truncate">{taskName}</span>
                              </button>

                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0 ${statusCls}`}>
                                {statusLabel}
                              </span>

                              {confirmingThis ? (
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-xs text-red-600 font-medium">Delete this task?</span>
                                  <button type="button" disabled={isDeleting}
                                    onClick={() => handleDeleteTask(d.specId, taskName)}
                                    className="flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition">
                                    {isDeleting
                                      ? <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                      : <Icon name="trash" className="h-3 w-3" />}
                                    Yes, delete
                                  </button>
                                  <button type="button" onClick={() => setConfirmDeleteTask(null)}
                                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition">
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button type="button"
                                  disabled={!deletable}
                                  onClick={() => deletable && setConfirmDeleteTask({ specId: d.specId, name: taskName })}
                                  title={deletable ? 'Delete this task' : `Cannot delete — task is ${statusLabel}`}
                                  className={`shrink-0 rounded-full p-1.5 transition ${deletable
                                    ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                                    : 'text-slate-200 cursor-not-allowed'}`}>
                                  <Icon name="trash" className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Expandable questionnaire panel */}
                            {isExpanded && (
                              <div className="border-t border-sky-200 px-4 pb-4 pt-3 space-y-3 bg-sky-50/20">
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
                                    <p className="text-xs text-sky-700 font-medium">
                                      Task-specific answers
                                      {wt ? '' : <span className="text-slate-400 font-normal"> (work task not yet assigned)</span>}
                                    </p>
                                    {qs.map(q => (
                                      <TaskQuestion
                                        key={q.questionId}
                                        q={q}
                                        answer={wt ? ans[q.questionId] : ''}
                                        onChange={v => wt && updateExistingTaskAnswer(wt.taskId, q.questionId, v)}
                                      />
                                    ))}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Add new tasks */}
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
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {newTasks.map(t => {
                        const isSel  = Boolean(newTaskSelections[t.taskId])
                        const qs     = taskQuestions[t.taskId] || []
                        const loadQs = loadingQs[t.taskId]
                        return (
                          <div key={t.taskId}
                            className={`rounded-xl border-2 transition ${isSel ? 'border-brand-400 bg-brand-50/50' : 'border-slate-200 bg-white hover:border-brand-200'}`}>
                            <button type="button" onClick={() => toggleNewTask(t.taskId)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left">
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${isSel ? 'border-brand-500 bg-brand-500' : 'border-slate-300 bg-white'}`}>
                                {isSel && <Icon name="check" className="h-3 w-3 text-white" />}
                              </span>
                              <span className="text-sm font-medium text-slate-800 flex-1">{t.taskName}</span>
                              {t.taskTypeName && (
                                <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5 shrink-0">{t.taskTypeName}</span>
                              )}
                            </button>
                            {isSel && (
                              <div className="px-4 pb-4 pt-3 border-t border-brand-100 space-y-3 bg-brand-50/30">
                                {loadQs ? (
                                  <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                    Loading questions…
                                  </div>
                                ) : qs.length === 0 ? (
                                  <p className="text-xs text-slate-400 italic">No task-specific questions.</p>
                                ) : qs.map(q => (
                                  <TaskQuestion key={q.questionId} q={q}
                                    answer={newTaskSelections[t.taskId]?.questionnaire?.[q.questionId]}
                                    onChange={v => updateTaskAnswer(t.taskId, q.questionId, v)} />
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
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
                    <ul className="mt-3 space-y-1.5">
                      {newFiles.map((f, i) => (
                        <li key={i} className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition
                          ${f.error ? 'border-red-200 bg-red-50' : f.url ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                          {f.uploading ? (
                            <svg className="h-4 w-4 shrink-0 animate-spin text-brand-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                          ) : f.error ? (
                            <Icon name="alertCircle" className="h-4 w-4 shrink-0 text-red-400" />
                          ) : (
                            <Icon name="checkCircle" className="h-4 w-4 shrink-0 text-emerald-500" />
                          )}
                          <span className={`flex-1 text-sm truncate ${f.error ? 'text-red-600' : 'text-slate-700'}`}>
                            {f.error ? `${f.name} — ${f.error}` : f.name}
                          </span>
                          <button type="button" onClick={() => setNewFiles(p => p.filter((_, j) => j !== i))}
                            className="shrink-0 rounded-full p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
                            <Icon name="x" className="h-3.5 w-3.5" />
                          </button>
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
              {removedCount > 0 && (
                <span className="flex items-center gap-1.5 text-red-500">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">{removedCount}</span>
                  file{removedCount !== 1 ? 's' : ''} to remove
                </span>
              )}
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

// ─── Requestor campaign-level view ───────────────────────────────────────────

function RequestorCampaignView({ campaigns, loadingDetails, refreshing, onRefresh }) {
  const [briefId,        setBriefId]        = useState(null)
  const [editCampaign,   setEditCampaign]   = useState(null) // campaign object for the edit modal
  const [fCampaign,  setFCampaign]  = useState('')
  const [fReqType,   setFReqType]   = useState('')
  const [fPriority,  setFPriority]  = useState('')
  const [fStatus,    setFStatus]    = useState('')

  const reqTypeOptions = useMemo(() => [...new Set(campaigns.map(c => c.requirementTypeName).filter(Boolean))].sort(), [campaigns])
  const priorityOptions = useMemo(() => [...new Set(campaigns.map(c => c.priority).filter(Boolean))].sort(), [campaigns])
  const statusOptions   = useMemo(() => [...new Set(campaigns.map(c => c.status).filter(Boolean))].sort(), [campaigns])

  const TERMINAL = ['COMPLETED', 'REJECTED', 'CANCELLED']

  const filtered = useMemo(() => campaigns.filter(c => {
    if (fCampaign && !String(c.campaignId).includes(fCampaign.trim())) return false
    if (fReqType  && c.requirementTypeName !== fReqType)                return false
    if (fPriority && c.priority !== fPriority)                          return false
    if (fStatus   && c.status   !== fStatus)                            return false
    return true
  }), [campaigns, fCampaign, fReqType, fPriority, fStatus])

  const hasFilters = fCampaign || fReqType || fPriority || fStatus
  const clearAll   = () => { setFCampaign(''); setFReqType(''); setFPriority(''); setFStatus('') }

  const colFilterCls = `w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600
    placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-300 focus:border-brand-400`

  return (
    <div className="space-y-3">
      {/* Row count + clear */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{filtered.length} campaign{filtered.length !== 1 ? 's' : ''}</span>
        {hasFilters && (
          <button onClick={clearAll}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition">
            <Icon name="x" className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>

      {loadingDetails ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <span className="text-sm">Loading…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-14 text-center">
          <Icon name="inbox" className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">No requests found.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-3 pt-3 pb-1 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Campaign #</th>
                  <th className="px-3 pt-3 pb-1 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Requirement Type</th>
                  <th className="px-3 pt-3 pb-1 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Priority</th>
                  <th className="px-3 pt-3 pb-1 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Status</th>
                  <th className="px-3 pt-3 pb-1 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Tasks</th>
                  <th className="px-3 pt-3 pb-1 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Submitted</th>
                  <th className="px-3 pt-3 pb-1" />
                </tr>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <td className="px-2 pb-2 pt-1">
                    <input value={fCampaign} onChange={e => setFCampaign(e.target.value)} placeholder="Filter…" className={colFilterCls} />
                  </td>
                  <td className="px-2 pb-2 pt-1">
                    <select value={fReqType} onChange={e => setFReqType(e.target.value)} className={colFilterCls}>
                      <option value="">All</option>
                      {reqTypeOptions.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </td>
                  <td className="px-2 pb-2 pt-1">
                    <select value={fPriority} onChange={e => setFPriority(e.target.value)} className={colFilterCls}>
                      <option value="">All</option>
                      {priorityOptions.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </td>
                  <td className="px-2 pb-2 pt-1">
                    <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={colFilterCls}>
                      <option value="">All</option>
                      {statusOptions.map(v => <option key={v} value={v}>{CAMPAIGN_STATUS_LABELS[v] || v}</option>)}
                    </select>
                  </td>
                  <td className="px-2 pb-2 pt-1" />
                  <td className="px-2 pb-2 pt-1" />
                  <td className="px-2 pb-2 pt-1" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const taskCount    = (c.workTasks || []).length
                  const doneCount    = (c.workTasks || []).filter(t => t.status === 'COMPLETED').length
                  const canEdit      = !TERMINAL.includes(c.status)
                  const fmtDate      = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'
                  const commentTasks = (c.workTasks || []).filter(t => t.status === 'HELD' && t.workerComment)
                  const hasComment   = commentTasks.length > 0
                  return (
                    <tr key={c.campaignId}
                      className={`transition ${hasComment
                        ? 'row-comment-pulse'
                        : 'hover:bg-slate-50/70'}`}>
                      <td className="px-3 py-3 font-mono text-slate-500">#{c.campaignId}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">{c.requirementTypeName || '—'}</td>
                      <td className="px-3 py-3"><PriorityBadge priority={c.priority} /></td>
                      <td className="px-3 py-3"><CampaignStatusBadge status={c.status} /></td>
                      <td className="px-3 py-3 text-slate-600">
                        <div className="flex items-center gap-2">
                          {taskCount === 0
                            ? <span className="italic text-slate-400">None yet</span>
                            : <span>{doneCount}/{taskCount} done</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-500">{fmtDate(c.createdAt)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setBriefId(c.campaignId)}
                            className="flex items-center gap-1 text-brand-600 hover:text-brand-800 text-xs font-medium whitespace-nowrap">
                            <Icon name="eye" className="h-3.5 w-3.5" /> Brief
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => !refreshing && setEditCampaign(c)}
                              disabled={refreshing}
                              title={refreshing ? 'Refreshing data…' : 'Edit campaign'}
                              className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs font-medium whitespace-nowrap border border-slate-200 rounded px-2 py-0.5 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
                              <Icon name="edit" className="h-3.5 w-3.5" /> Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Brief drawer */}
      {briefId && (
        <RequestBriefDrawer
          campaignId={briefId}
          onClose={() => setBriefId(null)}
        />
      )}

      {/* Edit Campaign modal */}
      {editCampaign && (
        <EditCampaignModal
          campaign={editCampaign}
          onClose={() => setEditCampaign(null)}
          onSuccess={() => { setEditCampaign(null); onRefresh() }}
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
      c.requirementTypeName?.toLowerCase().includes(q) ||
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
                  {['#', 'Requirement Type', 'Requestor', 'Department', 'Priority', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.campaignId} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">#{c.campaignId}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{c.requirementTypeName || '—'}</td>
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
  const { isRequestor, hasAnyRole } = useAuth()
  const toast     = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)
  const navigate  = useNavigate()
  const location  = useLocation()

  const [campaigns,       setCampaigns]       = useState([])
  const [campaignDetails, setCampaignDetails] = useState([])  // with workTasks, for requestor view
  const [loading,         setLoading]         = useState(true)
  const [loadingDetails,  setLoadingDetails]  = useState(false)
  const [refreshing,      setRefreshing]      = useState(false)
  const [successBanner,   setSuccessBanner]   = useState(
    location.state?.justSubmitted
      ? 'Your request was submitted successfully.'
      : null
  )

  const isCreator = hasAnyRole('Marketing Creator')

  const load = async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await campaignsApi.list()
      const list = res.data || []
      setCampaigns(list)

      // For requestors: batch-fetch campaign details to get work tasks.
      // During a silent refresh, skip the loadingDetails spinner so the table
      // doesn't flash away — the existing rows stay visible while data updates.
      if (isRequestor && list.length > 0) {
        if (!silent) setLoadingDetails(true)
        try {
          const details = await Promise.all(
            list.map(c => campaignsApi.getById(c.campaignId).then(r => r.data).catch(() => c))
          )
          setCampaignDetails(details)
        } finally {
          if (!silent) setLoadingDetails(false)
        }
      } else {
        setCampaignDetails(list)
      }
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

  // Intentionally no window-focus auto-refresh here — it caused the entire
  // campaign table to flash a loading spinner every time the user tabbed back.
  // Users can use the manual "Refresh" button instead.

  return (
    <div className="space-y-5">
      {/* Success banner */}
      {successBanner && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <svg className="h-5 w-5 shrink-0 text-green-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          <p className="flex-1 text-sm font-medium text-green-800">{successBanner}</p>
          <button onClick={() => setSuccessBanner(null)} className="text-green-500 hover:text-green-700 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {isRequestor ? 'My Requests' : 'Marketing Requests'}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {isRequestor
              ? `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} submitted`
              : `${campaigns.length} total request${campaigns.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            title="Refresh"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition disabled:opacity-50 sm:flex-none"
          >
            <svg className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          {!isCreator && (
            <button
              onClick={() => navigate('/campaigns/new')}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition sm:flex-none"
            >
              <Icon name="plus" className="h-4 w-4" /> New Request
            </button>
          )}
        </div>
      </div>

      {/* View */}
      {loading ? (
        <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>
      ) : isRequestor ? (
        <RequestorCampaignView
          campaigns={campaignDetails}
          loadingDetails={loadingDetails}
          refreshing={refreshing}
          onRefresh={() => load(true)}
        />
      ) : (
        <CampaignTableView
          campaigns={campaigns}
          loading={loading}
          onRefresh={() => load(true)}
          refreshing={refreshing}
        />
      )}
    </div>
  )
}
