import { formatTaskTime } from './workingHours'

/** Format minutes as "73h : 22m". */
export function fmtMins(m) {
  return formatTaskTime(m)
}

export function fmtDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export function initials(name) {
  if (!name) return '?'
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

/** Sum logged minutes across all assignment cycles. */
export function sumHistoryMinutes(history) {
  if (!history?.length) return 0
  return history.reduce((acc, h) => acc + (h.totalTimeLoggedMinutes ?? 0), 0)
}

/** Derive human outcome label for one assignment cycle. */
export function deriveAssignmentOutcome(entry, index, total) {
  const isActive = entry.status === 'ACTIVE'
  const isLast = index === total - 1

  if (entry.lastReworkAction === 'NEEDS_REWORK') {
    return { label: 'Sent for Rework (Manager)', tone: 'amber' }
  }
  if (entry.lastReworkAction === 'REQUESTOR_REWORK') {
    return { label: 'Sent for Rework (Requestor)', tone: 'amber' }
  }

  if (entry.requestorApprovedAt) return { label: 'Completed', tone: 'emerald' }
  if (entry.managerApprovedAt && !entry.requestorApprovedAt) return { label: 'Manager approved', tone: 'blue' }
  if (entry.submittedAt && !entry.managerApprovedAt) return { label: `Submitted ${fmtDateTime(entry.submittedAt)}`, tone: 'violet' }
  if (entry.startedAt || entry.acceptedAt) return { label: 'In progress', tone: 'blue' }
  if (!isActive && isLast && total > 1) return { label: 'Reassigned', tone: 'amber' }
  if (!isActive) return { label: 'Previous cycle', tone: 'slate' }
  if (isActive) return { label: 'Current assignee', tone: 'brand' }
  return { label: 'Assigned', tone: 'slate' }
}

const OUTCOME_TONE = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  blue:    'bg-blue-50 text-blue-700 ring-blue-200',
  violet:  'bg-violet-50 text-violet-700 ring-violet-200',
  amber:   'bg-amber-50 text-amber-700 ring-amber-200',
  brand:   'bg-brand-50 text-brand-700 ring-brand-200',
  slate:   'bg-slate-100 text-slate-600 ring-slate-200',
}

export function outcomeBadgeClass(tone) {
  return OUTCOME_TONE[tone] || OUTCOME_TONE.slate
}
