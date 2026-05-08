import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import managerApi from '../../api/manager'
import campaignsApi from '../../api/campaigns'
import { masterApi, granularTasksApi } from '../../api/masterData'
import { useDebounce } from '../../hooks/useDebounce'
import Pagination from '../../components/Pagination'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'
import RequestBriefDrawer from '../../components/RequestBriefDrawer'
import AssetPreviewModal from '../../components/AssetPreviewModal'
import { useAuth } from '../../auth/AuthContext'
import AppSelect from '../../components/AppSelect'
import DateRangePicker from '../../components/DateRangePicker'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  ASSIGNED:    'bg-blue-50 text-blue-700 ring-blue-200',
  IN_PROGRESS: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  REWORK:      'bg-orange-50 text-orange-700 ring-orange-200',
  QC_REVIEW:   'bg-purple-50 text-purple-700 ring-purple-200',
  COMPLETED:   'bg-green-50 text-green-700 ring-green-200',
  CANCELLED:   'bg-slate-100 text-slate-500 ring-slate-200',
  HELD:        'bg-amber-50 text-amber-700 ring-amber-200',
}
const STATUS_LABELS = {
  ASSIGNED:    'Assigned',
  IN_PROGRESS: 'In Progress',
  REWORK:      'Rework',
  QC_REVIEW:   'QC Review',
  COMPLETED:   'Completed',
  CANCELLED:   'Cancelled',
  HELD:        'Held',
}
const PRIORITY_STYLES = {
  HIGH:   'bg-rose-50 text-rose-700 ring-rose-200',
  MEDIUM: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
  LOW:    'bg-emerald-50 text-emerald-700 ring-emerald-200',
}

const PRIORITY_OPTIONS = ['HIGH', 'MEDIUM', 'LOW']
const BUDGET_OPTIONS = [
  { value: 'NO_BUDGET_ORGANIC', label: 'No Budget (Organic)' },
  { value: 'UNDER_50K',         label: '< ₹50K' },
  { value: 'FIFTY_K_TO_2L',     label: '₹50K – ₹2L' },
  { value: 'TWO_L_TO_10L',      label: '₹2L – ₹10L' },
  { value: 'ABOVE_10L',         label: '₹10L+' },
]

// ─── Inline column-filter primitives ─────────────────────────────────────────

function SelectFilter({ value, onChange, options, placeholder = 'All' }) {
  const normOpts = options.map(o => ({ value: o, label: STATUS_LABELS[o] || o }))
  return (
    <AppSelect
      value={value}
      onChange={onChange}
      options={normOpts}
      placeholder={placeholder}
      size="sm"
      isSearchable
      menuPortal
    />
  )
}

function SearchSelectFilter({ value, onChange, options, placeholder = 'All' }) {
  const normOpts = options.map(o => ({ value: o, label: o }))
  return (
    <AppSelect
      value={value}
      onChange={v => onChange(v ?? '')}
      options={normOpts}
      placeholder={placeholder}
      size="sm"
      isSearchable
      menuPortal
    />
  )
}

