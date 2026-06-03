import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
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

const TOP_NAV = [
  { to: '/dashboard',    label: 'Dashboard',      icon: 'dashboard'  },
  { to: '/campaigns',    label: 'My Requests',     icon: 'fileText'   },
  { to: '/my-tasks',     label: 'My Tasks',        icon: 'clipboard'  },
  { to: '/collaborations', label: 'Collaborations', icon: 'users'     },
]

export default function AppLayout() {
  const { user, logout, isAdmin, isHead, isRegionalManager, isMarketingManager, isProcurementManager, isRequestor, isWorker } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const toast = useToast()
  const [hovered, setHovered]           = useState(false)
  const [mobileOpen, setMobileOpen]     = useState(false)
  const [menuOpen, setMenuOpen]         = useState(false)
  const [managerOpen, setManagerOpen]   = useState(true)
  const [changePwdOpen, setChangePwdOpen] = useState(false)
  // Admin alone does NOT get Manager Tools — Marketing Manager or Procurement Manager role is required.
  const showManagerTools = isMarketingManager || isProcurementManager
  // "My Tasks" is for anyone who holds at least one worker (execution) role,
  // even if they also hold a manager/admin role.
  const showMyTasks = isWorker
  // "Collaborations" is visible to workers, requestors, marketing managers, and admins.
  const showCollaborations = isWorker || isRequestor || isMarketingManager || isProcurementManager || isAdmin
  // "Requests" is for anyone who submits briefs. Admin alone does not qualify —
  // assign the Requestor role as well if an admin needs to submit requests.
  const showRequests = isRequestor || isHead || isRegionalManager

  // Auto-expand groups based on current URL
  useEffect(() => {
    if (location.pathname.startsWith('/manager')) setManagerOpen(true)
  }, [location.pathname])

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
    if (location.pathname.startsWith('/admin/task-mappings')) return 'Task Mappings'
    if (location.pathname.startsWith('/admin/questions'))           return 'Question Library'
    if (location.pathname.startsWith('/admin/qc-routing'))                  return 'QC Routing'
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
    if (location.pathname.startsWith('/manager/qc-review'))        return 'Manager QC Review Queue'
    if (location.pathname.startsWith('/requestor-qc-review'))     return 'Requestor QC Review'
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
                    border-r border-slate-100 bg-white
                    transition-all duration-200
                    ${hovered ? 'shadow-xl shadow-slate-200/60' : ''}
                    ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        {/* Brand row — when collapsed, only the logo shows (centered, fixed 36px) */}
        <div className={`flex h-[60px] shrink-0 items-center border-b border-slate-100
                         ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
          {collapsed ? (
            <Logo size={32} />
          ) : (
            <div className="flex min-w-0 items-center gap-2.5">
              <Logo size={32} />
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[13px] font-bold tracking-tight text-slate-900">MedPlus</div>
                <div className="text-[10px] uppercase tracking-widest text-slate-400">
                  Brand &amp; Buzz
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 overflow-y-auto py-3 ${collapsed ? 'px-1.5 space-y-0.5' : 'px-2 space-y-0.5'}`}>
          {TOP_NAV.filter(item => {
            if (item.to === '/my-tasks')        return showMyTasks
            if (item.to === '/collaborations')  return showCollaborations
            if (item.to === '/campaigns')       return showRequests
            return true
          }).map((item) => (
            <SidebarLink
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              collapsed={collapsed}
              onNavigate={() => setMobileOpen(false)}
              badge={0}
            />
          ))}

          {/* Requestor-only: QC Review + Completed Tasks */}
          {showRequests && (
            <>
              <SidebarLink
                to="/requestor-qc-review"
                label="Requestor QC Review"
                icon="checkCircle"
                collapsed={collapsed}
                onNavigate={() => setMobileOpen(false)}
              />
              <SidebarLink
                to="/campaigns/completed"
                label="Completed Tasks"
                icon="check"
                collapsed={collapsed}
                onNavigate={() => setMobileOpen(false)}
              />
            </>
          )}

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
                to="/manager/task-management"
                label="Task Management"
                icon="fileText"
                collapsed={collapsed}
                nested
                onNavigate={() => setMobileOpen(false)}
              />
              <SidebarLink
                to="/manager/qc-review"
                label="Manager QC Review"
                icon="check"
                collapsed={collapsed}
                nested
                onNavigate={() => setMobileOpen(false)}
              />
              <SidebarLink
                to="/manager/analytics"
                label="Analytics"
                icon="barChart"
                collapsed={collapsed}
                nested
                onNavigate={() => setMobileOpen(false)}
              />
            </SidebarGroup>
          )}

          {isAdmin && (
            <SidebarLink
              to="/admin/master"
              label="Master"
              icon="cog"
              collapsed={collapsed}
              onNavigate={() => setMobileOpen(false)}
            />
          )}
        </nav>

        {/* Footer: sign out */}
        <div className="shrink-0 border-t border-slate-100 p-2">
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sign out' : undefined}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm
                        font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600
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
          <div className="relative shrink-0">
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
                <div className="fixed inset-0 z-dropdown" onClick={() => setMenuOpen(false)} />
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

