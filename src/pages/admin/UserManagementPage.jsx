import { useEffect, useMemo, useState } from 'react'
import api from '../../api/client'
import { masterApi } from '../../api/masterData'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import { useToast } from '../../components/Toast'

const BASE = '/admin/users'
const SKILL_LEVELS = ['JUNIOR', 'SENIOR']

// ─── API helpers (uses the authenticated api client) ─────────────────────────
const usersApi = {
  list:   ()         => api.get(BASE, { params: { includeInactive: true } }).then(r => r.data),
  create: (data)     => api.post(BASE, data).then(r => r.data),
  update: (id, data) => api.put(`${BASE}/${id}`, data).then(r => r.data),
  delete: (id)       => api.delete(`${BASE}/${id}`),
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

// ─── Password reveal cell ─────────────────────────────────────────────────────
function PasswordCell({ value }) {
  const [show, setShow] = useState(false)
  if (!value) return <span className="text-slate-300 italic text-xs">—</span>
  return (
    <span className="flex items-center gap-1.5">
      <span className="font-mono text-xs text-slate-700">
        {show ? value : '••••••••'}
      </span>
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="text-slate-400 hover:text-brand-600 transition"
        title={show ? 'Hide password' : 'Show password'}
      >
        <Icon name={show ? 'eyeOff' : 'eye'} className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}

// ─── Form modal ───────────────────────────────────────────────────────────────
function UserFormModal({ open, onClose, initial, roles, departments, onSaved }) {
  const toast = useToast()
  const isEdit = !!initial?.userId

  const blank = {
    fullName: '', email: '', password: '',
    roleId: '', departmentId: '',
    skillLevel: 'JUNIOR', status: 'ACTIVE',
  }
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          fullName: initial.fullName || '',
          email: initial.email || '',
          password: '',
          roleId: initial.roleId || '',
          departmentId: initial.departmentId || '',
          skillLevel: initial.skillLevel || 'JUNIOR',
          status: initial.status || 'ACTIVE',
        })
      } else {
        setForm(blank)
      }
      setShowPwd(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isEdit && !form.password) {
      toast.error('Password is required when creating a user.')
      return
    }
    setSaving(true)
    try {
      const payload = { ...form }
      if (!payload.password) delete payload.password
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Full Name */}
          <div className="sm:col-span-1">
            <label className={labelCls}>Full Name *</label>
            <input
              required
              className={inputCls}
              value={form.fullName}
              onChange={e => set('fullName', e.target.value)}
              placeholder="e.g. Priya Sharma"
            />
          </div>

          {/* Email */}
          <div className="sm:col-span-1">
            <label className={labelCls}>Email *</label>
            <input
              required
              type="email"
              className={inputCls}
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="priya@medplus.com"
            />
          </div>

          {/* Password */}
          <div className="sm:col-span-1">
            <label className={labelCls}>
              Password {isEdit ? '(leave blank to keep current)' : '*'}
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                required={!isEdit}
                className={`${inputCls} pr-10`}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder={isEdit ? '••••••••' : 'Set a password'}
              />
              <button
                type="button"
                onClick={() => setShowPwd(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-600"
              >
                <Icon name={showPwd ? 'eyeOff' : 'eye'} className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Role */}
          <div className="sm:col-span-1">
            <label className={labelCls}>Role</label>
            <select
              className={inputCls}
              value={form.roleId}
              onChange={e => set('roleId', e.target.value)}
            >
              <option value="">— Select role —</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div className="sm:col-span-1">
            <label className={labelCls}>Department</label>
            <select
              className={inputCls}
              value={form.departmentId}
              onChange={e => set('departmentId', e.target.value)}
            >
              <option value="">— Select department —</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Skill Level */}
          <div className="sm:col-span-1">
            <label className={labelCls}>Skill Level</label>
            <select
              className={inputCls}
              value={form.skillLevel}
              onChange={e => set('skillLevel', e.target.value)}
            >
              {SKILL_LEVELS.map(s => (
                <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>

          {/* Status (edit only) */}
          {isEdit && (
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Status</label>
              <select
                className={inputCls}
                value={form.status}
                onChange={e => set('status', e.target.value)}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 pt-2 border-t border-slate-100 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium
                       text-slate-700 transition hover:bg-slate-50 sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white
                       shadow-sm transition hover:bg-brand-700 disabled:opacity-60 sm:w-auto"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Column filter input ──────────────────────────────────────────────────────
function ColInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs
                 text-slate-700 placeholder-slate-400 outline-none focus:border-brand-400
                 focus:bg-white focus:ring-1 focus:ring-brand-100 transition"
    />
  )
}

function ColSelect({ value, onChange, options, placeholder }) {
  return (
    <div className="relative mt-1">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none rounded border border-slate-200 bg-slate-50
                   pl-2 pr-6 py-1 text-xs text-slate-700 outline-none
                   focus:border-brand-400 focus:bg-white focus:ring-1 focus:ring-brand-100 transition"
      >
        <option value="all">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function UserManagementPage() {
  const toast = useToast()

  const [users, setUsers]             = useState([])
  const [roles, setRoles]             = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [editing, setEditing]         = useState(null)   // null = closed, false = new, obj = edit
  const [deleting, setDeleting]       = useState(null)   // user to confirm delete
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Column-level filters
  const [fName,   setFName]   = useState('')
  const [fEmail,  setFEmail]  = useState('')
  const [fRole,   setFRole]   = useState('all')
  const [fDept,   setFDept]   = useState('all')
  const [fSkill,  setFSkill]  = useState('all')
  const [fStatus, setFStatus] = useState('all')

  useEffect(() => {
    Promise.all([
      usersApi.list(),
      masterApi.list('roles', false),
      masterApi.list('departments', false),
    ])
      .then(([u, r, d]) => {
        setUsers(u)
        setRoles(r.map(x => ({ id: x.id, name: x.name })))
        setDepartments(d.map(x => ({ id: x.id, name: x.name })))
      })
      .catch(() => toast.error('Failed to load data.'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSaved = (saved) => {
    setUsers(curr => {
      const i = curr.findIndex(u => u.userId === saved.userId)
      if (i === -1) return [...curr, saved]
      const next = [...curr]
      next[i] = saved
      return next
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
    } catch {
      toast.error('Delete failed.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const roleOptions = useMemo(() =>
    [...new Map(users.map(u => [u.roleId, u.roleName])).entries()]
      .filter(([id]) => id)
      .map(([id, name]) => ({ value: id, label: name })),
  [users])

  const deptOptions = useMemo(() =>
    [...new Map(users.map(u => [u.departmentId, u.departmentName])).entries()]
      .filter(([id]) => id)
      .map(([id, name]) => ({ value: id, label: name })),
  [users])

  const skillOptions = SKILL_LEVELS.map(s => ({
    value: s,
    label: s.charAt(0) + s.slice(1).toLowerCase(),
  }))

  const statusOptions = [
    { value: 'ACTIVE',   label: 'Active'   },
    { value: 'INACTIVE', label: 'Inactive' },
  ]

  const filtered = useMemo(() => users.filter(u => {
    if (fStatus !== 'all' && u.status !== fStatus) return false
    if (fRole   !== 'all' && u.roleId !== fRole)   return false
    if (fDept   !== 'all' && u.departmentId !== fDept) return false
    if (fSkill  !== 'all' && u.skillLevel !== fSkill) return false
    if (fName  && !u.fullName?.toLowerCase().includes(fName.toLowerCase()))  return false
    if (fEmail && !u.email?.toLowerCase().includes(fEmail.toLowerCase()))    return false
    return true
  }), [users, fStatus, fRole, fDept, fSkill, fName, fEmail])

  const hasFilter = fName || fEmail || fRole !== 'all' || fDept !== 'all' || fSkill !== 'all' || fStatus !== 'all'
  const clearFilters = () => { setFName(''); setFEmail(''); setFRole('all'); setFDept('all'); setFSkill('all'); setFStatus('all') }

  // shared th style
  const th = 'px-3 pt-3 pb-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 align-top'

  return (
    <div className="space-y-3">
      {/* ── Add button row ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">
            {filtered.length} of {users.length} user{users.length !== 1 ? 's' : ''}
          </span>
          {hasFilter && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1
                         text-xs text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              <Icon name="x" className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>
        <button
          onClick={() => setEditing(false)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm
                     font-medium text-white shadow-sm transition hover:bg-brand-700 sm:w-auto"
        >
          <Icon name="plus" className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm text-slate-400">
            Loading users…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                {/* ── Column labels ── */}
                <tr>
                  <th className="px-3 pt-3 pb-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-8">#</th>
                  <th className={th}>Name</th>
                  <th className={th}>Email</th>
                  <th className={th}>Role</th>
                  <th className={th}>Department</th>
                  <th className={th}>Password</th>
                  <th className={th}>Skill</th>
                  <th className="px-3 pt-3 pb-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Active Tasks</th>
                  <th className={th}>Status</th>
                  <th className="px-3 pt-3 pb-1 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
                {/* ── Column filters ── */}
                <tr className="border-t border-slate-100">
                  <td className="px-3 pb-2" />
                  <td className="px-3 pb-2">
                    <ColInput value={fName}  onChange={setFName}  placeholder="Filter name…" />
                  </td>
                  <td className="px-3 pb-2">
                    <ColInput value={fEmail} onChange={setFEmail} placeholder="Filter email…" />
                  </td>
                  <td className="px-3 pb-2">
                    <ColSelect value={fRole} onChange={setFRole} options={roleOptions} placeholder="All roles" />
                  </td>
                  <td className="px-3 pb-2">
                    <ColSelect value={fDept} onChange={setFDept} options={deptOptions} placeholder="All depts" />
                  </td>
                  <td className="px-3 pb-2" />
                  <td className="px-3 pb-2">
                    <ColSelect value={fSkill} onChange={setFSkill} options={skillOptions} placeholder="All skills" />
                  </td>
                  <td className="px-3 pb-2" />
                  <td className="px-3 pb-2">
                    <ColSelect value={fStatus} onChange={setFStatus} options={statusOptions} placeholder="All statuses" />
                  </td>
                  <td className="px-3 pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      No users match the current filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((u, idx) => (
                    <tr key={u.userId} className="hover:bg-slate-50/60 transition">
                      <td className="px-3 py-2.5 text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">{u.fullName}</td>
                      <td className="px-3 py-2.5 text-slate-500 text-xs">{u.email}</td>
                      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{u.roleName || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{u.departmentName || '—'}</td>
                      <td className="px-3 py-2.5">
                        <PasswordCell value={u.plainPassword} />
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 capitalize">
                        {u.skillLevel ? u.skillLevel.charAt(0) + u.skillLevel.slice(1).toLowerCase() : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-600">
                        {u.currentActiveTasks ?? 0}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditing(u)}
                            className="rounded-md p-1.5 text-slate-500 transition hover:bg-brand-50 hover:text-brand-700"
                            title="Edit user"
                          >
                            <Icon name="edit" className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleting(u)}
                            className="rounded-md p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                            title="Delete user"
                          >
                            <Icon name="trash" className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
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
        onSaved={handleSaved}
      />

      {/* ── Delete confirmation modal ── */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete User"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to permanently delete{' '}
            <span className="font-semibold text-slate-800">{deleting?.fullName}</span>?
            This action cannot be undone.
          </p>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              onClick={() => setDeleting(null)}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm
                         font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white
                         shadow-sm transition hover:bg-red-700 disabled:opacity-60 sm:w-auto"
            >
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
