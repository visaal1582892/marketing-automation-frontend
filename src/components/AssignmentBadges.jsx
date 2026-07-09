import Icon from './Icon'
import { fmtMins } from '../utils/taskAssignment'

/** Reassigned / multi-cycle pill when assignmentCount > 1. */
export function ReassignedBadge({ assignmentCount }) {
  if (!assignmentCount || assignmentCount <= 1) return null
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-sky-200"
      title={`${assignmentCount} assignment cycles on this task`}
    >
      <Icon name="refresh" className="h-3 w-3" />
      {assignmentCount > 2 ? `Attempts: ${assignmentCount}` : 'Reassigned'}
    </span>
  )
}

/**
 * Time logged label — "Your time" vs "Total time" when cycles differ.
 * @param {object} task — needs totalTimeLoggedMinutes, totalTimeAllCycles, assignmentCount, assignedTo
 * @param {number|null} currentUserId — viewer user id
 */
export function TimeLoggedBadge({ task, currentUserId }) {
  const yourMins = task.totalTimeLoggedMinutes ?? 0
  const totalMins = task.totalTimeAllCycles ?? yourMins
  const multiCycle = (task.assignmentCount ?? 1) > 1
  const isAssignee = currentUserId != null && task.assignedTo === currentUserId

  if (!yourMins && !totalMins) return null

  if (multiCycle && totalMins !== yourMins) {
    return (
      <span className="inline-flex flex-col gap-0.5 text-[10px] text-slate-500" title="Time across all assignees">
        {isAssignee && yourMins > 0 && (
          <span><span className="font-semibold text-slate-600">Your time:</span> {fmtMins(yourMins)}</span>
        )}
        <span><span className="font-semibold text-slate-600">Total time:</span> {fmtMins(totalMins)}</span>
      </span>
    )
  }

  const label = isAssignee ? 'Your time' : 'Time logged'
  return (
    <span className="text-[10px] text-slate-500">
      <span className="font-semibold text-slate-600">{label}:</span> {fmtMins(yourMins || totalMins)}
    </span>
  )
}
