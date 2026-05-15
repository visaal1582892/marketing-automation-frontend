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
    user, isAdmin, isRequestor, isMarketingManager, isHead, isRegionalManager, isWorker,
  } = useAuth()

  // Operational pipeline view — Marketing Manager only.
  // Admin alone does NOT see this (consistent with sidebar isolation):
  // they must also hold the Marketing Manager role.
  const showOpsWidgets = isMarketingManager

  // Admin-only extras (quick-access links to admin pages)
  const showAdminExtras = isAdmin

  // Worker widgets: anyone who holds at least one execution role, even if they
  // also hold a manager/admin role (multi-role aware via isWorker).
  const showWorkerWidgets = isWorker

  // Request widgets: anyone who submits briefs (mirrors sidebar showRequests)
  const showRequestWidgets = isRequestor || isHead || isRegionalManager

  // Whether to show the "New Request" CTA (same set of roles that can submit)
  const canSubmitRequest = isRequestor || isHead || isRegionalManager

  const [campaigns,            setCampaigns]            = useState([])
  const [tasks,                setTasks]                = useState([])
  const [opsQcTasks,           setOpsQcTasks]           = useState([])
  const [opsCounts,            setOpsCounts]            = useState({ qcReview: 0, rework: 0, inProgress: 0, completed: 0, assigned: 0, held: 0, cancelled: 0 })
  const [completedTasksCount,  setCompletedTasksCount]  = useState(0)
  const [loading,              setLoading]              = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)

    // Returns null when condition is false, or catches to null on error
    const need = (cond, fn) => cond ? fn().catch(() => null) : Promise.resolve(null)
    // Extract array from plain array or PagedResponse
    const toArr = (data) => Array.isArray(data) ? data : (data?.content || [])
    // Extract total count from plain array or PagedResponse
    const toCount = (data) => Array.isArray(data) ? data.length : (data?.totalElements ?? 0)

    Promise.all([
      // Requestor: just first page is enough for the array (used for task-level status filters)
      need(showRequestWidgets, () => campaignsApi.list().then(r => r.data)),
      // Requestor: total completed tasks count (size=1 — only totalElements needed)
      need(showRequestWidgets, () => campaignsApi.completedTasks({ page: 0, size: 1 }).then(r => r.data?.totalElements ?? 0)),
      // Worker: own task list
      need(showWorkerWidgets,  () => tasksApi.listMy().then(r => r.data)),
      // Ops: QC pending (full list — usually small)
      need(showOpsWidgets,     () => managerApi.pendingTasks().then(r => r.data)),
      // Ops: per-status counts — fetch size=1 so backend returns totalElements accurately
      need(showOpsWidgets,     () => managerApi.allTasks({ status: 'REWORK',      size: 1 }).then(r => r.data?.totalElements ?? 0)),
      need(showOpsWidgets,     () => managerApi.allTasks({ status: 'IN_PROGRESS', size: 1 }).then(r => r.data?.totalElements ?? 0)),
      need(showOpsWidgets,     () => managerApi.allTasks({ status: 'COMPLETED',   size: 1 }).then(r => r.data?.totalElements ?? 0)),
      need(showOpsWidgets,     () => managerApi.allTasks({ status: 'ASSIGNED',    size: 1 }).then(r => r.data?.totalElements ?? 0)),
      need(showOpsWidgets,     () => managerApi.allTasks({ status: 'HELD',        size: 1 }).then(r => r.data?.totalElements ?? 0)),
      need(showOpsWidgets,     () => managerApi.allTasks({ status: 'CANCELLED',   size: 1 }).then(r => r.data?.totalElements ?? 0)),
    ]).then(([cs, completedTasks, ts, qc, rework, inProgress, completed, assigned, held, cancelled]) => {
      if (!alive) return
      setCampaigns(toArr(cs))
      setCompletedTasksCount(completedTasks ?? 0)
      setTasks(toArr(ts))
      const qcArr = toArr(qc)
      setOpsQcTasks(qcArr)
      setOpsCounts({
        qcReview:   toCount(qc),
        rework:     rework     ?? 0,
        inProgress: inProgress ?? 0,
        completed:  completed  ?? 0,
        assigned:   assigned   ?? 0,
        held:       held       ?? 0,
        cancelled:  cancelled  ?? 0,
      })
    }).finally(() => alive && setLoading(false))

    return () => { alive = false }
  }, [showWorkerWidgets, showOpsWidgets, showRequestWidgets])

  // Derived KPIs
  const taskCounts = useMemo(() => ({
    open:     tasks.filter(t => ['ASSIGNED','IN_PROGRESS','REWORK'].includes(t.status)).length,
    inFlight: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    qc:       tasks.filter(t => t.status === 'MANAGER_QC_REVIEW').length,
    done:     tasks.filter(t => t.status === 'COMPLETED').length,
  }), [tasks])

  const myRequestCounts = useMemo(() => {
    const my = campaigns
    return {
      total:     my.length,
      completed: my.filter(c => c.status === 'COMPLETED').length,
      rejected:  my.filter(c => c.status === 'REJECTED').length,
      cancelled: my.filter(c => c.status === 'CANCELLED').length,
    }
  }, [campaigns])

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
              <Icon name="send" className="h-3 w-3" /> Manager QC Review
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
              to="/manager/task-management?status=REWORK"
              tone="amber"
              icon="alertCircle"
              label="Sent for Rework"
              value={opsCounts.rework}
              cta="View →"
            />
            <KpiCard
              to="/manager/task-management?status=IN_PROGRESS"
              tone="brand"
              icon="play"
              label="Tasks In Progress"
              value={opsCounts.inProgress}
              cta="View all →"
            />
            <KpiCard
              to="/manager/task-management?status=COMPLETED"
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
              to="/manager/task-management?status=ASSIGNED"
              tone="brand"
              icon="inbox"
              label="Newly Assigned"
              value={opsCounts.assigned}
              cta="View →"
            />
            <KpiCard
              to="/manager/task-management?status=REWORK"
              tone="amber"
              icon="refresh"
              label="Reworks"
              value={opsCounts.rework}
              cta="View →"
            />
            <KpiCard
              to="/manager/task-management?status=HELD"
              tone="orange"
              icon="pause"
              label="Held"
              value={opsCounts.held}
              cta="View →"
            />
            <KpiCard
              to="/manager/task-management?status=CANCELLED"
              tone="rose"
              icon="x"
              label="Cancelled"
              value={opsCounts.cancelled}
              cta="View →"
            />
          </Section>
        </>
      )}

      {/* ── Admin-only quick-access shortcuts ──────────────────────────
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
      )} */}

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
            label="Total Submitted"
            value={myRequestCounts.total}
            cta="View all →"
          />
          <KpiCard
            to="/campaigns/completed"
            tone="emerald"
            icon="check"
            label="Delivered Tasks"
            value={completedTasksCount}
            cta="View →"
          />
          <KpiCard
            to="/campaigns?status=REJECTED"
            tone="orange"
            icon="alertCircle"
            label="Rejected"
            value={myRequestCounts.rejected}
            cta="View →"
          />
          <KpiCard
            to="/campaigns?status=CANCELLED"
            tone="rose"
            icon="x"
            label="Cancelled"
            value={myRequestCounts.cancelled}
            cta="View →"
          />
        </Section>
      )}

      {/* Recent activity feeds */}
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
    MANAGER_QC_REVIEW:   'bg-purple-50 text-purple-700 ring-purple-200',
    REQUESTOR_QC_REVIEW: 'bg-violet-50 text-violet-700 ring-violet-200',
    COMPLETED:           'bg-green-50 text-green-700 ring-green-200',
  }
  const labels = {
    ASSIGNED: 'New', IN_PROGRESS: 'In Progress', REWORK: 'Rework',
    MANAGER_QC_REVIEW: 'Mgr QC', REQUESTOR_QC_REVIEW: 'Req QC', COMPLETED: 'Done',
  }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${m[status] || 'bg-slate-100 text-slate-600'}`}>{labels[status] || status}</span>
}

function PriorityBadge({ v }) {
  const m = { HIGH: 'bg-red-50 text-red-700 ring-red-200', MEDIUM: 'bg-yellow-50 text-yellow-700 ring-yellow-200', LOW: 'bg-green-50 text-green-700 ring-green-200' }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${m[v] || 'bg-slate-100 text-slate-600'}`}>{v || '—'}</span>
}

