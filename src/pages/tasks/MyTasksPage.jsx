import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import tasksApi from '../../api/tasks'
import collaborationApi from '../../api/collaboration'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import RequestBriefDrawer, { RequestSummaryCard } from '../../components/RequestBriefDrawer'
import campaignsApi from '../../api/campaigns'
import AssetPanel from '../../components/AssetPanel'
import AppSelect from '../../components/AppSelect'

/**
 * Module 3 — Employee Dashboard.
 *
 *  - Lists every task assigned to the logged-in user, ordered by priority.
 *  - "Accept" starts a server-side timer; the elapsed time updates every second.
 *  - "Submit for QC" stops the timer and lets the user upload an asset URL + notes.
 */
export default function MyTasksPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const toast    = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)

  const VALID_TABS = ['OPEN', 'QC', 'DONE', 'HELD', 'ALL']
  const initialTab = () => {
    const param = new URLSearchParams(location.search).get('tab')?.toUpperCase()
    return VALID_TABS.includes(param) ? param : 'OPEN'
  }

  const [tasks, setTasks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState(initialTab)
  const [submitting, setSubmitting] = useState(null)
  const [submitForm, setSubmitForm] = useState({ submissionNotes: '' })
  // fileItems: [{ id, file, status: 'uploading'|'done'|'error', url, errorMsg }]
  const [fileItems, setFileItems]   = useState([])
  const [savingId, setSavingId]     = useState(null)

  // Comment & hold modal
  const [commentTask,    setCommentTask]    = useState(null)
  const [commentText,    setCommentText]    = useState('')
  const [commentSaving,  setCommentSaving]  = useState(false)

  // Collaborate — no modal, just start + navigate
  const [collaboratingId, setCollaboratingId] = useState(null)

  // Full-brief drawer (any task → click "View brief")
  const [briefCampaignId, setBriefCampaignId] = useState(null)
  const [briefTaskId,     setBriefTaskId]     = useState(null)

  // Pre-fetched campaign summary for the Submit-for-QC modal so the worker
  // sees full request context while writing submission notes.
  const [submittingCampaign, setSubmittingCampaign] = useState(null)

  // Task-specific dynamic questions and worker's current answers
  const [taskQuestions, setTaskQuestions] = useState([])
  const [taskAnswers,   setTaskAnswers]   = useState({}) // { [questionId]: string }

  // `load()` blanks the list to "Loading…" — used only on first mount /
  // route change. `refresh()` silently swaps tasks without flicker so the
  // live timer span isn't unmounted while we sync after Start / Submit.
  const load = () => {
    setLoading(true)
    tasksApi.listMy()
      .then(res => setTasks(res.data || []))
      .catch(() => showToast('Failed to load tasks', 'error'))
      .finally(() => setLoading(false))
  }
  const refresh = () => {
    tasksApi.listMy()
      .then(res => setTasks(res.data || []))
      .catch(() => { /* silent — UI still shows the optimistic state */ })
  }

  useEffect(load, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live "wall clock" used by the timer badge ───────────────────────────
  // We keep an actual `now` state value (vs the old setTick re-render trick)
  // so it's a real piece of reactive state that React tracks. Every second
  // we bump it to the current millisecond stamp; `formatElapsed(task, now)`
  // then renders task.startedAt → now as MM:SS.
  // The interval is only armed while at least one task is IN_PROGRESS,
  // so an idle worker page costs zero ticks.
  const [now, setNow]   = useState(() => Date.now())
  const hasInFlight     = tasks.some(t => t.status === 'IN_PROGRESS')
  useEffect(() => {
    if (!hasInFlight) return
    setNow(Date.now()) // sync immediately so the first frame already shows ≥0s
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [hasInFlight])

  // A task whose parent campaign is REJECTED/COMPLETED is no longer
  // actionable — the worker may still see it for reference, but Accept/Submit
  // must be disabled. We treat such tasks as "closed" regardless of the task's
  // own status (e.g. it could still say ASSIGNED if the cancel sweep hasn't
  // re-rendered yet on a stale tab).
  const isTaskClosed = (t) =>
    t.status === 'COMPLETED' ||
    t.status === 'CANCELLED' ||
    t.campaignStatus === 'REJECTED' ||
    t.campaignStatus === 'COMPLETED'

  // ── Queue rules ─────────────────────────────────────────────────────────
  // The worker can have UP TO 3 tasks in flight simultaneously. The backend
  // already returns tasks ordered by priority (HIGH first, then MEDIUM, LOW)
  // and within each priority by status precedence + creation time.
  //
  //  - While fewer than 3 tasks are IN_PROGRESS → the top (3 − inFlight)
  //    ASSIGNED/REWORK tasks each get a "Start" button (up to 3 total).
  //  - Once 3 tasks are IN_PROGRESS → no more Start buttons appear.
  const MAX_IN_FLIGHT = 3
  const inFlightCount = useMemo(
    () => tasks.filter(t => t.status === 'IN_PROGRESS' && !isTaskClosed(t)).length,
    [tasks] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const canStartMore = inFlightCount < MAX_IN_FLIGHT
  // IDs of the next (up to MAX_IN_FLIGHT − inFlightCount) startable tasks.
  const startableTaskIds = useMemo(() => {
    if (!canStartMore) return new Set()
    const slots = MAX_IN_FLIGHT - inFlightCount
    const ids = new Set()
    for (const t of tasks) {
      if (ids.size >= slots) break
      if ((t.status === 'ASSIGNED' || t.status === 'REWORK') && !isTaskClosed(t)) {
        ids.add(t.taskId)
      }
    }
    return ids
  }, [tasks, canStartMore, inFlightCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (filter === 'ALL') return tasks
    if (filter === 'OPEN') return tasks.filter(t =>
      ['ASSIGNED', 'IN_PROGRESS', 'REWORK'].includes(t.status) &&
      t.campaignStatus !== 'REJECTED' &&
      t.campaignStatus !== 'COMPLETED'
    )
    if (filter === 'HELD')      return tasks.filter(t => t.status === 'HELD')
    if (filter === 'QC')        return tasks.filter(t => t.status === 'QC_REVIEW')
    if (filter === 'DONE')      return tasks.filter(t => t.status === 'COMPLETED')
    if (filter === 'CANCELLED') return tasks.filter(t =>
      t.status === 'CANCELLED' ||
      (['ASSIGNED', 'IN_PROGRESS', 'REWORK', 'QC_REVIEW'].includes(t.status) &&
        (t.campaignStatus === 'REJECTED' || t.campaignStatus === 'COMPLETED'))
    )
    return tasks
  }, [tasks, filter])

  const counts = useMemo(() => ({
    open: tasks.filter(t =>
      ['ASSIGNED', 'IN_PROGRESS', 'REWORK'].includes(t.status) &&
      t.campaignStatus !== 'REJECTED' &&
      t.campaignStatus !== 'COMPLETED'
    ).length,
    held: tasks.filter(t => t.status === 'HELD').length,
    qc:   tasks.filter(t => t.status === 'QC_REVIEW').length,
    done: tasks.filter(t => t.status === 'COMPLETED').length,
    cancelled: tasks.filter(t =>
      t.status === 'CANCELLED' ||
      (['ASSIGNED', 'IN_PROGRESS', 'REWORK', 'QC_REVIEW'].includes(t.status) &&
        (t.campaignStatus === 'REJECTED' || t.campaignStatus === 'COMPLETED'))
    ).length,
  }), [tasks])

  const accept = async (task) => {
    setSavingId(task.taskId)
    try {
      const res = await tasksApi.accept(task.taskId)
      // Optimistically merge the server's updated task into local state so
      // the status flips to IN_PROGRESS and `startedAt` is set immediately —
      // this is what kicks the live-timer interval into action without
      // waiting for the follow-up `refresh()` round-trip. We use `refresh()`
      // (not `load()`) here so the page DOESN'T blank out to "Loading…",
      // which would unmount the timer span the user is watching tick.
      const updated = res?.data
      if (updated && updated.taskId) {
        setTasks(prev => prev.map(t => t.taskId === updated.taskId ? { ...t, ...updated } : t))
      }
      showToast('Task started — timer running.', 'success')
      refresh()
    } catch (e) {
      const msg = e?.response?.data?.message || 'Could not start task'
      showToast(msg, 'error')
    } finally {
      setSavingId(null)
    }
  }

  const openSubmit = async (task) => {
    setSubmitting(task)
    setSubmittingCampaign(null)
    setTaskQuestions([])
    setTaskAnswers({})
    // Pre-fill notes from the previous submission so the worker can amend them.
    setSubmitForm({ submissionNotes: task.submissionNotes || '' })

    campaignsApi.getById(task.campaignId)
      .then(res => setSubmittingCampaign(res.data))
      .catch(() => { /* show task-only modal */ })

    // Fetch task-specific questions and any previously saved answers
    try {
      const [qRes, aRes] = await Promise.all([
        tasksApi.getQuestions(task.taskId),
        tasksApi.getAnswers(task.taskId),
      ])
      setTaskQuestions(qRes.data || [])
      const answerMap = {}
      for (const a of (aRes.data || [])) {
        answerMap[a.questionId] = a.answerValue
      }
      setTaskAnswers(answerMap)
    } catch {
      /* questions are optional — the modal still works without them */
    }
  }

  const submitForQc = async () => {
    if (!submitting) return

    // Validate required questions
    const missing = taskQuestions.filter(q => {
      if (!q.isRequired) return false
      const val = taskAnswers[q.questionId]
      return !val || (typeof val === 'string' && val.trim() === '') ||
             (val === '[]')
    })
    if (missing.length > 0) {
      showToast(`Please answer ${missing.length} required question${missing.length > 1 ? 's' : ''}.`, 'error')
      return
    }

    setSavingId(submitting.taskId)
    try {
      // Save question answers first (if any exist)
      if (taskQuestions.length > 0) {
        const answers = Object.entries(taskAnswers)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([questionId, answerValue]) => ({ questionId, answerValue }))
        if (answers.length > 0) {
          await tasksApi.submitAnswers(submitting.taskId, answers)
        }
      }

      await tasksApi.complete(submitting.taskId, {
        submissionNotes: submitForm.submissionNotes,
      })
      showToast('Submitted for QC review.', 'success')
      setSubmitting(null)
      setTaskQuestions([])
      setTaskAnswers({})
      refresh()
    } catch (e) {
      const msg = e?.response?.data?.message || 'Could not submit task'
      showToast(msg, 'error')
    } finally {
      setSavingId(null)
    }
  }

  // Upload a single fileItem to the image server and update its state in-place.
  const uploadFileItem = async (item) => {
    setFileItems(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading' } : f))
    const formData = new FormData()
    formData.append('files', item.file)
    try {
      const res = await tasksApi.uploadAssets(formData)
      const url = res.data?.urls?.[0]
      setFileItems(prev => prev.map(f => f.id === item.id ? { ...f, status: 'done', url } : f))
    } catch (err) {
      const msg = err?.response?.data?.message || 'Upload failed'
      setFileItems(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', errorMsg: msg } : f))
    }
  }

  const addFiles = (newFiles) => {
    const items = Array.from(newFiles).map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      status: 'pending',
      url: null,
      errorMsg: null,
    }))
    setFileItems(prev => {
      const updated = [...prev, ...items]
      return updated
    })
    // Upload each new file immediately
    items.forEach(item => uploadFileItem(item))
  }

  const removeFileItem = (id) => {
    setFileItems(prev => prev.filter(f => f.id !== id))
  }

  const retryFileItem = (item) => {
    uploadFileItem(item)
  }

  const openCommentModal = (task) => {
    setCommentTask(task)
    setCommentText(task.workerComment || '')
  }

  const submitComment = async () => {
    if (!commentTask || !commentText.trim()) return
    setCommentSaving(true)
    try {
      await tasksApi.commentAndHold(commentTask.taskId, commentText.trim())
      showToast('Task held. The requestor will be notified of your comment.', 'success')
      setCommentTask(null)
      setCommentText('')
      refresh()
    } catch (e) {
      showToast(e?.response?.data?.message || 'Could not hold task', 'error')
    } finally {
      setCommentSaving(false)
    }
  }

  const workerUnhold = async (task) => {
    setSavingId(task.taskId)
    try {
      await tasksApi.workerUnhold(task.taskId)
      showToast('Task resumed. Comment cleared.', 'success')
      refresh()
    } catch (e) {
      showToast(e?.response?.data?.message || 'Could not resume task', 'error')
    } finally {
      setSavingId(null)
    }
  }

  const handleCollaborate = async (task) => {
    setCollaboratingId(task.taskId)
    try {
      await collaborationApi.startCollaboration(task.taskId)
    } catch (e) {
      // If already held or already a collaborator, ignore and navigate anyway
      const msg = e?.response?.data?.message || ''
      if (!msg.toLowerCase().includes('already') && e?.response?.status !== 400) {
        showToast(msg || 'Could not start collaboration', 'error')
        setCollaboratingId(null)
        return
      }
    } finally {
      setCollaboratingId(null)
    }
    navigate('/collaborations')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">My Tasks</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Your live work queue, ordered by priority. Up to 3 tasks can be active at a time.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FilterPill label={`Open (${counts.open})`}            active={filter === 'OPEN'}      onClick={() => setFilter('OPEN')} />
          {counts.held > 0 && (
            <FilterPill label={`On Hold (${counts.held})`} active={filter === 'HELD'} onClick={() => setFilter('HELD')} highlight />
          )}
          <FilterPill label={`In QC (${counts.qc})`}             active={filter === 'QC'}        onClick={() => setFilter('QC')} />
          <FilterPill label={`Done (${counts.done})`}            active={filter === 'DONE'}      onClick={() => setFilter('DONE')} />
          {counts.cancelled > 0 && (
            <FilterPill label={`Cancelled (${counts.cancelled})`} active={filter === 'CANCELLED'} onClick={() => setFilter('CANCELLED')} />
          )}
          <FilterPill label="All" active={filter === 'ALL'} onClick={() => setFilter('ALL')} />
        </div>
      </div>

      {loading ? (
        <p className="text-center text-slate-400 py-12 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-14 text-center">
          <Icon name="inbox" className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">No tasks in this view.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => (
            <TaskCard
              key={t.taskId}
              task={t}
              now={now}
              busy={savingId === t.taskId}
              closed={isTaskClosed(t)}
              isNextUp={startableTaskIds.has(t.taskId)}
              hasInFlight={!canStartMore}
              onAccept={() => accept(t)}
              onSubmit={() => openSubmit(t)}
              onView={() => { setBriefCampaignId(t.campaignId); setBriefTaskId(t.taskId) }}
              onComment={() => openCommentModal(t)}
              onWorkerUnhold={() => workerUnhold(t)}
              onCollaborate={() => handleCollaborate(t)}
              collaborating={collaboratingId === t.taskId}
            />
          ))}
        </div>
      )}

      {submitting && (
        <SubmitModal
          task={submitting}
          campaign={submittingCampaign}
          form={submitForm}
          setForm={setSubmitForm}
          onCancel={() => {
            setSubmitting(null)
            setSubmittingCampaign(null)
            setTaskQuestions([])
            setTaskAnswers({})
          }}
          onConfirm={submitForQc}
          onViewBrief={() => { setBriefCampaignId(submitting.campaignId); setBriefTaskId(submitting.taskId) }}
          saving={savingId === submitting.taskId}
        />
      )}

      {commentTask && (
        <CommentModal
          task={commentTask}
          comment={commentText}
          onCommentChange={setCommentText}
          onConfirm={submitComment}
          onClose={() => { setCommentTask(null); setCommentText('') }}
          saving={commentSaving}
        />
      )}


      {briefCampaignId && (
        <RequestBriefDrawer
          campaignId={briefCampaignId}
          filterTaskId={briefTaskId}
          onClose={() => { setBriefCampaignId(null); setBriefTaskId(null) }}
          onCampaignChanged={(updated) => {
            // Mirror priority changes (and any other campaign-level edits made
            // from inside the drawer) onto every task that belongs to that
            // campaign — keeps the priority badge & "campaign closed" banner
            // accurate without forcing a full reload.
            setTasks(prev => prev.map(t =>
              t.campaignId === updated.campaignId
                ? {
                    ...t,
                    campaignPriority: updated.priority,
                    campaignStatus:   updated.status,
                  }
                : t
            ))
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function TaskCard({ task, now, busy, closed, isNextUp, hasInFlight, onAccept, onSubmit, onView, onComment, onWorkerUnhold, onCollaborate, collaborating }) {
  const [showAssets, setShowAssets] = useState(false)
  const elapsed      = formatElapsed(task, now)
  const isAssigned   = (task.status === 'ASSIGNED' || task.status === 'REWORK') && !closed
  const isInProgress = task.status === 'IN_PROGRESS' && !closed
  const isHeld       = task.status === 'HELD'
  // Self-held tasks (the worker put themselves on hold) have active comments.
  const isSelfHeld   = isHeld && task.activeComments?.length > 0
  // Queue rule: up to 3 tasks can be started simultaneously. The first
  // (3 − inFlight) ASSIGNED/REWORK tasks get a Start button; the rest are locked.
  const canStart     = isAssigned && isNextUp && !hasInFlight
  const isLocked     = isAssigned && !canStart
  // A task is "deactivated" when its parent campaign was rejected/completed
  // out from under it but the task row hasn't been swept to CANCELLED yet
  // (or when the task itself is now CANCELLED).
  const campaignDead = task.campaignStatus === 'REJECTED' || task.campaignStatus === 'COMPLETED'
  const isCancelled  = task.status === 'CANCELLED' || (campaignDead && task.status !== 'COMPLETED')

  return (
    <div className={`rounded-xl border bg-white shadow-sm overflow-hidden ${
      isCancelled ? 'border-slate-200 opacity-80' : 'border-slate-200'
    }`}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-500">
              <span className="font-normal text-slate-400">TASK</span>{task.taskId}
            </span>
            <span className="text-sm font-semibold text-slate-800">
              {task.granularTaskName || task.taskTypeName || 'Task'}
            </span>
            <PriorityBadge v={task.campaignPriority} />
            <StatusBadge status={isCancelled ? 'CANCELLED' : task.status} />
            {task.status === 'REWORK' && !isCancelled && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                <Icon name="alertCircle" className="h-3 w-3" />
                Needs rework
              </span>
            )}
            {task.reworkCount > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-orange-200"
                title={`QC Manager sent back ${task.reworkCount} time${task.reworkCount === 1 ? '' : 's'}`}
              >
                <Icon name="refresh" className="h-3 w-3" />
                QC {task.reworkCount}×
              </span>
            )}
            {task.requestorReworkCount > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-purple-200"
                title={`Requestor sent back ${task.requestorReworkCount} time${task.requestorReworkCount === 1 ? '' : 's'}`}
              >
                <Icon name="refresh" className="h-3 w-3" />
                Requestor {task.requestorReworkCount}×
              </span>
            )}
            {isHeld && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                <Icon name="pause" className="h-3 w-3" />
                {isSelfHeld ? 'On Hold — your comment' : 'On Hold'}
              </span>
            )}
            {campaignDead && task.status !== 'COMPLETED' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
                <Icon name="alertCircle" className="h-3 w-3" />
                Campaign {task.campaignStatus === 'REJECTED' ? 'rejected' : 'closed'}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>Campaign {task.campaignId} · {task.taskTypeName || '—'}</span>
            {task.platformName && <span>• {task.platformName}</span>}
            {task.formatName   && <span>• {task.formatName}</span>}
            {task.quantity     && <span>• {task.quantity}</span>}
            {task.requestorName && <span>• Requested by {task.requestorName}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isInProgress && (
            <span
              key={task.startedAt || task.taskId}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 tabular-nums"
              title={task.startedAt ? `Started ${fmtDateTime(task.startedAt)}` : 'Timer running'}
            >
              <Icon name="clock" className="h-3.5 w-3.5" />
              {elapsed || '00:00'}
            </span>
          )}
          {canStart && (
            <button
              onClick={onAccept}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition disabled:opacity-60"
            >
              <Icon name="play" className="h-3.5 w-3.5" />
              {busy ? 'Starting…' : 'Start'}
            </button>
          )}
          {isLocked && (
            <span
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200"
              title={
                hasInFlight
                  ? 'You already have 3 tasks active. Complete one before starting another.'
                  : 'Start one of the top 3 tasks in your queue first.'
              }
            >
              <Icon name="lock" className="h-3.5 w-3.5" />
              {hasInFlight ? 'Locked — 3 tasks active' : 'Locked — start a top task first'}
            </span>
          )}
          {isInProgress && (
            <button
              onClick={onSubmit}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60"
            >
              <Icon name="send" className="h-3.5 w-3.5" />
              Submit for QC
            </button>
          )}
          {(isAssigned || isInProgress) && !isCancelled && (
            <button
              onClick={onComment}
              className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition"
              title="Add a comment and pause this task"
            >
              <Icon name="messageSquare" className="h-3.5 w-3.5" />
              Add Comment
            </button>
          )}
          {isSelfHeld && (
            <button
              onClick={onWorkerUnhold}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition disabled:opacity-60"
            >
              <Icon name="play" className="h-3.5 w-3.5" />
              {busy ? 'Resuming…' : 'Resume Task'}
            </button>
          )}
          <button
            onClick={onView}
            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition flex items-center gap-1"
            title="View full request brief"
          >
            <Icon name="eye" className="h-3.5 w-3.5" />
            View Brief
          </button>
          {isInProgress && (
            <button
              onClick={onCollaborate}
              disabled={collaborating}
              className="flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 transition disabled:opacity-50"
              title="Open collaboration chat for this task"
            >
              <Icon name="users" className="h-3.5 w-3.5" />
              {collaborating ? 'Opening…' : 'Collaborate'}
            </button>
          )}
        </div>
      </div>

      <TaskTimeline task={task} />

      {isSelfHeld && task.activeComments?.length > 0 && (
        <ActiveCommentsList
          taskId={task.taskId}
          comments={task.activeComments}
          onAnswered={onWorkerUnhold}
        />
      )}

      {task.status === 'REWORK' && task.latestManagerReworkComment && !task.latestRequestorReworkComment && (
        <div className="border-t border-orange-100 bg-orange-50/60 px-4 py-2.5 flex items-start gap-2">
          <Icon name="alertCircle" className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-semibold text-orange-700">Manager rework note:</span>
            <p className="mt-0.5 text-xs text-orange-800 whitespace-pre-wrap">{task.latestManagerReworkComment}</p>
          </div>
        </div>
      )}
      {task.status === 'REWORK' && task.latestRequestorReworkComment && (
        <div className="border-t border-purple-100 bg-purple-50/60 px-4 py-2.5 flex items-start gap-2">
          <Icon name="alertCircle" className="h-3.5 w-3.5 text-purple-500 shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-semibold text-purple-700">Requestor rework note:</span>
            <p className="mt-0.5 text-xs text-purple-800 whitespace-pre-wrap">{task.latestRequestorReworkComment}</p>
          </div>
        </div>
      )}

      {task.totalTimeLoggedMinutes != null && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <span><span className="text-slate-400">Time logged:</span> {task.totalTimeLoggedMinutes} min</span>
          <button
            onClick={() => setShowAssets(true)}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 hover:border-brand-200 transition"
          >
            <Icon name="paperclip" className="h-3.5 w-3.5" />
            Assets
          </button>
        </div>
      )}

      {showAssets && (
        <AssetPanel task={task} allowUpload={isInProgress} onClose={() => setShowAssets(false)} />
      )}
    </div>
  )
}

