import { useEffect, useState } from 'react'
import tasksApi from '../api/tasks'
import Icon from './Icon'
import {
  deriveAssignmentOutcome, fmtDateTime, fmtMins, initials, outcomeBadgeClass,
} from '../utils/taskAssignment'

/**
 * Vertical assignment lifecycle timeline — one block per task_assignments row.
 * Falls back to compact status strip when history unavailable.
 */
export default function TaskHistoryTimeline({ taskId, task, compact = false }) {
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!taskId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    tasksApi.getAssignmentHistory(taskId)
      .then(r => { if (!cancelled) setHistory(r.data ?? []) })
      .catch(() => { if (!cancelled) setError('Could not load assignment history.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [taskId])

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 animate-pulse">
        <div className="h-3 w-32 rounded bg-slate-200 mb-3" />
        <div className="space-y-3">
          <div className="h-14 rounded-lg bg-slate-200" />
          <div className="h-14 rounded-lg bg-slate-200" />
        </div>
      </div>
    )
  }

  if (error || !history?.length) {
    if (task && compact) return <LegacyStrip task={task} />
    if (task) return <LegacyStrip task={task} />
    return (
      <p className="text-xs text-slate-400 italic py-2">{error || 'No assignment history yet.'}</p>
    )
  }

  if (compact && history.length === 1) {
    return <LegacyStrip task={task} />
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/80 to-white overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <Icon name="clock" className="h-3.5 w-3.5 text-brand-600" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Assignment History
        </span>
        {history.length > 1 && (
          <span className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
            {history.length} cycles
          </span>
        )}
      </div>

      <ol className="relative px-4 py-4 space-y-0">
        {history.map((entry, i) => {
          const isActive = entry.status === 'ACTIVE'
          const outcome = deriveAssignmentOutcome(entry, i, history.length)
          const isLast = i === history.length - 1

          return (
            <li key={entry.assignmentId ?? i} className="relative flex gap-3 pb-6 last:pb-0">
              {!isLast && (
                <span className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-slate-200" aria-hidden />
              )}

              <div className="relative z-10 shrink-0 mt-0.5">
                {isActive ? (
                  <span className="relative flex h-8 w-8 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-30" />
                    <span className="relative flex h-8 w-8 items-center justify-center rounded-full
                                     bg-gradient-to-br from-brand-500 to-brand-700 text-[10px] font-bold text-white shadow-md ring-2 ring-brand-200">
                      {initials(entry.assigneeName)}
                    </span>
                  </span>
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full
                                   bg-slate-200 text-[10px] font-bold text-slate-600">
                    {initials(entry.assigneeName)}
                  </span>
                )}
              </div>

              <div className={`flex-1 min-w-0 rounded-xl border px-3 py-2.5 transition ${
                isActive
                  ? 'border-brand-200 bg-brand-50/60 shadow-sm ring-1 ring-brand-100'
                  : 'border-slate-200 bg-white'
              }`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{entry.assigneeName || 'Unknown'}</p>
                    {entry.roleName && (
                      <p className="text-[10px] text-slate-400 font-medium">{entry.roleName}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${outcomeBadgeClass(outcome.tone)}`}>
                    {isActive && <span className="mr-1 h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />}
                    {outcome.label}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                  {entry.assignedAt && (
                    <span><span className="text-slate-400">Assigned</span> {fmtDateTime(entry.assignedAt)}</span>
                  )}
                  {entry.acceptedAt && (
                    <span><span className="text-slate-400">Accepted</span> {fmtDateTime(entry.acceptedAt)}</span>
                  )}
                  {(entry.totalTimeLoggedMinutes ?? 0) > 0 && (
                    <span className="font-semibold text-slate-700">
                      <Icon name="clock" className="inline h-3 w-3 -mt-0.5 mr-0.5 text-emerald-600" />
                      {fmtMins(entry.totalTimeLoggedMinutes)} logged
                    </span>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Fallback horizontal strip when no multi-cycle history. */
function LegacyStrip({ task }) {
  if (!task) return null
  const steps = [
    { label: 'Assigned', ts: task.assignedAt || task.createdAt },
    { label: 'Accepted', ts: task.acceptedAt },
    { label: 'Submitted', ts: task.submittedAt },
    { label: 'Mgr Approved', ts: task.managerApprovedAt },
    { label: 'Req Approved', ts: task.requestorApprovedAt },
  ]
  return (
    <div className="overflow-x-auto pb-0.5">
      <div className="flex items-stretch min-w-max gap-2">
        {steps.map(s => (
          <div key={s.label} className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${
            s.ts ? 'border-slate-200 bg-white text-slate-700' : 'border-slate-100 bg-slate-50 text-slate-400'
          }`}>
            <span className="font-semibold">{s.label}:</span>{' '}
            {s.ts ? fmtDateTime(s.ts) : '—'}
          </div>
        ))}
      </div>
    </div>
  )
}
