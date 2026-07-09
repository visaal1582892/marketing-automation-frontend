const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

export const WEEKDAY_OPTIONS = DAY_NAMES.map((name) => ({
  value: name,
  label: name.charAt(0) + name.slice(1).toLowerCase(),
}))

export const WEEK_OFF_SPECIAL_OPTIONS = [
  { value: 'SATURDAY_EVEN', label: 'Even Saturdays (2nd & 4th)' },
]

const WEEK_OFF_LABELS = Object.fromEntries(
  WEEK_OFF_SPECIAL_OPTIONS.map((opt) => [opt.value, opt.label]),
)

function parseTimeParts(value) {
  const [hh = '0', mm = '0'] = String(value || '00:00').split(':')
  return { hours: Number(hh), minutes: Number(mm) }
}

function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function atTime(date, hours, minutes) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0)
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function normalizeSnapshot(raw) {
  if (!raw) return null
  return {
    workStartTime: raw.workStartTime || '09:00',
    workEndTime: raw.workEndTime || '18:00',
    weekOffDays: new Set((raw.weekOffDays || ['SUNDAY']).map(d => String(d).toUpperCase())),
    holidays: new Set(raw.holidays || []),
    workStart: parseTimeParts(raw.workStartTime || '09:00'),
    workEnd: parseTimeParts(raw.workEndTime || '18:00'),
  }
}

export function isWorkingDay(date, snapshot) {
  if (!snapshot) return true
  const dayName = DAY_NAMES[date.getDay()]
  if (snapshot.weekOffDays.has(dayName)) return false
  if (dayName === 'SATURDAY' && snapshot.weekOffDays.has('SATURDAY_EVEN')) {
    const weekOfMonth = Math.floor((date.getDate() - 1) / 7) + 1
    if (weekOfMonth % 2 === 0) return false
  }
  return !snapshot.holidays.has(toDateKey(date))
}

export function isWithinWorkingHours(date, snapshot) {
  if (!snapshot || !date) return false
  if (!isWorkingDay(date, snapshot)) return false
  const mins = date.getHours() * 60 + date.getMinutes()
  const start = snapshot.workStart.hours * 60 + snapshot.workStart.minutes
  const end = snapshot.workEnd.hours * 60 + snapshot.workEnd.minutes
  return mins >= start && mins < end
}

export function calculateWorkingMinutes(start, end, snapshot) {
  if (!start || !end || !snapshot || start >= end) return 0

  let total = 0
  let cursor = startOfDay(start)
  const endDay = startOfDay(end)

  while (cursor <= endDay) {
    if (isWorkingDay(cursor, snapshot)) {
      const dayStart = atTime(cursor, snapshot.workStart.hours, snapshot.workStart.minutes)
      const dayEnd = atTime(cursor, snapshot.workEnd.hours, snapshot.workEnd.minutes)
      const overlapStart = start > dayStart ? start : dayStart
      const overlapEnd = end < dayEnd ? end : dayEnd
      if (overlapStart < overlapEnd) {
        total += Math.floor((overlapEnd - overlapStart) / 60000)
      }
    }
    cursor = addDays(cursor, 1)
  }

  return total
}

export function parseTs(v) {
  if (!v) return null
  if (Array.isArray(v) && v.length >= 3) {
    const [y, mo, d, hh = 0, mm = 0, ss = 0] = v
    const t = new Date(y, (mo || 1) - 1, d || 1, hh, mm, ss).getTime()
    return Number.isNaN(t) ? null : t
  }
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? null : t
}

export function formatTaskTime(totalMinutes) {
  const total = Math.max(0, Math.floor(totalMinutes ?? 0))
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `${hours}h : ${minutes}m`
}

export function formatHHmm(totalMinutes) {
  const total = Math.max(0, Math.floor(totalMinutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  return { hours: h, minutes: m, display: formatTaskTime(total) }
}

export function formatWorkingElapsed(task, nowMs, snapshot) {
  if (task.status !== 'IN_PROGRESS') {
    return { display: '', outsideHours: false, isRunning: false }
  }

  const baseMinutes = task.totalTimeLoggedMinutes ?? 0
  const cycleStartMs = parseTs(task.startedAt) ?? parseTs(task.acceptedAt)
  const nowDate = new Date(nowMs ?? Date.now())

  let cycleMinutes = 0
  if (cycleStartMs != null && snapshot) {
    cycleMinutes = calculateWorkingMinutes(new Date(cycleStartMs), nowDate, snapshot)
  } else if (cycleStartMs != null) {
    cycleMinutes = Math.max(0, Math.floor(((nowMs ?? Date.now()) - cycleStartMs) / 60000))
  }

  const outsideHours = snapshot ? !isWithinWorkingHours(nowDate, snapshot) : false
  const display = formatTaskTime(baseMinutes + cycleMinutes)

  return {
    display,
    outsideHours,
    isRunning: !outsideHours,
  }
}

export function formatWeekOffLabel(token) {
  const key = String(token || '').toUpperCase()
  return WEEK_OFF_LABELS[key] || key.charAt(0) + key.slice(1).toLowerCase()
}

export function todayIsoDate() {
  const d = new Date()
  return toDateKey(d)
}

export function isFutureHolidayDate(isoDate) {
  return isoDate > todayIsoDate()
}

export function isDeletableHolidayDate(isoDate) {
  return isoDate > todayIsoDate()
}

export function isCreatableHolidayDate(isoDate) {
  return isoDate >= todayIsoDate()
}

export function tomorrowIsoDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return toDateKey(d)
}

/** Min HH:mm for same-day end-time PATCH (must be strictly after now). */
export function minEndTimeAfterNow() {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 1)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function isFutureScheduleDate(isoDate) {
  return isoDate > todayIsoDate()
}

export function weekOffsEqual(a, b) {
  const sa = [...(a || [])].map(d => String(d).toUpperCase()).sort().join(',')
  const sb = [...(b || [])].map(d => String(d).toUpperCase()).sort().join(',')
  return sa === sb
}

/** 'none' | 'saveDetails' (end only) | 'createSchedule' (start/week-offs changed) */
export function getScheduleEditMode(saved, current) {
  if (!saved || !current) return 'none'
  const endChanged = saved.workEndTime !== current.workEndTime
  const startChanged = saved.workStartTime !== current.workStartTime
  const weekOffsChanged = !weekOffsEqual(saved.weekOffDays, current.weekOffDays)
  if (!endChanged && !startChanged && !weekOffsChanged) return 'none'
  if (endChanged && !startChanged && !weekOffsChanged) return 'saveDetails'
  return 'createSchedule'
}

export function findActiveScheduleId(schedules, today = todayIsoDate()) {
  if (!schedules?.length) return null
  const active = [...schedules]
    .filter((s) => s.effectiveDate <= today)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0]
  return active?.id ?? null
}
