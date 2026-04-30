import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import tasksApi from '../../api/tasks'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import RequestBriefDrawer, { RequestSummaryCard } from '../../components/RequestBriefDrawer'
import campaignsApi from '../../api/campaigns'

/**
 * Module 3 — Employee Dashboard.
 *
 *  - Lists every task assigned to the logged-in user, ordered by priority.
 *  - "Accept" starts a server-side timer; the elapsed time updates every second.
 *  - "Submit for QC" stops the timer and lets the user upload an asset URL + notes.
 */
export default function MyTasksPage() {
  const location = useLocation()
  const toast    = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)

  const [tasks, setTasks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('OPEN')
  const [submitting, setSubmitting] = useState(null)
  const [submitForm, setSubmitForm] = useState({ submissionNotes: '' })
  // fileItems: [{ id, file, status: 'uploading'|'done'|'error', url, errorMsg }]
  const [fileItems, setFileItems]   = useState([])
  const [savingId, setSavingId]     = useState(null)

  // Comment & hold modal
  const [commentTask,    setCommentTask]    = useState(null)
  const [commentText,    setCommentText]    = useState('')
  const [commentSaving,  setCommentSaving]  = useState(false)

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
  // The worker can have AT MOST ONE task in flight at a time. The backend
  // already returns tasks ordered by priority (HIGH first, then MEDIUM, LOW)
  // and within each priority by status precedence + creation time, so the
  // first ASSIGNED/REWORK task in this list is the "top of queue".
  //
  //  - If something is already IN_PROGRESS → no Start buttons appear at all;
  //    the only allowed next action is "Submit for QC" on that task.
  //  - Otherwise → only the very first ASSIGNED/REWORK task gets a "Start"
  //    button. Every other ASSIGNED/REWORK task shows a Locked indicator.
  const inFlightTaskId = useMemo(
    () => tasks.find(t => t.status === 'IN_PROGRESS' && !isTaskClosed(t))?.taskId ?? null,
    [tasks] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const nextStartableTaskId = useMemo(() => {
    if (inFlightTaskId != null) return null
    return tasks.find(t =>
      (t.status === 'ASSIGNED' || t.status === 'REWORK') && !isTaskClosed(t)
    )?.taskId ?? null
  }, [tasks, inFlightTaskId]) // eslint-disable-line react-hooks/exhaustive-deps

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

    // Pre-populate previously uploaded files as already-done items.
    // The worker can remove any of them or just add new ones on top.
    const prevUrls = parseAssetUrls(task.assetUrl)
    setFileItems(prevUrls.map((url, i) => ({
      id:           `prev-${i}-${Date.now()}`,
      file:         null,        // no File object — already on server
      status:       'done',
      url,
      fromPrevious: true,
      errorMsg:     null,
    })))

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

    const uploadedUrls = fileItems.filter(f => f.status === 'done').map(f => f.url)
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
        assetUrls: uploadedUrls,
      })
      showToast('Submitted for QC review.', 'success')
      setSubmitting(null)
      setFileItems([])
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">My Tasks</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Your live work queue, ordered by priority. Start the top task first — only one task can be active at a time.
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
              isNextUp={t.taskId === nextStartableTaskId}
              hasInFlight={inFlightTaskId != null}
              onAccept={() => accept(t)}
              onSubmit={() => openSubmit(t)}
              onView={() => { setBriefCampaignId(t.campaignId); setBriefTaskId(t.taskId) }}
              onComment={() => openCommentModal(t)}
              onWorkerUnhold={() => workerUnhold(t)}
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
          fileItems={fileItems}
          onAddFiles={addFiles}
          onRemoveFile={removeFileItem}
          onRetryFile={retryFileItem}
          onCancel={() => {
            setSubmitting(null); setSubmittingCampaign(null)
            setFileItems([]); setTaskQuestions([]); setTaskAnswers({})
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

function TaskCard({ task, now, busy, closed, isNextUp, hasInFlight, onAccept, onSubmit, onView, onComment, onWorkerUnhold }) {
  const elapsed      = formatElapsed(task, now)
  const isAssigned   = (task.status === 'ASSIGNED' || task.status === 'REWORK') && !closed
  const isInProgress = task.status === 'IN_PROGRESS' && !closed
  const isHeld       = task.status === 'HELD'
  // Only worker-held tasks (those with a workerComment) can be self-unholded.
  const isSelfHeld   = isHeld && !!task.workerComment
  // Queue rule: only the top-of-queue task can be started, and only when no
  // other task is in flight. Everything else in ASSIGNED/REWORK gets locked.
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
            <span className="text-xs font-mono text-slate-400">#{task.taskId}</span>
            <span className="text-sm font-semibold text-slate-800">
              {task.granularTaskName || task.requirementTypeName || 'Task'}
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
                title={`This task has been sent back for rework ${task.reworkCount} time${task.reworkCount === 1 ? '' : 's'}`}
              >
                <Icon name="refresh" className="h-3 w-3" />
                {task.reworkCount}× rework
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
            <span>Campaign #{task.campaignId} • {task.requirementTypeName || '—'}</span>
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
                  ? 'Finish the task currently in progress before starting another.'
                  : 'You can only start the top task in your queue.'
              }
            >
              <Icon name="lock" className="h-3.5 w-3.5" />
              {hasInFlight ? 'Locked — finish current task' : 'Locked — start the top task first'}
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
        </div>
      </div>

      <TaskTimeline task={task} />

      {isSelfHeld && task.workerComment && (
        <div className="border-t border-amber-100 bg-amber-50/60 px-4 py-2.5 flex items-start gap-2">
          <Icon name="messageSquare" className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-semibold text-amber-700">Your comment to requestor:</span>
            <p className="mt-0.5 text-xs text-amber-800 whitespace-pre-wrap">{task.workerComment}</p>
          </div>
        </div>
      )}

      {(task.totalTimeLoggedMinutes || task.assetUrl) && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 flex flex-wrap items-center gap-4 text-xs text-slate-600">
          {task.totalTimeLoggedMinutes != null && (
            <span><span className="text-slate-400">Time logged:</span> {task.totalTimeLoggedMinutes} min</span>
          )}
          {parseAssetUrls(task.assetUrl).map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
               className="text-brand-600 hover:underline flex items-center gap-1">
              <Icon name="fileText" className="h-3.5 w-3.5" />
              {parseAssetUrls(task.assetUrl).length > 1 ? `Asset ${i + 1}` : 'View submitted asset'}
            </a>
          ))}
        </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// Accepted file types for the asset upload picker
const ACCEPTED_FILE_TYPES = [
  'image/*',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
  'video/x-ms-wmv', 'video/mpeg',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',')

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
        <select value={value || ''} onChange={e => onChange(e.target.value)} className={controlCls}>
          <option value="">Select…</option>
          {parsedOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
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

// ─── Submit-for-QC modal ──────────────────────────────────────────────────────
function SubmitModal({
  task, campaign, form, setForm,
  fileItems, onAddFiles, onRemoveFile, onRetryFile,
  onCancel, onConfirm, onViewBrief, saving,
}) {
  const uploading  = fileItems.some(f => f.status === 'uploading')
  const doneCount  = fileItems.filter(f => f.status === 'done').length
  const errorCount = fileItems.filter(f => f.status === 'error').length

  const handleDrop = (e) => {
    e.preventDefault()
    if (e.dataTransfer.files?.length) onAddFiles(e.dataTransfer.files)
  }
  const handleDragOver = (e) => e.preventDefault()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Submit for QC review</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {task.granularTaskName || task.requirementTypeName || 'Task'}
              {campaign && <span className="text-slate-400"> · {campaign.requirementTypeName || `Campaign #${task.campaignId}`}</span>}
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

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {/* ── File upload zone ── */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Attach files
              <span className="ml-1 text-slate-400 font-normal">(images, videos, PDFs, Word, Excel)</span>
            </label>

            {/* Drop zone */}
            <label
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition cursor-pointer py-6 px-4 text-center"
            >
              <input
                type="file"
                multiple
                accept={ACCEPTED_FILE_TYPES}
                className="sr-only"
                onChange={e => { if (e.target.files?.length) onAddFiles(e.target.files); e.target.value = '' }}
              />
              <Icon name="upload" className="h-7 w-7 text-slate-400" />
              <span className="text-sm text-slate-600 font-medium">
                Drag & drop files here, or <span className="text-brand-600">click to browse</span>
              </span>
              <span className="text-xs text-slate-400">
                Images · MP4 / MOV / AVI · PDF · DOCX · XLSX — up to 100 MB each
              </span>
            </label>

            {/* File list */}
            {fileItems.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {fileItems.map(item => (
                  <li key={item.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                      item.fromPrevious               ? 'border-blue-200 bg-blue-50' :
                      item.status === 'done'          ? 'border-emerald-200 bg-emerald-50' :
                      item.status === 'error'         ? 'border-red-200 bg-red-50' :
                                                        'border-slate-200 bg-white'
                    }`}
                  >
                    {/* Status icon */}
                    {item.status === 'uploading' && (
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-brand-400 border-t-transparent animate-spin flex-shrink-0" />
                    )}
                    {item.status === 'done' && !item.fromPrevious && (
                      <Icon name="check" className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                    )}
                    {item.status === 'done' && item.fromPrevious && (
                      <Icon name="fileText" className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                    )}
                    {item.status === 'error' && (
                      <Icon name="alertCircle" className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                    )}
                    {item.status === 'pending' && (
                      <Icon name="fileText" className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    )}

                    {/* File name + info */}
                    <span className="flex-1 truncate text-slate-700">
                      {item.fromPrevious
                        ? <span className="text-blue-700 text-xs">Previously uploaded</span>
                        : item.file?.name
                      }
                    </span>
                    {!item.fromPrevious && item.file && (
                      <span className="text-slate-400 flex-shrink-0">
                        {(item.file.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                    )}

                    {/* Error message */}
                    {item.status === 'error' && (
                      <span className="text-red-600 text-xs">{item.errorMsg}</span>
                    )}

                    {/* URL preview for done items */}
                    {item.status === 'done' && item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="text-brand-600 hover:underline text-xs flex-shrink-0 flex items-center gap-0.5">
                        <Icon name="eye" className="h-3 w-3" /> View
                      </a>
                    )}

                    {/* Retry button for errors */}
                    {item.status === 'error' && (
                      <button onClick={() => onRetryFile(item)}
                        className="text-xs text-red-600 hover:underline flex-shrink-0">
                        Retry
                      </button>
                    )}

                    {/* Remove button — works for both previous and new files */}
                    <button onClick={() => onRemoveFile(item.id)}
                      className="text-slate-400 hover:text-red-500 transition flex-shrink-0"
                      title={item.fromPrevious ? 'Remove from this submission' : 'Remove'}>
                      <Icon name="x" className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Status summary */}
            {fileItems.length > 0 && (
              <p className="mt-1.5 text-xs text-slate-500">
                {doneCount} of {fileItems.length} file{fileItems.length !== 1 ? 's' : ''} uploaded
                {errorCount > 0 && <span className="text-red-500 ml-1">· {errorCount} error{errorCount !== 1 ? 's' : ''}</span>}
              </p>
            )}
          </div>

          {/* Submission notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Submission notes
            </label>
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
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving || uploading}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60 flex items-center gap-2"
          >
            <Icon name="send" className="h-3.5 w-3.5" />
            {saving ? 'Submitting…' : uploading ? 'Uploading files…' : 'Submit for QC'}
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

/**
 * Parses the stored asset URL string into an array of URLs.
 * The value may be a JSON array (multiple uploads) or a plain URL (legacy single upload).
 */
function parseAssetUrls(assetUrl) {
  if (!assetUrl) return []
  try {
    const parsed = JSON.parse(assetUrl)
    if (Array.isArray(parsed)) return parsed
  } catch { /* not JSON — treat as plain URL */ }
  return [assetUrl]
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
              {task.granularTaskName || task.requirementTypeName || 'Task'}
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
