import { useEffect, useMemo, useState } from 'react'
import api from '../../api/client'
import { masterApi } from '../../api/masterData'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import { useToast } from '../../components/Toast'

const BASE = '/admin/users'
const SKILL_LEVELS = ['JUNIOR', 'SENIOR']

// ─── API helpers ──────────────────────────────────────────────────────────────
const usersApi = {
  list:          ()         => api.get(BASE, { params: { includeInactive: true } }).then(r => r.data),
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

// ─── Role multi-select chip picker ───────────────────────────────────────────
function RoleChipPicker({ roles, selectedIds, onChange }) {
  const toggle = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(r => r !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }
  return (
    <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2 min-h-[40px]">
      {roles.length === 0 && (
        <span className="text-xs text-slate-400 self-center">No roles configured</span>
      )}
      {roles.map(r => {
        const active = selectedIds.includes(r.id)
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => toggle(r.id)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition border
              ${active
                ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-300 hover:border-brand-400 hover:text-brand-700'
              }`}
          >
            {r.name}
          </button>
        )
      })}
    </div>
  )
}

// ─── Form modal ───────────────────────────────────────────────────────────────
function UserFormModal({ open, onClose, initial, roles, departments, designations, onSaved }) {
  const toast  = useToast()
  const isEdit = !!initial?.userId

  const blank = {
    fullName: '', email: '',
    departmentId: '', designationId: '', roleIds: [],
    skillLevel: 'JUNIOR', status: 'ACTIVE',
  }
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        fullName:      initial.fullName      || '',
        email:         initial.email         || '',
        departmentId:  initial.departmentId  || '',
        designationId: initial.designationId || '',
        roleIds:       initial.roleIds       || [],
        skillLevel:    initial.skillLevel    || 'JUNIOR',
        status:        initial.status        || 'ACTIVE',
      } : blank)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const saved = isEdit
        ? await usersApi.update(initial.userId, form)
        : await usersApi.create(form)
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
            <select className={inputCls} value={form.departmentId} onChange={e => set('departmentId', e.target.value)}>
              <option value="">— Select department —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Designation */}
          <div>
            <label className={labelCls}>Designation</label>
            <select className={inputCls} value={form.designationId} onChange={e => set('designationId', e.target.value)}>
              <option value="">— Select designation —</option>
              {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Skill Level */}
          <div>
            <label className={labelCls}>Skill Level</label>
            <select className={inputCls} value={form.skillLevel} onChange={e => set('skillLevel', e.target.value)}>
              {SKILL_LEVELS.map(s => (
                <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>

          {/* Status (edit only) */}
          {isEdit && (
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          )}
        </div>

        {/* Roles — multi-select chips (spans full width) */}
        <div>
          <label className={labelCls}>
            Roles <span className="text-slate-400 font-normal">(select one or more)</span>
          </label>
          <RoleChipPicker
            roles={roles}
            selectedIds={form.roleIds}
            onChange={ids => set('roleIds', ids)}
          />
          {form.roleIds.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">At least one role is recommended for proper access.</p>
          )}
        </div>

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
    <div className="relative mt-1">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full appearance-none rounded border border-slate-200 bg-slate-50
                   pl-2 pr-6 py-1 text-xs text-slate-700 outline-none
                   focus:border-brand-400 focus:bg-white focus:ring-1 focus:ring-brand-100 transition">
        <option value="all">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function UserManagementPage() {
  const toast = useToast()

  const [users, setUsers]               = useState([])
  const [roles, setRoles]               = useState([])
  const [departments, setDepartments]   = useState([])
  const [designations, setDesignations] = useState([])
  const [loading, setLoading]           = useState(true)

  const [editing, setEditing]             = useState(null)
  const [deleting, setDeleting]           = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [resetting, setResetting]         = useState(null)
  const [resetLoading, setResetLoading]   = useState(false)

  // Column filters
  const [fName,        setFName]        = useState('')
  const [fEmail,       setFEmail]       = useState('')
  const [fDept,        setFDept]        = useState('all')
  const [fDesignation, setFDesignation] = useState('all')
  const [fSkill,       setFSkill]       = useState('all')
  const [fStatus,      setFStatus]      = useState('all')

  useEffect(() => {
    Promise.all([
      usersApi.list(),
      masterApi.list('roles', false),
      masterApi.list('departments', false),
      masterApi.list('designations', false),
    ])
      .then(([u, r, d, dsg]) => {
        setUsers(u)
        setRoles(r.map(x => ({ id: x.id, name: x.name })))
        setDepartments(d.map(x => ({ id: x.id, name: x.name })))
        setDesignations(dsg.map(x => ({ id: x.id, name: x.name })))
      })
      .catch(() => toast.error('Failed to load data.'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSaved = (saved) => {
    setUsers(curr => {
      const i = curr.findIndex(u => u.userId === saved.userId)
      if (i === -1) return [...curr, saved]
      const next = [...curr]; next[i] = saved; return next
    })
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await usersApi.delete(deleting.userId)
      setUsers(curr => curr.filter(u => u.userId !== deleting.userId))
      toast.success(`User "${deleting.fullName}" deleted.`)
      setDeleting(null)
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

  const deptOptions = useMemo(() =>
    [...new Map(users.map(u => [u.departmentId, u.departmentName])).entries()]
      .filter(([id]) => id).map(([id, name]) => ({ value: id, label: name })),
  [users])

  const designationOptions = useMemo(() =>
    [...new Map(users.map(u => [u.designationId, u.designationName])).entries()]
      .filter(([id]) => id).map(([id, name]) => ({ value: id, label: name })),
  [users])

  const skillOptions  = SKILL_LEVELS.map(s => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))
  const statusOptions = [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]

  const filtered = useMemo(() => users.filter(u => {
    if (fStatus      !== 'all' && u.status          !== fStatus)      return false
    if (fDept        !== 'all' && u.departmentId    !== fDept)        return false
    if (fDesignation !== 'all' && u.designationId   !== fDesignation) return false
    if (fSkill       !== 'all' && u.skillLevel      !== fSkill)       return false
    if (fName  && !u.fullName?.toLowerCase().includes(fName.toLowerCase()))  return false
    if (fEmail && !u.email?.toLowerCase().includes(fEmail.toLowerCase()))    return false
    return true
  }), [users, fStatus, fDept, fDesignation, fSkill, fName, fEmail])

  const hasFilter = fName || fEmail || fDept !== 'all' || fDesignation !== 'all' || fSkill !== 'all' || fStatus !== 'all'
  const clearFilters = () => {
    setFName(''); setFEmail('')
    setFDept('all'); setFDesignation('all'); setFSkill('all'); setFStatus('all')
  }

  const th = 'px-3 pt-3 pb-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 align-top'

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">
            {filtered.length} of {users.length} user{users.length !== 1 ? 's' : ''}
          </span>
          {hasFilter && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1
                         text-xs text-slate-500 transition hover:bg-slate-50 hover:text-slate-700">
              <Icon name="x" className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>
        <button onClick={() => setEditing(false)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5
                     text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 sm:w-auto">
          <Icon name="plus" className="h-4 w-4" /> Add User
        </button>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm text-slate-400">Loading users…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-3 pt-3 pb-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-8">#</th>
                  <th className={th}>Name</th>
                  <th className={th}>Email</th>
                  <th className={th}>Roles</th>
                  <th className={th}>Designation</th>
                  <th className={th}>Department</th>
                  <th className={th}>Skill</th>
                  <th className="px-3 pt-3 pb-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Active Tasks</th>
                  <th className={th}>Status</th>
                  <th className="px-3 pt-3 pb-1 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-3 pb-2" />
                  <td className="px-3 pb-2"><ColInput value={fName}  onChange={setFName}  placeholder="Filter name…" /></td>
                  <td className="px-3 pb-2"><ColInput value={fEmail} onChange={setFEmail} placeholder="Filter email…" /></td>
                  <td className="px-3 pb-2" />
                  <td className="px-3 pb-2"><ColSelect value={fDesignation} onChange={setFDesignation} options={designationOptions} placeholder="All designations" /></td>
                  <td className="px-3 pb-2"><ColSelect value={fDept}        onChange={setFDept}        options={deptOptions}        placeholder="All depts" /></td>
                  <td className="px-3 pb-2"><ColSelect value={fSkill}       onChange={setFSkill}       options={skillOptions}       placeholder="All skills" /></td>
                  <td className="px-3 pb-2" />
                  <td className="px-3 pb-2"><ColSelect value={fStatus} onChange={setFStatus} options={statusOptions} placeholder="All statuses" /></td>
                  <td className="px-3 pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">No users match the current filters.</td>
                  </tr>
                ) : filtered.map((u, idx) => (
                  <tr key={u.userId} className="hover:bg-slate-50/60 transition">
                    <td className="px-3 py-2.5 text-slate-400 font-mono text-xs">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">{u.fullName}</td>
                    <td className="px-3 py-2.5 text-slate-500 text-xs">{u.email}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {(u.roleNames ?? []).length > 0
                          ? (u.roleNames).map(r => (
                              <span key={r} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-100">
                                {r}
                              </span>
                            ))
                          : <span className="text-slate-400 text-xs">—</span>
                        }
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{u.designationName || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{u.departmentName || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-500 capitalize">
                      {u.skillLevel ? u.skillLevel.charAt(0) + u.skillLevel.slice(1).toLowerCase() : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-600">{u.currentActiveTasks ?? 0}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={u.status} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setEditing(u)} title="Edit user"
                          className="rounded-md p-1.5 text-slate-500 transition hover:bg-brand-50 hover:text-brand-700">
                          <Icon name="edit" className="h-4 w-4" />
                        </button>
                        <button onClick={() => setResetting(u)} title="Reset password to default"
                          className="rounded-md p-1.5 text-slate-500 transition hover:bg-amber-50 hover:text-amber-600">
                          <Icon name="lock" className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleting(u)} title="Delete user"
                          className="rounded-md p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600">
                          <Icon name="trash" className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Form modal ── */}
      <UserFormModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        initial={editing || null}
        roles={roles}
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