function SidebarLink({ to, label, icon, collapsed, nested = false, onNavigate, badge = 0 }) {
  const iconClass = collapsed
    ? 'h-[18px] w-[18px] shrink-0'
    : nested
      ? 'h-[15px] w-[15px] shrink-0 opacity-70'
      : 'h-[17px] w-[17px] shrink-0'

  const baseClass = collapsed
    ? 'group relative mx-auto flex h-9 w-9 items-center justify-center rounded-lg transition'
    : `group relative flex items-center gap-2.5 rounded-lg transition
       ${nested ? 'px-2.5 py-1.5 text-[13px]' : 'px-2.5 py-2 text-[13.5px] font-medium'}`

  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      end={!nested}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `${baseClass} ${isActive
          ? 'bg-brand-50 text-brand-700'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !collapsed && (
            <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-brand-600" />
          )}
          {/* Badge dot on icon when collapsed */}
          <span className="relative shrink-0">
            <Icon name={icon} className={iconClass} strokeWidth={isActive && !collapsed ? 2 : 1.7} />
            {badge > 0 && collapsed && (
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center
                               rounded-full bg-brand-600 text-[8px] font-bold text-white ring-1 ring-white">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </span>
          {!collapsed && <span className="truncate flex-1">{label}</span>}
          {!collapsed && badge > 0 && (
            <span className="ml-auto shrink-0 rounded-full bg-brand-600 px-1.5 py-0.5
                             text-[10px] font-bold leading-none text-white">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

function SidebarGroup({ label, icon, collapsed, open, onToggle, children }) {
  if (collapsed) {
    // Icon-only mode: group icon acts as a toggle; children show when open
    return (
      <div className="pt-2">
        <div className="mx-2 mb-1.5 border-t border-slate-100" />
        <button
          onClick={onToggle}
          title={label}
          className={`mx-auto flex h-9 w-9 items-center justify-center rounded-lg transition
            ${open
              ? 'bg-brand-50 text-brand-600'
              : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
        >
          <Icon name={icon} className="h-[18px] w-[18px]" />
        </button>
        {open && <div className="mt-0.5 space-y-0.5">{children}</div>}
      </div>
    )
  }
  return (
    <div className="pt-3">
      <button
        onClick={onToggle}
        className="flex w-full select-none items-center justify-between px-2.5 py-1
                   text-[10px] font-semibold uppercase tracking-widest text-slate-400
                   transition-colors hover:text-slate-600"
      >
        <span>{label}</span>
        <Icon
          name="chevron"
          className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && <div className="mt-1 space-y-0.5">{children}</div>}
    </div>
  )
}
