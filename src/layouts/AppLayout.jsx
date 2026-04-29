import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { MASTER_RESOURCES } from '../api/masterData'
import Icon from '../components/Icon'
import Logo from '../components/Logo'

const TOP_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/campaigns', label: 'Requests',  icon: 'fileText'  },
  { to: '/my-tasks',  label: 'My Tasks',  icon: 'clipboard' },
]

export default function AppLayout() {
  const { user, logout, isAdmin, isHead, isRegionalManager, isMarketingManager, isRequestor } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [collapsed, setCollapsed]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOpen, setMenuOpen]     = useState(false)
  const [masterOpen, setMasterOpen] = useState(true)
  const [managerOpen, setManagerOpen] = useState(true)

  const showManagerTools = isMarketingManager || isAdmin
  // "My Tasks" is only for marketing-team workers who actually execute tasks
  // (e.g. Graphic Designer, Content Writer, Paid Ads Manager, SEO Owner, …).
  // Managers, Requestors and Admin never have tasks routed to them.
  const showMyTasks =
    !isRequestor && !isAdmin && !isMarketingManager && !isHead && !isRegionalManager
  // "Requests" is for anyone who can submit or view their own requests:
  // Requestors, Dept Heads, Regional Managers, and Admins.
  const showRequests = isRequestor || isHead || isRegionalManager || isAdmin

  // Auto-expand groups based on current URL
  useEffect(() => {
    if (location.pathname.startsWith('/admin'))   setMasterOpen(true)
    if (location.pathname.startsWith('/manager')) setManagerOpen(true)
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-64'
  const padded       = collapsed ? 'lg:pl-[72px]' : 'lg:pl-64'

  const navHeader = useMemo(() => {
    if (location.pathname.startsWith('/admin/master'))             return 'Master Data'
    if (location.pathname.startsWith('/admin/granular-tasks'))     return 'Granular Tasks'
    if (location.pathname.startsWith('/admin/role-task-mappings')) return 'Role → Task Mappings'
    if (location.pathname.startsWith('/admin/questions'))           return 'Question Library'
    if (location.pathname.startsWith('/admin/users'))              return 'User Management'
    if (location.pathname.startsWith('/campaigns/new'))            return 'New Marketing Request'
    if (location.pathname.match(/^\/campaigns\/\d+/))              return 'Campaign Detail'
    if (location.pathname.startsWith('/campaigns'))                return 'Marketing Requests'
    if (location.pathname.startsWith('/my-tasks'))                 return 'My Tasks'
    if (location.pathname.startsWith('/manager/all-requests'))     return 'All Requests'
    if (location.pathname.startsWith('/manager/qc-review'))        return 'QC Review Queue'
    if (location.pathname.startsWith('/manager/reports'))          return 'Time & Efficiency Reports'
    if (location.pathname === '/dashboard')                        return 'Dashboard'
    return 'Marketing Automation'
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* ============ SIDEBAR ============ */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 ${sidebarWidth} flex flex-col
                    border-r border-slate-200 bg-white transition-all duration-200
                    ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        {/* Brand row — when collapsed, only the logo shows (centered, fixed 36px) */}
        <div className={`flex h-14 shrink-0 items-center border-b border-slate-200
                         ${collapsed ? 'justify-center px-2' : 'justify-between px-3'}`}>
          {collapsed ? (
            <Logo size={36} />
          ) : (
            <div className="flex min-w-0 items-center gap-2.5">
              <Logo size={36} />
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-semibold text-slate-900">MedPlus</div>
                <div className="text-xs uppercase tracking-wider text-slate-400">
                  Brand & Buzz
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 overflow-y-auto py-3 ${collapsed ? 'px-2 space-y-1' : 'px-2.5 space-y-0.5'}`}>
          {TOP_NAV.filter(item => {
            if (item.to === '/my-tasks')  return showMyTasks
            if (item.to === '/campaigns') return showRequests
            return true
          }).map((item) => (
            <SidebarLink
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              collapsed={collapsed}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}

          {/* Marketing-Manager tools */}
          {showManagerTools && (
            <SidebarGroup
              label="Manager Tools"
              icon="shield"
              collapsed={collapsed}
              open={managerOpen}
              onToggle={() => setManagerOpen((o) => !o)}
            >
              <SidebarLink
                to="/manager/all-requests"
                label="All Requests"
                icon="fileText"
                collapsed={collapsed}
                nested
                onNavigate={() => setMobileOpen(false)}
              />
              <SidebarLink
                to="/manager/qc-review"
                label="QC Review"
                icon="check"
                collapsed={collapsed}
                nested
                onNavigate={() => setMobileOpen(false)}
              />
              <SidebarLink
                to="/manager/reports"
                label="Time Reports"
                icon="trendingUp"
                collapsed={collapsed}
                nested
                onNavigate={() => setMobileOpen(false)}
              />
            </SidebarGroup>
          )}

          {(isAdmin || isMarketingManager) && (
            <SidebarGroup
              label="Master Data"
              icon="cog"
              collapsed={collapsed}
              open={masterOpen}
              onToggle={() => setMasterOpen((o) => !o)}
            >
              {(isAdmin || isMarketingManager) && MASTER_RESOURCES.map((r) => (
                <SidebarLink
                  key={r.slug}
                  to={`/admin/master/${r.slug}`}
                  label={r.label}
                  icon={r.icon}
                  collapsed={collapsed}
                  nested
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
              {(isAdmin || isMarketingManager) && (
                <SidebarLink
                  to="/admin/granular-tasks"
                  label="Granular Tasks"
                  icon="list"
                  collapsed={collapsed}
                  nested
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
              {(isAdmin || isMarketingManager) && (
                <SidebarLink
                  to="/admin/role-task-mappings"
                  label="Role-Task Mappings"
                  icon="shield"
                  collapsed={collapsed}
                  nested
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
              {(isAdmin || isMarketingManager) && (
                <SidebarLink
                  to="/admin/questions"
                  label="Question Library"
                  icon="clipboard"
                  collapsed={collapsed}
                  nested
                  onNavigate={() => setMobileOpen(false)}
                />
              )}
              <SidebarLink
                to="/admin/users"
                label="Users"
                icon="users"
                collapsed={collapsed}
                nested
                onNavigate={() => setMobileOpen(false)}
              />
            </SidebarGroup>
          )}
        </nav>

        {/* Footer: collapse toggle + sign out */}
        <div className="shrink-0 border-t border-slate-200 p-2 space-y-1">
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`hidden w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm
                        font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800
                        lg:flex ${collapsed ? 'justify-center' : ''}`}
          >
            <Icon
              name="chevron"
              className={`h-4 w-4 shrink-0 transition-transform ${collapsed ? '' : 'rotate-180'}`}
            />
            {!collapsed && <span>Collapse</span>}
          </button>

          <button
            onClick={handleLogout}
            title={collapsed ? 'Sign out' : undefined}
            className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm
                        font-medium text-slate-600 transition hover:bg-brand-50 hover:text-brand-700
                        ${collapsed ? 'justify-center' : ''}`}
          >
            <Icon name="logout" className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ============ MAIN COLUMN ============ */}
      <div className={`flex min-h-screen flex-col transition-[padding] duration-200 ${padded}`}>
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between
                           border-b border-slate-200 bg-white/85 px-3 backdrop-blur sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <h1 className="truncate text-base font-semibold text-slate-800">
              {navHeader}
            </h1>
          </div>

          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen((m) => !m)}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5
                         text-left transition hover:bg-slate-100"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full
                              bg-gradient-to-br from-brand-500 to-brand-700 text-xs
                              font-semibold text-white shadow-sm ring-2 ring-white">
                {(user?.fullName || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="hidden text-right sm:block">
                <div className="text-sm font-medium leading-tight text-slate-800">
                  {user?.fullName || user?.email}
                </div>
                <div className="text-xs leading-tight text-slate-500">
                  {user?.role || 'User'}{user?.department ? ` • ${user.department}` : ''}
                </div>
              </div>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-lg
                                border border-slate-200 bg-white shadow-lg">
                  <div className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                                    bg-gradient-to-br from-brand-500 to-brand-700 text-xs
                                    font-semibold text-white shadow-sm">
                      {(user?.fullName || user?.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">
                        {user?.fullName}
                      </div>
                      <div className="truncate text-xs text-slate-500">{user?.email}</div>
                    </div>
                  </div>
                  {user?.role && (
                    <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
                      Signed in as{' '}
                      <span className="inline-flex items-center rounded-full bg-brand-50 px-1.5 py-0.5
                                       text-xs font-medium text-brand-700 ring-1 ring-brand-100">
                        {user.role}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm
                               text-slate-700 transition hover:bg-slate-50"
                  >
                    <Icon name="logout" className="h-4 w-4" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- */
/* Sidebar primitives                                                */
/* ----------------------------------------------------------------- */

function SidebarLink({ to, label, icon, collapsed, nested = false, onNavigate }) {
  // Icons stay legible when collapsed (20px); a touch smaller when nested + open.
  const iconClass = collapsed
    ? 'h-5 w-5 shrink-0'
    : nested
      ? 'h-[17px] w-[17px] shrink-0'
      : 'h-[18px] w-[18px] shrink-0'

  // Hit-area: square + centered icon when collapsed; pill row when expanded.
  const baseClass = collapsed
    ? 'group relative flex h-10 items-center justify-center rounded-md font-medium transition'
    : `group relative flex items-center gap-2.5 rounded-md font-medium transition
       ${nested ? 'px-2.5 py-1.5 text-sm' : 'px-2.5 py-2 text-sm'}`

  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      end={!nested}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `${baseClass} ${isActive
          ? 'bg-brand-50 text-brand-700'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !collapsed && (
            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-brand-600" />
          )}
          <Icon name={icon} className={iconClass} />
          {!collapsed && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  )
}

function SidebarGroup({ label, icon, collapsed, open, onToggle, children }) {
  if (collapsed) {
    // No group header in collapsed mode — children render as a plain icon strip.
    // A subtle divider gives the group a visible boundary.
    return (
      <div className="space-y-1 pt-2">
        <div className="mx-3 border-t border-slate-100" />
        {children}
      </div>
    )
  }
  return (
    <div className="pt-2">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm
                   font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
      >
        <Icon name={icon} className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        <Icon
          name="chevron"
          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && <div className="mt-0.5 space-y-0.5 pl-3.5">{children}</div>}
    </div>
  )
}
