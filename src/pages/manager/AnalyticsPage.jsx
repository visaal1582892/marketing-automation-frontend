import { useEffect, useMemo, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadialBarChart, RadialBar,
} from 'recharts'
import managerApi from '../../api/manager'
import Icon from '../../components/Icon'

// ─── Palette ─────────────────────────────────────────────────────────────────
const COLORS = {
  brand:   '#c2181d',
  blue:    '#2563eb',
  violet:  '#7c3aed',
  emerald: '#059669',
  amber:   '#d97706',
  rose:    '#e11d48',
  cyan:    '#0891b2',
  indigo:  '#4338ca',
  slate:   '#475569',
}

const STATUS_COLOR = {
  IN_PROGRESS: COLORS.blue,
  QC_REVIEW:   COLORS.violet,
  COMPLETED:   COLORS.emerald,
  REJECTED:    COLORS.rose,
  CANCELLED:   COLORS.slate,
  PENDING:     COLORS.amber,
}
const STATUS_LABEL = {
  IN_PROGRESS: 'In Progress', QC_REVIEW: 'QC Review',
  COMPLETED: 'Completed',     REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',     PENDING: 'Pending',
  ASSIGNED: 'Assigned',       REWORK: 'Rework',
  HELD: 'On Hold',
}
const PRIORITY_COLOR = { HIGH: COLORS.rose, MEDIUM: COLORS.amber, LOW: COLORS.emerald }
const TASK_STATUS_COLOR = {
  ASSIGNED:    '#94a3b8',
  IN_PROGRESS: COLORS.blue,
  QC_REVIEW:   COLORS.violet,
  REWORK:      COLORS.amber,
  COMPLETED:   COLORS.emerald,
  HELD:        '#f59e0b',
  CANCELLED:   '#cbd5e1',
}

const CHART_COLORS = [COLORS.brand, COLORS.blue, COLORS.violet, COLORS.emerald,
                      COLORS.amber, COLORS.cyan, COLORS.indigo, COLORS.rose]

