import { useEffect, useMemo, useState } from 'react'
import workingHoursApi from '../../api/workingHours'
import useDebounce from '../../hooks/useDebounce'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import AppSelect from '../../components/AppSelect'
import BackToMaster from '../../components/admin/BackToMaster'
import { TableStatusRow } from '../../components/dataTable'
import {
  WEEKDAY_OPTIONS,
  WEEK_OFF_SPECIAL_OPTIONS,
  findActiveScheduleId,
  formatWeekOffLabel,
  getScheduleEditMode,
  isCreatableHolidayDate,
  isDeletableHolidayDate,
  isFutureScheduleDate,
  minEndTimeAfterNow,
  todayIsoDate,
  tomorrowIsoDate,
} from '../../utils/workingHours'

const PAGE_SIZE = 20

const MONTH_OPTIONS = [
  { value: '', label: 'All months' },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i, 1).toLocaleString(undefined, { month: 'long' }),
  })),
]

function yearOptions() {
  const current = new Date().getFullYear()
  return [
    { value: '', label: 'All years' },
    ...Array.from({ length: 5 }, (_, i) => ({
      value: String(current + i),
      label: String(current + i),
    })),
  ]
}

function toggleWeekOffInList(weekOffDays, day) {
  const set = new Set(weekOffDays || [])
  if (set.has(day)) set.delete(day)
  else set.add(day)
  return [...set]
}

function cloneConfig(data) {
  return {
    workStartTime: data?.workStartTime || '09:00',
    workEndTime: data?.workEndTime || '18:00',
    weekOffDays: [...(data?.weekOffDays || ['SUNDAY'])],
  }
}

