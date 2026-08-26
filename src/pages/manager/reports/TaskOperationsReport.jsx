import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'
import Icon from '../../../components/Icon'

const COLORS = { emerald: '#059669', blue: '#2563eb', violet: '#7c3aed', amber: '#d97706' }
const STATUS_LABEL = {
  IN_PROGRESS: 'In Progress', MARKETING_REVIEW: 'Marketing Review',
  REQUESTOR_REVIEW: 'Requestor Review', COMPLETED: 'Completed',
  REJECTED: 'Rejected', CANCELLED: 'Cancelled', PENDING: 'Pending',
  ASSIGNED: 'Assigned', REWORK: 'Rework', HELD: 'On Hold',
}
const TASK_STATUS_COLOR = {
  ASSIGNED: '#94a3b8', IN_PROGRESS: COLORS.blue, MARKETING_REVIEW: COLORS.violet,
  REQUESTOR_REVIEW: '#7c3aed', REWORK: COLORS.amber, COMPLETED: COLORS.emerald,
  HELD: '#f59e0b', CANCELLED: '#cbd5e1',
}

function ChartTooltip({ active, payload, label, valueLabel = 'Count' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-xl px-3 py-2.5 min-w-[120px]">
      {label && <p className="text-[11px] font-bold text-slate-500 mb-1.5">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-xs mt-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
            <span className="text-slate-600">{p.name || valueLabel}:</span>
          </div>
          <span className="font-bold text-slate-900">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function Section({ title, sub, children }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <div className="p-5 flex-1">{children}</div>
    </div>
  )
}

function Skeleton({ h = 'h-48' }) {
  return <div className={`${h} rounded-xl bg-slate-100 animate-pulse w-full`} />
}

function fmtMins(m) {
  if (!m || m === 0) return '—'
  const h = Math.floor(m / 60)
  const min = Math.round(m % 60)
  return h > 0 ? `${h}h ${min}m` : `${min}m`
}

export default function TaskOperationsReport({ data, loading }) {
  const taskStatusData = useMemo(() => {
    if (!data?.tasksByStatus) return []
    return data.tasksByStatus.map(r => ({
      name: STATUS_LABEL[r.status] || r.status,
      value: Number(r.cnt),
      fill: TASK_STATUS_COLOR[r.status] || '#94a3b8',
    }))
  }, [data])

  const weeklyCompletedData = useMemo(() => {
    if (!data?.weeklyCompleted) return []
    return data.weeklyCompleted.map(r => ({
      week: r.week?.replace(/^\d{4}-/, '') ?? r.week,
      Tasks: Number(r.cnt),
    }))
  }, [data])

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Skeleton h="h-[300px]" /><Skeleton h="h-[300px]" />
        <div className="lg:col-span-2"><Skeleton h="h-[300px]" /></div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Task Status Breakdown */}
        <Section title="Task Status Breakdown" sub="Current state of all active work tasks">
          <div className="h-[250px]">
            {taskStatusData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 italic">No data for this period</div>
            ) : (
              <div className="flex flex-col md:flex-row items-center gap-6 h-full justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={taskStatusData} cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" paddingAngle={2} dataKey="value">
                      {taskStatusData.map((entry, i) => <Cell key={i} fill={entry.fill} stroke="none" />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3 w-full max-w-[200px]">
                  {taskStatusData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full shrink-0 shadow-sm" style={{ background: d.fill }} />
                        <span className="text-xs font-semibold text-slate-600 truncate">{d.name}</span>
                      </div>
                      <span className="text-sm font-black text-slate-800">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Weekly Task Completions */}
        <Section title="Weekly Task Completions" sub="Tasks approved through QC in this period">
          <div className="h-[250px]">
            {weeklyCompletedData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 italic">No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyCompletedData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradTasks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{stroke: '#e2e8f0', strokeWidth: 1, strokeDasharray: '4 4'}} />
                  <Area type="monotone" dataKey="Tasks" stroke={COLORS.emerald} strokeWidth={3} fill="url(#gradTasks)" dot={{ r: 4, fill: COLORS.emerald, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>
      </div>

      {/* Bottlenecks Table */}
      {(data?.bottlenecks?.length > 0) && (
        <Section title="Rework Leaders & Bottlenecks" sub="Tasks with 3+ assignment cycles — reassignment or rework churn">
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  {['Task', 'Current Assignee', 'Status', 'Cycles', 'Total Time'].map(h => (
                    <th key={h} className="py-3 px-5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.bottlenecks.map((r, i) => (
                  <tr key={r.task_id ?? i} className="hover:bg-slate-50/60 transition group">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 group-hover:bg-sky-100 group-hover:text-sky-700 transition">
                          {i + 1}
                        </span>
                        <span className="font-semibold text-slate-800">{r.task_name || r.task_id}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-slate-600 font-medium">{r.assignee || '—'}</td>
                    <td className="py-3 px-5">
                      <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 border border-sky-100 shadow-sm">
                        <Icon name="refresh" className="h-3 w-3" /> {r.cycleCount}×
                      </span>
                    </td>
                    <td className="py-3 px-5 text-slate-700 font-semibold tabular-nums whitespace-nowrap">
                      {fmtMins(Number(r.totalMinutes))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Top Rework Issues Table */}
      {(data?.topRework?.length > 0) && (
        <Section title="Top Rework Issues" sub="Tasks sent back for rework the most — identify quality gaps">
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  {['Task', 'Assignee', 'Rework Count', 'Last Rework'].map(h => (
                    <th key={h} className="py-3 px-5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.topRework.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/60 transition group">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 group-hover:bg-rose-100 group-hover:text-rose-700 transition">
                          {i + 1}
                        </span>
                        <span className="font-semibold text-slate-800">{r.task_name || r.task_id}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-slate-600 font-medium">{r.assignee || '—'}</td>
                    <td className="py-3 px-5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm border ${
                        r.reworkCount >= 3 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        <Icon name="refresh" className="h-3 w-3" /> {r.reworkCount}×
                      </span>
                    </td>
                    <td className="py-3 px-5 text-xs font-medium text-slate-500">
                      {r.lastRework ? new Date(r.lastRework).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

    </div>
  )
}
