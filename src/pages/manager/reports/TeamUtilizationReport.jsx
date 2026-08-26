import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import Icon from '../../../components/Icon'

const COLORS = { emerald: '#059669', blue: '#2563eb', amber: '#d97706', rose: '#e11d48', cyan: '#0891b2' }

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-xl px-3 py-2.5 min-w-[120px]">
      {label && <p className="text-[11px] font-bold text-slate-500 mb-1.5">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-xs mt-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
            <span className="text-slate-600">{p.name}:</span>
          </div>
          <span className="font-bold text-slate-900">{p.value} hrs</span>
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

export default function TeamUtilizationReport({ data, loading }) {
  
  // Prepare data for the new Person-Wise Time Tracking chart (hours)
  const timeTrackingData = useMemo(() => {
    if (!data?.team) return []
    return data.team.map(m => ({
      name: m.name,
      Hours: Number((m.minutesLogged / 60).toFixed(1))
    })).sort((a, b) => b.Hours - a.Hours)
  }, [data])

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-1 gap-5">
        <Skeleton h="h-[300px]" />
        <Skeleton h="h-64" />
      </div>
    )
  }

  if (!data?.team?.length) {
    return (
      <div className="p-12 text-center">
        <Icon name="users" className="h-12 w-12 text-slate-200 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-700">No Team Data Found</h3>
        <p className="text-sm text-slate-400 mt-1">Try expanding your date range to see team activity.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      
      {/* Total Hours Invested Chart (NEW) */}
      <Section title="Total Hours Invested per Team Member" sub="Aggregated time logged across all tasks">
        <div className="h-[300px]">
          {timeTrackingData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400 italic">No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeTrackingData} margin={{ top: 20, right: 20, left: -20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  tickLine={false} 
                  axisLine={false} 
                  angle={-45} 
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="Hours" fill={COLORS.cyan} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Section>

      {/* Team Performance Table */}
      <Section title="Team Performance & Workload" sub="Task counts, completion rates, and time metrics per user">
        <div className="overflow-x-auto -mx-5 -mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                {['Team Member', 'Assigned', 'Active', 'Completed', 'Completion Rate', 'Total Time', 'Avg Time/Task', 'Reworks'].map(h => (
                  <th key={h} className="py-3 px-5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.team.map((m, i) => {
                const rate = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0
                const avgTime = m.completed > 0 ? Math.round(m.minutesLogged / m.completed) : 0

                return (
                  <tr key={i} className="hover:bg-slate-50/60 transition group">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-xs font-bold text-white shadow-sm">
                          {(m.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-800 whitespace-nowrap">{m.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-slate-600 font-medium tabular-nums">{m.total}</td>
                    <td className="py-3 px-5 text-blue-600 font-bold tabular-nums">{m.active}</td>
                    <td className="py-3 px-5 text-emerald-600 font-bold tabular-nums">{m.completed}</td>
                    <td className="py-3 px-5 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${rate}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-700 tabular-nums whitespace-nowrap">
                          {rate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-slate-700 font-semibold tabular-nums whitespace-nowrap">
                      {fmtMins(m.minutesLogged)}
                    </td>
                    <td className="py-3 px-5 text-slate-500 tabular-nums whitespace-nowrap">
                      {fmtMins(avgTime)}
                    </td>
                    <td className="py-3 px-5">
                      {m.reworkCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-100 shadow-sm">
                          <Icon name="refresh" className="h-3 w-3" /> {m.reworkCount}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs font-bold">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

    </div>
  )
}