function fmtScheduleCreatedAt(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtWeekOffs(days) {
  if (!days?.length) return '—'
  return days.map((d) => formatWeekOffLabel(d)).join(', ')
}

export default function WorkingHoursPage() {
  const toast = useToast()

  const [savedConfig, setSavedConfig] = useState(null)
  const [config, setConfig] = useState({ workStartTime: '09:00', workEndTime: '18:00', weekOffDays: ['SUNDAY'] })
  const [configLoading, setConfigLoading] = useState(true)
  const [savingDetails, setSavingDetails] = useState(false)

  const [futureOpen, setFutureOpen] = useState(false)
  const [futureSchedule, setFutureSchedule] = useState({
    effectiveDate: '',
    workStartTime: '09:00',
    workEndTime: '18:00',
    weekOffDays: ['SUNDAY'],
  })
  const [creatingSchedule, setCreatingSchedule] = useState(false)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyRows, setHistoryRows] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshSeed, setRefreshSeed] = useState(0)

  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()))
  const [filterMonth, setFilterMonth] = useState('')
  const dYear = useDebounce(filterYear, 300)
  const dMonth = useDebounce(filterMonth, 300)

  const [createOpen, setCreateOpen] = useState(false)
  const [newHoliday, setNewHoliday] = useState({ holidayDate: '', description: '' })
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const editMode = useMemo(() => getScheduleEditMode(savedConfig, config), [savedConfig, config])
  const activeScheduleId = useMemo(() => findActiveScheduleId(historyRows), [historyRows])

  const loadConfig = () => {
    setConfigLoading(true)
    return workingHoursApi.getConfig()
      .then((data) => {
        const snapshot = cloneConfig(data)
        setSavedConfig(snapshot)
        setConfig(snapshot)
        return data
      })
      .catch(() => {
        toast.error('Failed to load working hours.')
        return null
      })
      .finally(() => setConfigLoading(false))
  }

  useEffect(() => {
    loadConfig()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(0)
  }, [dYear, dMonth])

  useEffect(() => {
    let alive = true
    setLoading(true)
    workingHoursApi.listHolidays({
      year: dYear ? Number(dYear) : undefined,
      month: dMonth ? Number(dMonth) : undefined,
      page,
      size: PAGE_SIZE,
    })
      .then((res) => {
        if (!alive) return
        setRows(res.content ?? [])
        setTotal(res.totalElements ?? 0)
        setTotalPages(res.totalPages ?? 0)
      })
      .catch(() => { if (alive) toast.error('Failed to load holidays.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [dYear, dMonth, page, refreshSeed]) // eslint-disable-line react-hooks/exhaustive-deps

  const openHistory = () => {
    setHistoryOpen(true)
    setHistoryLoading(true)
    workingHoursApi.listSchedules()
      .then((data) => setHistoryRows(data ?? []))
      .catch(() => toast.error('Failed to load schedule history.'))
      .finally(() => setHistoryLoading(false))
  }

  const saveDetails = async (e) => {
    e.preventDefault()
    setSavingDetails(true)
    try {
      const updated = await workingHoursApi.patchActiveEndTime(config.workEndTime)
      const snapshot = {
        workStartTime: updated.workStartTime,
        workEndTime: updated.workEndTime,
        weekOffDays: [...(updated.weekOffDays || [])],
      }
      setSavedConfig(snapshot)
      setConfig(snapshot)
      toast.success('End time updated for today.')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save details.')
    } finally {
      setSavingDetails(false)
    }
  }

  const openCreateSchedule = () => {
    setFutureSchedule({
      effectiveDate: '',
      workStartTime: config.workStartTime,
      workEndTime: config.workEndTime,
      weekOffDays: [...(config.weekOffDays || [])],
    })
    setFutureOpen(true)
  }

  const createFutureSchedule = async (e) => {
    e.preventDefault()
    if (!isFutureScheduleDate(futureSchedule.effectiveDate)) {
      toast.error('Effective date must be after today (Asia/Kolkata).')
      return
    }
    setCreatingSchedule(true)
    try {
      const created = await workingHoursApi.createSchedule(futureSchedule)
      toast.success(`Schedule queued for ${created.effectiveDate}.`)
      setFutureOpen(false)
      const snapshot = cloneConfig(savedConfig)
      setConfig(snapshot)
      if (historyOpen) {
        const rows = await workingHoursApi.listSchedules()
        setHistoryRows(rows ?? [])
      }
    } catch (err) {
      const status = err?.response?.status
      const msg = err?.response?.data?.message
      if (status === 409 || status === 400) {
        toast.error(msg || 'A schedule already exists for that date.')
      } else {
        toast.error(msg || 'Failed to create schedule.')
      }
    } finally {
      setCreatingSchedule(false)
    }
  }

  const openCreate = () => {
    setNewHoliday({ holidayDate: '', description: '' })
    setCreateOpen(true)
  }

  const createHoliday = async (e) => {
    e.preventDefault()
    if (!isCreatableHolidayDate(newHoliday.holidayDate)) {
      toast.error('Holiday date must be today or in the future.')
      return
    }
    setCreating(true)
    try {
      await workingHoursApi.createHoliday(newHoliday)
      toast.success('Holiday created.')
      setCreateOpen(false)
      setRefreshSeed((s) => s + 1)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create holiday.')
    } finally {
      setCreating(false)
    }
  }

  const deleteHoliday = async (row) => {
    if (!isDeletableHolidayDate(row.holidayDate)) {
      toast.error('Only future holidays can be deleted.')
      return
    }
    setDeletingId(row.id)
    try {
      await workingHoursApi.deleteHoliday(row.id)
      toast.success('Holiday deleted.')
      setRefreshSeed((s) => s + 1)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete holiday.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <BackToMaster />

      <header className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
          <Icon name="clock" className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Working Hours & Holidays</h1>
          <p className="text-xs text-slate-500">
            Versioned schedules (Asia/Kolkata) and company holidays.
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Active schedule</h2>
            <p className="mt-1 text-xs text-slate-500">
              Change end time only to update today. Change start or week-offs to create a new schedule version.
            </p>
          </div>
          <button
            type="button"
            onClick={openHistory}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Icon name="clock" className="h-3.5 w-3.5" />
            History
          </button>
        </div>

        {configLoading ? (
          <p className="mt-4 text-sm text-slate-400">Loading…</p>
        ) : (
          <form
            onSubmit={editMode === 'saveDetails' ? saveDetails : (e) => { e.preventDefault(); openCreateSchedule() }}
            className="mt-4 space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-xs font-medium text-slate-600">
                Work start
                <input
                  type="time"
                  required
                  value={config.workStartTime}
                  onChange={(e) => setConfig((c) => ({ ...c, workStartTime: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Work end
                <input
                  type="time"
                  required
                  min={editMode === 'saveDetails' ? minEndTimeAfterNow() : undefined}
                  value={config.workEndTime}
                  onChange={(e) => setConfig((c) => ({ ...c, workEndTime: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <WeekOffPicker
              weekOffDays={config.weekOffDays}
              onChange={(days) => setConfig((c) => ({ ...c, weekOffDays: days }))}
            />

            {editMode === 'saveDetails' && (
              <p className="text-xs text-slate-500">
                Only end time changed — applies to today&apos;s active schedule immediately.
              </p>
            )}
            {editMode === 'createSchedule' && (
              <p className="text-xs text-slate-500">
                Start or week-offs changed — you&apos;ll pick an effective date for the new version.
              </p>
            )}

            {editMode !== 'none' && (
              <button
                type="submit"
                disabled={savingDetails || creatingSchedule}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                  editMode === 'saveDetails'
                    ? 'bg-brand-600 hover:bg-brand-700'
                    : 'bg-slate-800 hover:bg-slate-900'
                }`}
              >
                {editMode === 'saveDetails'
                  ? (savingDetails ? 'Saving…' : 'Save details')
                  : 'Create new schedule'}
              </button>
            )}
          </form>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Holidays</h2>
            <p className="text-xs text-slate-500">{loading ? 'Loading…' : `${total} holiday${total === 1 ? '' : 's'}`}</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
          >
            <Icon name="plus" className="h-3.5 w-3.5" />
            Create holiday
          </button>
        </div>

        <div className="flex flex-wrap gap-3 border-b border-slate-100 px-5 py-3">
          <AppSelect value={filterYear} onChange={setFilterYear} options={yearOptions()} className="w-36" />
          <AppSelect value={filterMonth} onChange={setFilterMonth} options={MONTH_OPTIONS} className="w-40" />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">Description</th>
                <th className="px-5 py-3 font-semibold w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <TableStatusRow colSpan={3} className="py-12">Loading…</TableStatusRow>
              )}
              {!loading && rows.length === 0 && (
                <TableStatusRow colSpan={3} className="py-12">No holidays match this filter.</TableStatusRow>
              )}
              {!loading && rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-5 py-3 tabular-nums text-slate-800">{row.holidayDate}</td>
                  <td className="px-5 py-3 text-slate-700">{row.description}</td>
                  <td className="px-5 py-3">
                    {isDeletableHolidayDate(row.holidayDate) ? (
                      <button
                        type="button"
                        onClick={() => deleteHoliday(row)}
                        disabled={deletingId === row.id}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50"
                      >
                        {deletingId === row.id ? 'Deleting…' : 'Delete'}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Locked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 px-5 py-3">
          <Pagination
            page={page}
            totalPages={totalPages}
            totalElements={total}
            pageSize={PAGE_SIZE}
            loading={loading}
            onPageChange={setPage}
          />
        </div>
      </section>

      <Modal open={futureOpen} onClose={() => setFutureOpen(false)} title="Create new schedule" maxWidth="max-w-lg">
        <p className="mb-4 text-xs text-slate-500">
          New version takes effect on the chosen date. Current schedule stays active until then.
        </p>
        <form onSubmit={createFutureSchedule} className="space-y-4">
          <label className="block text-xs font-medium text-slate-600">
            Effective date
            <input
              type="date"
              required
              min={tomorrowIsoDate()}
              value={futureSchedule.effectiveDate}
              onChange={(e) => setFutureSchedule((s) => ({ ...s, effectiveDate: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600">
              Work start
              <input
                type="time"
                required
                value={futureSchedule.workStartTime}
                onChange={(e) => setFutureSchedule((s) => ({ ...s, workStartTime: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Work end
              <input
                type="time"
                required
                value={futureSchedule.workEndTime}
                onChange={(e) => setFutureSchedule((s) => ({ ...s, workEndTime: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <WeekOffPicker
            weekOffDays={futureSchedule.weekOffDays}
            onChange={(days) => setFutureSchedule((s) => ({ ...s, weekOffDays: days }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setFutureOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingSchedule}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {creatingSchedule ? 'Creating…' : 'Create schedule'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Schedule history" maxWidth="max-w-5xl">
        <div className="overflow-x-auto -mx-1">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Effective</th>
                <th className="px-3 py-2.5 font-semibold">Hours</th>
                <th className="px-3 py-2.5 font-semibold">Week-offs</th>
                <th className="px-3 py-2.5 font-semibold">Created</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading && (
                <TableStatusRow colSpan={5} className="py-10">Loading…</TableStatusRow>
              )}
              {!historyLoading && historyRows.length === 0 && (
                <TableStatusRow colSpan={5} className="py-10">No schedules found.</TableStatusRow>
              )}
              {!historyLoading && historyRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2.5 tabular-nums text-slate-800">{row.effectiveDate}</td>
                  <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                    {row.workStartTime} – {row.workEndTime}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 text-xs">{fmtWeekOffs(row.weekOffDays)}</td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                    {fmtScheduleCreatedAt(row.createdAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    {row.id === activeScheduleId ? (
                      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                        Active
                      </span>
                    ) : row.effectiveDate > todayIsoDate() ? (
                      <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-200">
                        Upcoming
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Past</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create holiday" maxWidth="max-w-md">
        <form onSubmit={createHoliday} className="space-y-4">
          <label className="block text-xs font-medium text-slate-600">
            Date
            <input
              type="date"
              required
              min={todayIsoDate()}
              value={newHoliday.holidayDate}
              onChange={(e) => setNewHoliday((h) => ({ ...h, holidayDate: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Description
            <input
              type="text"
              required
              maxLength={255}
              value={newHoliday.description}
              onChange={(e) => setNewHoliday((h) => ({ ...h, description: e.target.value }))}
              placeholder="e.g. Independence Day"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function WeekOffPicker({ weekOffDays, onChange }) {
  const options = [...WEEKDAY_OPTIONS, ...WEEK_OFF_SPECIAL_OPTIONS]

  return (
    <div>
      <div className="text-xs font-medium text-slate-600 mb-2">Week-off days</div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const checked = (weekOffDays || []).includes(opt.value)
          return (
            <label
              key={opt.value}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer transition ${
                checked
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-200"
                checked={checked}
                onChange={() => onChange(toggleWeekOffInList(weekOffDays, opt.value))}
              />
              {opt.label}
            </label>
          )
        })}
      </div>
    </div>
  )
}
