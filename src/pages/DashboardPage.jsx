import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import campaignsApi from '../api/campaigns'
import tasksApi from '../api/tasks'
import managerApi from '../api/manager'
import Icon from '../components/Icon'

/**
 * Role-aware dashboard.
 *
 * Each role sees the KPIs and quick links that matter to it:
 *   - Requestor:              my requests by status
 *   - Head / Regional:        pending dept queue + my decisions history
 *   - Marketing Manager:      live operations overview (QC, rework, progress, completed)
 *   - Marketing Creator:      my task queue (open / QC / completed)
 *   - Admin:                  same ops overview as Marketing Manager + admin quick-access links
 */
export default function DashboardPage() {
  const {
    user, isAdmin, isRequestor, isMarketingManager, isHead, isRegionalManager,
  } = useAuth()

  // Operational pipeline view — Marketing Manager only.
  // Admin alone does NOT see this (consistent with sidebar isolation):
  // they must also hold the Marketing Manager role.
  const showOpsWidgets = isMarketingManager

  // Admin-only extras (quick-access links to admin pages)
  const showAdminExtras = isAdmin

  // Worker widgets: executors only — not brief-submitters, not ops, not admin
  const showWorkerWidgets =
    !isRequestor && !isHead && !isRegionalManager && !isAdmin && !isMarketingManager

  // Request widgets: anyone who submits briefs (mirrors sidebar showRequests)
  const showRequestWidgets = isRequestor || isHead || isRegionalManager

  // Whether to show the "New Request" CTA (same set of roles that can submit)
  const canSubmitRequest = isRequestor || isHead || isRegionalManager

  const [campaigns,   setCampaigns]   = useState([])
  const [tasks,       setTasks]       = useState([])
  const [opsQcTasks,  setOpsQcTasks]  = useState([])
  const [opsAllTasks, setOpsAllTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)

    const need = (cond, fn) => cond ? fn().catch(() => []) : Promise.resolve([])

    Promise.all([
      need(showRequestWidgets, () => campaignsApi.list().then(r => r.data || [])),
      need(showWorkerWidgets,  () => tasksApi.listMy().then(r => r.data || [])),
      need(showOpsWidgets,     () => managerApi.pendingTasks().then(r => r.data || [])),
      need(showOpsWidgets,     () => managerApi.allTasks().then(r => r.data || [])),
    ]).then(([cs, ts, qc, at]) => {
      if (!alive) return
      setCampaigns(cs); setTasks(ts)
      setOpsQcTasks(qc); setOpsAllTasks(at)
    }).finally(() => alive && setLoading(false))

    return () => { alive = false }
  }, [showWorkerWidgets, showOpsWidgets, showRequestWidgets])

  // Derived KPIs
  const taskCounts = useMemo(() => ({
    open:     tasks.filter(t => ['ASSIGNED','IN_PROGRESS','REWORK'].includes(t.status)).length,
    inFlight: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    qc:       tasks.filter(t => t.status === 'QC_REVIEW').length,
    done:     tasks.filter(t => t.status === 'COMPLETED').length,
  }), [tasks])

  const myRequestCounts = useMemo(() => {
    // campaignsApi.list() already returns only the caller's own campaigns
    // (the isAdminOrManager bypass was removed from the backend), so we
    // can always use the full list directly.
    const my = campaigns
    return {
      total:      my.length,
      inProgress: my.filter(c => ['IN_PROGRESS','QC_REVIEW'].includes(c.status)).length,
      completed:  my.filter(c => c.status === 'COMPLETED').length,
      cancelled:  my.filter(c => c.status === 'CANCELLED' || c.status === 'REJECTED').length,
    }
  }, [campaigns])

  const opsCounts = useMemo(() => ({
    qcReview:   opsQcTasks.length,
    rework:     opsAllTasks.filter(t => t.status === 'REWORK').length,
    inProgress: opsAllTasks.filter(t => t.status === 'IN_PROGRESS').length,
    completed:  opsAllTasks.filter(t => t.status === 'COMPLETED').length,
    assigned:   opsAllTasks.filter(t => t.status === 'ASSIGNED').length,
  }), [opsQcTasks, opsAllTasks])

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Hero + CTA — single combined row */}
      <header className="flex flex-wrap items-center justify-between gap-4
                         rounded-2xl bg-white px-5 py-4
                         shadow-sm ring-1 ring-slate-900/5">
        {/* Left: greeting */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl
                          bg-gradient-to-br from-brand-600 to-brand-800 text-xs font-bold text-white shadow-sm">
            {(user?.fullName || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              Welcome back, {user?.fullName?.split(' ')[0] || 'there'}.
            </p>
            <p className="text-xs text-slate-400">
              {user?.designation || 'User'}{user?.department ? ` · ${user.department}` : ''}
            </p>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-3">
          {/* QC queue shortcut — Marketing Manager only */}
          {isMarketingManager && (
            <Link
              to="/manager/qc-review"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200
                         px-3 py-1.5 text-xs font-semibold text-slate-600
                         transition hover:bg-slate-50"
            >
              <Icon name="send" className="h-3 w-3" /> QC Review Queue
            </Link>
          )}
          {/* Master Data shortcut — Admin only */}
          {isAdmin && (
            <Link
              to="/admin/master/departments"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200
                         px-3 py-1.5 text-xs font-semibold text-slate-600
                         transition hover:bg-slate-50"
            >
              <Icon name="cog" className="h-3 w-3" /> Master Data
            </Link>
          )}
          {/* New Request CTA — Requestor, Head, Regional Manager */}
          {canSubmitRequest && (
            <Link
              to="/campaigns/new"
              className="group relative inline-flex shrink-0 items-center gap-2 overflow-hidden
                         rounded-xl attention-pulse
                         bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500
                         px-5 py-2.5 text-sm font-bold text-white"
            >
              <span className="pointer-events-none absolute inset-0 bg-white/0 transition-all duration-200 group-hover:bg-white/10" />
              <Icon name="plus" className="relative h-4 w-4" strokeWidth={2.5} />
              <span className="relative">New Request</span>
            </Link>
          )}
        </div>
      </header>

      {loading && (
        <p className="text-center text-slate-400 py-8 text-sm">Loading dashboard…</p>
      )}

      {/* ── Operations Overview: Marketing Manager + Admin ───────────── */}
      {showOpsWidgets && (
        <>
          <Section
            title="Operations Overview"
            subtitle="Live pulse of the entire marketing execution pipeline."
          >
            <KpiCard
              to="/manager/qc-review"
              tone="violet"
              icon="send"
              label="Pending QC Review"
              value={opsCounts.qcReview}
              cta="Review queue →"
            />
            <KpiCard
              to="/manager/qc-review"
              tone="amber"
              icon="alertCircle"
              label="Sent for Rework"
              value={opsCounts.rework}
              cta="View →"
            />
            <KpiCard
              to="/manager/all-requests"
              tone="brand"
              icon="play"
              label="Tasks In Progress"
              value={opsCounts.inProgress}
              cta="View all →"
            />
            <KpiCard
              to="/manager/all-requests"
              tone="emerald"
              icon="check"
              label="Tasks Completed"
              value={opsCounts.completed}
              cta="View →"
            />
          </Section>

          <Section
            title="Team Pipeline"
            subtitle="Breakdown of where work currently stands across all team members."
          >
            <KpiCard
              to="/manager/all-requests"
              tone="brand"
              icon="inbox"
              label="Newly Assigned"
              value={opsCounts.assigned}
              cta="View →"
            />
            <KpiCard
              to="/manager/all-requests"
              tone="violet"
              icon="clock"
              label="Total Active Tasks"
              value={opsCounts.inProgress + opsCounts.assigned + opsCounts.qcReview + opsCounts.rework}
              cta="View all →"
            />
            <KpiCard
              to="/manager/reports"
              tone="orange"
              icon="trendingUp"
              label="Time & Efficiency Report"
              value="→"
              cta="Open →"
            />
            <KpiCard
              to="/manager/all-requests"
              tone="emerald"
              icon="fileText"
              label="All Requests"
              value="→"
              cta="Open →"
            />
          </Section>
        </>
      )}

      {/* ── Admin-only quick-access shortcuts ────────────────────────── */}
      {showAdminExtras && (
        <div>
          <div className="mb-3">
            <h2 className="text-[13px] font-bold uppercase tracking-widest text-slate-400">Admin Quick Access</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { to: '/admin/users',               icon: 'users',      label: 'User Management',   desc: 'Add or edit user accounts'      },
              { to: '/admin/master/departments',   icon: 'building',   label: 'Master Data',       desc: 'Departments, roles, types…'     },
              { to: '/admin/granular-tasks',       icon: 'list',       label: 'Granular Tasks',    desc: 'Configure task definitions'     },
              { to: '/admin/role-task-mappings',   icon: 'shield',     label: 'Role → Task Map',   desc: 'Routing rules per role'         },
            ].map(({ to, icon, label, desc }) => (
              <Link
                key={to}
                to={to}
                className="group flex flex-col gap-2 rounded-2xl bg-white p-5 shadow-sm
                           ring-1 ring-slate-900/5
                           transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl
                                bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-sm">
                  <Icon name={icon} className="h-[17px] w-[17px]" strokeWidth={2} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">{label}</div>
                  <div className="text-xs text-slate-400">{desc}</div>
                </div>
                <div className="mt-auto text-xs font-semibold text-brand-600 opacity-0 transition group-hover:opacity-100">
                  Open →
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Worker section */}
      {showWorkerWidgets && (
        <Section title="My Tasks" subtitle="Work assigned to you, ordered by priority.">
          <KpiCard
            to="/my-tasks?tab=OPEN"
            tone="brand"
            icon="play"
            label="Open / In Progress"
            value={taskCounts.open}
            cta="Open queue →"
          />
          <KpiCard
            to="/my-tasks?tab=QC"
            tone="violet"
            icon="send"
            label="In QC Review"
            value={taskCounts.qc}
            cta="View →"
          />
          <KpiCard
            to="/my-tasks?tab=DONE"
            tone="emerald"
            icon="check"
            label="Completed"
            value={taskCounts.done}
            cta="View →"
          />
        </Section>
      )}

      {/* Request submitters — Requestor, Head, Regional Manager */}
      {showRequestWidgets && (
        <Section title="My Requests" subtitle="The briefs you've submitted and where they stand.">
          <KpiCard
            to="/campaigns"
            tone="brand"
            icon="fileText"
            label="Total submitted"
            value={myRequestCounts.total}
            cta="View all →"
          />
          <KpiCard
            to="/campaigns"
            tone="violet"
            icon="clock"
            label="In Progress / QC"
            value={myRequestCounts.inProgress}
            cta="View →"
          />
          <KpiCard
            to="/campaigns"
            tone="emerald"
            icon="check"
            label="Delivered"
            value={myRequestCounts.completed}
            cta="View →"
          />
          <KpiCard
            to="/campaigns"
            tone="rose"
            icon="x"
            label="Cancelled"
            value={myRequestCounts.cancelled}
            cta="View →"
          />
        </Section>
      )}

      {/* Recent activity feeds */}
      {showWorkerWidgets && tasks.length > 0 && (
        <RecentTasksFeed tasks={tasks} />
      )}
      {showOpsWidgets && opsQcTasks.length > 0 && (
        <RecentTasksFeed
          tasks={opsQcTasks.slice(0, 5)}
          title="Pending QC — Recent Submissions"
          linkTo="/manager/qc-review"
        />
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, subtitle, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-slate-400">{title}</h2>
        {subtitle && <p className="hidden text-xs text-slate-400 sm:block">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {children}
      </div>
    </section>
  )
}

const TONES = {
  brand:   'from-brand-500 to-brand-700',
  emerald: 'from-emerald-400 to-emerald-600',
  amber:   'from-amber-400 to-amber-600',
  violet:  'from-violet-400 to-violet-600',
  orange:  'from-orange-400 to-orange-600',
  rose:    'from-rose-400 to-rose-600',
}

function KpiCard({ to, tone = 'brand', icon, label, value, cta }) {
  return (
    <Link
      to={to}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white p-5
                 shadow-sm ring-1 ring-slate-900/5
                 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-slate-900/8"
    >
      <div className="flex items-start justify-between">
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl
                         bg-gradient-to-br ${TONES[tone]} text-white shadow-sm`}>
          <Icon name={icon} className="h-[17px] w-[17px]" strokeWidth={2} />
        </div>
        <Icon name="chevron"
          className="h-4 w-4 text-slate-200 transition-all duration-200 group-hover:text-brand-400 group-hover:translate-x-0.5" />
      </div>
      <div className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{value ?? 0}</div>
      <div className="mt-0.5 text-xs font-medium text-slate-400">{label}</div>
    </Link>
  )
}

function RecentTasksFeed({ tasks, title = 'Up Next', linkTo = '/my-tasks' }) {
  const recent = tasks.slice(0, 5)
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-slate-400">{title}</h2>
        <Link to={linkTo} className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition">
          View all →
        </Link>
      </div>
      <ul className="divide-y divide-slate-50">
        {recent.map(t => (
          <li key={t.taskId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-mono text-slate-300">#{t.taskId}</span>
              <span className="font-medium text-slate-700 truncate">
                {t.granularTaskName || t.taskTypeName || 'Task'}
              </span>
              <TaskBadge status={t.status} />
              <PriorityBadge v={t.campaignPriority} />
            </div>
            <span className="text-xs text-slate-400">
              {t.requestorName ? `by ${t.requestorName}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function TaskBadge({ status }) {
  const m = {
    ASSIGNED:    'bg-blue-50 text-blue-700 ring-blue-200',
    IN_PROGRESS: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    REWORK:      'bg-amber-50 text-amber-700 ring-amber-200',
    QC_REVIEW:   'bg-purple-50 text-purple-700 ring-purple-200',
    COMPLETED:   'bg-green-50 text-green-700 ring-green-200',
  }
  const labels = {
    ASSIGNED: 'New', IN_PROGRESS: 'In Progress', REWORK: 'Rework',
    QC_REVIEW: 'In QC', COMPLETED: 'Done',
  }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${m[status] || 'bg-slate-100 text-slate-600'}`}>{labels[status] || status}</span>
}

function PriorityBadge({ v }) {
  const m = { HIGH: 'bg-red-50 text-red-700 ring-red-200', MEDIUM: 'bg-yellow-50 text-yellow-700 ring-yellow-200', LOW: 'bg-green-50 text-green-700 ring-green-200' }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${m[v] || 'bg-slate-100 text-slate-600'}`}>{v || '—'}</span>
}

