import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import managerApi from '../../api/manager'
import campaignsApi from '../../api/campaigns'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'
import RequestBriefDrawer, { RequestSummaryCard } from '../../components/RequestBriefDrawer'

/**
 * Module 4 — QC Review queue.
 *
 * Tasks are grouped by their parent campaign so the QC reviewer sees the
 * whole brief in one place, but every task row keeps its OWN
 * Approve / Rework / Reject buttons — multi-deliverable campaigns can have
 * one asset approved while another is sent back for rework, mirroring the
 * backend's per-task review semantics.
 *
 * Within a campaign group we sort tasks by submission time (oldest first)
 * so the reviewer naturally picks up where the worker left off.
 */
export default function QcReviewPage() {
  const location = useLocation()
  const toast    = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)

  const [tasks, setTasks]   = useState([])
  const [loading, setLoading] = useState(true)

  // Single shared review modal — opened with one task at a time.
  const [reviewing, setReviewing] = useState(null)
  const [reviewingCampaign, setReviewingCampaign] = useState(null)
  const [action, setAction] = useState('APPROVED')
  const [comments, setComments] = useState('')
  const [saving, setSaving] = useState(false)

  const [briefCampaignId, setBriefCampaignId] = useState(null)

  const load = () => {
    setLoading(true)
    managerApi.pendingTasks()
      .then(res => setTasks(res.data || []))
      .catch(() => showToast('Failed to load review queue', 'error'))
      .finally(() => setLoading(false))
  }
  const refresh = () => {
    managerApi.pendingTasks()
      .then(res => setTasks(res.data || []))
      .catch(() => { /* silent */ })
  }

  useEffect(load, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Groups by campaignId, preserving the backend's overall ordering — the
   * first occurrence of a campaign defines its position in the page. Inside
   * each group, we re-sort by submittedAt ASC so the oldest submission is
   * at the top (FIFO inside a brief).
   */
  const groups = useMemo(() => {
    const byId = new Map()
    for (const t of tasks) {
      if (!byId.has(t.campaignId)) byId.set(t.campaignId, [])
      byId.get(t.campaignId).push(t)
    }
    const out = []
    for (const [campaignId, items] of byId) {
      items.sort((a, b) => {
        const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0
        const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0
        return ta - tb
      })
      out.push({ campaignId, items })
    }
    return out
  }, [tasks])

  const open = (task, act = 'APPROVED') => {
    setReviewing(task)
    setReviewingCampaign(null)
    setAction(act)
    setComments('')
    campaignsApi.getById(task.campaignId)
      .then(res => setReviewingCampaign(res.data))
      .catch(() => { /* show task-only modal if fetch fails */ })
  }
  const close = () => {
    setReviewing(null); setReviewingCampaign(null)
    setComments(''); setAction('APPROVED')
  }

  const submitReview = async () => {
    if (!reviewing) return
    if (action !== 'APPROVED' && !comments.trim()) {
      showToast('Please add comments.', 'error')
      return
    }
    setSaving(true)
    try {
      await managerApi.reviewTask(reviewing.taskId, { action, comments: comments.trim() || null })
      const map = {
        APPROVED:     'Task approved — asset will be delivered to the requestor.',
        NEEDS_REWORK: 'Sent back to creator for rework.',
        REJECTED:     'Task rejected and campaign closed.',
      }
      showToast(map[action] || 'Review submitted', 'success')
      close()
      refresh()
    } catch (e) {
      const msg = e?.response?.data?.message || 'Action failed'
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">QC Review Queue</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Tasks submitted by creators awaiting your quality-control review,
          grouped by campaign. Approve, send back for rework, or reject each
          deliverable individually.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-2.5 flex items-center gap-2">
          <Icon name="inbox" className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-semibold text-purple-700">
            {tasks.length} task{tasks.length === 1 ? '' : 's'} across {groups.length} campaign{groups.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-slate-400 py-12 text-sm">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-14 text-center">
          <Icon name="inbox" className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">No tasks pending QC.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(g => (
            <CampaignGroup
              key={g.campaignId}
              group={g}
              onApprove={(t) => open(t, 'APPROVED')}
              onRework={(t)  => open(t, 'NEEDS_REWORK')}
              onReject={(t)  => open(t, 'REJECTED')}
              onView={()     => setBriefCampaignId(g.campaignId)}
            />
          ))}
        </div>
      )}

      {reviewing && (
        <ReviewModal
          task={reviewing}
          campaign={reviewingCampaign}
          action={action}
          setAction={setAction}
          comments={comments}
          setComments={setComments}
          saving={saving}
          onCancel={close}
          onConfirm={submitReview}
          onViewBrief={() => setBriefCampaignId(reviewing.campaignId)}
        />
      )}

      {briefCampaignId && (
        <RequestBriefDrawer
          campaignId={briefCampaignId}
          onClose={() => setBriefCampaignId(null)}
          onCampaignChanged={(updated) => {
            setTasks(prev => prev.map(t =>
              t.campaignId === updated.campaignId
                ? { ...t, campaignPriority: updated.priority, campaignStatus: updated.status }
                : t
            ))
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Card representing one campaign + every task of that campaign currently in
 * QC. The header surfaces campaign-level metadata (id, priority, deadline,
 * requestor); rows below each carry their own individual action buttons.
 */
function CampaignGroup({ group, onApprove, onRework, onReject, onView }) {
  const { campaignId, items } = group
  const sample   = items[0] || {}
  const requestor = sample.requestorName
  const priority  = sample.campaignPriority
  const deadline  = sample.campaignDeadline

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-400">CMP</span>
            <span className="text-sm font-semibold text-slate-800">Campaign #{campaignId}</span>
            <PriorityBadge v={priority} />
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-purple-200">
              {items.length} deliverable{items.length === 1 ? '' : 's'} pending QC
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {requestor && <span>Requested by {requestor}</span>}
            {deadline && <span>• Deadline: {fmtDate(deadline)}</span>}
          </div>
        </div>
        <button
          onClick={onView}
          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 transition flex items-center gap-1 self-center"
        >
          <Icon name="eye" className="h-3.5 w-3.5" /> View Brief
        </button>
      </div>

      <ul className="divide-y divide-slate-100">
        {items.map((t, idx) => (
          <li key={t.taskId} className="px-4 py-3">
            <TaskRow
              task={t}
              index={idx + 1}
              onApprove={() => onApprove(t)}
              onRework={()  => onRework(t)}
              onReject={()  => onReject(t)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function TaskRow({ task, index, onApprove, onRework, onReject }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex-1 min-w-[260px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-slate-400">#{task.taskId}</span>
          <span className="text-xs uppercase tracking-wide text-slate-400">Deliverable {index}</span>
          <span className="text-sm font-semibold text-slate-800">
            {task.granularTaskName || task.requirementTypeName || 'Task'}
          </span>
          {task.platformName && (
            <span className="text-xs text-slate-500">• {task.platformName}</span>
          )}
          {task.formatName && (
            <span className="text-xs text-slate-500">• {task.formatName}</span>
          )}
          {task.quantity && (
            <span className="text-xs text-slate-500">• {task.quantity}</span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
          <span>Submitted by {task.assigneeName || `User ${task.assignedTo}`}</span>
          {task.totalTimeLoggedMinutes != null && (
            <span>• {task.totalTimeLoggedMinutes} min logged</span>
          )}
          {task.reworkCount > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-orange-200"
              title={`Sent back for rework ${task.reworkCount} time${task.reworkCount === 1 ? '' : 's'} previously`}
            >
              <Icon name="refresh" className="h-3 w-3" />
              {task.reworkCount}× rework
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <TimePill icon="inbox" label="Assigned"  ts={task.assignedAt || task.createdAt} />
          <TimePill icon="play"  label="Accepted"  ts={task.acceptedAt} />
          <TimePill icon="send"  label="Submitted" ts={task.submittedAt} />
        </div>

        {task.submissionNotes && (
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700">
            <span className="text-slate-400 text-xs uppercase tracking-wide">Notes:</span>{' '}
            {task.submissionNotes}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-2">
        {parseAssetUrls(task.assetUrl).map((url, i, arr) => (
          <a
            key={i}
            href={url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-brand-600 hover:bg-brand-50 transition"
          >
            <Icon name="fileText" className="h-3.5 w-3.5" />
            {arr.length > 1 ? `Asset ${i + 1}` : 'Open asset'}
          </a>
        ))}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={onRework}
            className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition flex items-center gap-1"
          >
            <Icon name="refresh" className="h-3.5 w-3.5" /> Rework
          </button>
          <button
            onClick={onReject}
            className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition flex items-center gap-1"
          >
            <Icon name="x" className="h-3.5 w-3.5" /> Reject
          </button>
          <button
            onClick={onApprove}
            className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition flex items-center gap-1"
          >
            <Icon name="check" className="h-3.5 w-3.5" /> Approve
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function ReviewModal({ task, campaign, action, setAction, comments, setComments, saving, onCancel, onConfirm, onViewBrief }) {
  const labels = { APPROVED: 'Approve & Deliver', NEEDS_REWORK: 'Send for Rework', REJECTED: 'Reject Task' }
  const tones = {
    APPROVED:     'bg-green-600 hover:bg-green-700',
    NEEDS_REWORK: 'bg-amber-600 hover:bg-amber-700',
    REJECTED:     'bg-red-600  hover:bg-red-700',
  }
  // Reminder: rejecting one task closes the WHOLE campaign on the backend
  // (cancels all sibling tasks), so we surface a clear warning when the
  // reviewer is about to pick that path on a multi-deliverable brief that
  // still has other open / approved tasks attached to it.
  const isReject = action === 'REJECTED'
  const openSiblings = (campaign?.workTasks || []).filter(w =>
    w.taskId !== task.taskId &&
    w.status !== 'CANCELLED' &&
    w.status !== 'COMPLETED'
  ).length
  const wouldCloseSibs = isReject && openSiblings > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">{labels[action]}</h3>
          <button onClick={onCancel} className="rounded p-1 text-slate-400 hover:bg-slate-100 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        {campaign ? (
          <>
            <RequestSummaryCard campaign={campaign} />
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700 space-y-0.5">
              <div>
                <span className="font-medium">Reviewing deliverable:</span>{' '}
                #{task.taskId} — {task.granularTaskName || task.requirementTypeName}
              </div>
              <div>
                <span className="font-medium">Creator:</span>{' '}
                {task.assigneeName || `User ${task.assignedTo}`}
                {task.totalTimeLoggedMinutes != null && ` • ${task.totalTimeLoggedMinutes} min logged`}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
            <div><span className="font-medium">Task:</span> {task.granularTaskName || task.requirementTypeName}</div>
            <div><span className="font-medium">Campaign:</span> #{task.campaignId}</div>
            <div><span className="font-medium">Creator:</span> {task.assigneeName || `User ${task.assignedTo}`}</div>
          </div>
        )}

        <button
          type="button"
          onClick={onViewBrief}
          className="text-xs text-brand-600 hover:underline flex items-center gap-1"
        >
          <Icon name="eye" className="h-3 w-3" /> View full request brief
        </button>

        <div className="grid grid-cols-3 gap-1">
          <ActionRadio v="APPROVED"     active={action} setActive={setAction} label="Approve" />
          <ActionRadio v="NEEDS_REWORK" active={action} setActive={setAction} label="Rework" />
          <ActionRadio v="REJECTED"     active={action} setActive={setAction} label="Reject" />
        </div>

        {wouldCloseSibs && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 flex items-start gap-2">
            <Icon name="alertCircle" className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Heads up — rejecting this deliverable will <b>close the entire
              campaign</b> and cancel {openSiblings} other open task{openSiblings === 1 ? '' : 's'}
              {' '}on it. Use "Rework" if you only want this single deliverable redone.
            </span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Comments {action !== 'APPROVED' && <span className="text-red-500">*</span>}
          </label>
          <textarea
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder={action === 'APPROVED' ? 'Optional praise / sign-off…' : 'Be specific about what needs to change…'}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className={`rounded-lg px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${tones[action]}`}
          >
            {saving ? 'Saving…' : labels[action]}
          </button>
        </div>
      </div>
    </div>
  )
}

function ActionRadio({ v, active, setActive, label }) {
  const isActive = v === active
  return (
    <button
      onClick={() => setActive(v)}
      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
        isActive
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  )
}

function PriorityBadge({ v }) {
  const m = { HIGH: 'bg-red-50 text-red-700 ring-red-200', MEDIUM: 'bg-yellow-50 text-yellow-700 ring-yellow-200', LOW: 'bg-green-50 text-green-700 ring-green-200' }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${m[v] || 'bg-slate-100 text-slate-600'}`}>{v || '—'}</span>
}

function TimePill({ icon, label, ts }) {
  if (!ts) return null
  return (
    <span className="inline-flex items-center gap-1">
      <Icon name={icon} className="h-3 w-3 text-emerald-600" />
      <span className="text-slate-400">{label}:</span>
      <span className="text-slate-700 font-medium">
        {new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </span>
    </span>
  )
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}

/**
 * Parses task.assetUrl which may be a JSON array (multiple uploads)
 * or a plain URL string (legacy single-upload).
 */
function parseAssetUrls(assetUrl) {
  if (!assetUrl) return []
  try {
    const parsed = JSON.parse(assetUrl)
    if (Array.isArray(parsed)) return parsed
  } catch { /* not JSON — treat as plain URL */ }
  return [assetUrl]
}
