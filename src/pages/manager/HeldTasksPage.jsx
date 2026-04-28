import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import managerApi from '../../api/manager'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'
import RequestBriefDrawer from '../../components/RequestBriefDrawer'

/**
 * HeldTasksPage — Manager view of all tasks currently in HELD status.
 *
 * Tasks end up here when the marketing head held them during the capacity-
 * check modal on the approval page, freeing a worker's slot for a higher-
 * priority campaign. The manager can unhold any row; auto-routing re-assigns
 * it to the next available user in the required role (or surfaces a 409 if
 * the team is still full).
 */
export default function HeldTasksPage() {
  const location  = useLocation()
  const toast     = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)

  const [tasks,          setTasks]          = useState([])
  const [loading,        setLoading]        = useState(true)
  const [unholdingId,    setUnholdingId]    = useState(null)
  const [briefCampaignId, setBriefCampaignId] = useState(null)

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
      showToast(`Task #${task.taskId} re-routed successfully.`, 'success')
      load()
    } catch (e) {
      if (e?.response?.status === 409) {
        showToast(
          'No available user in the required role yet. Free a slot (hold another task) and retry.',
          'error'
        )
      } else {
        const msg = e?.response?.data?.message || 'Unhold failed. Please retry.'
        showToast(msg, 'error')
      }
    } finally {
      setUnholdingId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Held Tasks</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Tasks paused by a capacity hold. Unhold any row to auto-route it back to the next
            available team member.
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="shrink-0 flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5
                     text-xs text-slate-600 hover:bg-slate-50 transition disabled:opacity-60"
        >
          <Icon name="refresh" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-2">
          <Icon name="pause" className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-700">
            {loading ? '…' : tasks.length} task{tasks.length !== 1 ? 's' : ''} on hold
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
            When the marketing head holds a task during capacity checks, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(t => (
            <HeldTaskCard
              key={t.taskId}
              task={t}
              busy={unholdingId === t.taskId}
              onUnhold={() => handleUnhold(t)}
              onViewBrief={() => setBriefCampaignId(t.campaignId)}
            />
          ))}
        </div>
      )}

      {briefCampaignId && (
        <RequestBriefDrawer
          campaignId={briefCampaignId}
          onClose={() => setBriefCampaignId(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// HeldTaskCard
// ---------------------------------------------------------------------------

function HeldTaskCard({ task: t, busy, onUnhold, onViewBrief }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        {/* Left — task info */}
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-400">#{t.taskId}</span>
            <span className="text-sm font-semibold text-slate-800">
              {t.granularTaskName || t.taskTypeName || 'Task'}
            </span>
            <PriorityBadge v={t.campaignPriority} />
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5
                             text-xs font-medium text-amber-700 ring-1 ring-amber-200">
              <Icon name="pause" className="h-3 w-3" /> On Hold
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {t.requirementTypeName && (
              <span className="flex items-center gap-1">
                <Icon name="fileText" className="h-3.5 w-3.5" />
                {t.requirementTypeName}
              </span>
            )}
            {t.assigneeName && (
              <span className="flex items-center gap-1">
                <Icon name="users" className="h-3.5 w-3.5" />
                Previously: {t.assigneeName}
              </span>
            )}
            {t.platformName && (
              <span className="flex items-center gap-1">
                <Icon name="megaphone" className="h-3.5 w-3.5" />
                {t.platformName}
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
          <button
            onClick={onViewBrief}
            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs
                       text-slate-600 hover:bg-slate-50 transition flex items-center gap-1"
          >
            <Icon name="eye" className="h-3.5 w-3.5" /> Brief
          </button>
          <button
            onClick={onUnhold}
            disabled={busy}
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs
                       font-medium text-emerald-700 hover:bg-emerald-100 transition
                       disabled:opacity-60 flex items-center gap-1.5"
          >
            {busy
              ? <><Icon name="refresh" className="h-3.5 w-3.5 animate-spin" /> Re-routing…</>
              : <><Icon name="check" className="h-3.5 w-3.5" /> Unhold &amp; Route</>}
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
