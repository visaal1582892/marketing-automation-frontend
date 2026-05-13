import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import managerApi from '../../api/manager'
import campaignsApi from '../../api/campaigns'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'
import RequestBriefDrawer, { RequestSummaryCard } from '../../components/RequestBriefDrawer'
import AssetPanel from '../../components/AssetPanel'
import { useAuth } from '../../auth/AuthContext'
import DateRangePicker from '../../components/DateRangePicker'
import Pagination from '../../components/Pagination'
import useDebounce from '../../hooks/useDebounce'

const PAGE_SIZE = 12

export default function QcReviewPage() {
  const location  = useLocation()
  const toast     = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)
  const { user }  = useAuth()

  const [tasks,         setTasks]        = useState([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages,    setTotalPages]   = useState(0)
  const [loading,       setLoading]      = useState(true)
  const [page,          setPage]         = useState(0)

  const [reviewing,         setReviewing]         = useState(null)
  const [reviewingCampaign, setReviewingCampaign] = useState(null)
  const [action,   setAction]   = useState('APPROVED')
  const [comments, setComments] = useState('')
  const [saving,   setSaving]   = useState(false)

  const [briefCampaignId,  setBriefCampaignId]  = useState(null)
  const [assetPreviewTask, setAssetPreviewTask] = useState(null)

  const [search,    setSearch]    = useState('')
  const [fDateFrom, setFDateFrom] = useState(null)
  const [fDateTo,   setFDateTo]   = useState(null)

  const dSearch = useDebounce(search, 350)

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [dSearch, fDateFrom, fDateTo])

  const fetchTasks = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    const params = {
      page, size: PAGE_SIZE,
      ...(dSearch   && { search:   dSearch   }),
      ...(fDateFrom && { dateFrom: fDateFrom }),
      ...(fDateTo   && { dateTo:   fDateTo   }),
    }
    managerApi.pendingTasks(params)
      .then(res => {
        const data = res.data
        setTasks(data.content || [])
        setTotalElements(data.totalElements ?? 0)
        setTotalPages(data.totalPages ?? 0)
      })
      .catch(() => { if (!silent) showToast('Failed to load review queue', 'error') })
      .finally(() => { if (!silent) setLoading(false) })
  }, [page, dSearch, fDateFrom, fDateTo]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchTasks() }, [fetchTasks, location.key])

  const load    = () => fetchTasks()
  const refresh = () => fetchTasks(true)

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
      {/* ── Header ── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">QC Review Queue</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Tasks submitted for quality-control review. Approve, send back for rework, or reject each deliverable.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 self-start rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition disabled:opacity-60"
        >
          <Icon name="refresh" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker
          from={fDateFrom}
          to={fDateTo}
          onChange={({ from, to }) => { setFDateFrom(from); setFDateTo(to) }}
          placeholder="All submitted dates"
          maxDate={new Date().toISOString().slice(0, 10)}
        />
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search task, campaign, assignee…"
            className="w-full rounded-lg border border-slate-200 pl-8 pr-8 py-1.5 text-sm text-slate-700
              placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
              <Icon name="x" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 flex items-center gap-1.5">
          <Icon name="inbox" className="h-3.5 w-3.5 text-purple-600" />
          <span className="text-xs font-semibold text-purple-700">
            {totalElements} task{totalElements !== 1 ? 's' : ''}
          </span>
        </div>
        {(fDateFrom || fDateTo || search) && (
          <button
            onClick={() => { setFDateFrom(null); setFDateTo(null); setSearch('') }}
            className="flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs text-brand-700 hover:bg-brand-100 transition"
          >
            <Icon name="x" className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <p className="text-center text-slate-400 py-12 text-sm">Loading…</p>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-14 text-center">
          <Icon name="inbox" className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">
            {search || fDateFrom || fDateTo ? 'No tasks match your filters.' : 'No tasks pending QC.'}
          </p>
          {(search || fDateFrom || fDateTo) && (
            <button onClick={() => { setFDateFrom(null); setFDateTo(null); setSearch('') }}
              className="mt-2 text-xs text-brand-600 hover:underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(t => (
            <FlatTaskCard
              key={t.taskId}
              task={t}
              onApprove={() => open(t, 'APPROVED')}
              onRework={()   => open(t, 'NEEDS_REWORK')}
              onReject={()   => open(t, 'REJECTED')}
              onView={()     => setBriefCampaignId(t.campaignId)}
              onViewAssets={() => setAssetPreviewTask(t)}
            />
          ))}
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-1 shadow-sm">
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

      {assetPreviewTask && (
        <AssetPanel
          task={assetPreviewTask}
          onClose={() => setAssetPreviewTask(null)}
        />
      )}

      {briefCampaignId && (
        <RequestBriefDrawer
          campaignId={briefCampaignId}
          onClose={() => setBriefCampaignId(null)}
          onCampaignChanged={() => { refresh() }}
        />
      )}
    </div>
  )
}

// ─── Flat task card (one card per task, sorted latest-first) ─────────────────

function FlatTaskCard({ task, onApprove, onRework, onReject, onView, onViewAssets }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* ── Header: IDs + priority + meta ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border-b border-slate-200 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 border border-brand-100">
            CMP&nbsp;{task.campaignId}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
            Task&nbsp;{task.taskId}
          </span>
          <PriorityBadge v={task.campaignPriority} />
          {task.reworkCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 ring-1 ring-orange-200">
              <Icon name="refresh" className="h-3 w-3" />
              {task.reworkCount}× rework
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {task.submittedAt && (
            <span className="text-xs text-slate-400">
              Submitted {new Date(task.submittedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={onView}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            <Icon name="eye" className="h-3 w-3" /> Brief
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-4 py-3 space-y-3">
        {/* Task name + assignee */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 leading-snug">
              {task.granularTaskName || task.taskTypeName || 'Task'}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {task.platformName && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{task.platformName}</span>
              )}
              {task.formatName && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{task.formatName}</span>
              )}
              {task.quantity && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Qty: {task.quantity}</span>
              )}
              <span>
                by <span className="font-semibold text-slate-700">{task.assigneeName || `User ${task.assignedTo}`}</span>
                {task.totalTimeLoggedMinutes != null && ` · ${task.totalTimeLoggedMinutes} min`}
              </span>
              {task.requestorName && (
                <span>· Req: <span className="font-semibold text-slate-700">{task.requestorName}</span></span>
              )}
            </div>
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <button onClick={onViewAssets}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition">
              <Icon name="fileText" className="h-3.5 w-3.5" /> Assets
            </button>
            <button onClick={onRework}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition">
              <Icon name="refresh" className="h-3.5 w-3.5" /> Rework
            </button>
            <button onClick={onReject}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition">
              <Icon name="x" className="h-3.5 w-3.5" /> Reject
            </button>
            <button onClick={onApprove}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">
              <Icon name="check" className="h-3.5 w-3.5" /> Approve
            </button>
          </div>
        </div>

        {/* Timeline */}
        <TaskTimeline task={task} />

        {/* Submission notes */}
        {task.submissionNotes && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Notes</span>
            <p className="mt-0.5 text-slate-700 whitespace-pre-wrap">{task.submissionNotes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Card representing one campaign + every task of that campaign currently in
 * QC. The header surfaces campaign-level metadata (id, priority, deadline,
 * requestor); rows below each carry their own individual action buttons.
 */
function CampaignGroup({ group, onApprove, onRework, onReject, onView, onViewAssets }) {
  const { campaignId, items } = group
  const sample    = items[0] || {}
  const requestor = sample.requestorName
  const priority  = sample.campaignPriority
  const deadline  = sample.campaignDeadline

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Campaign header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border-b border-slate-200 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Campaign</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-600">
            <span className="font-normal text-slate-400">CMP</span>{campaignId}
          </span>
          <PriorityBadge v={priority} />
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 ring-1 ring-purple-200">
            {items.length} pending QC
          </span>
          {requestor && (
            <span className="text-xs text-slate-500">· {requestor}</span>
          )}
          {deadline && (
            <span className="text-xs text-slate-400">· Due {fmtDate(deadline)}</span>
          )}
        </div>
        <button
          onClick={onView}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition shadow-sm"
        >
          <Icon name="eye" className="h-3.5 w-3.5" /> View Brief
        </button>
      </div>

      {/* Task rows */}
      <div className="divide-y divide-slate-100">
        {items.map(t => (
          <TaskRow
            key={t.taskId}
            task={t}
            onApprove={() => onApprove(t)}
            onRework={()  => onRework(t)}
            onReject={()  => onReject(t)}
            onViewAssets={() => onViewAssets(t)}
          />
        ))}
      </div>
    </div>
  )
}

function TaskRow({ task, onApprove, onRework, onReject, onViewAssets }) {
  const assetCount = 0 // assets are loaded on demand in the modal / preview
  const hasAssets  = true // always show the button — let the modal handle empty state

  return (
    <div className="px-5 py-4 space-y-3">
      {/* ── Row 1: task identity ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Left: name + meta tags */}
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-600">
              {task.taskId}
            </span>
            <span className="text-sm font-bold text-slate-900 truncate">
              {task.granularTaskName || task.taskTypeName || 'Task'}
            </span>
            {task.reworkCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 ring-1 ring-orange-200">
                <Icon name="refresh" className="h-3 w-3" />
                {task.reworkCount}× rework
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {task.platformName && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{task.platformName}</span>
            )}
            {task.formatName && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{task.formatName}</span>
            )}
            {task.quantity && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Qty: {task.quantity}</span>
            )}
            <span className="text-slate-400">
              by <span className="font-medium text-slate-600">{task.assigneeName || `User ${task.assignedTo}`}</span>
              {task.totalTimeLoggedMinutes != null && ` · ${task.totalTimeLoggedMinutes} min`}
            </span>
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* Assets — always shown; disabled when no files were submitted */}
          <button
            onClick={onViewAssets}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 cursor-pointer transition"
            title="View submitted assets"
          >
            <Icon name="fileText" className="h-3.5 w-3.5" />
            Assets
          </button>
          <button
            onClick={onRework}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition"
          >
            <Icon name="refresh" className="h-3.5 w-3.5" /> Rework
          </button>
          <button
            onClick={onReject}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
          >
            <Icon name="x" className="h-3.5 w-3.5" /> Reject
          </button>
          <button
            onClick={onApprove}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
          >
            <Icon name="check" className="h-3.5 w-3.5" /> Approve
          </button>
        </div>
      </div>

      {/* ── Row 2: lifecycle stepper ── */}
      <TaskTimeline task={task} />

      {/* ── Row 3: submission notes (only when present) ── */}
      {task.submissionNotes && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Notes</span>
          <p className="mt-0.5 text-slate-700 whitespace-pre-wrap">{task.submissionNotes}</p>
        </div>
      )}
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
  const isReject = action === 'REJECTED'
  const openSiblings = (campaign?.workTasks || []).filter(w =>
    w.taskId !== task.taskId &&
    w.status !== 'CANCELLED' &&
    w.status !== 'COMPLETED'
  ).length
  const wouldCloseSibs = isReject && openSiblings > 0

  const [showAssets, setShowAssets] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-y-auto max-h-[92vh] flex flex-col">
        <div className="p-6 space-y-4">
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
                  Task {task.taskId} — {task.granularTaskName || task.taskTypeName}
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
              <div><span className="font-medium">Task:</span> {task.granularTaskName || task.taskTypeName}</div>
              <div><span className="font-medium">Campaign:</span> {task.campaignId}</div>
              <div><span className="font-medium">Creator:</span> {task.assigneeName || `User ${task.assignedTo}`}</div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onViewBrief}
              className="text-xs text-brand-600 hover:underline flex items-center gap-1"
            >
              <Icon name="eye" className="h-3 w-3" /> View full request brief
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => setShowAssets(true)}
              className="text-xs text-brand-600 hover:underline flex items-center gap-1"
            >
              <Icon name="paperclip" className="h-3 w-3" /> Assets
            </button>
          </div>

          {task.submissionNotes && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Submission Notes</span>
              <p className="mt-0.5 text-slate-700 whitespace-pre-wrap">{task.submissionNotes}</p>
            </div>
          )}

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

      {showAssets && (
        <AssetPanel
          task={task}
          onClose={() => setShowAssets(false)}
        />
      )}
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