function TextFilter({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <Icon name="search" className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded border pl-5 pr-1.5 py-1 text-xs leading-tight
                    focus:outline-none focus:ring-1 focus:ring-brand-300
                    ${value
                      ? 'border-brand-400 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white text-slate-500'}`}
      />
    </div>
  )
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditCampaignModal({ campaignId, task, onClose, onSaved }) {
  const toast = useToast()
  const [form,     setForm]     = useState({ priority: '', keyMessage: '', budgetTier: '' })
  const [fetching, setFetching] = useState(true)
  const [saving,   setSaving]   = useState(false)

  const isRestricted = ['COMPLETED', 'QC_REVIEW'].includes(task?.status)

  useEffect(() => {
    campaignsApi.getById(campaignId)
      .then(res => {
        const c = res.data
        setForm({ priority: c.priority || '', budgetTier: c.budgetTier || '', keyMessage: '' })
      })
      .catch(() => toast.error('Could not load campaign details.'))
      .finally(() => setFetching(false))
  }, [campaignId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true)
    try {
      await campaignsApi.updateCampaign(campaignId, {
        priority:   form.priority   || undefined,
        budgetTier: form.budgetTier || undefined,
        keyMessage: form.keyMessage || undefined,
      })
      toast.success('Campaign updated successfully.')
      onSaved(); onClose()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Update failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Edit Campaign</h3>
            <p className="mt-0.5 text-xs text-slate-400">Campaign {campaignId} · Task {task.taskId}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        {fetching ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
            <Icon name="refresh" className="h-4 w-4 animate-spin" /><span className="text-sm">Loading…</span>
          </div>
        ) : (
          <div className="space-y-4 px-5 py-4">
            {isRestricted && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <Icon name="alertCircle" className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                <span>
                  Priority and budget tier cannot be changed for tasks in{' '}
                  <strong>{task?.status === 'QC_REVIEW' ? 'QC Review' : 'Completed'}</strong> status.
                  You can still update the key message.
                </span>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
              <AppSelect
                value={form.priority}
                onChange={v => setForm(f => ({ ...f, priority: v }))}
                options={PRIORITY_OPTIONS.map(p => ({ value: p, label: p.charAt(0) + p.slice(1).toLowerCase() }))}
                placeholder="Select priority…"
                isClearable={false}
                isDisabled={isRestricted}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Budget Tier</label>
              <AppSelect
                value={form.budgetTier}
                onChange={v => setForm(f => ({ ...f, budgetTier: v }))}
                options={BUDGET_OPTIONS}
                placeholder="Select budget tier…"
                isClearable={false}
                isDisabled={isRestricted}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Key Message</label>
              <textarea value={form.keyMessage} onChange={e => setForm(f => ({ ...f, keyMessage: e.target.value }))}
                rows={3} placeholder="Type a new key message…"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800
                           placeholder:text-slate-400 focus:border-brand-400 focus:outline-none
                           focus:ring-1 focus:ring-brand-300 resize-none" />
            </div>
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:justify-end">
          <button onClick={onClose} disabled={saving || fetching}
            className="w-full rounded-md border border-slate-200 px-4 py-1.5 text-sm text-slate-600
                       hover:bg-slate-50 transition disabled:opacity-60 sm:w-auto">Cancel</button>
          <button onClick={handleSave} disabled={saving || fetching}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-600 px-4 py-1.5
                       text-sm font-medium text-white hover:bg-brand-700 transition disabled:opacity-60 sm:w-auto">
            {saving ? <><Icon name="refresh" className="h-3.5 w-3.5 animate-spin" /> Saving…</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Unhold modal — choose auto-route OR manual assign ────────────────────────
// For TASK-OTHER tasks, auto-route is not shown — manual assignment only.

function UnholdModal({ task: t, isOther, mode, onSelectAuto, onSelectManual,
                       eligibleUsers, loadingUsers, selectedUserId, onSelectUser,
                       onConfirm, onClose, acting }) {
  const canConfirm = mode === 'auto' || (mode === 'manual' && selectedUserId)
  const [userSearch, setUserSearch] = useState('')
  const filteredUsers = eligibleUsers.filter(u =>
    !userSearch.trim() ||
    u.fullName?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.roleName?.toLowerCase().includes(userSearch.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-500">
              <span className="font-normal text-slate-400">TASK</span>{t.taskId}
            </span>
            <h3 className="text-sm font-semibold text-slate-900">
              Assign: {t.granularTaskName || t.taskTypeName || 'Task'}
            </h3>
          </div>
          <button onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        {/* Mode selection — hidden for TASK-OTHER (manual only) */}
        {!isOther && (
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              How would you like to resume this task?
            </p>

            <button onClick={onSelectAuto}
              className={`w-full flex items-start gap-3 rounded-xl border p-4 text-left transition
                ${mode === 'auto'
                  ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                ${mode === 'auto' ? 'bg-blue-100' : 'bg-slate-100'}`}>
                <Icon name="refresh" className={`h-4 w-4 ${mode === 'auto' ? 'text-blue-600' : 'text-slate-500'}`} />
              </span>
              <div>
                <p className={`text-sm font-semibold ${mode === 'auto' ? 'text-blue-800' : 'text-slate-800'}`}>
                  Auto Route
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  System picks the least-loaded eligible team member automatically.
                </p>
              </div>
            </button>

            <button onClick={onSelectManual}
              className={`w-full flex items-start gap-3 rounded-xl border p-4 text-left transition
                ${mode === 'manual'
                  ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                ${mode === 'manual' ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                <Icon name="users" className={`h-4 w-4 ${mode === 'manual' ? 'text-emerald-600' : 'text-slate-500'}`} />
              </span>
              <div>
                <p className={`text-sm font-semibold ${mode === 'manual' ? 'text-emerald-800' : 'text-slate-800'}`}>
                  Assign Manually
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pick a specific team member from the eligible list.
                </p>
              </div>
            </button>
          </div>
        )}

        {/* TASK-OTHER: always manual — show a note */}
        {isOther && (
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs text-violet-800">
              <Icon name="edit" className="h-4 w-4 shrink-0 mt-0.5 text-violet-600" />
              <span>
                This is a custom <span className="font-semibold">"Other"</span> task — please select a team member to assign it to.
              </span>
            </div>
          </div>
        )}

        {/* Step 2 — user list (manual only) */}
        {mode === 'manual' && (
          <div className="px-5 pb-4 pt-2 space-y-2 border-t border-slate-100">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
              Select a team member
            </p>
            {!loadingUsers && eligibleUsers.length > 0 && (
              <input
                type="text"
                placeholder="Search by name or role…"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                           placeholder-slate-400 focus:outline-none focus:ring-2
                           focus:ring-brand-200 focus:border-brand-400"
              />
            )}
            <div className="max-h-48 overflow-y-auto space-y-1.5">
            {loadingUsers ? (
              <div className="flex items-center justify-center gap-2 py-6 text-slate-400">
                <Icon name="refresh" className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading eligible users…</span>
              </div>
            ) : eligibleUsers.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No eligible users found.</p>
            ) : filteredUsers.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">No users match your search.</p>
            ) : filteredUsers.map(u => (
              <label key={u.userId}
                className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition
                  ${selectedUserId === u.userId
                    ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                <input type="radio" name="assignee" checked={selectedUserId === u.userId}
                  onChange={() => onSelectUser(u.userId)} className="accent-emerald-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{u.fullName}</p>
                  <p className="text-xs text-slate-500">{u.roleName}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-slate-600">
                  {u.currentActiveTasks ?? 0} active
                </span>
              </label>
            ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50">
          <button onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-white transition">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={!canConfirm || acting}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white
                       hover:bg-brand-700 transition disabled:opacity-50 flex items-center gap-2">
            {acting
              ? <><Icon name="refresh" className="h-4 w-4 animate-spin" /> Processing…</>
              : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Cancel confirmation modal ────────────────────────────────────────────────

function CancelConfirmModal({ task: t, onConfirm, onClose, acting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 py-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <Icon name="x" className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">Cancel Task?</h3>
          <p className="mt-1.5 text-sm text-slate-500">
            Task <span className="font-medium text-slate-700">#{t.taskId}</span> (
            {t.granularTaskName || t.taskTypeName || 'Task'}) will be permanently cancelled.
            This cannot be undone.
          </p>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
            Keep Task
          </button>
          <button onClick={onConfirm} disabled={acting}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white
                       hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {acting
              ? <><Icon name="refresh" className="h-4 w-4 animate-spin" /> Cancelling…</>
              : 'Yes, Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TaskManagementPage() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const toast     = useToast()

  const PAGE_SIZE = 20

  const [tasks,         setTasks]         = useState([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages,    setTotalPages]    = useState(0)
  const [page,          setPage]          = useState(0)
  const [loading,       setLoading]       = useState(true)
  const [refreshSeed,   setRefreshSeed]   = useState(0)
  const { user } = useAuth()
  const [editTarget,       setEditTarget]       = useState(null)
  const [briefId,          setBriefId]          = useState(null)
  const [assetPreviewTask, setAssetPreviewTask] = useState(null)

  // ── Per-column filter state (raw — bound directly to inputs) ──────────────
  // Pre-populate status from URL query param (e.g. ?status=REWORK from dashboard)
  const [fTaskId,         setFTaskId]         = useState('')
  const [fCampaign,       setFCampaign]       = useState('')
  const [fRequestor,      setFRequestor]      = useState('')
  const [fAssignee,       setFAssignee]       = useState('')
  const [fTaskType,       setFTaskType]       = useState('')
  const [fPriority,       setFPriority]       = useState('')
  const [fStatus,         setFStatus]         = useState(() => new URLSearchParams(location.search).get('status') || '')
  const [fActionDoneBy,   setFActionDoneBy]   = useState('')
  const [fDateFrom,       setFDateFrom]       = useState(null)
  const [fDateTo,         setFDateTo]         = useState(null)

  // ── Debounced text filters (delay API call while typing) ──────────────────
  const dTaskId       = useDebounce(fTaskId)
  const dCampaign     = useDebounce(fCampaign)
  const dRequestor    = useDebounce(fRequestor)
  const dAssignee     = useDebounce(fAssignee)
  const dActionDoneBy = useDebounce(fActionDoneBy)

  // ── Unhold modal state ────────────────────────────────────────────────────
  const [unholdTarget,   setUnholdTarget]   = useState(null)
  const [unholdMode,     setUnholdMode]     = useState(null)
  const [eligibleUsers,  setEligibleUsers]  = useState([])
  const [loadingUsers,   setLoadingUsers]   = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [actingUnhold,   setActingUnhold]   = useState(false)

  // ── Cancel modal state ────────────────────────────────────────────────────
  const [cancelTarget, setCancelTarget] = useState(null)
  const [actingCancel, setActingCancel] = useState(false)

  // ── Reset to page 0 whenever any filter changes ───────────────────────────
  useEffect(() => { setPage(0) },
    [dTaskId, dCampaign, dRequestor, dAssignee, dActionDoneBy, fTaskType, fPriority, fStatus, fDateFrom, fDateTo]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch data from backend (debounced filters + page) ────────────────────
  useEffect(() => {
    let alive = true
    setLoading(true)
    const params = {
      page, size: PAGE_SIZE,
      ...(dTaskId       && { taskId:          dTaskId       }),
      ...(dCampaign     && { campaignId:      dCampaign     }),
      ...(dRequestor    && { requestorName:   dRequestor    }),
      ...(dAssignee     && { assigneeName:    dAssignee     }),
      ...(dActionDoneBy && { actionDoneBy:    dActionDoneBy }),
      ...(fTaskType     && { taskType:        fTaskType     }),
      ...(fPriority     && { priority:        fPriority     }),
      ...(fStatus       && { status:          fStatus       }),
      ...(fDateFrom     && { dateFrom:        fDateFrom     }),
      ...(fDateTo       && { dateTo:          fDateTo       }),
    }
    managerApi.allTasks(params)
      .then(r => {
        if (!alive) return
        const raw = r.data
        // Handle both old (plain array) and new (PagedResponse) formats
        if (Array.isArray(raw)) {
          setTasks(raw)
          setTotalElements(raw.length)
          setTotalPages(1)
        } else {
          const d = raw || {}
          setTasks(d.content || [])
          setTotalElements(d.totalElements || 0)
          setTotalPages(d.totalPages || 0)
        }
      })
      .catch(() => { if (alive) toast.error('Failed to load requests') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [dTaskId, dCampaign, dRequestor, dAssignee, dActionDoneBy, fTaskType, fPriority, fStatus, fDateFrom, fDateTo, page, refreshSeed, location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Master data for filter dropdowns ─────────────────────────────────────
  const [allTaskTypeOpts, setAllTaskTypeOpts] = useState([])
  useEffect(() => {
    Promise.all([
      masterApi.list('task-types').catch(() => []),
      granularTasksApi.list().catch(() => []),
    ]).then(([types, granular]) => {
      const names = new Set([...types.map(t => t.name), ...granular.map(t => t.taskName)])
      setAllTaskTypeOpts([...names].filter(Boolean).sort())
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const PRIORITY_OPTS = ['HIGH', 'MEDIUM', 'LOW']
  const STATUS_OPTS   = ['ASSIGNED', 'IN_PROGRESS', 'REWORK', 'QC_REVIEW', 'COMPLETED', 'CANCELLED', 'HELD']

  const taskTypeOptions  = allTaskTypeOpts
  const priorityOptions  = PRIORITY_OPTS
  const statusOptions    = STATUS_OPTS

  // The data shown in the table is the current page (server already filtered it)
  const filtered = tasks

  const activeFilters = [fTaskId, fCampaign, fRequestor, fAssignee, fTaskType, fPriority, fStatus, fActionDoneBy, fDateFrom, fDateTo]
    .filter(Boolean).length

  const clearFilters = () => {
    setFTaskId(''); setFCampaign(''); setFRequestor(''); setFAssignee('')
    setFTaskType(''); setFPriority(''); setFStatus(''); setFActionDoneBy('')
    setFDateFrom(null); setFDateTo(null)
    // clear the URL query param if it was set from the dashboard
    if (location.search) navigate('/manager/task-management', { replace: true })
  }

  // ── Hold ─────────────────────────────────────────────────────────────────────
  const [holdingId, setHoldingId] = useState(null)

  const handleHold = async (task) => {
    setHoldingId(task.taskId)
    try {
      await managerApi.holdTask(task.taskId)
      toast.success(`Task ${task.taskId} is now on hold.`)
      setRefreshSeed(s => s + 1)
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Hold failed.')
    } finally {
      setHoldingId(null)
    }
  }

  // ── Unhold — open modal ───────────────────────────────────────────────────────
  const openUnholdModal = (task) => {
    setUnholdTarget(task)
    setSelectedUserId(null)
    setEligibleUsers([])

    if (task.granularTaskId === 'TASK-OTHER') {
      // TASK-OTHER always goes manual — pre-select mode and load eligible users
      setUnholdMode('manual')
      setLoadingUsers(true)
      managerApi.eligibleUsersForTask(task.taskId)
        .then(res => setEligibleUsers(res.data || []))
        .catch(() => toast.error('Failed to load eligible users.'))
        .finally(() => setLoadingUsers(false))
    } else {
      setUnholdMode(null)
    }
  }

  const closeUnholdModal = () => {
    setUnholdTarget(null)
    setUnholdMode(null)
    setSelectedUserId(null)
    setEligibleUsers([])
    setLoadingUsers(false)
  }

  const selectManual = async () => {
    setUnholdMode('manual')
    setLoadingUsers(true)
    try {
      const res = await managerApi.eligibleUsersForTask(unholdTarget.taskId)
      setEligibleUsers(res.data || [])
    } catch {
      toast.error('Failed to load eligible users.')
      setUnholdMode(null)
    } finally {
      setLoadingUsers(false)
    }
  }

  const confirmUnhold = async () => {
    if (!unholdTarget) return
    setActingUnhold(true)
    try {
      if (unholdMode === 'auto') {
        await managerApi.unholdTask(unholdTarget.taskId)
        toast.success(`Task ${unholdTarget.taskId} auto-routed successfully.`)
      } else {
        await managerApi.assignHeldTask(unholdTarget.taskId, selectedUserId)
        toast.success(`Task ${unholdTarget.taskId} assigned successfully.`)
      }
      closeUnholdModal()
      setRefreshSeed(s => s + 1)
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Unhold failed. Please retry.')
    } finally {
      setActingUnhold(false)
    }
  }

  // ── Cancel ────────────────────────────────────────────────────────────────────
  const confirmCancel = async () => {
    if (!cancelTarget) return
    setActingCancel(true)
    try {
      await managerApi.cancelTask(cancelTarget.taskId)
      toast.success(`Task ${cancelTarget.taskId} cancelled.`)
      setCancelTarget(null)
      setRefreshSeed(s => s + 1)
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Cancel failed.')
    } finally {
      setActingCancel(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Task Management</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Every work task across the team. Hold, unhold, cancel (not-started only), edit, or view briefs.
          </p>
        </div>
        <button
          onClick={() => setRefreshSeed(s => s + 1)} disabled={loading}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5
                     text-xs text-slate-600 hover:bg-slate-50 transition disabled:opacity-60 sm:w-auto"
        >
          <Icon name="refresh" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Date range + Stats bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker
          from={fDateFrom}
          to={fDateTo}
          onChange={({ from, to }) => { setFDateFrom(from); setFDateTo(to) }}
          placeholder="All dates"
          maxDate={new Date().toISOString().slice(0, 10)}
        />
        <StatChip icon="clipboard" label={`${totalElements} task${totalElements !== 1 ? 's' : ''}`} color="slate" />
        <StatChip icon="pause"     label={`${tasks.filter(t => t.status === 'HELD').length} on hold (this page)`} color="amber" />
        {activeFilters > 0 && (
          <button onClick={clearFilters}
            className="flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50
                       px-3 py-1 text-xs text-brand-700 hover:bg-brand-100 transition">
            <Icon name="x" className="h-3 w-3" />
            Clear {activeFilters} filter{activeFilters > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <LoadingState />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <Th width="w-16">Task</Th>
                  <Th width="w-28">Campaign</Th>
                  <Th>Requestor</Th>
                  <Th>Assignee</Th>
                  <Th>Task</Th>
                  <Th width="w-24">Priority</Th>
                  <Th width="w-28">Status</Th>
                  <Th width="w-20" title="Times sent back by QC manager">QC Reworks</Th>
                  <Th width="w-24" title="Times sent back by requestor">Req. Reworks</Th>
                  <Th width="w-28">Assigned On</Th>
                  <Th width="w-32" title="Who performed the most recent action on this task">Action done by</Th>
                  <Th align="right" width="w-44" sticky>Actions</Th>
                </tr>
                <tr className="bg-white border-b border-slate-200">
                  <td className="px-2 py-1.5"><TextFilter value={fTaskId}    onChange={setFTaskId}    placeholder="e.g. 42" /></td>
                  <td className="px-2 py-1.5"><TextFilter value={fCampaign}  onChange={setFCampaign}  placeholder="ID…" /></td>
                  <td className="px-2 py-1.5"><TextFilter value={fRequestor} onChange={setFRequestor} placeholder="Search…" /></td>
                  <td className="px-2 py-1.5"><TextFilter value={fAssignee}  onChange={setFAssignee}  placeholder="Search…" /></td>
                  <td className="px-2 py-1.5"><SearchSelectFilter value={fTaskType}  onChange={setFTaskType}  options={taskTypeOptions} /></td>
                  <td className="px-2 py-1.5"><SelectFilter value={fPriority}  onChange={setFPriority}  options={priorityOptions} /></td>
                  <td className="px-2 py-1.5"><SelectFilter value={fStatus}    onChange={setFStatus}    options={statusOptions} /></td>
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5"><TextFilter value={fActionDoneBy} onChange={setFActionDoneBy} placeholder="Search…" /></td>
                  <td className="sticky right-0 z-10 bg-white border-l border-slate-200 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)] px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-14 text-center">
                      <Icon name="inbox" className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-sm text-slate-500">
                        {activeFilters > 0 ? 'No tasks match the current filters.' : 'No tasks found.'}
                      </p>
                      {activeFilters > 0 && (
                        <button onClick={clearFilters} className="mt-2 text-xs text-brand-600 hover:underline">
                          Clear all filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : filtered.map((t, i) => (
                  <TaskRow
                    key={t.taskId}
                    task={t}
                    alt={i % 2 === 1}
                    holding={holdingId === t.taskId}
                    onHold={() => handleHold(t)}
                    onUnhold={() => openUnholdModal(t)}
                    onCancel={() => setCancelTarget(t)}
                    onEdit={() => setEditTarget({ campaignId: t.campaignId, task: t })}
                    onViewBrief={() => setBriefId(t.campaignId)}
                    onViewAssets={() => setAssetPreviewTask(t)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-1">
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
      )}

      {/* Assets modal — completed tasks */}
      {assetPreviewTask && (
        <AssetPreviewModal
          taskId={assetPreviewTask.taskId}
          taskName={assetPreviewTask.granularTaskName || `Task ${assetPreviewTask.taskId}`}
          currentUserId={user?.id}
          onClose={() => setAssetPreviewTask(null)}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <EditCampaignModal
          campaignId={editTarget.campaignId}
          task={editTarget.task}
          onClose={() => setEditTarget(null)}
          onSaved={() => setRefreshSeed(s => s + 1)}
        />
      )}

      {/* Brief drawer */}
      {briefId && <RequestBriefDrawer campaignId={briefId} onClose={() => setBriefId(null)} />}

      {/* Unhold modal */}
      {unholdTarget && (
        <UnholdModal
          task={unholdTarget}
          isOther={unholdTarget.granularTaskId === 'TASK-OTHER'}
          mode={unholdMode}
          onSelectAuto={() => setUnholdMode('auto')}
          onSelectManual={selectManual}
          eligibleUsers={eligibleUsers}
          loadingUsers={loadingUsers}
          selectedUserId={selectedUserId}
          onSelectUser={setSelectedUserId}
          onConfirm={confirmUnhold}
          onClose={closeUnholdModal}
          acting={actingUnhold}
        />
      )}

      {/* Cancel confirmation modal */}
      {cancelTarget && (
        <CancelConfirmModal
          task={cancelTarget}
          onConfirm={confirmCancel}
          onClose={() => setCancelTarget(null)}
          acting={actingCancel}
        />
      )}
    </div>
  )
}

// ─── Table header cell ────────────────────────────────────────────────────────

function Th({ children, align = 'left', width = '', sticky = false }) {
  return (
    <th className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wider
                    text-slate-500 whitespace-nowrap text-${align} ${width}
                    ${sticky ? 'sticky right-0 z-10 bg-slate-50 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)] border-l border-slate-200' : ''}`}>
      {children}
    </th>
  )
}

// ─── Data row ─────────────────────────────────────────────────────────────────

function TaskRow({ task: t, alt, holding, onHold, onUnhold, onCancel, onEdit, onViewBrief, onViewAssets }) {
  // Hold: only ASSIGNED (not started yet)
  const canHold   = t.status === 'ASSIGNED'
  // Unhold: only HELD
  const canUnhold = t.status === 'HELD'
  // Cancel: ASSIGNED or HELD (not yet started / paused)
  const canCancel = t.status === 'ASSIGNED' || t.status === 'HELD'

  return (
    <tr className={`border-b border-slate-100 transition-colors hover:bg-brand-50/30
                    ${alt ? 'bg-slate-50' : 'bg-white'}`}>

      <td className="px-3 py-2.5">
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-500">
          <span className="font-normal text-slate-400">TASK</span>{t.taskId}
        </span>
      </td>

      <td className="px-3 py-2.5">
        <button onClick={onViewBrief} className="font-medium text-brand-700 hover:underline leading-tight">
          #{t.campaignId}
        </button>
        {t.taskTypeName && (
          <div className="text-xs text-slate-400 mt-0.5">{t.taskTypeName}</div>
        )}
      </td>

      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
        {t.requestorName || <span className="text-slate-300">—</span>}
      </td>

      <td className="px-3 py-2.5">
        {t.assigneeName
          ? <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5
                             text-xs font-medium text-slate-700">
              <Icon name="users" className="h-3 w-3 text-slate-400" />{t.assigneeName}
            </span>
          : <span className="text-slate-300">Unassigned</span>}
      </td>

      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
        {t.granularTaskName || t.taskTypeName || <span className="text-slate-300">—</span>}
      </td>

      <td className="px-3 py-2.5">
        {t.campaignPriority
          ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs
                              font-medium ring-1 ${PRIORITY_STYLES[t.campaignPriority] || 'bg-slate-100 text-slate-600'}`}>
              {t.campaignPriority}
            </span>
          : <span className="text-slate-300">—</span>}
      </td>

      <td className="px-3 py-2.5">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs
                          font-medium ring-1 ${STATUS_STYLES[t.status] || 'bg-slate-100 text-slate-600'}`}>
          {STATUS_LABELS[t.status] || t.status}
        </span>
      </td>

      <td className="px-3 py-2.5 text-center">
        {t.reworkCount > 0
          ? <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5
                             text-xs font-semibold text-orange-700 ring-1 ring-orange-200">
              {t.reworkCount}
            </span>
          : <span className="text-slate-300">—</span>}
      </td>

      <td className="px-3 py-2.5 text-center">
        {t.requestorReworkCount > 0
          ? <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5
                             text-xs font-semibold text-purple-700 ring-1 ring-purple-200">
              {t.requestorReworkCount}
            </span>
          : <span className="text-slate-300">—</span>}
      </td>

      <td className="px-3 py-2.5 whitespace-nowrap text-slate-500 text-xs">
        {t.assignedAt ? fmtDate(t.assignedAt) : <span className="text-slate-300">—</span>}
      </td>

      <td className="px-3 py-2.5 text-slate-600 text-xs whitespace-nowrap">
        {t.latestActionDoneByName
          ? <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5
                             text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
              {t.latestActionDoneByName}
            </span>
          : <span className="text-slate-300">N/A</span>}
      </td>

      <td className={`sticky right-0 z-10 px-3 py-2.5 border-l border-slate-200 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]
                      ${alt ? 'bg-slate-50' : 'bg-white'}`}>
        <div className="flex items-center justify-end gap-1">
          {/* Brief */}
          <button onClick={onViewBrief} title="View brief"
            className="rounded border border-slate-200 p-1.5 text-slate-400
                       hover:bg-slate-50 hover:text-slate-700 transition">
            <Icon name="eye" className="h-3.5 w-3.5" />
          </button>

          {/* Assets — completed tasks only */}
          {t.status === 'COMPLETED' && (
            <button onClick={onViewAssets} title="View assets"
              className="rounded border border-green-200 bg-green-50 p-1.5 text-green-600
                         hover:bg-green-100 hover:text-green-800 transition">
              <Icon name="fileText" className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Edit */}
          <button onClick={onEdit} title="Edit campaign"
            className="rounded border border-slate-200 p-1.5 text-slate-400
                       hover:bg-slate-50 hover:text-slate-700 transition">
            <Icon name="edit" className="h-3.5 w-3.5" />
          </button>

          {/* Hold */}
          {canHold && (
            <button onClick={onHold} disabled={holding} title="Hold task"
              className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs
                         font-medium text-amber-700 hover:bg-amber-100 transition disabled:opacity-50
                         flex items-center gap-1">
              {holding
                ? <Icon name="refresh" className="h-3 w-3 animate-spin" />
                : <><Icon name="pause" className="h-3 w-3" /> Hold</>}
            </button>
          )}

          {/* Unhold → opens modal */}
          {canUnhold && (
            <button onClick={onUnhold} title="Unhold task"
              className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs
                         font-medium text-emerald-700 hover:bg-emerald-100 transition flex items-center gap-1">
              <Icon name="check" className="h-3 w-3" /> Unhold
            </button>
          )}

          {/* Cancel */}
          {canCancel && (
            <button onClick={onCancel} title="Cancel task"
              className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs
                         font-medium text-red-600 hover:bg-red-100 transition flex items-center gap-1">
              <Icon name="x" className="h-3 w-3" /> Cancel
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatChip({ icon, label, color }) {
  const colors = {
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    brand: 'border-brand-200 bg-brand-50 text-brand-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  }
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${colors[color] || colors.slate}`}>
      <Icon name={icon} className="h-4 w-4" />
      <span className="text-xs font-semibold">{label}</span>
    </div>
  )
}

function fmtDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function LoadingState() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
      <Icon name="refresh" className="mx-auto h-8 w-8 text-slate-300 mb-3 animate-spin" />
      <p className="text-sm text-slate-400">Loading all requests…</p>
    </div>
  )
}

function EmptyState({ hasFilters, onClear }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
      <Icon name="inbox" className="mx-auto h-10 w-10 text-slate-300 mb-3" />
      {hasFilters
        ? <>
            <p className="text-sm font-medium text-slate-600">No tasks match your filters</p>
            <button onClick={onClear} className="mt-3 text-sm text-brand-600 hover:underline">
              Clear all filters
            </button>
          </>
        : <p className="text-sm font-medium text-slate-600">No work tasks found</p>}
    </div>
  )
}
