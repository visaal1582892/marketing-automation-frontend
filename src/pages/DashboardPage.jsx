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
    user, isAdmin, isRequestor, isHead, isRegionalManager,
    isMarketingManager, isMarketingCreator,
  } = useAuth()

  // Dept-level approver queue — Head / Regional Manager only
  const showApproverWidgets = isHead || isRegionalManager
  // Operational pipeline view — Marketing Manager and Admin share this
  const showOpsWidgets  = isMarketingManager || isAdmin
  // Admin-only extras (quick-access links to admin pages)
  const showAdminExtras = isAdmin
  // Worker widgets — marketing-team executors only
  const showWorkerWidgets =
    !isRequestor && !isAdmin && !isMarketingManager && !isHead && !isRegionalManager
  // Requestor widgets — brief authors only
  const showRequestWidgets = isRequestor

  const [campaigns,     setCampaigns]     = useState([])
  const [tasks,         setTasks]         = useState([])
  const [pendingDept,   setPendingDept]   = useState([])
  const [deptHistory,   setDeptHistory]   = useState([])
  const [opsQcTasks,    setOpsQcTasks]    = useState([])
  const [opsAllTasks,   setOpsAllTasks]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)

    const need = (cond, fn) => cond ? fn().catch(() => []) : Promise.resolve([])

    Promise.all([
      need(showRequestWidgets,  () => campaignsApi.list().then(r => r.data || [])),
      need(showWorkerWidgets,   () => tasksApi.listMy().then(r => r.data || [])),
      need(showApproverWidgets, () => campaignsApi.pendingDept().then(r => r.data || [])),
      need(showApproverWidgets, () => campaignsApi.historyDept().then(r => r.data || [])),
      need(showOpsWidgets,      () => managerApi.pendingTasks().then(r => r.data || [])),
      need(showOpsWidgets,      () => managerApi.allTasks().then(r => r.data || [])),
    ]).then(([cs, ts, pd, dh, qc, at]) => {
      if (!alive) return
      setCampaigns(cs); setTasks(ts)
      setPendingDept(pd); setDeptHistory(dh)
      setOpsQcTasks(qc); setOpsAllTasks(at)
    }).finally(() => alive && setLoading(false))

    return () => { alive = false }
  }, [showWorkerWidgets, showApproverWidgets, showOpsWidgets, showRequestWidgets])

  // Derived KPIs
  const taskCounts = useMemo(() => ({
    open:     tasks.filter(t => ['ASSIGNED','IN_PROGRESS','REWORK'].includes(t.status)).length,
    inFlight: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    qc:       tasks.filter(t => t.status === 'QC_REVIEW').length,
    done:     tasks.filter(t => t.status === 'COMPLETED').length,
  }), [tasks])

  const myRequestCounts = useMemo(() => {
    const myId = user?.id ?? user?.userId
    const my = isRequestor
      ? campaigns
      : campaigns.filter(c => myId != null && Number(c.requestorId) === Number(myId))
    return {
      total:      my.length,
      pending:    my.filter(c => ['PENDING_DEPT_APPROVAL','PENDING_MARKETING_APPROVAL'].includes(c.status)).length,
      inProgress: my.filter(c => ['IN_PROGRESS','PENDING_INTERVENTION','QC_REVIEW'].includes(c.status)).length,
      completed:  my.filter(c => c.status === 'COMPLETED').length,
      cancelled:  my.filter(c => c.status === 'CANCELLED' || c.status === 'REJECTED').length,
    }
  }, [campaigns, isRequestor, user])

  const deptHistoryCounts = useMemo(() => ({
    approved: deptHistory.filter(c => c.deptDecision === 'APPROVED').length,
    rejected: deptHistory.filter(c => c.deptDecision === 'REJECTED').length,
  }), [deptHistory])

  const opsCounts = useMemo(() => ({
    qcReview:   opsQcTasks.length,
    rework:     opsAllTasks.filter(t => t.status === 'REWORK').length,
    inProgress: opsAllTasks.filter(t => t.status === 'IN_PROGRESS').length,
    completed:  opsAllTasks.filter(t => t.status === 'COMPLETED').length,
    assigned:   opsAllTasks.filter(t => t.status === 'ASSIGNED').length,
  }), [opsQcTasks, opsAllTasks])

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Hero */}
      <header className="overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900
                         p-6 text-white shadow-sm sm:p-7">
        <div className="relative">
          <div className="pointer-events-none absolute -top-10 right-0 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-14 -left-10 h-40 w-40 rounded-full bg-accent-500/30 blur-2xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1
                              text-xs font-medium uppercase tracking-wider text-white/90 ring-1 ring-white/20">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
                {user?.role || 'User'}
              </div>
              <h1 className="text-2xl font-semibold sm:text-3xl">
                Welcome back, {user?.fullName?.split(' ')[0] || 'there'}.
              </h1>
              <p className="mt-1.5 max-w-xl text-sm text-white/80">
                Here's what's on your plate today.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isRequestor && (
                <Link
                  to="/campaigns/new"
                  className="inline-flex items-center gap-1.5 rounded-md bg-white px-3.5 py-2
                             text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50 transition"
                >
                  <Icon name="plus" className="h-4 w-4" /> New Request
                </Link>
              )}
              {showOpsWidgets && (
                <Link
                  to="/manager/qc-review"
                  className="inline-flex items-center gap-1.5 rounded-md bg-white px-3.5 py-2
                             text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50 transition"
                >
                  <Icon name="send" className="h-4 w-4" /> QC Review Queue
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin/master/departments"
                  className="inline-flex items-center gap-1.5 rounded-md bg-white/20 px-3.5 py-2
                             text-sm font-semibold text-white shadow-sm hover:bg-white/30 transition"
                >
                  <Icon name="cog" className="h-4 w-4" /> Master Data
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {loading && (
        <p className="text-center text-slate-400 py-8 text-sm">Loading dashboard…</p>
      )}

      {/* Dept-Head / Regional-Manager approval queue */}
      {showApproverWidgets && (
        <Section title="Approval Queues" subtitle="Requests waiting on your decision and your past calls.">
          <KpiCard
            to="/approvals/dept"
            tone="amber"
            icon="inbox"
            label="Pending in my queue"
            value={pendingDept.length}
            cta="Review now →"
          />
          <KpiCard
            to="/approvals/dept"
            tone="emerald"
            icon="check"
            label="I've Approved"
            value={deptHistoryCounts.approved}
            cta="View history →"
          />
          <KpiCard
            to="/approvals/dept"
            tone="rose"
            icon="x"
            label="I've Rejected"
            value={deptHistoryCounts.rejected}
            cta="View history →"
          />
        </Section>
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
            <h2 className="text-base font-semibold text-slate-900">Admin Quick Access</h2>
            <p className="text-xs text-slate-500">Jump straight to any admin area.</p>
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
                className="group flex flex-col gap-2 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200/70
                           transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-md
                                bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-sm">
                  <Icon name={icon} className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">{label}</div>
                  <div className="text-xs text-slate-500">{desc}</div>
                </div>
                <div className="mt-auto text-xs font-medium text-brand-600 opacity-0 transition group-hover:opacity-100">
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
            to="/my-tasks"
            tone="brand"
            icon="play"
            label="Open / In Progress"
            value={taskCounts.open}
            cta="Open queue →"
          />
          <KpiCard
            to="/my-tasks"
            tone="violet"
            icon="send"
            label="In QC Review"
            value={taskCounts.qc}
            cta="View →"
          />
          <KpiCard
            to="/my-tasks"
            tone="emerald"
            icon="check"
            label="Completed"
            value={taskCounts.done}
            cta="View →"
          />
        </Section>
      )}

      {/* Requestor section — only Requestor accounts ever author briefs. */}
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
      {showApproverWidgets && deptHistory.length > 0 && (
        <RecentDecisionsFeed
          title="My Recent Department Decisions"
          decisions={deptHistory.slice(0, 5)}
          stage="dept"
          to="/approvals/dept"
        />
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
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      className="group overflow-hidden rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200/70
                 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-md
                       bg-gradient-to-br ${TONES[tone]} text-white shadow-sm`}>
        <Icon name={icon} className="h-[18px] w-[18px]" />
      </div>
      <div className="mt-3.5 text-2xl font-semibold text-slate-900">{value ?? 0}</div>
      <div className="mt-0.5 text-xs text-slate-500">{label}</div>
      {cta && (
        <div className="mt-2 text-xs font-medium text-brand-600 opacity-0 transition group-hover:opacity-100">
          {cta}
        </div>
      )}
    </Link>
  )
}

function RecentTasksFeed({ tasks, title = 'Up Next', linkTo = '/my-tasks' }) {
  const recent = tasks.slice(0, 5)
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        <Link to={linkTo} className="text-xs font-medium text-brand-600 hover:underline">View all →</Link>
      </div>
      <ul className="mt-3 divide-y divide-slate-100">
        {recent.map(t => (
          <li key={t.taskId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-mono text-slate-400">#{t.taskId}</span>
              <span className="font-medium text-slate-800 truncate">
                {t.granularTaskName || t.requirementTypeName || 'Task'}
              </span>
              <TaskBadge status={t.status} />
              <PriorityBadge v={t.campaignPriority} />
            </div>
            <span className="text-xs text-slate-500">
              {t.requestorName ? `by ${t.requestorName}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function RecentDecisionsFeed({ title, decisions, stage, to }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        <Link to={to} className="text-xs font-medium text-brand-600 hover:underline">View all →</Link>
      </div>
      <ul className="mt-3 divide-y divide-slate-100">
        {decisions.map(c => (
          <li key={c.campaignId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-mono text-slate-400">#{c.campaignId}</span>
              <span className="font-medium text-slate-800 truncate">{c.requirementTypeName || '—'}</span>
              <DecisionBadge v={stage === 'marketing' ? c.marketingDecision : c.deptDecision} />
            </div>
            <span className="text-xs text-slate-500">
              {fmtRelative(stage === 'marketing' ? c.marketingDecisionAt : c.deptDecisionAt)}
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

function DecisionBadge({ v }) {
  if (v === 'APPROVED') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
      <Icon name="check" className="h-3 w-3" /> Approved
    </span>
  )
  if (v === 'REJECTED') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
      <Icon name="x" className="h-3 w-3" /> Rejected
    </span>
  )
  return <span className="text-slate-400 text-xs">—</span>
}

function fmtRelative(d) {
  if (!d) return ''
  const ms = Date.now() - new Date(d).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1)  return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24)  return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  return new Date(d).toLocaleDateString('en-IN')
}
