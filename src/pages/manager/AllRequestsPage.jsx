import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import managerApi from '../../api/manager'
import campaignsApi from '../../api/campaigns'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'
import RequestBriefDrawer from '../../components/RequestBriefDrawer'

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

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditCampaignModal({ campaignId, task, onClose, onSaved }) {
  const toast     = useToast()
  const showToast = (msg, type) => toast[type]?.(msg)

  const [form, setForm]       = useState({ priority: '', keyMessage: '', budgetTier: '' })
  const [fetching, setFetching] = useState(true)
  const [saving,   setSaving]   = useState(false)

  // Load actual campaign values so every field shows the real current value
  useEffect(() => {
    campaignsApi.getById(campaignId)
      .then(res => {
        const c = res.data
        setForm({
          priority:   c.priority   || '',
          budgetTier: c.budgetTier || '',
          keyMessage: '',
        })
      })
      .catch(() => showToast('Could not load campaign details.', 'error'))
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
      showToast('Campaign updated successfully.', 'success')
      onSaved(); onClose()
    } catch (e) {
      showToast(e?.response?.data?.message || 'Update failed.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Edit Campaign</h3>
            <p className="mt-0.5 text-xs text-slate-400">Campaign #{campaignId} · Task #{task.taskId}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        {fetching ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
            <Icon name="refresh" className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <div className="space-y-4 px-5 py-4">
            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800
                           focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300">
                {PRIORITY_OPTIONS.map(p => (
                  <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>

            {/* Budget Tier */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Budget Tier</label>
              <select value={form.budgetTier} onChange={e => setForm(f => ({ ...f, budgetTier: e.target.value }))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800
                           focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300">
                {BUDGET_OPTIONS.map(b => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>

            {/* Key Message */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Key Message</label>
              <textarea value={form.keyMessage} onChange={e => setForm(f => ({ ...f, keyMessage: e.target.value }))}
                rows={3} placeholder="Type a new key message to replace the existing one…"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800
                           placeholder:text-slate-400 focus:border-brand-400 focus:outline-none
                           focus:ring-1 focus:ring-brand-300 resize-none" />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button onClick={onClose} disabled={saving || fetching}
            className="rounded-md border border-slate-200 px-4 py-1.5 text-sm text-slate-600
                       hover:bg-slate-50 transition disabled:opacity-60">Cancel</button>
          <button onClick={handleSave} disabled={saving || fetching}
            className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white
                       hover:bg-brand-700 transition disabled:opacity-60 flex items-center gap-1.5">
            {saving ? <><Icon name="refresh" className="h-3.5 w-3.5 animate-spin" /> Saving…</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Inline column-filter primitives ─────────────────────────────────────────

/** Dropdown filter rendered inside a <th> filter row */
function SelectFilter({ value, onChange, options, placeholder = 'All' }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-full rounded border px-1.5 py-1 text-xs leading-tight
                  focus:outline-none focus:ring-1 focus:ring-brand-300
                  ${value
                    ? 'border-brand-400 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white text-slate-500'}`}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{STATUS_LABELS[o] || o}</option>)}
    </select>
  )
}

/** Text filter rendered inside a <th> filter row */
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AllRequestsPage() {
  const location  = useLocation()
  const toast     = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)

  const [tasks,     setTasks]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [holdingId, setHoldingId] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [briefId,    setBriefId]   = useState(null)

  // Per-column filter state
  const [fTaskId,    setFTaskId]    = useState('')
  const [fCampaign,  setFCampaign]  = useState('')
  const [fRequestor, setFRequestor] = useState('')
  const [fAssignee,  setFAssignee]  = useState('')
  const [fTaskType,  setFTaskType]  = useState('')
  const [fPlatform,  setFPlatform]  = useState('')
  const [fPriority,  setFPriority]  = useState('')
  const [fStatus,    setFStatus]    = useState('')

  const load = (silent = false) => {
    if (!silent) setLoading(true)
    managerApi.allTasks()
      .then(r => setTasks(r.data || []))
      .catch(() => showToast('Failed to load requests', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [location.key])  // eslint-disable-line react-hooks/exhaustive-deps

  const uniq = arr => [...new Set(arr.filter(Boolean))].sort()

  // Options derived from loaded data
  const requestorOptions = uniq(tasks.map(t => t.requestorName))
  const assigneeOptions  = uniq(tasks.map(t => t.assigneeName))
  const taskTypeOptions  = uniq(tasks.map(t => t.granularTaskName || t.taskTypeName))
  const platformOptions  = uniq(tasks.map(t => t.platformName))
  const priorityOptions  = uniq(tasks.map(t => t.campaignPriority))
  const statusOptions    = uniq(tasks.map(t => t.status))

  // Apply column filters
  const filtered = useMemo(() => tasks.filter(t => {
    if (fTaskId   && !String(t.taskId).includes(fTaskId.trim())) return false
    if (fCampaign && !String(t.campaignId).includes(fCampaign.trim())) return false
    if (fRequestor && t.requestorName !== fRequestor) return false
    if (fAssignee  && t.assigneeName  !== fAssignee)  return false
    if (fTaskType) {
      const name = t.granularTaskName || t.taskTypeName || ''
      if (name !== fTaskType) return false
    }
    if (fPlatform && t.platformName      !== fPlatform) return false
    if (fPriority && t.campaignPriority  !== fPriority) return false
    if (fStatus   && t.status            !== fStatus)   return false
    return true
  }), [tasks, fTaskId, fCampaign, fRequestor, fAssignee, fTaskType, fPlatform, fPriority, fStatus])

  const activeFilters = [fTaskId, fCampaign, fRequestor, fAssignee, fTaskType, fPlatform, fPriority, fStatus]
    .filter(Boolean).length

  const clearFilters = () => {
    setFTaskId(''); setFCampaign(''); setFRequestor(''); setFAssignee('')
    setFTaskType(''); setFPlatform(''); setFPriority(''); setFStatus('')
  }

  const handleHold = async (task) => {
    setHoldingId(task.taskId)
    try {
      await managerApi.holdTask(task.taskId)
      showToast(`Task #${task.taskId} is now on hold.`, 'success')
      load(true)
    } catch (e) {
      showToast(e?.response?.data?.message || 'Hold failed.', 'error')
    } finally {
      setHoldingId(null)
    }
  }

  const handleUnhold = async (task) => {
    setHoldingId(task.taskId)
    try {
      await managerApi.unholdTask(task.taskId)
      showToast(`Task #${task.taskId} re-routed successfully.`, 'success')
      load(true)
    } catch (e) {
      if (e?.response?.status === 409) {
        showToast('No available user in the required role. Free capacity and retry.', 'error')
      } else {
        showToast(e?.response?.data?.message || 'Unhold failed.', 'error')
      }
    } finally {
      setHoldingId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">All Requests</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Every work task assigned across the team. Filter per column, hold any task, or edit campaign details.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="shrink-0 flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5
                     text-xs text-slate-600 hover:bg-slate-50 transition disabled:opacity-60"
        >
          <Icon name="refresh" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Stats bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <StatChip icon="clipboard" label={`${filtered.length} / ${tasks.length} tasks`} color="slate" />
        <StatChip icon="users"     label={`${uniq(tasks.map(t => t.assigneeName)).length} workers`} color="brand" />
        <StatChip icon="pause"     label={`${tasks.filter(t => t.status === 'HELD').length} on hold`} color="amber" />
        {activeFilters > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50
                       px-3 py-1 text-xs text-brand-700 hover:bg-brand-100 transition"
          >
            <Icon name="x" className="h-3 w-3" />
            Clear {activeFilters} filter{activeFilters > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <LoadingState />
      ) : tasks.length === 0 ? (
        <EmptyState hasFilters={false} onClear={clearFilters} />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-xs border-collapse">
              <thead>
                {/* ── Row 1: Column labels ── */}
                <tr className="bg-slate-50 border-b border-slate-200">
                  <Th width="w-16">Task #</Th>
                  <Th width="w-28">Campaign</Th>
                  <Th>Requestor</Th>
                  <Th>Assignee</Th>
                  <Th>Task Type</Th>
                  <Th>Platform</Th>
                  <Th width="w-24">Priority</Th>
                  <Th width="w-28">Status</Th>
                  <Th width="w-28">Assigned On</Th>
                  <Th align="right" width="w-36">Actions</Th>
                </tr>
                {/* ── Row 2: Column filters ── */}
                <tr className="bg-white border-b border-slate-200">
                  {/* Task # */}
                  <td className="px-2 py-1.5">
                    <TextFilter value={fTaskId} onChange={setFTaskId} placeholder="e.g. 42" />
                  </td>
                  {/* Campaign */}
                  <td className="px-2 py-1.5">
                    <TextFilter value={fCampaign} onChange={setFCampaign} placeholder="ID…" />
                  </td>
                  {/* Requestor */}
                  <td className="px-2 py-1.5">
                    <SelectFilter value={fRequestor} onChange={setFRequestor} options={requestorOptions} placeholder="All" />
                  </td>
                  {/* Assignee */}
                  <td className="px-2 py-1.5">
                    <SelectFilter value={fAssignee} onChange={setFAssignee} options={assigneeOptions} placeholder="All" />
                  </td>
                  {/* Task Type */}
                  <td className="px-2 py-1.5">
                    <SelectFilter value={fTaskType} onChange={setFTaskType} options={taskTypeOptions} placeholder="All" />
                  </td>
                  {/* Platform */}
                  <td className="px-2 py-1.5">
                    <SelectFilter value={fPlatform} onChange={setFPlatform} options={platformOptions} placeholder="All" />
                  </td>
                  {/* Priority */}
                  <td className="px-2 py-1.5">
                    <SelectFilter value={fPriority} onChange={setFPriority} options={priorityOptions} placeholder="All" />
                  </td>
                  {/* Status */}
                  <td className="px-2 py-1.5">
                    <SelectFilter value={fStatus} onChange={setFStatus} options={statusOptions} placeholder="All" />
                  </td>
                  {/* Assigned On — no filter */}
                  <td className="px-2 py-1.5" />
                  {/* Actions — no filter */}
                  <td className="px-2 py-1.5" />
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-14 text-center">
                      <Icon name="inbox" className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-sm text-slate-500">No tasks match the current filters.</p>
                      <button onClick={clearFilters} className="mt-2 text-xs text-brand-600 hover:underline">
                        Clear all filters
                      </button>
                    </td>
                  </tr>
                ) : filtered.map((t, i) => (
                  <TaskRow
                    key={t.taskId}
                    task={t}
                    alt={i % 2 === 1}
                    busy={holdingId === t.taskId}
                    onHold={() => handleHold(t)}
                    onUnhold={() => handleUnhold(t)}
                    onEdit={() => setEditTarget({ campaignId: t.campaignId, task: t })}
                    onViewBrief={() => setBriefId(t.campaignId)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-400">
            Showing {filtered.length} of {tasks.length} tasks
            {activeFilters > 0 && (
              <button onClick={clearFilters} className="ml-3 text-brand-600 hover:underline">
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <EditCampaignModal
          campaignId={editTarget.campaignId}
          task={editTarget.task}
          onClose={() => setEditTarget(null)}
          onSaved={() => load(true)}
        />
      )}

      {/* Brief drawer */}
      {briefId && (
        <RequestBriefDrawer campaignId={briefId} onClose={() => setBriefId(null)} />
      )}
    </div>
  )
}

// ─── Table header cell ────────────────────────────────────────────────────────

function Th({ children, align = 'left', width = '' }) {
  return (
    <th className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wider
                    text-slate-500 whitespace-nowrap text-${align} ${width}`}>
      {children}
    </th>
  )
}

// ─── Data row ─────────────────────────────────────────────────────────────────

function TaskRow({ task: t, alt, busy, onHold, onUnhold, onEdit, onViewBrief }) {
  const canHold   = t.status === 'ASSIGNED'
  const canUnhold = t.status === 'HELD'

  return (
    <tr className={`border-b border-slate-100 transition-colors hover:bg-brand-50/30
                    ${alt ? 'bg-slate-50/40' : 'bg-white'}`}>

      {/* Task # */}
      <td className="px-3 py-2.5">
        <span className="font-mono text-xs text-slate-400">#{t.taskId}</span>
      </td>

      {/* Campaign */}
      <td className="px-3 py-2.5">
        <button onClick={onViewBrief} className="font-medium text-brand-700 hover:underline leading-tight">
          #{t.campaignId}
        </button>
        {t.requirementTypeName && (
          <div className="text-xs text-slate-400 mt-0.5">{t.requirementTypeName}</div>
        )}
      </td>

      {/* Requestor */}
      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
        {t.requestorName || <span className="text-slate-300">—</span>}
      </td>

      {/* Assignee */}
      <td className="px-3 py-2.5">
        {t.assigneeName
          ? <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5
                             text-xs font-medium text-slate-700">
              <Icon name="users" className="h-3 w-3 text-slate-400" />
              {t.assigneeName}
            </span>
          : <span className="text-slate-300">Unassigned</span>}
      </td>

      {/* Task Type */}
      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
        {t.granularTaskName || t.taskTypeName || <span className="text-slate-300">—</span>}
      </td>

      {/* Platform */}
      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
        {t.platformName || <span className="text-slate-300">—</span>}
      </td>

      {/* Priority */}
      <td className="px-3 py-2.5">
        {t.campaignPriority
          ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs
                              font-medium ring-1 ${PRIORITY_STYLES[t.campaignPriority] || 'bg-slate-100 text-slate-600'}`}>
              {t.campaignPriority}
            </span>
          : <span className="text-slate-300">—</span>}
      </td>

      {/* Status */}
      <td className="px-3 py-2.5">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs
                          font-medium ring-1 ${STATUS_STYLES[t.status] || 'bg-slate-100 text-slate-600'}`}>
          {STATUS_LABELS[t.status] || t.status}
        </span>
      </td>

      {/* Assigned On */}
      <td className="px-3 py-2.5 whitespace-nowrap text-slate-500 text-xs">
        {t.assignedAt ? fmtDate(t.assignedAt) : <span className="text-slate-300">—</span>}
      </td>

      {/* Actions */}
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-1">
          <button onClick={onViewBrief} title="View brief"
            className="rounded border border-slate-200 p-1.5 text-slate-400
                       hover:bg-slate-50 hover:text-slate-700 transition">
            <Icon name="eye" className="h-3.5 w-3.5" />
          </button>
          <button onClick={onEdit} title="Edit campaign"
            className="rounded border border-slate-200 p-1.5 text-slate-400
                       hover:bg-slate-50 hover:text-slate-700 transition">
            <Icon name="edit" className="h-3.5 w-3.5" />
          </button>
          {canHold && (
            <button onClick={onHold} disabled={busy} title="Hold task"
              className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs
                         font-medium text-amber-700 hover:bg-amber-100 transition disabled:opacity-50
                         flex items-center gap-1">
              {busy
                ? <Icon name="refresh" className="h-3 w-3 animate-spin" />
                : <><Icon name="pause" className="h-3 w-3" /> Hold</>}
            </button>
          )}
          {canUnhold && (
            <button onClick={onUnhold} disabled={busy} title="Unhold & re-route"
              className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs
                         font-medium text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50
                         flex items-center gap-1">
              {busy
                ? <Icon name="refresh" className="h-3 w-3 animate-spin" />
                : <><Icon name="check" className="h-3 w-3" /> Unhold</>}
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