// ─── Helper: format minutes → "2h 15m" ───────────────────────────────────────
function fmtMins(m) {
  if (!m || m === 0) return '—'
  const h = Math.floor(m / 60)
  const min = Math.round(m % 60)
  return h > 0 ? `${h}h ${min}m` : `${min}m`
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, valueLabel = 'Count' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-xl px-3 py-2.5 min-w-[120px]">
      {label && <p className="text-[11px] font-bold text-slate-500 mb-1.5">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-slate-600">{p.name || valueLabel}:</span>
          <span className="font-bold text-slate-900">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, accent, sub, trend }) {
  const ACCENTS = {
    brand:   'from-brand-600 to-brand-800',
    blue:    'from-blue-500 to-blue-700',
    violet:  'from-violet-500 to-violet-700',
    emerald: 'from-emerald-500 to-emerald-700',
    amber:   'from-amber-400 to-amber-600',
    rose:    'from-rose-500 to-rose-700',
  }
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl
                         bg-gradient-to-br ${ACCENTS[accent] || ACCENTS.brand} text-white shadow-sm`}>
          <Icon name={icon} className="h-5 w-5" strokeWidth={2} />
        </div>
        {trend != null && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            trend >= 0
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          }`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div>
        <p className="text-3xl font-black text-slate-900 tracking-tight leading-none">{value}</p>
        <p className="text-xs font-semibold text-slate-500 mt-1">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, sub, children, action }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function Skeleton({ h = 'h-48' }) {
  return <div className={`${h} rounded-xl bg-slate-100 animate-pulse`} />
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    setLoading(true)
    managerApi.analytics()
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load analytics data.'))
      .finally(() => setLoading(false))
  }, [])

  // ── Derived chart data ──────────────────────────────────────────────────────
  const campaignStatusData = useMemo(() => {
    if (!data?.campaignsByStatus) return []
    return data.campaignsByStatus.map(r => ({
      name:  STATUS_LABEL[r.status] || r.status,
      value: Number(r.cnt),
      fill:  STATUS_COLOR[r.status] || '#94a3b8',
    }))
  }, [data])

  const taskStatusData = useMemo(() => {
    if (!data?.tasksByStatus) return []
    return data.tasksByStatus.map(r => ({
      name:  STATUS_LABEL[r.status] || r.status,
      value: Number(r.cnt),
      fill:  TASK_STATUS_COLOR[r.status] || '#94a3b8',
    }))
  }, [data])

  const weeklyCompletedData = useMemo(() => {
    if (!data?.weeklyCompleted) return []
    return data.weeklyCompleted.map(r => ({
      week:  r.week?.replace(/^\d{4}-/, '') ?? r.week,
      Tasks: Number(r.cnt),
    }))
  }, [data])

  const weeklyNewData = useMemo(() => {
    if (!data?.weeklyNew) return []
    return data.weeklyNew.map(r => ({
      week:      r.week?.replace(/^\d{4}-/, '') ?? r.week,
      Campaigns: Number(r.cnt),
    }))
  }, [data])

  const campaignTypeData = useMemo(() => {
    if (!data?.campaignsByType) return []
    return data.campaignsByType.map(r => ({
      name:  r.name,
      Count: Number(r.cnt),
    }))
  }, [data])

  const priorityData = useMemo(() => {
    if (!data?.campaignsByPriority) return []
    return data.campaignsByPriority.map(r => ({
      name:  r.priority,
      Count: Number(r.cnt),
      fill:  PRIORITY_COLOR[r.priority] || '#94a3b8',
    }))
  }, [data])

  const totals = data?.totals ?? {}
  const completionRate = totals.tasks > 0
    ? Math.round((totals.completed / totals.tasks) * 100) : 0

  if (error) return (
    <div className="flex items-center justify-center py-24 text-rose-500 text-sm">{error}</div>
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
            Manager Reports
          </p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Analytics Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Live overview of campaigns, tasks, team performance, and quality metrics.
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); managerApi.analytics().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false)) }}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white
                     px-4 py-2 text-xs font-semibold text-slate-600
                     hover:bg-slate-50 transition shadow-sm"
        >
          <Icon name="refresh" className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* ── KPI row ── */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h="h-32" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KpiCard label="Total Campaigns"   value={totals.campaigns ?? 0}     icon="megaphone"  accent="brand"   />
          <KpiCard label="Tasks Completed"   value={totals.completed  ?? 0}    icon="checkCircle" accent="emerald" sub={`${completionRate}% completion rate`} />
          <KpiCard label="Pending QC Review" value={totals.pendingQc  ?? 0}    icon="eye"        accent="violet"  />
          <KpiCard label="In Rework"         value={totals.inRework   ?? 0}    icon="refresh"    accent="amber"   />
          <KpiCard label="Avg Task Duration" value={fmtMins(totals.avgMinutes)} icon="clock"     accent="blue"    sub="per completed task" />
        </div>
      )}

      {/* ── Trend charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Weekly task completions */}
        <Section
          title="Weekly Task Completions"
          sub="Tasks approved through QC in the last 10 weeks"
        >
          {loading ? <Skeleton /> : weeklyCompletedData.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">No completion data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={weeklyCompletedData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gradTasks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={COLORS.emerald} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="Tasks" stroke={COLORS.emerald} strokeWidth={2.5}
                      fill="url(#gradTasks)" dot={{ r: 3, fill: COLORS.emerald, strokeWidth: 0 }}
                      activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* Weekly new campaigns */}
        <Section
          title="Weekly New Campaigns"
          sub="New requests submitted in the last 10 weeks"
        >
          {loading ? <Skeleton /> : weeklyNewData.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">No campaign data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={weeklyNewData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gradCamp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={COLORS.brand} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={COLORS.brand} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="Campaigns" stroke={COLORS.brand} strokeWidth={2.5}
                      fill="url(#gradCamp)" dot={{ r: 3, fill: COLORS.brand, strokeWidth: 0 }}
                      activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* ── Status donuts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Campaign pipeline */}
        <Section title="Campaign Pipeline" sub="Current distribution across all statuses">
          {loading ? <Skeleton /> : campaignStatusData.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">No data.</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie data={campaignStatusData} cx="50%" cy="50%"
                       innerRadius={52} outerRadius={80}
                       paddingAngle={3} dataKey="value">
                    {campaignStatusData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {campaignStatusData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                      <span className="text-xs text-slate-600 truncate">{d.name}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-800 shrink-0">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* Task status breakdown */}
        <Section title="Task Status Breakdown" sub="All work tasks by current status">
          {loading ? <Skeleton /> : taskStatusData.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">No data.</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie data={taskStatusData} cx="50%" cy="50%"
                       innerRadius={52} outerRadius={80}
                       paddingAngle={3} dataKey="value">
                    {taskStatusData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {taskStatusData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                      <span className="text-xs text-slate-600 truncate">{d.name}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-800 shrink-0">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* ── Bar charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Campaigns by type */}
        <Section title="Campaigns by Requirement Type" sub="Top 8 most requested types">
          {loading ? <Skeleton /> : campaignTypeData.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">No data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={campaignTypeData} layout="vertical"
                        margin={{ top: 0, right: 8, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120}
                       tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="Count" radius={[0, 6, 6, 0]} maxBarSize={18}>
                  {campaignTypeData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* Priority split */}
        <Section title="Campaign Priority Distribution" sub="Active campaigns by priority level">
          {loading ? <Skeleton /> : priorityData.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">No data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={priorityData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="Count" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  {priorityData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* ── Team performance table ── */}
      <Section
        title="Team Performance"
        sub="Task counts, completion rates, and time logged per team member"
      >
        {loading ? <Skeleton h="h-40" /> : !data?.team?.length ? (
          <p className="text-center text-slate-400 text-sm py-8">No team data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Team Member', 'Assigned', 'Active', 'Completed', 'Completion Rate', 'Time Logged', 'Reworks'].map(h => (
                    <th key={h} className="pb-2.5 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.team.map((m, i) => {
                  const rate = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0
                  return (
                    <tr key={i} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                                          bg-gradient-to-br from-brand-500 to-brand-700
                                          text-[10px] font-bold text-white">
                            {(m.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-800 whitespace-nowrap">{m.name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600 tabular-nums">{m.total}</td>
                      <td className="py-3 pr-4 text-slate-600 tabular-nums">{m.active}</td>
                      <td className="py-3 pr-4 font-semibold text-emerald-700 tabular-nums">{m.completed}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500 transition-all"
                                 style={{ width: `${rate}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                            {rate}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600 tabular-nums whitespace-nowrap">
                        {fmtMins(m.minutesLogged)}
                      </td>
                      <td className="py-3 pr-4">
                        {m.reworkCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50
                                           px-2 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
                            <Icon name="refresh" className="h-2.5 w-2.5" />
                            {m.reworkCount}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Top rework issues ── */}
      {(loading || (data?.topRework?.length > 0)) && (
        <Section
          title="Top Rework Issues"
          sub="Tasks sent back for rework the most — identify quality gaps"
        >
          {loading ? <Skeleton h="h-32" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Task', 'Assignee', 'Rework Count', 'Last Rework'].map(h => (
                      <th key={h} className="pb-2.5 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.topRework.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full
                                           bg-rose-100 text-[10px] font-bold text-rose-700">
                            {i + 1}
                          </span>
                          <span className="font-semibold text-slate-800">{r.task_name || r.taskId}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{r.assignee || '—'}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5
                                          text-xs font-bold ring-1 ${
                          r.reworkCount >= 3
                            ? 'bg-rose-50 text-rose-700 ring-rose-200'
                            : 'bg-amber-50 text-amber-700 ring-amber-200'
                        }`}>
                          <Icon name="refresh" className="h-2.5 w-2.5" />
                          {r.reworkCount}×
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-500">
                        {r.lastRework
                          ? new Date(r.lastRework).toLocaleDateString('en-IN', {
                              day: '2-digit', month: 'short', year: 'numeric',
                            })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

    </div>
  )
}
