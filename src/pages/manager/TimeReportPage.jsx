import { useEffect, useMemo, useState } from 'react'
import managerApi from '../../api/manager'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'
import AppSelect from '../../components/AppSelect'

/**
 * Module 3 — weekly / monthly efficiency report.
 * Displays per-user total tasks, completed, in-flight, and minutes logged
 * within an optional date range.
 */
export default function TimeReportPage() {
  const toast = useToast()
  const showToast = (m, t = 'info') => toast[t]?.(m)

  const presets = [
    { id: 'today',   label: 'Today',         days: 0 },
    { id: 'week',    label: 'Last 7 days',   days: 6 },
    { id: 'month',   label: 'Last 30 days',  days: 29 },
    { id: 'quarter', label: 'Last 90 days',  days: 89 },
    { id: 'all',     label: 'All time',      days: null },
  ]

  const [preset, setPreset] = useState('week')
  const [from, setFrom]     = useState(() => isoDaysAgo(6))
  const [to, setTo]         = useState(() => isoDaysAgo(0))
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(true)

  // Column-level filters
  const [filterUser,     setFilterUser]     = useState('')
  const [filterRole,     setFilterRole]     = useState('')
  const [filterMinTotal, setFilterMinTotal] = useState('')
  const [filterMinDone,  setFilterMinDone]  = useState('')

  const applyPreset = (p) => {
    setPreset(p.id)
    if (p.days == null) { setFrom(''); setTo('') }
    else                { setFrom(isoDaysAgo(p.days)); setTo(isoDaysAgo(0)) }
  }

  const load = () => {
    setLoading(true)
    managerApi.timeReport(from || undefined, to || undefined)
      .then(res => setRows(res.data || []))
      .catch(() => showToast('Failed to load report', 'error'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [from, to]) // eslint-disable-line react-hooks/exhaustive-deps

  const distinctRoles = useMemo(
    () => [...new Set(rows.map(r => r.role_name).filter(Boolean))].sort(),
    [rows],
  )

  const filteredRows = useMemo(() => {
    const u = filterUser.trim().toLowerCase()
    const minT = filterMinTotal !== '' ? Number(filterMinTotal) : null
    const minD = filterMinDone  !== '' ? Number(filterMinDone)  : null
    return rows.filter(r => {
      if (u && !r.full_name?.toLowerCase().includes(u))   return false
      if (filterRole && r.role_name !== filterRole)         return false
      if (minT !== null && Number(r.total_tasks ?? 0) < minT) return false
      if (minD !== null && Number(r.completed_tasks ?? 0) < minD) return false
      return true
    })
  }, [rows, filterUser, filterRole, filterMinTotal, filterMinDone])

  const totals = useMemo(() => {
    return rows.reduce((a, r) => ({
      total:     a.total     + Number(r.total_tasks     || 0),
      completed: a.completed + Number(r.completed_tasks || 0),
      inFlight:  a.inFlight  + Number(r.in_flight_tasks || 0),
      minutes:   a.minutes   + Number(r.minutes_logged  || 0),
    }), { total: 0, completed: 0, inFlight: 0, minutes: 0 })
  }, [rows])

  const exportCsv = () => {
    if (rows.length === 0) return
    const headers = ['User', 'Role', 'Active Tasks', 'Total', 'Completed', 'In Flight', 'Minutes Logged']
    const lines = [headers.join(',')].concat(rows.map(r => [
      escape(r.full_name), escape(r.role_name), r.current_active_tasks ?? 0,
      r.total_tasks ?? 0, r.completed_tasks ?? 0, r.in_flight_tasks ?? 0, r.minutes_logged ?? 0,
    ].join(',')))
    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `time-report-${from || 'all'}_to_${to || 'all'}.csv`
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Time Tracking & Efficiency</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Per-user productivity summary. Numbers reflect work tasks the user has accepted.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {presets.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                preset === p.id
                  ? 'bg-brand-50 text-brand-700 ring-brand-200'
                  : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
              }`}
            >{p.label}</button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-0.5">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPreset('') }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-0.5">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPreset('') }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500"
            />
          </div>
          <button
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <Icon name="download" className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total tasks"   value={totals.total}     tone="brand" />
        <Kpi label="Completed"     value={totals.completed} tone="green" />
        <Kpi label="In flight"     value={totals.inFlight}  tone="amber" />
        <Kpi label="Minutes logged" value={fmtMinutes(totals.minutes)} tone="violet" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            {/* Column headers */}
            <tr>
              {['User', 'Role', 'Active Tasks', 'Total', 'Completed', 'In Flight', 'Time Logged'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
              ))}
            </tr>
            {/* Column-level filter inputs */}
            <tr className="border-t border-slate-100 bg-white">
              {/* User filter */}
              <td className="px-3 py-1.5">
                <input
                  type="text"
                  value={filterUser}
                  onChange={e => setFilterUser(e.target.value)}
                  placeholder="Search name…"
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs placeholder-slate-400
                             focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
                />
              </td>
              {/* Role filter */}
              <td className="px-3 py-1.5">
                <AppSelect value={filterRole} onChange={setFilterRole} options={distinctRoles} placeholder="All roles" size="sm" isSearchable menuPortal />
              </td>
              {/* Workload — no filter */}
              <td className="px-3 py-1.5" />
              {/* Total filter (min) */}
              <td className="px-3 py-1.5">
                <input
                  type="number"
                  min={0}
                  value={filterMinTotal}
                  onChange={e => setFilterMinTotal(e.target.value)}
                  placeholder="Min"
                  className="w-20 rounded border border-slate-200 px-2 py-1 text-xs placeholder-slate-400
                             focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
                />
              </td>
              {/* Completed filter (min) */}
              <td className="px-3 py-1.5">
                <input
                  type="number"
                  min={0}
                  value={filterMinDone}
                  onChange={e => setFilterMinDone(e.target.value)}
                  placeholder="Min"
                  className="w-20 rounded border border-slate-200 px-2 py-1 text-xs placeholder-slate-400
                             focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
                />
              </td>
              {/* In Flight & Time Logged — no filter */}
              <td className="px-3 py-1.5" />
              <td className="px-3 py-1.5">
                {(filterUser || filterRole || filterMinTotal !== '' || filterMinDone !== '') && (
                  <button
                    onClick={() => { setFilterUser(''); setFilterRole(''); setFilterMinTotal(''); setFilterMinDone('') }}
                    className="text-xs font-medium text-brand-600 hover:underline whitespace-nowrap"
                  >
                    Clear filters
                  </button>
                )}
              </td>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">Loading…</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">
                {rows.length === 0 ? 'No data for this range.' : 'No rows match the current filters.'}
              </td></tr>
            ) : filteredRows.map(r => (
              <tr key={r.user_id} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-medium text-slate-800">{r.full_name}</td>
                <td className="px-4 py-2.5 text-slate-600">{r.role_name || '—'}</td>
                <td className="px-4 py-2.5 text-slate-700 tabular-nums">
                  {r.current_active_tasks ?? 0}
                </td>
                <td className="px-4 py-2.5 text-slate-700 tabular-nums">{r.total_tasks ?? 0}</td>
                <td className="px-4 py-2.5 text-emerald-700 tabular-nums">{r.completed_tasks ?? 0}</td>
                <td className="px-4 py-2.5 text-amber-700 tabular-nums">{r.in_flight_tasks ?? 0}</td>
                <td className="px-4 py-2.5 text-slate-700 tabular-nums">{fmtMinutes(Number(r.minutes_logged ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Kpi({ label, value, tone }) {
  const tones = {
    brand:  'from-brand-500 to-brand-700',
    green:  'from-emerald-500 to-emerald-700',
    amber:  'from-amber-400 to-amber-600',
    violet: 'from-violet-500 to-violet-700',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`inline-flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br ${tones[tone]} text-white shadow-sm`}>
        <Icon name="trendingUp" className="h-4 w-4" />
      </div>
      <div className="mt-3 text-xl font-semibold text-slate-900 tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{label}</div>
    </div>
  )
}

function CapacityBar({ active, cap }) {
  const pct = cap > 0 ? Math.min(100, Math.round((active / cap) * 100)) : 0
  const tone = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 tabular-nums">{active}/{cap}</span>
    </div>
  )
}

function fmtMinutes(min) {
  const m = Number(min) || 0
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h}h` : `${h}h ${r}m`
}

function isoDaysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function escape(v) {
  const s = String(v ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
