import { useCallback, useEffect, memo, useRef, useState } from 'react'
import api from '../../api/client'
import { masterApi } from '../../api/masterData'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import { useToast } from '../../components/Toast'
import AppSelect from '../../components/AppSelect'
import SingleSelectDropdown from '../../components/SingleSelectDropdown'
import MultiSelectDropdown from '../../components/MultiSelectDropdown'
import OverflowPillList from '../../components/OverflowPillList'
import Pagination from '../../components/Pagination'
import useDebounce from '../../hooks/useDebounce'
import BackToMaster from '../../components/admin/BackToMaster'

const BASE = '/admin/users'
const SKILL_LEVELS = ['JUNIOR', 'SENIOR']

// ─── API helpers ──────────────────────────────────────────────────────────────
const usersApi = {
  list:          (params)   => api.get(BASE, { params: { includeInactive: true, ...params } }),
  create:        (data)     => api.post(BASE, data).then(r => r.data),
  update:        (id, data) => api.put(`${BASE}/${id}`, data).then(r => r.data),
  delete:        (id)       => api.delete(`${BASE}/${id}`),
  resetPassword: (id)       => api.patch(`${BASE}/${id}/reset-password`),
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const active = status === 'ACTIVE'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold
                      ${active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                               : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}



// ─── Form modal ───────────────────────────────────────────────────────────────
function UserFormModal({ open, onClose, initial, roles, capabilities, departments, designations, onSaved }) {
  const toast  = useToast()
  const isEdit = !!initial?.userId

  const blank = {
    fullName: '', email: '',
    departmentId: '', designationId: '', roleIds: [],
    capabilityIds: [],
    teamMemberIds: [],
    skillLevel: 'JUNIOR', status: 'ACTIVE',
  }
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [marketingUsers, setMarketingUsers] = useState([])
  const isTeamLeader = form.roleIds.some(id => roles.find(r => r.id === id)?.name === 'TEAM_LEADER' || roles.find(r => r.id === id)?.name === 'Team Leader');
  const hasAssignee = form.roleIds.some(id => roles.find(r => r.id === id)?.name === 'ASSIGNEE' || roles.find(r => r.id === id)?.name === 'Assignee');

  // Fetch users for Team Members dropdown
  useEffect(() => {
    if (isTeamLeader && marketingUsers.length === 0) {
      // Find marketing department ID dynamically
      const marketingDept = departments.find(d => d.name.toLowerCase() === 'marketing')
      const filter = marketingDept ? { departmentId: marketingDept.id, size: 500 } : { size: 500 }
      usersApi.list(filter).then(res => {
        const raw = res.data?.content || res.data || []
        setMarketingUsers(raw)
      }).catch(err => toast.error(err?.response?.data?.message || "Failed to fetch team members."))
    }
  }, [isTeamLeader, departments, marketingUsers.length])

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        fullName:      initial.fullName      || '',
        email:         initial.email         || '',
        departmentId:  initial.departmentId  || '',
        designationId: initial.designationId || '',
        roleIds:       initial.roles ? initial.roles.map(r => r.id) : [],
        capabilityIds: initial.capabilityIds || [],
        teamMemberIds: initial.teamMemberIds || [],
        skillLevel:    initial.skillLevel    || 'JUNIOR',
        status:        initial.status        || 'ACTIVE',
      } : blank)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const buildPayload = () => ({
    fullName:      form.fullName,
    email:         form.email,
    departmentId:  form.departmentId || null,
    designationId: form.designationId || null,
    roleIds:       form.roleIds,
    capabilityIds: hasAssignee ? form.capabilityIds : [],
    teamMemberIds: isTeamLeader ? form.teamMemberIds.filter(id => id !== initial?.userId) : [],
    skillLevel:    form.skillLevel,
    status:        form.status || 'ACTIVE',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = buildPayload()
      const saved = isEdit
        ? await usersApi.update(initial.userId, payload)
        : await usersApi.create(payload)
      toast.success(`User ${isEdit ? 'updated' : 'created'} successfully.`)
      onSaved(saved)
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = `w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm
                    text-slate-800 placeholder-slate-400 shadow-sm outline-none
                    focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition`
  const labelCls = 'mb-1 block text-xs font-medium text-slate-600'

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit User' : 'Add User'} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEdit && (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 ring-1 ring-blue-100">
            Default password <span className="font-semibold font-mono">medplus@123</span> will be set.
            The user can change it from their profile.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Full Name */}
          <div>
            <label className={labelCls}>Full Name *</label>
            <input required className={inputCls} value={form.fullName}
              onChange={e => set('fullName', e.target.value)} placeholder="e.g. Priya Sharma" />
          </div>

          {/* Email */}
          <div>
            <label className={labelCls}>Email *</label>
            <input required type="email" className={inputCls} value={form.email}
              onChange={e => set('email', e.target.value)} placeholder="priya@medplus.com" />
          </div>

          {/* Department */}
          <div>
            <label className={labelCls}>Department</label>
            <AppSelect
              value={form.departmentId != null ? String(form.departmentId) : ''}
              onChange={v => set('departmentId', v)}
              options={departments.map(d => ({ value: String(d.id), label: d.name }))}
              placeholder="— Select department —"
              menuPortal
            />
          </div>

          {/* Designation */}
          <div>
            <label className={labelCls}>Designation</label>
            <AppSelect
              value={form.designationId != null ? String(form.designationId) : ''}
              onChange={v => set('designationId', v)}
              options={designations.map(d => ({ value: String(d.id), label: d.name }))}
              placeholder="— Select designation —"
              menuPortal
            />
          </div>

          {/* Skill Level */}
          <div>
            <label className={labelCls}>Skill Level</label>
            <AppSelect
              value={form.skillLevel}
              onChange={v => set('skillLevel', v)}
              options={SKILL_LEVELS.map(s => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))}
              placeholder="Select…"
              isClearable={false}
              menuPortal
            />
          </div>

          {/* Status (edit only) */}
          {isEdit && (
            <div>
              <label className={labelCls}>Status</label>
              <SingleSelectDropdown
                value={form.status}
                onChange={v => set('status', v)}
                options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]}
                placeholder="Select…"
              />
            </div>
          )}
        </div>

        {/* Roles — multi-select dropdown (spans full width) */}
        <div>
          <label className={labelCls}>
            Roles <span className="text-slate-400 font-normal">(select one or more)</span>
          </label>
          <MultiSelectDropdown
            options={roles}
            value={form.roleIds}
            onChange={ids => set('roleIds', ids)}
            placeholder="Search roles..."
          />
          {form.roleIds.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">At least one role is recommended for proper access.</p>
          )}
        </div>

        {/* Capabilities — only for users with ASSIGNEE role */}
        <div>
          <label className={labelCls}>
            Capabilities <span className="text-slate-400 font-normal">(select one or more)</span>
          </label>
          {hasAssignee ? (
            <MultiSelectDropdown
              options={capabilities.map(c => ({ id: c.id, name: c.name }))}
              value={form.capabilityIds}
              onChange={ids => set('capabilityIds', ids)}
              placeholder="Search capabilities..."
            />
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-400">
              Assign the <strong className="text-slate-500">ASSIGNEE</strong> role above to unlock capability assignment.
            </div>
          )}
        </div>

        {isTeamLeader && (
          <div>
            <label className={labelCls}>
              Team Members <span className="text-slate-400 font-normal">(select direct reports)</span>
            </label>
            <MultiSelectDropdown
              options={marketingUsers
                .filter(u => u.userId !== initial?.userId)
                .filter(u => u.roles && u.roles.some(r => r.roleCode !== 'MANAGER' && r.roleCode !== 'TEAM_LEADER'))
                .map(u => ({ id: u.userId, name: `${u.fullName} (${u.designationName || 'No Designation'})` }))}
              value={form.teamMemberIds}
              onChange={ids => set('teamMemberIds', ids)}
              placeholder="Search team members..."
            />
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 pt-2 border-t border-slate-100 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium
                       text-slate-700 transition hover:bg-slate-50 sm:w-auto">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white
                       shadow-sm transition hover:bg-brand-700 disabled:opacity-60 sm:w-auto">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Column filter helpers ────────────────────────────────────────────────────
function ColInput({ value, onChange, placeholder }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs
                 text-slate-700 placeholder-slate-400 outline-none focus:border-brand-400
                 focus:bg-white focus:ring-1 focus:ring-brand-100 transition" />
  )
}

function ColSelect({ value, onChange, options, placeholder }) {
  return (
    <div className="mt-1">
      <AppSelect
        value={value}
        onChange={v => onChange(v || '')}
        options={options}
        placeholder={placeholder}
        size="sm"
        isSearchable
        menuPortal
      />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function UserManagementPage() {
  const toast = useToast()

  const PAGE_SIZE = 20

  const [users,         setUsers]         = useState([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages,    setTotalPages]    = useState(0)
  const [page,          setPage]          = useState(0)
  const [roles,         setRoles]         = useState([])
  const [capabilities,  setCapabilities]  = useState([])
  const [departments,   setDepartments]   = useState([])
  const [designations,  setDesignations]  = useState([])
  const [loading,       setLoading]       = useState(true)
  const [refreshSeed,   setRefreshSeed]   = useState(0)

  const [editing,       setEditing]       = useState(null)
  const [deleting,      setDeleting]      = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [resetting,     setResetting]     = useState(null)
  const [resetLoading,  setResetLoading]  = useState(false)

  const handleEditUser   = useCallback((u) => setEditing(u), [])
  const handleDeleteUser = useCallback((u) => setDeleting(u), [])
  const handleResetUser  = useCallback((u) => setResetting(u), [])

  // ── Column filters ──────────────────────────────────────────────────────────
  const [fName,        setFName]        = useState('')
  const [fEmail,       setFEmail]       = useState('')
  const [fRole,        setFRole]        = useState('')
  const [fCapability,  setFCapability]  = useState('')
  const [fDept,        setFDept]        = useState('')
  const [fDesignation, setFDesignation] = useState('')
  const [fSkill,       setFSkill]       = useState('')
  const [fStatus,      setFStatus]      = useState('')

  // ── Debounced text filters ─────────────────────────────────────────────────
  const dName  = useDebounce(fName)
  const dEmail = useDebounce(fEmail)

  // ── Reset page when filters change ────────────────────────────────────────
  useEffect(() => { setPage(0) },
    [dName, dEmail, fRole, fCapability, fDept, fDesignation, fSkill, fStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch data from backend ───────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    setLoading(true)
    const params = {
      page, size: PAGE_SIZE,
      ...(dName        && { name:          dName        }),
      ...(dEmail       && { email:         dEmail       }),
      ...(fRole        && { roleName:      fRole        }),
      ...(fCapability  && { capabilityName: fCapability  }),
      ...(fDept        && { departmentId:  fDept        }),
      ...(fDesignation && { designationId: fDesignation }),
      ...(fSkill       && { skillLevel:    fSkill       }),
      ...(fStatus      && { status:        fStatus      }),
    }
    usersApi.list(params)
      .then(res => {
        if (!alive) return
        const raw = res.data
        if (Array.isArray(raw)) {
          setUsers(raw)
          setTotalElements(raw.length)
          setTotalPages(1)
        } else {
          const d = raw || {}
          setUsers(d.content || [])
          setTotalElements(d.totalElements || 0)
          setTotalPages(d.totalPages || 0)
        }
      })
      .catch(() => { if (alive) toast.error('Failed to load users.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [dName, dEmail, fRole, fCapability, fDept, fDesignation, fSkill, fStatus, page, refreshSeed]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load master data for dropdowns once ──────────────────────────────────
  // Uses allSettled so a failure in one endpoint doesn't wipe the other two.
  useEffect(() => {
    Promise.allSettled([
      masterApi.list('roles', false),
      masterApi.list('capabilities', false),
      masterApi.list('departments', false),
      masterApi.list('designations', false),
    ]).then(([rRes, capRes, dRes, dsgRes]) => {
      if (rRes.status === 'fulfilled')
        setRoles(rRes.value.map(x => ({ id: parseInt(x.id, 10), name: x.name })))
      else
        toast.error('Failed to load roles.')

      if (capRes.status === 'fulfilled')
        setCapabilities(capRes.value.map(x => ({ id: x.id, name: x.name })))
      else
        toast.error('Failed to load capabilities.')

      if (dRes.status === 'fulfilled')
        setDepartments(dRes.value.map(x => ({ id: x.id, name: x.name })))
      else
        toast.error('Failed to load departments.')

      if (dsgRes.status === 'fulfilled')
        setDesignations(dsgRes.value.map(x => ({ id: x.id, name: x.name })))
      else
        toast.error('Failed to load designations.')
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSaved = () => {
    setRefreshSeed(s => s + 1)
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await usersApi.delete(deleting.userId)
      toast.success(`User "${deleting.fullName}" deleted.`)
      setDeleting(null)
      setRefreshSeed(s => s + 1)
    } catch { toast.error('Delete failed.') }
    finally { setDeleteLoading(false) }
  }

  const handleResetPassword = async () => {
    if (!resetting) return
    setResetLoading(true)
    try {
      await usersApi.resetPassword(resetting.userId)
      toast.success(`Password reset to default for "${resetting.fullName}".`)
      setResetting(null)
    } catch { toast.error('Password reset failed.') }
    finally { setResetLoading(false) }
  }

  const roleOptions        = roles.map(r => ({ value: r.name, label: r.name }))
  const capabilityOptions  = capabilities.map(c => ({ value: c.name, label: c.name }))
  const deptOptions        = departments.map(x => ({ value: x.id, label: x.name }))
  const designationOptions = designations.map(x => ({ value: x.id, label: x.name }))
  const skillOptions       = SKILL_LEVELS.map(s => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))
  const statusOptions      = [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]

  const filtered = users  // server already filtered

  const hasFilter = !!(fName || fEmail || fRole || fCapability || fDept || fDesignation || fSkill || fStatus)
  const clearFilters = () => {
    setFName(''); setFEmail('')
    setFRole(''); setFCapability(''); setFDept(''); setFDesignation(''); setFSkill(''); setFStatus('')
  }

  const th = 'px-3 pt-3 pb-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 align-top'

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <BackToMaster />

      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Icon name="users" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-900">User Management</h1>
            <p className="text-xs text-slate-500">{totalElements} user record{totalElements === 1 ? '' : 's'} total</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasFilter && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-2
                         text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800">
              <Icon name="x" className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
          <button onClick={() => setEditing(false)}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3.5 py-2
                       text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98]">
            <Icon name="plus" className="h-4 w-4" /> Add User
          </button>
        </div>
      </header>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1300px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-3 pt-3 pb-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-24">User ID</th>
                  <th className={`${th} w-44 min-w-[160px]`}>Name</th>
                  <th className={`${th} w-48 min-w-[180px]`}>Email</th>
                  <th className={`${th} w-52 min-w-[200px]`}>Roles</th>
                  <th className={`${th} w-52 min-w-[200px]`}>Capabilities</th>
                  <th className={`${th} w-60 min-w-[240px]`}>Team Members</th>
                  <th className={th}>Designation</th>
                  <th className={th}>Department</th>
                  <th className={th}>Skill</th>
                  <th className="px-3 pt-3 pb-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Active Tasks</th>
                  <th className={th}>Status</th>
                  <th className="sticky right-0 z-10 bg-slate-50 px-3 pt-3 pb-1 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">Actions</th>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-3 pb-2" />
                  <td className="px-3 pb-2"><ColInput value={fName}  onChange={setFName}  placeholder="Filter name…" /></td>
                  <td className="px-3 pb-2"><ColInput value={fEmail} onChange={setFEmail} placeholder="Filter email…" /></td>
                  <td className="px-3 pb-2"><ColSelect value={fRole}        onChange={setFRole}        options={roleOptions}        placeholder="All roles" /></td>
                  <td className="px-3 pb-2"><ColSelect value={fCapability}    onChange={setFCapability}    options={capabilityOptions}    placeholder="All capabilities" /></td>
                  <td className="px-3 pb-2" />
                  <td className="px-3 pb-2"><ColSelect value={fDesignation} onChange={setFDesignation} options={designationOptions} placeholder="All designations" /></td>
                  <td className="px-3 pb-2"><ColSelect value={fDept}        onChange={setFDept}        options={deptOptions}        placeholder="All depts" /></td>
                  <td className="px-3 pb-2"><ColSelect value={fSkill}       onChange={setFSkill}       options={skillOptions}       placeholder="All skills" /></td>
                  <td className="px-3 pb-2" />
                  <td className="px-3 pb-2"><ColSelect value={fStatus} onChange={setFStatus} options={statusOptions} placeholder="All statuses" /></td>
                  <td className="sticky right-0 z-10 bg-slate-50 px-3 pb-2 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center">
                      <span className="inline-flex items-center gap-2 text-sm text-slate-400">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
                        Loading users…
                      </span>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">No users match the current filters.</td>
                  </tr>
                ) : filtered.map((u) => (
                  <UserRow
                    key={u.userId}
                    user={u}
                    onEdit={handleEditUser}
                    onDelete={handleDeleteUser}
                    onReset={handleResetUser}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-1">
            <Pagination
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              loading={loading}
            />
          </div>
      </div>

      {/* ── Form modal ── */}
      <UserFormModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        initial={editing || null}
        roles={roles}
        capabilities={capabilities}
        departments={departments}
        designations={designations}
        onSaved={handleSaved}
      />

      {/* ── Delete confirmation ── */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete User" maxWidth="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to permanently delete{' '}
            <span className="font-semibold text-slate-800">{deleting?.fullName}</span>?
            This action cannot be undone.
          </p>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button onClick={() => setDeleting(null)}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm
                         font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto">
              Cancel
            </button>
            <button onClick={handleDelete} disabled={deleteLoading}
              className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white
                         shadow-sm transition hover:bg-red-700 disabled:opacity-60 sm:w-auto">
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Reset password confirmation ── */}
      <Modal open={!!resetting} onClose={() => setResetting(null)} title="Reset Password" maxWidth="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            This will reset the password for{' '}
            <span className="font-semibold text-slate-800">{resetting?.fullName}</span>{' '}
            back to the default{' '}
            <span className="font-mono font-semibold text-slate-800">medplus@123</span>.
          </p>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button onClick={() => setResetting(null)}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm
                         font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto">
              Cancel
            </button>
            <button onClick={handleResetPassword} disabled={resetLoading}
              className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white
                         shadow-sm transition hover:bg-amber-700 disabled:opacity-60 sm:w-auto">
              {resetLoading ? 'Resetting…' : 'Reset Password'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

const UserRow = memo(function UserRow({ user: u, onEdit, onDelete, onReset }) {
  return (
    <tr className="hover:bg-slate-50/60 transition">
      <td className="px-3 py-2.5 text-slate-500 font-mono text-xs">{u.userId}</td>
      <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">{u.fullName}</td>
      <td className="px-3 py-2.5 text-slate-500 text-xs">{u.email}</td>
      <td className="px-3 py-2.5">
        <OverflowPillList items={u.roles ? u.roles.map(r => r.roleName) : []} maxVisible={2} color="brand" />
      </td>
      <td className="px-3 py-2.5">
        <OverflowPillList items={u.capabilityNames ?? []} maxVisible={2} color="brand" />
      </td>
      <td className="px-3 py-2.5">
        <OverflowPillList items={u.teamMemberNames ?? []} maxVisible={2} color="brand" />
      </td>
      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{u.designationName || '—'}</td>
      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{u.departmentName || '—'}</td>
      <td className="px-3 py-2.5 text-slate-500 capitalize">
        {u.skillLevel ? u.skillLevel.charAt(0) + u.skillLevel.slice(1).toLowerCase() : '—'}
      </td>
      <td className="px-3 py-2.5 text-center text-slate-600">{u.currentActiveTasks ?? 0}</td>
      <td className="px-3 py-2.5"><StatusBadge status={u.status} /></td>
      <td className="sticky right-0 z-10 bg-white px-3 py-2.5 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-end gap-1.5">
          <button onClick={() => onEdit(u)} title="Edit user"
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-brand-50 hover:text-brand-700">
            <Icon name="edit" className="h-4 w-4" />
          </button>
          <button onClick={() => onReset(u)} title="Reset password to default"
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-amber-50 hover:text-amber-600">
            <Icon name="lock" className="h-4 w-4" />
          </button>
          <button onClick={() => onDelete(u)} title="Delete user"
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600">
            <Icon name="trash" className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  )
})
