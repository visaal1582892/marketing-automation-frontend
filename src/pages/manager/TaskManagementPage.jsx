import { useCallback, useEffect, memo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import managerApi from '../../api/manager'
import campaignsApi from '../../api/campaigns'
import { masterApi, granularTasksApi } from '../../api/masterData'
import useDebounce from '../../hooks/useDebounce'
import Pagination from '../../components/Pagination'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'
import RequestBriefDrawer from '../../components/RequestBriefDrawer'
import AssetPreviewModal from '../../components/AssetPreviewModal'
import { useAuth } from '../../auth/AuthContext'
import AppSelect from '../../components/AppSelect'
import DateRangePicker from '../../components/DateRangePicker'
import { DATA_TABLE_CLASS, DataTableColGroup, TableStatusRow, dataTableStyle } from '../../components/dataTable'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  ASSIGNED:             'bg-blue-50 text-blue-700 ring-blue-200',
  IN_PROGRESS:          'bg-indigo-50 text-indigo-700 ring-indigo-200',
  REWORK:               'bg-orange-50 text-orange-700 ring-orange-200',
  MANAGER_QC_REVIEW:    'bg-purple-50 text-purple-700 ring-purple-200',
  REQUESTOR_QC_REVIEW:  'bg-violet-50 text-violet-700 ring-violet-200',
  COMPLETED:            'bg-green-50 text-green-700 ring-green-200',
  CANCELLED:            'bg-slate-100 text-slate-500 ring-slate-200',
  HELD:                 'bg-amber-50 text-amber-700 ring-amber-200',
}
const STATUS_LABELS = {
  ASSIGNED:             'Assigned',
  IN_PROGRESS:          'In Progress',
  REWORK:               'Rework',
  MANAGER_QC_REVIEW:    'Manager QC Review',
  REQUESTOR_QC_REVIEW:  'Requestor QC Review',
  COMPLETED:            'Completed',
  CANCELLED:            'Cancelled',
  REJECTED:             'Rejected',
  HELD:                 'Held',
  REQUESTED:            'Requested'
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

// ─── Table column layout (fixed widths — keeps header / filter / body aligned) ─

/** Min px per column — table scrolls horizontally when viewport narrower than sum */
const TASK_COLS_GENERAL = [88, 124, 144, 144, 164, 196, 108, 160, 112, 124, 136, 136, 172, 240]
/** Source task, Requested by, Content status — inserted after Task, before Campaign */
const TASK_COLS_AUTO_MID = [116, 160, 168]

const cellCls = 'min-w-0 overflow-hidden px-4 py-2.5'

/** Sticky Actions column — solid bg so fixed column obvious */
const ACTIONS_STICKY_HEADER = 'sticky right-0 z-30 bg-slate-100'
const ACTIONS_STICKY_BODY = 'sticky right-0 z-[1] bg-slate-50'

function taskTableCols(autoMode) {
  if (!autoMode) return TASK_COLS_GENERAL
  return [
    TASK_COLS_GENERAL[0],
    ...TASK_COLS_AUTO_MID,
    148, // Campaign — room for #id + task type line
    ...TASK_COLS_GENERAL.slice(2),
  ]
}

function taskTableMinWidth(autoMode) {
  return taskTableCols(autoMode).reduce((sum, w) => sum + w, 0)
}

// ─── Inline column-filter primitives ─────────────────────────────────────────

const filterWrapCls = 'min-w-0 w-full [&_.app-select__control]:!min-h-[28px] [&_.app-select__control]:!h-[28px]'

function SelectFilter({ value, onChange, options, placeholder = 'All' }) {
  const normOpts = options.map(o => ({ value: o, label: STATUS_LABELS[o] || o }))
  return (
    <div className={filterWrapCls}>
      <AppSelect
        className="w-full"
        value={value}
        onChange={onChange}
        options={normOpts}
        placeholder={placeholder}
        size="sm"
        isSearchable
        menuPortal
      />
    </div>
  )
}

function SearchSelectFilter({ value, onChange, options, placeholder = 'All' }) {
  const normOpts = options.map(o => ({
    value: o,
    label: STATUS_LABELS[o] || o,
  }))

  return (
    <div className={filterWrapCls}>
      <AppSelect
        className="w-full"
        value={value}
        onChange={v => onChange(v ?? '')}
        options={normOpts}
        placeholder={placeholder}
        size="sm"
        isSearchable
        menuPortal
      />
    </div>
  )
}

function TextFilter({ value, onChange, placeholder }) {
  return (
    <div className="relative min-w-0 w-full">
      <Icon name="search" className="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded border py-1 pl-5 pr-1.5 text-xs leading-tight
                    focus:outline-none focus:ring-1 focus:ring-brand-300
                    ${value
                      ? 'border-brand-400 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white text-slate-500'}`}
      />
    </div>
  )
}

function FilterTd({ children, sticky = false }) {
  return (
    <td className={`min-w-0 px-3 py-1.5 align-top ${sticky ? ACTIONS_STICKY_HEADER : 'bg-white'}`}>
      {children != null ? <div className="min-w-0 w-full">{children}</div> : null}
    </td>
  )
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

// Tasks whose status blocks deletion (matches backend constraint)
const UNDELETABLE_STATUSES = new Set(['IN_PROGRESS', 'REWORK', 'MANAGER_QC_REVIEW', 'COMPLETED'])

const TASK_STATUS_STYLES = {
  ASSIGNED:             'bg-blue-50 text-blue-700 ring-blue-200',
  IN_PROGRESS:          'bg-indigo-50 text-indigo-700 ring-indigo-200',
  REWORK:               'bg-orange-50 text-orange-700 ring-orange-200',
  MANAGER_QC_REVIEW:    'bg-purple-50 text-purple-700 ring-purple-200',
  REQUESTOR_QC_REVIEW:  'bg-violet-50 text-violet-700 ring-violet-200',
  COMPLETED:            'bg-green-50 text-green-700 ring-green-200',
  CANCELLED:            'bg-slate-100 text-slate-500 ring-slate-200',
  HELD:                 'bg-amber-50 text-amber-700 ring-amber-200',
}

function EditCampaignModal({ campaignId, task, onClose, onSaved }) {
  const toast = useToast()
  const [form,       setForm]       = useState({ priority: '', budgetTier: '', budgetTierOther: '', keyMessage: '' })
  const [budgetOpts, setBudgetOpts] = useState([])
  const [fetching,   setFetching]   = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [workTasks,  setWorkTasks]  = useState([])
  const [deletingId, setDeletingId] = useState(null)

  const resolveId = (opts, storedVal) => {
    if (!storedVal) return { selected: '', other: '' }
    return opts.find(o => o.value === storedVal && o.value !== 'Other')
      ? { selected: storedVal, other: '' }
      : { selected: 'Other', other: storedVal }
  }

  const loadCampaign = () => {
    setFetching(true)
    Promise.all([
      campaignsApi.getById(campaignId),
      masterApi.list('budget-tiers'),
    ]).then(([campRes, budgets]) => {
        const c    = campRes.data
        const raw  = Array.isArray(budgets) ? budgets : []
        const opts = [
          ...raw.map(i => ({ value: i.id, label: i.name })),
          { value: 'Other', label: 'Other (specify below)' },
        ]
        setBudgetOpts(opts)
        const bgt = resolveId(opts, c.budgetTierId || '')
        setForm({ priority: c.priority || '', budgetTier: bgt.selected, budgetTierOther: bgt.other, keyMessage: c.keyMessage || '' })
        setWorkTasks(Array.isArray(c.workTasks) ? c.workTasks : [])
      })
      .catch(() => toast.error('Could not load campaign details.'))
      .finally(() => setFetching(false))
  }

  useEffect(loadCampaign, [campaignId]) // eslint-disable-line react-hooks/exhaustive-deps

  const resolveBudget = () =>
    form.budgetTier === 'Other'
      ? (form.budgetTierOther?.trim() || undefined)
      : (form.budgetTier || undefined)

  const handleSave = async () => {
    setSaving(true)
    try {
      await campaignsApi.updateCampaign(campaignId, {
        priority:   form.priority  || undefined,
        budgetTier: resolveBudget(),
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

  const handleDeleteTask = async (wt) => {
    if (!window.confirm(`Delete task "${wt.granularTaskName || wt.taskTypeName || wt.taskId}"? This cannot be undone.`)) return
    setDeletingId(wt.taskId)
    try {
      await campaignsApi.deleteTask(campaignId, wt.taskId)
      toast.success(`Task ${wt.taskId} deleted.`)
      setWorkTasks(prev => prev.filter(t => t.taskId !== wt.taskId))
      onSaved()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not delete task.')
    } finally {
      setDeletingId(null)
    }
  }

  const visibleTasks = workTasks.filter(t => t.status !== 'CANCELLED')

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 flex-shrink-0">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Edit Campaign</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Campaign {campaignId}{task?.taskId ? ` · Task ${task.taskId}` : ''}
            </p>
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
          <div className="overflow-y-auto flex-1">
            {/* Campaign fields */}
            <div className="space-y-4 px-5 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
                  <AppSelect
                    value={form.priority}
                    onChange={v => setForm(f => ({ ...f, priority: v }))}
                    options={PRIORITY_OPTIONS.map(p => ({ value: p, label: p.charAt(0) + p.slice(1).toLowerCase() }))}
                    placeholder="Select priority…"
                    isClearable={false}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Budget Tier</label>
                  <AppSelect
                    value={form.budgetTier}
                    onChange={v => setForm(f => ({ ...f, budgetTier: v, budgetTierOther: v !== 'Other' ? '' : f.budgetTierOther }))}
                    options={budgetOpts}
                    placeholder="Select budget tier…"
                    isClearable={false}
                  />
                  {form.budgetTier === 'Other' && (
                    <input
                      value={form.budgetTierOther}
                      onChange={e => setForm(f => ({ ...f, budgetTierOther: e.target.value }))}
                      placeholder="Specify budget tier…"
                      className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm
                                 text-slate-800 placeholder:text-slate-400 focus:border-brand-400
                                 focus:outline-none focus:ring-1 focus:ring-brand-300"
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Key Message</label>
                <textarea value={form.keyMessage} onChange={e => setForm(f => ({ ...f, keyMessage: e.target.value }))}
                  rows={2} placeholder="Type a new key message…"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800
                             placeholder:text-slate-400 focus:border-brand-400 focus:outline-none
                             focus:ring-1 focus:ring-brand-300 resize-none" />
              </div>
            </div>

          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:justify-end flex-shrink-0">
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
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-600">
              {t.taskId}
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
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/40">
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
  const [generalHeldCount, setGeneralHeldCount] = useState(0)
  const [autoHeldCount,    setAutoHeldCount]    = useState(0)
  const { user } = useAuth()
  const [editTarget,       setEditTarget]       = useState(null)
  const [briefId,          setBriefId]          = useState(null)
  const [briefTaskId,      setBriefTaskId]      = useState(null)
  const [assetPreviewTask, setAssetPreviewTask] = useState(null)
  const [taskListMode,     setTaskListMode]     = useState('general')

  // ── Per-column filter state (raw — bound directly to inputs) ──────────────
  // Pre-populate status from URL query param (e.g. ?status=REWORK from dashboard)
  const [fTaskId,         setFTaskId]         = useState('')
  const [fCampaign,       setFCampaign]       = useState('')
  const [fStoreId,        setFStoreId]        = useState('')
  const [fRequestor,      setFRequestor]      = useState('')
  const [fAssignee,       setFAssignee]       = useState('')
  const [fTaskType,       setFTaskType]       = useState('')
  const [fPriority,       setFPriority]       = useState('')
  const [fStatus,         setFStatus]         = useState(() => new URLSearchParams(location.search).get('status') || '')
  const [fActionDoneBy,   setFActionDoneBy]   = useState('')
  const [fSourceTaskId, setFSourceTaskId]     = useState('')
  const [fContentRequestedBy, setFContentRequestedBy] = useState('')
  const [fContentRequestStatus, setFContentRequestStatus] = useState('')
  const [fDateFrom,       setFDateFrom]       = useState(null)
  const [fDateTo,         setFDateTo]         = useState(null)

  // ── Debounced text filters (delay API call while typing) ──────────────────
  const dTaskId       = useDebounce(fTaskId)
  const dCampaign     = useDebounce(fCampaign)
  const dStoreId      = useDebounce(fStoreId)
  const dRequestor    = useDebounce(fRequestor)
  const dAssignee     = useDebounce(fAssignee)
  const dActionDoneBy = useDebounce(fActionDoneBy)
  const dSourceTaskId = useDebounce(fSourceTaskId)
  const dContentRequestedBy = useDebounce(fContentRequestedBy)

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
    [dTaskId, dCampaign, dStoreId, dRequestor, dAssignee, dActionDoneBy, dSourceTaskId, dContentRequestedBy,
      fContentRequestStatus, fTaskType, fPriority, fStatus, fDateFrom, fDateTo, taskListMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch data from backend (debounced filters + page) ────────────────────
  useEffect(() => {
    let alive = true
    setLoading(true)
    const params = {
      page, size: PAGE_SIZE,
      ...(dTaskId       && { taskId:          dTaskId       }),
      ...(dCampaign     && { campaignId:      dCampaign     }),
      ...(dStoreId      && { storeId:         dStoreId      }),
      ...(dRequestor    && { requestorName:   dRequestor    }),
      ...(dAssignee     && { assigneeName:    dAssignee     }),
      ...(dActionDoneBy && { actionDoneBy:    dActionDoneBy }),
      ...(fTaskType     && { taskType:        fTaskType     }),
      ...(fPriority     && { priority:        fPriority     }),
      ...(fStatus       && { status:          fStatus       }),
      ...(fDateFrom     && { dateFrom:        fDateFrom     }),
      ...(fDateTo       && { dateTo:          fDateTo       }),
      autoGenerated: taskListMode === 'auto',
      ...(taskListMode === 'auto' && dSourceTaskId && { sourceTaskId: dSourceTaskId }),
      ...(taskListMode === 'auto' && dContentRequestedBy && { contentRequestedBy: dContentRequestedBy }),
      ...(taskListMode === 'auto' && fContentRequestStatus && { contentRequestStatus: fContentRequestStatus }),
    }
    const heldCountParams = { status: 'HELD', page: 0, size: 1 }
    Promise.all([
      managerApi.allTasks(params),
      managerApi.allTasks({ ...heldCountParams, autoGenerated: false }),
      managerApi.allTasks({ ...heldCountParams, autoGenerated: true }),
    ]).then(([r, heldGeneral, heldAuto]) => {
        if (!alive) return
        const raw = r.data
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
        const parseHeldTotal = (res) => {
          const d = res?.data
          if (Array.isArray(d)) return d.length
          return d?.totalElements ?? 0
        }
        setGeneralHeldCount(parseHeldTotal(heldGeneral))
        setAutoHeldCount(parseHeldTotal(heldAuto))
      })
      .catch(() => { if (alive) toast.error('Failed to load requests') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [dTaskId, dCampaign, dStoreId, dRequestor, dAssignee, dActionDoneBy, dSourceTaskId, dContentRequestedBy,
    fContentRequestStatus, fTaskType, fPriority, fStatus, fDateFrom, fDateTo, page, refreshSeed, location.key, taskListMode]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const STATUS_OPTS   = ['ASSIGNED', 'IN_PROGRESS', 'REWORK', 'MANAGER_QC_REVIEW', 'REQUESTOR_QC_REVIEW', 'COMPLETED', 'CANCELLED', 'REJECTED', 'HELD']
  const CONTENT_REQUEST_STATUS_OPTS = ['REQUESTED', 'ASSIGNED', 'IN_PROGRESS', 'REWORK', 'MANAGER_QC_REVIEW', 'REQUESTOR_QC_REVIEW', 'COMPLETED', 'CANCELLED', 'HELD']

  const taskTypeOptions  = allTaskTypeOpts
  const priorityOptions  = PRIORITY_OPTS
  const statusOptions    = STATUS_OPTS
  const contentRequestStatusOptions = CONTENT_REQUEST_STATUS_OPTS

  // The data shown in the table is the current page (server already filtered it)
  const filtered = tasks

  const activeFilters = [fTaskId, fCampaign, fStoreId, fRequestor, fAssignee, fTaskType, fPriority, fStatus, fActionDoneBy,
    fSourceTaskId, fContentRequestedBy, fContentRequestStatus, fDateFrom, fDateTo]
    .filter(Boolean).length

  const clearFilters = () => {
    setFTaskId(''); setFCampaign(''); setFStoreId(''); setFRequestor(''); setFAssignee('')
    setFTaskType(''); setFPriority(''); setFStatus(''); setFActionDoneBy('')
    setFSourceTaskId(''); setFContentRequestedBy(''); setFContentRequestStatus('')
    setFDateFrom(null); setFDateTo(null)
    // clear the URL query param if it was set from the dashboard
    if (location.search) navigate('/manager/task-management', { replace: true })
  }

  // ── Stable row action callbacks (for React.memo on TaskRow) ──────────────────
  const cbHold       = useCallback((task) => handleHold(task),      []) // eslint-disable-line react-hooks/exhaustive-deps
  const cbOpenUnhold = useCallback((task) => openUnholdModal(task), []) // eslint-disable-line react-hooks/exhaustive-deps
  const cbSetCancel  = useCallback((task) => setCancelTarget(task), [])
  const cbSetEdit    = useCallback((task) => setEditTarget({ campaignId: task.campaignId, task }), [])
  const cbSetBrief   = useCallback((task) => {
    setBriefId(task.campaignId)
    setBriefTaskId(task.taskId)
  }, [])
  const cbSetAssets  = useCallback((task) => setAssetPreviewTask(task), [])

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

  const autoListMode = taskListMode === 'auto'
  const tableColSpan = autoListMode ? 17 : 14

  return (
    <div className="h-full flex flex-col gap-2">
      {/* ── Controls bar ── */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            from={fDateFrom}
            to={fDateTo}
            onChange={({ from, to }) => { setFDateFrom(from); setFDateTo(to) }}
            placeholder="All dates"
            maxDate={new Date().toISOString().slice(0, 10)}
          />
          <StatChip icon="clipboard" label={`${totalElements} task${totalElements !== 1 ? 's' : ''}`} color="slate" />
          <StatChip
            icon="pause"
            label={autoListMode
              ? `${autoHeldCount} auto task${autoHeldCount !== 1 ? 's' : ''} on hold`
              : `${generalHeldCount} general task${generalHeldCount !== 1 ? 's' : ''} on hold`}
            color="amber"
          />
          {activeFilters > 0 && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50
                         px-3 py-1 text-xs text-brand-700 hover:bg-brand-100 transition">
              <Icon name="x" className="h-3 w-3" />
              Clear {activeFilters} filter{activeFilters > 1 ? 's' : ''}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => {
                setTaskListMode('general')
                setFSourceTaskId('')
                setFContentRequestedBy('')
                setFContentRequestStatus('')
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                taskListMode === 'general'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              General Tasks
            </button>
            <button
              type="button"
              onClick={() => setTaskListMode('auto')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                taskListMode === 'auto'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Auto Generated Tasks
            </button>
          </div>
          <button
            onClick={() => setRefreshSeed(s => s + 1)} disabled={loading}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5
                       text-xs text-slate-600 hover:bg-slate-50 transition disabled:opacity-60"
          >
            <Icon name="refresh" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="w-full flex-1 overflow-auto">
            <table
              className={DATA_TABLE_CLASS}
              style={dataTableStyle(taskTableMinWidth(autoListMode))}
            >
              <DataTableColGroup widths={taskTableCols(autoListMode)} />
              <thead className="sticky top-0 z-20 bg-slate-50">
                <tr className="bg-slate-50">
                  <Th>Task</Th>
                  {autoListMode && <Th>Source Task</Th>}
                  {autoListMode && <Th>Requested By</Th>}
                  {autoListMode && <Th>Content Status</Th>}
                  <Th>Campaign</Th>
                  <Th>Store ID</Th>
                  <Th>{autoListMode ? 'Source Requestor' : 'Requestor'}</Th>
                  <Th>Assignee</Th>
                  <Th>Task</Th>
                  <Th>Priority</Th>
                  <Th>Status</Th>
                  <Th title="Times sent back by QC manager">QC Reworks</Th>
                  <Th title="Times sent back by requestor">Req. Reworks</Th>
                  <Th>Created On</Th>
                  <Th>Assigned On</Th>
                  <Th title="Who performed the most recent action on this task">Action done by</Th>
                  <Th align="right" sticky>Actions</Th>
                </tr>
                <tr className="border-b border-slate-200">
                  <FilterTd><TextFilter value={fTaskId} onChange={setFTaskId} placeholder="e.g. 42" /></FilterTd>
                  {autoListMode && (
                    <FilterTd>
                      <TextFilter value={fSourceTaskId} onChange={setFSourceTaskId} placeholder="Search…" />
                    </FilterTd>
                  )}
                  {autoListMode && (
                    <FilterTd>
                      <TextFilter value={fContentRequestedBy} onChange={setFContentRequestedBy} placeholder="Search…" />
                    </FilterTd>
                  )}
                  {autoListMode && (
                    <FilterTd>
                      <SearchSelectFilter
                        value={fContentRequestStatus}
                        onChange={setFContentRequestStatus}
                        options={contentRequestStatusOptions}
                        placeholder="All"
                      />
                    </FilterTd>
                  )}
                  <FilterTd><TextFilter value={fCampaign} onChange={setFCampaign} placeholder="ID…" /></FilterTd>
                  <FilterTd><TextFilter value={fStoreId} onChange={setFStoreId} placeholder="Search…" /></FilterTd>
                  <FilterTd><TextFilter value={fRequestor} onChange={setFRequestor} placeholder="Search…" /></FilterTd>
                  <FilterTd><TextFilter value={fAssignee} onChange={setFAssignee} placeholder="Search…" /></FilterTd>
                  <FilterTd><SearchSelectFilter value={fTaskType} onChange={setFTaskType} options={taskTypeOptions} /></FilterTd>
                  <FilterTd><SelectFilter value={fPriority} onChange={setFPriority} options={priorityOptions} /></FilterTd>
                  <FilterTd><SelectFilter value={fStatus} onChange={setFStatus} options={statusOptions} /></FilterTd>
                  <FilterTd />
                  <FilterTd />
                  <FilterTd />
                  <FilterTd />
                  <FilterTd><TextFilter value={fActionDoneBy} onChange={setFActionDoneBy} placeholder="Search…" /></FilterTd>
                  <FilterTd sticky />
                </tr>
              </thead>
              <tbody className="bg-white">
                {loading ? (
                  <TableStatusRow colSpan={tableColSpan}>
                    <LoadingState inline />
                  </TableStatusRow>
                ) : filtered.length === 0 ? (
                  <TableStatusRow colSpan={tableColSpan}>
                    <Icon name="inbox" className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500">
                      {activeFilters > 0 ? 'No tasks match the current filters.' : 'No tasks found.'}
                    </p>
                    {activeFilters > 0 && (
                      <button onClick={clearFilters} className="mt-2 text-xs text-brand-600 hover:underline">
                        Clear all filters
                      </button>
                    )}
                  </TableStatusRow>
                ) : filtered.map((t, i) => (
                  <TaskRow
                    key={t.taskId}
                    task={t}
                    alt={i % 2 === 1}
                    autoMode={autoListMode}
                    holding={holdingId === t.taskId}
                    onHold={cbHold}
                    onUnhold={cbOpenUnhold}
                    onCancel={cbSetCancel}
                    onEdit={cbSetEdit}
                    onViewBrief={cbSetBrief}
                    onViewAssets={cbSetAssets}
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
      {briefId && (
        <RequestBriefDrawer
          campaignId={briefId}
          filterTaskId={briefTaskId}
          onClose={() => { setBriefId(null); setBriefTaskId(null) }}
          onCommentAnswered={({ taskId, hasActiveComments }) => {
            setTasks(prev => prev.map(t =>
              String(t.taskId) === String(taskId) ? { ...t, hasActiveComments } : t
            ))
          }}
          onCampaignChanged={() => setRefreshSeed(s => s + 1)}
        />
      )}

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

function Th({ children, align = 'left', sticky = false, title }) {
  return (
    <th
      title={title}
      className={`min-w-0 border-b border-slate-200 px-4 py-2.5 text-xs font-semibold uppercase
                  tracking-wide whitespace-nowrap
                  ${align === 'right' ? 'text-right' : 'text-left'}
                  ${sticky ? `${ACTIONS_STICKY_HEADER} text-slate-600` : 'bg-slate-50 text-slate-500'}`}
    >
      {children}
    </th>
  )
}

// ─── Data row ─────────────────────────────────────────────────────────────────

const TaskRow = memo(function TaskRow({ task: t, alt, autoMode = false, holding, onHold, onUnhold, onCancel, onEdit, onViewBrief, onViewAssets }) {
  // Hold: ASSIGNED or REWORK (manager can pause and reassign)
  const canHold   = t.status === 'ASSIGNED' || t.status === 'REWORK'
  // Unhold: only HELD
  const canUnhold = t.status === 'HELD'
  // Cancel: ASSIGNED, REWORK or HELD
  const canCancel = t.status === 'ASSIGNED' || t.status === 'REWORK' || t.status === 'HELD'

  return (
    <tr className={`border-b border-slate-100 transition-colors hover:bg-brand-50/30
                    ${alt ? 'bg-slate-50' : 'bg-white'}`}>

      <td className={cellCls}>
        <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-600">
          {t.taskId}
        </span>
      </td>

      {autoMode && (
        <td className={`${cellCls} text-slate-600`}>
          {t.sourceTaskId
            ? <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-600">
                {t.sourceTaskId}
              </span>
            : <span className="text-slate-300">—</span>}
        </td>
      )}
      {autoMode && (
        <td className={`${cellCls} text-slate-600`}>
          <span className="block truncate" title={t.contentRequestedByName}>
            {t.contentRequestedByName || <span className="text-slate-300">—</span>}
          </span>
        </td>
      )}
      {autoMode && (
        <td className={cellCls}>
          {t.contentRequestStatus
            ? <span className="inline-flex max-w-full truncate items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-200">
                {STATUS_LABELS[t.contentRequestStatus] || t.contentRequestStatus}
              </span>
            : <span className="text-slate-300">—</span>}
        </td>
      )}

      <td className={cellCls}>
        <button onClick={() => onViewBrief(t)} className="block truncate text-left font-medium text-brand-700 hover:underline leading-tight">
          #{t.campaignId}
        </button>
        {t.taskTypeName && (
          <div className="mt-0.5 truncate text-xs text-slate-400" title={t.taskTypeName}>{t.taskTypeName}</div>
        )}
      </td>

      <td className={`${cellCls} text-xs text-slate-600`}>
        {t.storeId
          ? <span className="block truncate font-medium text-slate-700" title={t.storeId}>{t.storeId}</span>
          : <span className="text-slate-300">—</span>}
      </td>

      <td className={`${cellCls} text-slate-600`}>
        {t.requestorName
          ? <span className="block truncate" title={t.requestorName}>{t.requestorName}</span>
          : <span className="text-slate-300">—</span>}
      </td>

      <td className={cellCls}>
        {t.assigneeName
          ? <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-slate-100 px-2 py-0.5
                             text-xs font-medium text-slate-700" title={t.assigneeName}>
              <Icon name="users" className="h-3 w-3 shrink-0 text-slate-400" />
              <span className="truncate">{t.assigneeName}</span>
            </span>
          : <span className="text-slate-300">Unassigned</span>}
      </td>

      <td className={`${cellCls} text-slate-600`}>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate" title={t.granularTaskName || t.taskTypeName}>
            {t.granularTaskName || t.taskTypeName || <span className="text-slate-300">—</span>}
          </span>
          {t.hasActiveComments && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-200 w-fit">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500" />
              </span>
              New comment
            </span>
          )}
        </div>
      </td>

      <td className={cellCls}>
        {t.campaignPriority
          ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs
                              font-medium ring-1 ${PRIORITY_STYLES[t.campaignPriority] || 'bg-slate-100 text-slate-600'}`}>
              {t.campaignPriority}
            </span>
          : <span className="text-slate-300">—</span>}
      </td>

      <td className={cellCls}>
        <span className={`inline-flex max-w-full truncate items-center rounded-full px-2 py-0.5 text-xs
                          font-medium ring-1 ${STATUS_STYLES[t.status] || 'bg-slate-100 text-slate-600'}`}
              title={STATUS_LABELS[t.status] || t.status}>
          {STATUS_LABELS[t.status] || t.status}
        </span>
      </td>

      <td className={`${cellCls} text-center`}>
        {t.reworkCount > 0
          ? <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5
                             text-xs font-semibold text-orange-700 ring-1 ring-orange-200">
              {t.reworkCount}
            </span>
          : <span className="text-slate-300">—</span>}
      </td>

      <td className={`${cellCls} text-center`}>
        {t.requestorReworkCount > 0
          ? <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5
                             text-xs font-semibold text-purple-700 ring-1 ring-purple-200">
              {t.requestorReworkCount}
            </span>
          : <span className="text-slate-300">—</span>}
      </td>

      <td className={`${cellCls} whitespace-nowrap text-xs text-slate-500`}>
        <span className="block truncate" title={t.createdAt ? fmtDate(t.createdAt) : undefined}>
          {t.createdAt ? fmtDate(t.createdAt) : <span className="text-slate-300">—</span>}
        </span>
      </td>

      <td className={`${cellCls} whitespace-nowrap text-xs text-slate-500`}>
        <span className="block truncate" title={t.assignedAt ? fmtDate(t.assignedAt) : undefined}>
          {t.assignedAt ? fmtDate(t.assignedAt) : <span className="text-slate-300">—</span>}
        </span>
      </td>

      <td className={`${cellCls} text-xs text-slate-600`}>
        {t.latestActionDoneByName
          ? <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-indigo-50 px-2 py-0.5
                             text-xs font-medium text-indigo-700 ring-1 ring-indigo-100" title={t.latestActionDoneByName}>
              <span className="truncate">{t.latestActionDoneByName}</span>
            </span>
          : <span className="text-slate-300">N/A</span>}
      </td>

      <td className={`${ACTIONS_STICKY_BODY} min-w-0 overflow-hidden px-2 py-2.5`}>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {/* Brief */}
          <button onClick={() => onViewBrief(t)} title="View brief"
            className="rounded border border-slate-200 p-1.5 text-slate-400
                       hover:bg-slate-50 hover:text-slate-700 transition">
            <Icon name="eye" className="h-3.5 w-3.5" />
          </button>

          {/* Assets — completed tasks only */}
          {t.status === 'COMPLETED' && (
            <button onClick={() => onViewAssets(t)} title="View assets"
              className="rounded border border-green-200 bg-green-50 p-1.5 text-green-600
                         hover:bg-green-100 hover:text-green-800 transition">
              <Icon name="fileText" className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Edit — only for mutable statuses */}
          {['ASSIGNED', 'HELD', 'IN_PROGRESS', 'REWORK'].includes(t.status) && (
            <button onClick={() => onEdit(t)} title="Edit campaign"
              className="rounded border border-slate-200 p-1.5 text-slate-400
                         hover:bg-slate-50 hover:text-slate-700 transition">
              <Icon name="edit" className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Hold */}
          {canHold && (
            <button onClick={() => onHold(t)} disabled={holding} title="Hold task"
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
            <button onClick={() => onUnhold(t)} title="Unhold task"
              className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs
                         font-medium text-emerald-700 hover:bg-emerald-100 transition flex items-center gap-1">
              <Icon name="check" className="h-3 w-3" /> Unhold
            </button>
          )}

          {/* Cancel */}
          {canCancel && (
            <button onClick={() => onCancel(t)} title="Cancel task"
              className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs
                         font-medium text-red-600 hover:bg-red-100 transition flex items-center gap-1">
              <Icon name="x" className="h-3 w-3" /> Cancel
            </button>
          )}
        </div>
      </td>
    </tr>
  )
})

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

function LoadingState({ inline = false }) {
  if (inline) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
        <Icon name="refresh" className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }
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