/**
 * Compact timeline strip showing the four lifecycle timestamps:
 *   Assigned → Accepted → Submitted for QC → Approved
 * Each step lights up only after that timestamp is recorded.
 */
function TaskTimeline({ task }) {
  const steps = [
    { key: 'assigned',  label: 'Assigned',     ts: task.assignedAt || task.createdAt, icon: 'inbox' },
    { key: 'accepted',  label: 'Accepted',     ts: task.acceptedAt,                    icon: 'play' },
    { key: 'submitted', label: 'Submitted',    ts: task.submittedAt,                   icon: 'send' },
    { key: 'approved',  label: 'Approved',     ts: task.completedAt,                   icon: 'check' },
  ]
  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
      {steps.map(s => (
        <div key={s.key} className="flex items-center gap-1.5">
          <Icon
            name={s.icon}
            className={`h-3 w-3 ${s.ts ? 'text-emerald-600' : 'text-slate-300'}`}
          />
          <span className={`font-medium ${s.ts ? 'text-slate-700' : 'text-slate-400'}`}>{s.label}:</span>
          <span className={s.ts ? 'text-slate-600' : 'text-slate-400'}>
            {s.ts ? fmtDateTime(s.ts) : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

function fmtDateTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-IN', {
    day:    '2-digit',
    month:  'short',
    year:   '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

// ─── Question field renderer ──────────────────────────────────────────────────
function QuestionField({ question, value, onChange }) {
  const { questionText, fieldType, options, isRequired } = question
  const labelCls  = 'block text-xs font-medium text-slate-600 mb-1'
  const controlCls = 'w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500'

  let parsedOptions = []
  if (options) {
    try { parsedOptions = JSON.parse(options) } catch { /* ignore */ }
  }

  const getChecked = (opt) => {
    try { return JSON.parse(value || '[]').includes(opt) } catch { return false }
  }
  const toggleOption = (opt) => {
    let current = []
    try { current = JSON.parse(value || '[]') } catch { /* ignore */ }
    const next = current.includes(opt) ? current.filter(x => x !== opt) : [...current, opt]
    onChange(JSON.stringify(next))
  }

  return (
    <div>
      <label className={labelCls}>
        {questionText}
        {isRequired && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {fieldType === 'TEXT' && (
        <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} className={controlCls} />
      )}
      {fieldType === 'NUMBER' && (
        <input type="number" value={value || ''} onChange={e => onChange(e.target.value)} className={controlCls} />
      )}
      {fieldType === 'TEXTAREA' && (
        <textarea rows={3} value={value || ''} onChange={e => onChange(e.target.value)} className={`${controlCls} resize-none`} />
      )}
      {fieldType === 'DATE' && (
        <input type="date" value={value || ''} onChange={e => onChange(e.target.value)} className={controlCls} />
      )}
      {fieldType === 'DROPDOWN' && (
        <AppSelect value={value || ''} onChange={onChange} options={parsedOptions} placeholder="Select…" />
      )}
      {fieldType === 'MULTISELECT' && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-1.5">
          {parsedOptions.map(opt => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={getChecked(opt)}
                onChange={() => toggleOption(opt)}
                className="h-3.5 w-3.5 rounded border-slate-300 accent-brand-600"
              />
              <span className="text-sm text-slate-700">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Active Worker Comments ───────────────────────────────────────────────────
function ActiveCommentsList({ taskId, comments, onAnswered }) {
  const toast = useToast()
  const [marking, setMarking] = useState({})

  const markAnswered = async (commentId) => {
    setMarking(prev => ({ ...prev, [commentId]: true }))
    try {
      await tasksApi.markCommentAnswered(taskId, commentId)
      toast.success?.('Comment marked as answered.')
      onAnswered?.()
    } catch {
      toast.error?.('Could not mark comment.')
    } finally {
      setMarking(prev => ({ ...prev, [commentId]: false }))
    }
  }

  return (
    <div className="border-t border-amber-100 bg-amber-50/60 px-4 py-3 space-y-2">
      <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Active comments (task is on hold)</p>
      {comments.map(c => (
        <div key={c.commentId} className="flex items-start gap-2">
          <Icon name="messageSquare" className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-800 whitespace-pre-wrap">{c.comment}</p>
            <p className="text-[10px] text-amber-600 mt-0.5">by {c.userName}</p>
          </div>
          <button
            onClick={() => markAnswered(c.commentId)}
            disabled={marking[c.commentId]}
            className="shrink-0 rounded-md bg-amber-100 border border-amber-200 px-2 py-1 text-[10px] font-semibold text-amber-800 hover:bg-amber-200 transition disabled:opacity-50"
          >
            {marking[c.commentId] ? '…' : 'Mark Answered'}
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Submit-for-QC modal ──────────────────────────────────────────────────────
// ── Helpers shared with SubmitModal ─────────────────────────────────────────

function SubmitModal({
  task, campaign, form, setForm,
  onCancel, onConfirm, onViewBrief, saving,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Submit for QC review</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {task.granularTaskName || task.taskTypeName || 'Task'}
              {campaign && <span className="text-slate-400"> · {campaign.taskTypeName || `Campaign ${task.campaignId}`}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onViewBrief}
              className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition flex items-center gap-1">
              <Icon name="eye" className="h-3 w-3" /> Brief
            </button>
            <button onClick={onCancel} className="rounded p-1 text-slate-400 hover:bg-slate-100 transition">
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">

          {/* ── Assets (inline panel with drag-and-drop) ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Assets</label>
            </div>
            <AssetPanel task={task} allowUpload inline />
          </div>

          {/* ── Submission notes ── */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Submission notes</label>
            <textarea
              rows={3}
              value={form.submissionNotes}
              onChange={(e) => setForm({ ...form, submissionNotes: e.target.value })}
              placeholder="Anything the reviewer should know…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 resize-none"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60 flex items-center gap-2"
          >
            <Icon name="send" className="h-3.5 w-3.5" />
            {saving ? 'Submitting…' : 'Submit for QC'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

// Plain helper — NOT a React hook (no state, no lifecycle). The previous name
// `useElapsed` falsely tripped React's hook lint since the function is called
// conditionally inside TaskCard. Renamed to `formatElapsed` so the lint
// honestly applies to actual hooks only.
//
// Returns the wall-clock elapsed time since `startedAt` for IN_PROGRESS
// tasks. `now` is the parent's reactive 1-Hz wall clock — passing it in
// (rather than calling Date.now() directly) is what makes the timer
// actually re-render every second, since React tracks props.
function formatElapsed(task, now) {
  if (task.status !== 'IN_PROGRESS') return ''
  const start = parseTs(task.startedAt) ?? parseTs(task.acceptedAt)
  if (start == null) return '00:00'
  const ms    = Math.max(0, (now ?? Date.now()) - start)
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`
  return `${pad(m)}:${pad(s)}`
}
function pad(n) { return String(n).padStart(2, '0') }
function parseTs(v) {
  if (!v) return null
  // Backend serializes LocalDateTime as ISO-8601 without an offset, e.g.
  // "2026-04-27T11:00:00". `new Date(...)` interprets that as local time —
  // which is exactly what we want since both server and browser run in IST.
  // Some payloads occasionally arrive as `[y, m, d, ...]` arrays (Jackson
  // default for older configs); guard against that too.
  if (Array.isArray(v) && v.length >= 3) {
    const [y, mo, d, hh = 0, mm = 0, ss = 0] = v
    const t = new Date(y, (mo || 1) - 1, d || 1, hh, mm, ss).getTime()
    return Number.isNaN(t) ? null : t
  }
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? null : t
}

// ─── Comment & Hold modal ─────────────────────────────────────────────────────
function CommentModal({ task, comment, onCommentChange, onConfirm, onClose, saving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Add Comment &amp; Hold Task</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Task <span className="font-medium text-slate-700">#{task.taskId}</span> —{' '}
              {task.granularTaskName || task.taskTypeName || 'Task'}
            </p>
          </div>
          <button onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
            <div className="font-semibold mb-0.5">This will pause your task</div>
            <div>The task will go <span className="font-medium">On Hold</span> and the requestor will see your comment. You can resume it once they respond.</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Your comment / question <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={comment}
              onChange={e => onCommentChange(e.target.value)}
              placeholder="Describe what you need from the requestor to proceed…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800
                         placeholder:text-slate-400 focus:border-amber-400 focus:outline-none
                         focus:ring-1 focus:ring-amber-300 resize-none"
              autoFocus
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} disabled={saving}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-60">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving || !comment?.trim()}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition"
          >
            {saving ? (
              <><span className="animate-spin h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent" /> Holding…</>
            ) : (
              <><Icon name="messageSquare" className="h-3.5 w-3.5" /> Comment &amp; Hold</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function FilterPill({ label, active, onClick, highlight }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ring-1 ${
        active
          ? highlight
            ? 'bg-amber-100 text-amber-800 ring-amber-300'
            : 'bg-brand-50 text-brand-700 ring-brand-200'
          : highlight
            ? 'bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100'
            : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  )
}

const STATUS_STYLES = {
  ASSIGNED:    'bg-blue-50 text-blue-700 ring-blue-200',
  IN_PROGRESS: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  REWORK:      'bg-amber-50 text-amber-700 ring-amber-200',
  QC_REVIEW:   'bg-purple-50 text-purple-700 ring-purple-200',
  COMPLETED:   'bg-green-50 text-green-700 ring-green-200',
  CANCELLED:   'bg-rose-50 text-rose-700 ring-rose-200',
  HELD:        'bg-amber-50 text-amber-700 ring-amber-200',
}
const STATUS_LABELS = {
  ASSIGNED: 'New', IN_PROGRESS: 'In Progress', REWORK: 'Rework',
  QC_REVIEW: 'In QC', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
  HELD: 'On Hold',
}
function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}
function PriorityBadge({ v }) {
  const m = { HIGH: 'bg-red-50 text-red-700 ring-red-200', MEDIUM: 'bg-yellow-50 text-yellow-700 ring-yellow-200', LOW: 'bg-green-50 text-green-700 ring-green-200' }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${m[v] || 'bg-slate-100 text-slate-600'}`}>{v || '—'}</span>
}

// ─── Collaborate Modal ────────────────────────────────────────────────────────

function CollaborateModal({ task, onClose }) {
  const toast = useToast()
  const [allUsers,  setAllUsers]  = useState([])
  const [selected,  setSelected]  = useState([])
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [existing,  setExisting]  = useState([])

  useEffect(() => {
    Promise.all([
      collaborationApi.getAllUsers(),
      collaborationApi.getMembers(task.taskId).catch(() => ({ data: [] })),
    ]).then(([usersRes, membersRes]) => {
      setAllUsers(usersRes.data || [])
      setExisting((membersRes.data || []).map(m => m.userId))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [task.taskId])

  const filtered = allUsers.filter(u =>
    u.userId !== task.assignedTo &&
    (u.fullName || '').toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (uid) =>
    setSelected(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid])

  const handleSubmit = async () => {
    if (!selected.length) return
    setSaving(true)
    try {
      await collaborationApi.invite(task.taskId, selected)
      toast.success?.(`${selected.length} collaborator${selected.length > 1 ? 's' : ''} invited.`)
      onClose()
    } catch (e) {
      toast.error?.(e?.response?.data?.message || 'Failed to invite collaborators.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Invite Collaborators</h3>
            <p className="text-xs text-slate-500 mt-0.5">{task.granularTaskName || task.taskId}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users…"
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
          />
        </div>

        <div className="overflow-y-auto max-h-64 px-5 py-2 space-y-1">
          {loading ? (
            <p className="text-center text-slate-400 text-sm py-6">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-4">No users found.</p>
          ) : filtered.map(u => {
            const isAlready = existing.includes(u.userId)
            const isSel     = selected.includes(u.userId)
            return (
              <button
                key={u.userId}
                disabled={isAlready}
                onClick={() => !isAlready && toggle(u.userId)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition
                  ${isAlready
                    ? 'opacity-50 cursor-not-allowed bg-slate-50'
                    : isSel
                      ? 'bg-indigo-50 ring-1 ring-indigo-200'
                      : 'hover:bg-slate-50'}`}
              >
                <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0">
                  {(u.fullName || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 truncate">{u.fullName}</p>
                  <p className="text-[10px] text-slate-400 truncate">{u.designationName || u.email}</p>
                </div>
                {isAlready && <span className="text-[10px] text-slate-400 shrink-0">Already added</span>}
                {!isAlready && isSel && <Icon name="check" className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
              </button>
            )
          })}
        </div>

        <div className="border-t border-slate-100 px-5 py-4 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {selected.length > 0 ? `${selected.length} selected` : 'Select collaborators above'}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selected.length || saving}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Inviting…' : 'Start Collaboration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
