import { useMemo } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'
import Icon from '../../../components/Icon'

const COLORS = {
  brand:   '#c2181d', blue:    '#2563eb', violet:  '#7c3aed',
  emerald: '#059669', amber:   '#d97706', rose:    '#e11d48',
  cyan:    '#0891b2', indigo:  '#4338ca', slate:   '#475569',
}
const STATUS_COLOR = {
  IN_PROGRESS: COLORS.blue, MARKETING_REVIEW: COLORS.violet, REQUESTOR_REVIEW: '#7c3aed',
  COMPLETED: COLORS.emerald, REJECTED: COLORS.rose, CANCELLED: COLORS.slate,
  PENDING: COLORS.amber, ASSIGNED: '#94a3b8', REWORK: COLORS.amber, HELD: '#f59e0b',
}
const STATUS_LABEL = {
  IN_PROGRESS: 'In Progress', MARKETING_REVIEW: 'Marketing Review',
  REQUESTOR_REVIEW: 'Requestor Review', COMPLETED: 'Completed',
  REJECTED: 'Rejected', CANCELLED: 'Cancelled', PENDING: 'Pending',
  ASSIGNED: 'Assigned', REWORK: 'Rework', HELD: 'On Hold',
}
const PRIORITY_COLOR = { HIGH: COLORS.rose, MEDIUM: COLORS.amber, LOW: COLORS.emerald }
const CHART_COLORS = [COLORS.brand, COLORS.blue, COLORS.violet, COLORS.emerald, COLORS.amber, COLORS.cyan, COLORS.indigo, COLORS.rose]

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

export default function CampaignOverviewReport({ data, loading }) {
  const campaignStatusData = useMemo(() => {
    if (!data?.campaignsByStatus) return []
    return data.campaignsByStatus.map(r => ({
      name: STATUS_LABEL[r.status] || r.status,
      value: Number(r.cnt),
      fill: STATUS_COLOR[r.status] || '#94a3b8',
    }))
  }, [data])

  const departmentData = useMemo(() => {
    if (!data?.departmentMatrix) return []
    return data.departmentMatrix.map(r => ({
      name: r.department,
      Total: Number(r.totalRequests),
      Completed: Number(r.completed),
      Cancelled: Number(r.cancelled),
      Active: Number(r.activePipeline)
    }))
  }, [data])

  const campaignTypeData = useMemo(() => {
    if (!data?.campaignsByType) return []
    return data.campaignsByType.map(r => ({
      name: r.name,
      Count: Number(r.cnt),
    }))
  }, [data])

  const priorityData = useMemo(() => {
    if (!data?.campaignsByPriority) return []
    return data.campaignsByPriority.map(r => ({
      name: r.priority,
      Count: Number(r.cnt),
      fill: PRIORITY_COLOR[r.priority] || '#94a3b8',
    }))
  }, [data])

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Skeleton h="h-[300px]" /><Skeleton h="h-[300px]" />
        <Skeleton h="h-[300px]" /><Skeleton h="h-[300px]" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Campaign Pipeline Donut */}
        <Section title="Campaign Pipeline" sub="Distribution of campaigns by status">
          <div className="h-[250px]">
            {campaignStatusData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 italic">No data for this period</div>
            ) : (
              <div className="flex flex-col md:flex-row items-center gap-6 h-full justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={campaignStatusData} cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" paddingAngle={2} dataKey="value">
                      {campaignStatusData.map((entry, i) => <Cell key={i} fill={entry.fill} stroke="none" />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3 w-full max-w-[200px]">
                  {campaignStatusData.map((d, i) => (
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

        {/* Department-Wise Matrix */}
        <Section title="Department-Wise Matrix" sub="Campaign activity by department">
          <div className="h-[250px]">
            {departmentData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 italic">No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    tickLine={false} 
                    axisLine={false} 
                    interval={0}
                    tickFormatter={(val) => val.substring(0, 3).toUpperCase()}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="Completed" stackId="a" fill={COLORS.emerald} maxBarSize={40} />
                  <Bar dataKey="Active" stackId="a" fill={COLORS.blue} maxBarSize={40} />
                  <Bar dataKey="Cancelled" stackId="a" fill={COLORS.slate} maxBarSize={40} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>

        {/* Campaigns by Requirement Type */}
        <Section title="Requirement Types" sub="Top 8 most requested types">
          <div className="h-[250px]">
            {campaignTypeData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 italic">No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campaignTypeData} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="Count" radius={[0, 4, 4, 0]} maxBarSize={16}>
                    {campaignTypeData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>

        {/* Priority Split */}
        <Section title="Priority Distribution" sub="Campaigns by priority level">
          <div className="h-[250px]">
            {priorityData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 italic">No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="Count" radius={[4, 4, 0, 0]} maxBarSize={50}>
                    {priorityData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>

      </div>
    </div>
  )
}
