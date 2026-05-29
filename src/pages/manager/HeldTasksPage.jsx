import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import managerApi from '../../api/manager'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'
import RequestBriefDrawer from '../../components/RequestBriefDrawer'

export default function HeldTasksPage() {
  const location  = useLocation()
  const toast     = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)

  const [tasks,           setTasks]           = useState([])
  const [loading,         setLoading]         = useState(true)
  const [unholdingId,     setUnholdingId]     = useState(null)
  const [briefCampaignId, setBriefCampaignId] = useState(null)
  const [assignTask,      setAssignTask]      = useState(null) // task object for manual assign modal

  const load = () => {
    setLoading(true)
    managerApi.heldTasks()
      .then(r => setTasks(r.data || []))
      .catch(() => showToast('Failed to load held tasks', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnhold = async (task) => {
    setUnholdingId(task.taskId)
    try {
      await managerApi.unholdTask(task.taskId)
      showToast(`Task re-routed successfully.`, 'success')
      load()
    } catch (e) {
      if (e?.response?.status === 409) {
        showToast('No available user in the required role yet. Free a slot and retry.', 'error')
      } else {
        showToast(e?.response?.data?.message || 'Unhold failed. Please retry.', 'error')
      }
    } finally {
      setUnholdingId(null)
    }
  }

  // Split held tasks: "Other" custom tasks vs capacity-held regular tasks
  const otherTasks   = tasks.filter(t => t.granularTaskId === 'TASK-OTHER')
  const regularTasks = tasks.filter(t => t.granularTaskId !== 'TASK-OTHER')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Held Tasks</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Custom "Other" tasks await manual assignment · Capacity-held tasks can be auto-routed.
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="shrink-0 flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5
                     text-xs text-slate-600 hover:bg-slate-50 transition disabled:opacity-60">
          <Icon name="refresh" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-2">
          <Icon name="pause" className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-700">
            {loading ? '…' : regularTasks.length} capacity-held
          </span>
        </div>
        <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 flex items-center gap-2">
          <Icon name="edit" className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-semibold text-violet-700">
            {loading ? '…' : otherTasks.length} awaiting manual assign
          </span>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white py-14 text-center">
          <Icon name="refresh" className="mx-auto h-8 w-8 text-slate-300 mb-3 animate-spin" />
          <p className="text-sm text-slate-400">Loading held tasks…</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <Icon name="inbox" className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-600">No tasks on hold</p>
          <p className="mt-1 text-xs text-slate-400">
            Tasks held for capacity or pending manual assignment will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* -- Custom "Other" tasks — manual assign only -- */}
          {otherTasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100">
                  <Icon name="edit" className="h-3.5 w-3.5 text-violet-600" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">Custom Tasks — Manual Assignment Required</h3>
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                  {otherTasks.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 -mt-1">
                These are open-ended "Other" tasks submitted by requestors. Review the brief and assign to the right team member.
              </p>
              <div className="space-y-2">
                {otherTasks.map(t => (
                  <HeldTaskCard
                    key={t.taskId}
                    task={t}
                    busy={unholdingId === t.taskId}
                    isOther
                    onAssign={() => setAssignTask(t)}
                    onViewBrief={() => setBriefCampaignId(t.campaignId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* -- Capacity-held regular tasks — auto-route -- */}
          {regularTasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100">
                  <Icon name="pause" className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">Capacity-Held Tasks</h3>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {regularTasks.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 -mt-1">
                Held during a capacity check. Unhold to auto-route to the next available team member.
              </p>
              <div className="space-y-2">
                {regularTasks.map(t => (
                  <HeldTaskCard
                    key={t.taskId}
                    task={t}
                    busy={unholdingId === t.taskId}
                    onUnhold={() => handleUnhold(t)}
                    onAssign={() => setAssignTask(t)}
                    onViewBrief={() => setBriefCampaignId(t.campaignId)}
                  />
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {briefCampaignId && (
        <RequestBriefDrawer
          campaignId={briefCampaignId}
          onClose={() => setBriefCampaignId(null)}
        />
      )}

      {assignTask && (
        <AssignTaskModal
          task={assignTask}
          onClose={() => setAssignTask(null)}
          onSuccess={() => { setAssignTask(null); load() }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// HeldTaskCard
// ---------------------------------------------------------------------------

function HeldTaskCard({ task: t, busy, isOther, onUnhold, onAssign, onViewBrief }) {
  const borderCls = isOther
    ? 'border-violet-200 hover:shadow-violet-100'
    : 'border-amber-200 hover:shadow-amber-100'

  return (
    <div className={`rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow ${borderCls}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">

        {/* Left — task info */}
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-400">#{t.taskId}</span>
            <span className="text-sm font-semibold text-slate-800">
              {t.granularTaskName || t.taskTypeName || 'Task'}
            </span>
            <PriorityBadge v={t.campaignPriority} />
            {isOther ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5
                               text-xs font-medium text-violet-700 ring-1 ring-violet-200">
                <Icon name="edit" className="h-3 w-3" /> Needs Assignment
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5
                               text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                <Icon name="pause" className="h-3 w-3" /> On Hold
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {t.taskTypeName && (
              <span className="flex items-center gap-1">
                <Icon name="fileText" className="h-3.5 w-3.5" />
                {t.taskTypeName}
              </span>
            )}
            {t.assigneeName && !isOther && (
              <span className="flex items-center gap-1">
                <Icon name="users" className="h-3.5 w-3.5" />
                Previously: {t.assigneeName}
              </span>
            )}
            {t.campaignDeadline && (
              <span className="flex items-center gap-1">
                <Icon name="clock" className="h-3.5 w-3.5" />
                Due {t.campaignDeadline}
              </span>
            )}
          </div>
          <div className="mt-1.5 text-xs text-slate-400">
            Campaign #{t.campaignId}
            {t.requestorName && <> · Requested by {t.requestorName}</>}
          </div>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onViewBrief}
            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs
                       text-slate-600 hover:bg-slate-50 transition flex items-center gap-1">
            <Icon name="eye" className="h-3.5 w-3.5" /> Brief
          </button>

          {/* "Other" tasks: Assign Task only */}
          {isOther && (
            <button onClick={onAssign}
              className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs
                         font-medium text-violet-700 hover:bg-violet-100 transition flex items-center gap-1.5">
              <Icon name="users" className="h-3.5 w-3.5" /> Assign Task
            </button>
          )}

          {/* Regular tasks: both Assign and Unhold & Route */}
          {!isOther && (
            <>
              <button onClick={onAssign}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs
                           text-slate-600 hover:bg-slate-50 transition flex items-center gap-1.5">
                <Icon name="users" className="h-3.5 w-3.5" /> Assign
              </button>
              <button onClick={onUnhold} disabled={busy}
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs
                           font-medium text-emerald-700 hover:bg-emerald-100 transition
                           disabled:opacity-60 flex items-center gap-1.5">
                {busy
                  ? <><Icon name="refresh" className="h-3.5 w-3.5 animate-spin" /> Re-routing…</>
                  : <><Icon name="check" className="h-3.5 w-3.5" /> Unhold &amp; Route</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AssignTaskModal — fetch eligible users and pick one
// ---------------------------------------------------------------------------

function AssignTaskModal({ task, onClose, onSuccess }) {
  const toast     = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)

  const [users,      setUsers]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState(null)
  const [assigning,  setAssigning]  = useState(false)

  useEffect(() => {
    managerApi.eligibleUsersForTask(task.taskId)
      .then(r => setUsers(r.data || []))
      .catch(() => showToast('Failed to load eligible users', 'error'))
      .finally(() => setLoading(false))
  }, [task.taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAssign = async () => {
    if (!selected) { showToast('Please select a team member first.', 'error'); return }
    setAssigning(true)
    try {
      await managerApi.assignHeldTask(task.taskId, selected)
      showToast('Task assigned successfully!', 'success')
      onSuccess()
    } catch (e) {
      showToast(e?.response?.data?.message || 'Assignment failed.', 'error')
    } finally {
      setAssigning(false)
    }
  }

  const isOther = task.granularTaskId === 'TASK-OTHER'

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Assign Task</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {isOther
                ? 'This is a custom task — choose the right team member to handle it.'
                : 'Manually assign this task instead of auto-routing.'}
            </p>
          </div>
          <button onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        {/* Task info */}
        <div className={`mx-5 mt-4 rounded-lg border px-4 py-3 ${isOther ? 'border-violet-200 bg-violet-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
          <p className="text-xs font-semibold text-slate-600 mb-0.5">
            {task.granularTaskName || task.taskTypeName}
          </p>
          <p className="text-xs text-slate-500">
            Campaign #{task.campaignId}
            {task.requestorName && <> · {task.requestorName}</>}
            {task.taskTypeName && <> · {task.taskTypeName}</>}
          </p>
        </div>

        {/* User list */}
        <div className="px-5 py-4 flex-1">
          <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
            Eligible Team Members
          </p>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-400">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span className="text-sm">Loading…</span>
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 py-6 text-center">
              <Icon name="users" className="mx-auto h-7 w-7 text-slate-300 mb-2" />
              <p className="text-xs text-slate-500">No eligible users found for this task type.</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {users.map(u => (
                <button key={u.userId} type="button"
                  onClick={() => setSelected(u.userId)}
                  className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition
                    ${selected === u.userId
                      ? 'border-brand-400 bg-brand-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/30'}`}>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold
                    ${selected === u.userId ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {(u.fullName || u.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{u.fullName || u.name}</p>
                    <p className="text-xs text-slate-400 truncate">{u.roleName || u.role}</p>
                  </div>
                  {selected === u.userId && (
                    <Icon name="check" className="h-4 w-4 text-brand-600 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button onClick={handleAssign} disabled={assigning || !selected || loading}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold
                       text-white hover:bg-brand-700 disabled:opacity-50 transition shadow-sm">
            {assigning ? (
              <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg> Assigning…</>
            ) : (
              <><Icon name="check" className="h-4 w-4" /> Assign Task</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function PriorityBadge({ v }) {
  const m = {
    HIGH:   'bg-rose-50 text-rose-700 ring-rose-200',
    MEDIUM: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
    LOW:    'bg-emerald-50 text-emerald-700 ring-emerald-200',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${m[v] || 'bg-slate-100 text-slate-600'}`}>
      {v || '—'}
    </span>
  )
}