function TaskTimeline({ task }) {
  const steps = [
    {
      label: 'Assigned',
      ts: task.assignedAt || task.createdAt,
      icon: (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm4 1.5a4.5 4.5 0 0 1 1 2.833V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-.667A4.5 4.5 0 0 1 4 9.5h8Z"/>
        </svg>
      ),
      done: { dot: 'bg-slate-500', line: 'bg-slate-300', text: 'text-slate-600', card: 'bg-slate-50 border-slate-200' },
    },
    {
      label: 'Accepted',
      ts: task.acceptedAt,
      icon: (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path fillRule="evenodd" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm11.78-1.72a.75.75 0 0 0-1.06-1.06L7 8.94 5.28 7.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25Z"/>
        </svg>
      ),
      done: { dot: 'bg-blue-500', line: 'bg-blue-200', text: 'text-blue-700', card: 'bg-blue-50 border-blue-200' },
    },
    {
      label: 'Submitted',
      ts: task.submittedAt,
      icon: (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M.5 9.9a.5.5 0 0 1 .5.5V13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.6a.5.5 0 0 1 1 0V13a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.6a.5.5 0 0 1 .5-.5Z"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3Z"/>
        </svg>
      ),
      done: { dot: 'bg-emerald-500', line: 'bg-emerald-200', text: 'text-emerald-700', card: 'bg-emerald-50 border-emerald-200' },
    },
  ]

  const fmt = (ts) => new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="overflow-x-auto pb-0.5">
      <div className="flex items-stretch min-w-max gap-0">
        {steps.map((step, i) => {
          const active = !!step.ts
          const isLast = i === steps.length - 1
          const s = step.done
          return (
            <div key={step.label} className="flex items-center">
              {/* Step card */}
              <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition ${
                active ? s.card : 'bg-slate-50 border-slate-100'
              }`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full shrink-0 ${
                  active ? `${s.dot} text-white` : 'bg-slate-200 text-slate-400'
                }`}>
                  <span className="scale-75">{step.icon}</span>
                </span>
                <div className="leading-tight">
                  <div className={`text-[9px] font-bold uppercase tracking-wider ${active ? s.text : 'text-slate-400'}`}>
                    {step.label}
                  </div>
                  <div className={`text-[10px] font-semibold whitespace-nowrap ${active ? 'text-slate-700' : 'text-slate-400'}`}>
                    {active ? fmt(step.ts) : '—'}
                  </div>
                </div>
              </div>
              {/* Connector */}
              {!isLast && (
                <div className={`h-px w-3 shrink-0 ${active ? s.line : 'bg-slate-200'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}

