import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Rights } from '../constants/rights'
import {
  BUDGET_RIGHTS,
  MANAGER_NAV_LINKS,
  REQUESTOR_NAV_LINKS,
  REQUESTOR_RIGHTS,
  canAccessNavItem,
} from '../constants/navAccess'
import HasRight from '../components/HasRight'
import Icon from '../components/Icon'
import Logo from '../components/Logo'
import Modal from '../components/Modal'
import NotificationBell from '../components/NotificationBell'
import { useToast } from '../components/Toast'
import api from '../api/client'

// ─── Change Password Modal ────────────────────────────────────────────────────
function ChangePasswordModal({ open, onClose }) {
  const toast = useToast()
  const [form, setForm]       = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [showCur, setShowCur] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    if (open) setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
  }, [open])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.newPassword !== form.confirmPassword) {
      toast.error('New passwords do not match.')
      return
    }
    if (form.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.')
      return
    }
    setSaving(true)
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword:     form.newPassword,
      })
      toast.success('Password changed successfully.')
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to change password.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = `w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm
                    text-slate-800 placeholder-slate-400 shadow-sm outline-none pr-10
                    focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition`

  return (
    <Modal open={open} onClose={onClose} title="Change Password" maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Password */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Current Password</label>
          <div className="relative">
            <input
              required
              type={showCur ? 'text' : 'password'}
              className={inputCls}
              value={form.currentPassword}
              onChange={e => set('currentPassword', e.target.value)}
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShowCur(s => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-600">
              <Icon name={showCur ? 'eyeOff' : 'eye'} className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">New Password</label>
          <div className="relative">
            <input
              required
              type={showNew ? 'text' : 'password'}
              className={inputCls}
              value={form.newPassword}
              onChange={e => set('newPassword', e.target.value)}
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShowNew(s => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-600">
              <Icon name={showNew ? 'eyeOff' : 'eye'} className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Confirm New Password */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Confirm New Password</label>
          <div className="relative">
            <input
              required
              type={showNew ? 'text' : 'password'}
              className={inputCls}
              value={form.confirmPassword}
              onChange={e => set('confirmPassword', e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {form.confirmPassword && form.newPassword !== form.confirmPassword && (
            <p className="mt-1 text-xs text-red-500">Passwords do not match.</p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm
                       font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white
                       shadow-sm transition hover:bg-brand-700 disabled:opacity-60 sm:w-auto">
            {saving ? 'Saving…' : 'Change Password'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const OVERVIEW_NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
]

const MY_WORKSPACE_NAV_LINKS = [
  {
    to: '/campaigns',
    label: 'My Requests',
    icon: 'fileText',
    anyRight: REQUESTOR_RIGHTS,
  },
  {
    to: '/my-tasks',
    label: 'My Tasks',
    icon: 'clipboard',
    right: Rights.VIEW_MY_TASKS,
  },
  {
    to: '/requestor/review-center',
    label: 'Review Center',
    icon: 'eye',
    right: Rights.VIEW_REQUESTOR_QC_QUEUE,
  },
  {
    to: '/campaigns/completed',
    label: 'Completed Tasks',
    icon: 'checkSquare',
    right: Rights.VIEW_OWN_COMPLETED_TASKS,
  },
  {
    to: '/collaborations',
    label: 'Collaborations',
    icon: 'users',
    right: Rights.ACCESS_COLLABORATIONS,
  },
]

const MANAGER_TOOLS_NAV_LINKS = [
  {
    to: '/manager/task-management',
    label: 'Task Management',
    icon: 'layers',
    anyRight: [Rights.ACCESS_MANAGER_TOOLS, Rights.VIEW_TEAM_TASKS],
  },
  {
    to: '/tasks/approvals',
    label: 'Task Approvals',
    icon: 'userCheck',
    anyRight: [Rights.REVIEW_MANAGER_QC, Rights.APPROVE_TEAM_TASKS],
  },
  {
    to: '/manager/analytics',
    label: 'Analytics',
    icon: 'barChart',
    anyRight: [Rights.VIEW_ANALYTICS_REPORTS, Rights.ACCESS_MANAGER_TOOLS, Rights.VIEW_TEAM_ANALYTICS],
  },
]

const ADMINISTRATION_NAV_LINKS = [
  {
    to: '/budget-planning',
    label: 'Budget Planning',
    icon: 'dollar',
    anyRight: BUDGET_RIGHTS,
  },
  {
    to: '/budget/approvals',
    label: 'Budget Approvals',
    icon: 'userCheck',
    anyRight: [Rights.APPROVE_BUDGET_OVERRUN, Rights.APPROVE_BUDGET],
  },
  {
    to: '/admin/master',
    label: 'Master Data',
    icon: 'cog',
    right: Rights.MANAGE_MASTER_DATA,
  },
]

export default function AppLayout() {
  const { user, logout, hasRight, hasAnyRight } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const toast = useToast()
  const [hovered, setHovered]           = useState(false)
  const [mobileOpen, setMobileOpen]     = useState(false)
  const [menuOpen, setMenuOpen]         = useState(false)
  const [changePwdOpen, setChangePwdOpen] = useState(false)

  const profileMenuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const visibleOverview = useMemo(
    () => OVERVIEW_NAV_LINKS.filter(item => canAccessNavItem(item, hasRight, hasAnyRight)),
    [hasRight, hasAnyRight],
  )
  const visibleMyWorkspace = useMemo(
    () => MY_WORKSPACE_NAV_LINKS.filter(item => canAccessNavItem(item, hasRight, hasAnyRight)),
    [hasRight, hasAnyRight],
  )
  const visibleManagerTools = useMemo(
    () => MANAGER_TOOLS_NAV_LINKS.filter(item => canAccessNavItem(item, hasRight, hasAnyRight)),
    [hasRight, hasAnyRight],
  )
  const visibleAdministration = useMemo(
    () => ADMINISTRATION_NAV_LINKS.filter(item => canAccessNavItem(item, hasRight, hasAnyRight)),
    [hasRight, hasAnyRight],
  )

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  // Sidebar is always collapsed by default; it expands while the cursor is inside it.
  // Main content keeps the collapsed offset permanently to avoid layout shifts on hover.
  const collapsed    = !hovered
  const sidebarWidth = hovered ? 'w-64' : 'w-[72px]'
  const padded       = 'lg:pl-[72px]'
  // Expanded sidebar overlaps main header — sit above header, still below modals
  const sidebarZ     = hovered || mobileOpen ? 'z-dropdown' : 'z-sidebar'

  const navHeader = useMemo(() => {
    if (location.pathname === '/admin/master')                     return 'Master'
    if (location.pathname.startsWith('/admin/master/'))            return 'Master Data'
    if (location.pathname.startsWith('/admin/granular-tasks'))     return 'Granular Tasks'
    if (location.pathname.startsWith('/admin/task-mappings')) return 'Capability → Task'
    if (location.pathname.startsWith('/admin/questions'))           return 'Question Library'
    if (location.pathname.startsWith('/admin/qc-routing'))                  return 'QC Routing'
    if (location.pathname.startsWith('/admin/working-hours'))           return 'Working Hours'
    if (location.pathname.startsWith('/admin/notification-templates'))      return 'Notification Templates'
    if (location.pathname.startsWith('/admin/campaign-mappings/vertical-type')) return 'Vertical → Type'
    if (location.pathname.startsWith('/admin/campaign-mappings/type-format'))   return 'Type → Format'
    if (location.pathname.startsWith('/admin/users'))              return 'User Management'
    if (location.pathname.startsWith('/campaigns/new'))            return 'New Marketing Request'
    if (location.pathname.startsWith('/campaigns/completed'))      return 'Completed Tasks'
    if (location.pathname.match(/^\/campaigns\/\d+/))              return 'Campaign Detail'
    if (location.pathname.startsWith('/campaigns'))                return 'Marketing Requests'
    if (location.pathname.startsWith('/my-tasks'))                 return 'My Tasks'
    if (location.pathname.startsWith('/collaborations'))           return 'Collaborations'
    if (location.pathname.startsWith('/manager/task-management'))  return 'Task Management'
    if (location.pathname.startsWith('/tasks/approvals'))          return 'Task Approvals'
    if (location.pathname.startsWith('/manager/analytics'))       return 'Analytics'
    if (location.pathname.startsWith('/budget/approvals'))        return 'Budget Overrun Approvals'
    if (location.pathname.startsWith('/budget-planning'))         return 'Budget & Planning'
    if (location.pathname === '/dashboard')                        return 'Dashboard'
    return 'Marketing Automation'
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      {/* ============ SIDEBAR ============ */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`fixed inset-y-0 left-0 ${sidebarZ} ${sidebarWidth} flex flex-col
                    overflow-hidden border-r border-slate-200/80 bg-white
                    transition-all duration-200 ease-in-out
                    ${hovered ? 'shadow-2xl shadow-slate-900/5' : ''}
                    ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        {/* Brand row — when collapsed, centered logo; when expanded, logo + styled brand badge */}
        <div className={`flex h-[60px] shrink-0 items-center border-b border-slate-100/80 bg-white
                         ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
          {collapsed ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50/50 transition hover:bg-brand-50">
              <Logo size={28} />
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-2.5">
              <Logo size={30} />
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-bold tracking-tight text-slate-900">MedPlus</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="inline-block rounded bg-brand-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-brand-600 border border-brand-100/80 leading-none">
                    Brand &amp; Buzz
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 overflow-hidden overflow-y-auto py-2.5 ${collapsed ? 'px-2 space-y-2' : 'px-2.5 space-y-3'}`}>
          {/* Section 1: Overview */}
          {visibleOverview.length > 0 && (
            <div className="space-y-0.5">
              {visibleOverview.map(item => (
                <SidebarLink
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  collapsed={collapsed}
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
            </div>
          )}

          {/* Section 2: My Workspace */}
          {visibleMyWorkspace.length > 0 && (
            <div>
              {!collapsed ? (
                <div className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none">
                  My Workspace
                </div>
              ) : (
                <div className="my-1.5 mx-2 border-t border-slate-200/80" />
              )}
              <div className="space-y-0.5">
                {visibleMyWorkspace.map(item => (
                  <SidebarLink
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    icon={item.icon}
                    collapsed={collapsed}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Manager Tools */}
          {visibleManagerTools.length > 0 && (
            <div>
              {!collapsed ? (
                <div className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none">
                  Manager Tools
                </div>
              ) : (
                <div className="my-1.5 mx-2 border-t border-slate-200/80" />
              )}
              <div className="space-y-0.5">
                {visibleManagerTools.map(item => (
                  <SidebarLink
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    icon={item.icon}
                    collapsed={collapsed}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Administration & Planning */}
          {visibleAdministration.length > 0 && (
            <div>
              {!collapsed ? (
                <div className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none">
                  Administration
                </div>
              ) : (
                <div className="my-1.5 mx-2 border-t border-slate-200/80" />
              )}
              <div className="space-y-0.5">
                {visibleAdministration.map(item => (
                  <SidebarLink
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    icon={item.icon}
                    collapsed={collapsed}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Footer: sign out */}
        <div className="shrink-0 border-t border-slate-100 p-2 bg-slate-50/40">
          <button
            onClick={handleLogout}
            className={`group relative flex w-full items-center rounded-xl text-slate-500 transition-all duration-150 hover:bg-rose-50 hover:text-rose-600 ${
              collapsed
                ? 'mx-auto h-9 w-9 justify-center'
                : 'px-3 py-2 text-xs font-medium gap-2.5'
            }`}
          >
            <Icon name="logout" className="h-[18px] w-[18px] shrink-0 group-hover:scale-110 transition-transform" />
            {!collapsed && <span className="font-medium">Sign out</span>}
            {collapsed && (
              <div className="pointer-events-none absolute left-full ml-3 z-50 hidden group-hover:flex items-center">
                <div className="relative rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white shadow-xl whitespace-nowrap animate-in fade-in duration-100">
                  Sign out
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                </div>
              </div>
            )}
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
      <div className={`flex h-screen flex-col transition-[padding] duration-200 ${padded}`}>
        {/* Header */}
        <header className="sticky top-0 z-header flex h-[60px] items-center justify-between
                           border-b border-slate-100 bg-white/95 px-4 backdrop-blur-sm
                           shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <h1 className="truncate text-sm font-semibold tracking-tight text-slate-700">
              {navHeader}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
          <div className="relative shrink-0" ref={profileMenuRef}>
            <button
              onClick={() => setMenuOpen((m) => !m)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5
                         text-left transition hover:bg-slate-50"
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
                  {user?.designation || 'User'}{user?.department ? ` • ${user.department}` : ''}
                </div>
              </div>
            </button>

            {menuOpen && (
              <>
                <div className="absolute right-0 z-dropdown mt-2 w-60 overflow-hidden rounded-xl
                                border border-slate-100 bg-white shadow-xl shadow-slate-200/50">
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
                  {user?.designation && (
                    <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
                      <span className="inline-flex items-center rounded-full bg-brand-50 px-1.5 py-0.5
                                       text-xs font-medium text-brand-700 ring-1 ring-brand-100">
                        {user.designation}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => { setMenuOpen(false); setChangePwdOpen(true) }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm
                               text-slate-700 transition hover:bg-slate-50"
                  >
                    <Icon name="lock" className="h-4 w-4" /> Change Password
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm
                               text-slate-700 transition hover:bg-slate-50 border-t border-slate-100"
                  >
                    <Icon name="logout" className="h-4 w-4" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
          </div>
        </header>

        <main className="flex flex-1 min-h-0 flex-col overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <ChangePasswordModal open={changePwdOpen} onClose={() => setChangePwdOpen(false)} />
    </div>
  )
}

/* ----------------------------------------------------------------- */
/* Sidebar primitives                                                */
/* ----------------------------------------------------------------- */

/* ----------------------------------------------------------------- */
/* Sidebar primitives                                                */
/* ----------------------------------------------------------------- */

function SidebarLink({ to, label, icon, collapsed, nested = false, onNavigate, badge = 0 }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      end={!nested}
      className={({ isActive }) =>
        `group relative flex items-center transition-all duration-150 select-none ${
          collapsed
            ? 'mx-auto justify-center h-9 w-9 rounded-xl my-0.5'
            : `rounded-lg my-0.5 ${
                nested
                  ? 'px-3 py-1.5 text-[13px] ml-2'
                  : 'px-3 py-2 text-[13.5px] font-medium'
              }`
        } ${
          isActive
            ? collapsed
              ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-200/80 shadow-xs'
              : 'bg-gradient-to-r from-brand-50 to-brand-50/20 text-brand-700 font-semibold'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Active indicator line in expanded mode */}
          {isActive && !collapsed && (
            <span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-brand-600 shadow-xs" />
          )}

          {/* Icon */}
          <span
            className={`relative flex items-center justify-center shrink-0 transition-transform duration-150 ${
              isActive
                ? 'text-brand-600'
                : 'text-slate-500 group-hover:text-slate-800 group-hover:scale-110'
            }`}
          >
            <Icon
              name={icon}
              className={
                collapsed
                  ? 'h-[18px] w-[18px]'
                  : nested
                  ? 'h-[15.5px] w-[15.5px]'
                  : 'h-[17.5px] w-[17.5px]'
              }
              strokeWidth={isActive ? 2 : 1.75}
            />
            {badge > 0 && collapsed && (
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-600 text-[8px] font-bold text-white ring-2 ring-white">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </span>

          {/* Label in expanded mode */}
          {!collapsed && (
            <span className="ml-2.5 truncate flex-1 tracking-tight">{label}</span>
          )}

          {/* Badge in expanded mode */}
          {!collapsed && badge > 0 && (
            <span className="ml-auto shrink-0 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {badge > 99 ? '99+' : badge}
            </span>
          )}

          {/* Creative floating tooltip in contracted / collapsed mode */}
          {collapsed && (
            <div className="pointer-events-none absolute left-full ml-3 z-50 hidden group-hover:flex items-center">
              <div className="relative rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white shadow-xl whitespace-nowrap animate-in fade-in duration-100">
                {label}
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
              </div>
            </div>
          )}
        </>
      )}
    </NavLink>
  )
}

function SidebarGroup({ label, icon, collapsed, open, onToggle, children }) {
  if (collapsed) {
    return (
      <div className="py-1">
        <div className="my-1.5 mx-2.5 border-t border-slate-200/80" />
        <div className="group relative mx-auto flex justify-center">
          <button
            onClick={onToggle}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150 ${
              open
                ? 'bg-slate-100 text-brand-600 font-medium'
                : 'text-slate-400 hover:bg-slate-100/80 hover:text-slate-700'
            }`}
          >
            <Icon name={icon} className="h-[18px] w-[18px]" />
          </button>
          {/* Tooltip for section group header */}
          <div className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 hidden group-hover:flex items-center">
            <div className="relative rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white shadow-xl whitespace-nowrap">
              {label}
              <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
            </div>
          </div>
        </div>
        {open && <div className="mt-1 space-y-0.5">{children}</div>}
      </div>
    )
  }

  return (
    <div className="pt-3 pb-0.5">
      <button
        onClick={onToggle}
        className="group flex w-full select-none items-center justify-between px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-600"
      >
        <span>{label}</span>
        <Icon
          name="chevron"
          className={`h-3 w-3 text-slate-400 transition-transform duration-200 group-hover:text-slate-600 ${
            open ? 'rotate-90' : ''
          }`}
        />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 border-l border-slate-200/80 ml-3 pl-0.5">
          {children}
        </div>
      )}
    </div>
  )
}
