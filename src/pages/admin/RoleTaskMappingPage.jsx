import { useEffect, useMemo, useState } from 'react'
import { masterApi, granularTasksApi, roleTaskApi } from '../../api/masterData'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import { useToast } from '../../components/Toast'
import AppSelect from '../../components/AppSelect'

export default function RoleTaskMappingPage() {
  const toast = useToast()
  const PAGE_SIZE = 20

  const [mappings, setMappings]           = useState([])
  const [roles, setRoles]                 = useState([])
  const [granularTasks, setGranularTasks] = useState([])
  const [loading, setLoading]             = useState(true)
  const [addOpen, setAddOpen]             = useState(false)
  const [editRow, setEditRow]             = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [page, setPage]                   = useState(0)

  // Column filters
  const [fRole,   setFRole]   = useState('all')
  const [fTask,   setFTask]   = useState('')
  const [fStatus, setFStatus] = useState('all')

  // Reset page on filter change
  useEffect(() => { setPage(0) }, [fRole, fTask, fStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load reference data and mappings
  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      roleTaskApi.list(),
      masterApi.list('roles', false),
      granularTasksApi.list(false),
    ])
      .then(([maps, roleList, taskList]) => {
        if (!alive) return
        setMappings(maps)
        setRoles(roleList)
        setGranularTasks(taskList)
      })
      .catch((e) => {
        if (alive) toast.error(e?.response?.data?.message || 'Failed to load data')
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------- handlers
  const handleAdd = async (roleId, taskId) => {
    const exists = mappings.some((m) => m.roleId === roleId && m.taskId === taskId)
    if (exists) { toast.error('This role → task mapping already exists.'); return }
    try {
      const saved = await roleTaskApi.create(roleId, taskId)
      setMappings((curr) => [...curr, saved])
      setAddOpen(false)
      toast.success('Mapping added')
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to add mapping')
    }
  }

  const handleEdit = async (mappingId, status) => {
    try {
      const updated = await roleTaskApi.update(mappingId, status)
      setMappings((curr) => curr.map((m) => m.mappingId === mappingId ? updated : m))
      setEditRow(null)
      toast.success('Mapping updated')
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Update failed')
    }
  }

  const handleDelete = async () => {
    const row = confirmDelete
    if (!row) return
    try {
      await roleTaskApi.remove(row.mappingId)
      setMappings((curr) => curr.filter((m) => m.mappingId !== row.mappingId))
      setConfirmDelete(null)
      toast.success('Mapping removed')
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Delete failed')
    }
  }

  // ---------------------------------------------------------------- filter
  const filtered = useMemo(() => mappings.filter((m) => {
    if (fRole !== 'all' && m.roleId !== fRole) return false
    if (fTask && !m.taskName?.toLowerCase().includes(fTask.toLowerCase())) return false
    if (fStatus !== 'all' && (m.status ?? 'ACTIVE') !== fStatus) return false
    return true
  }), [mappings, fRole, fTask, fStatus])

  const roleOptions = useMemo(() => {
    const seen = new Set()
    const opts = [['all', 'All Roles']]
    mappings.forEach((m) => {
      if (!seen.has(m.roleId)) {
        seen.add(m.roleId)
        opts.push([m.roleId, m.roleName || m.roleId])
      }
    })
    return opts
  }, [mappings])

  const paged = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  )
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  // ---------------------------------------------------------------- render
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg
                           bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Icon name="shield" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-900">
              Role → Task Mappings
            </h1>
            <p className="text-xs text-slate-500">
              {mappings.length} mapping{mappings.length === 1 ? '' : 's'} — defines which tasks
              each role can execute
            </p>
          </div>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3.5 py-2
                     text-sm font-semibold text-white shadow-sm transition
                     hover:bg-brand-700 active:scale-[0.98]"
        >
          <Icon name="plus" className="h-4 w-4" />
          Add mapping
        </button>
      </header>

      {/* Card with table */}
      <section className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200/70">
        {/* Desktop */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/70 text-left text-xs font-semibold uppercase
                              tracking-wider text-slate-500">
                <th className="w-20 px-4 py-2.5">ID</th>
                <th className="w-48 px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Granular Task</th>
                <th className="w-32 px-4 py-2.5">Status</th>
                <th className="w-24 px-4 py-2.5 text-right">Actions</th>
              </tr>
              {/* Filters */}
              <tr className="border-y border-slate-100 bg-slate-50/40">
                <th />
                <th className="px-4 py-2">
                  <FilterSelect value={fRole} onChange={setFRole} options={roleOptions} />
                </th>
                <th className="px-4 py-2">
                  <FilterInput value={fTask} onChange={setFTask} placeholder="Search task…" icon="search" />
                </th>
                <th className="px-4 py-2">
                  <FilterSelect
                    value={fStatus}
                    onChange={setFStatus}
                    options={[['all', 'All'], ['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']]}
                  />
                </th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="5" className="px-4 py-12 text-center text-slate-500">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-12 text-center text-slate-500">
                  {mappings.length === 0
                    ? 'No mappings yet. Click "Add mapping" to get started.'
                    : 'No matching records.'}
                </td></tr>
              ) : (
                paged.map((row) => (
                  <tr key={row.mappingId}
                      className={`transition hover:bg-slate-50/60 ${
                        (row.status ?? 'ACTIVE') === 'INACTIVE' ? 'opacity-60' : ''
                      }`}>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{row.mappingId}</td>
                    <td className="px-4 py-2.5">
                      <RolePill name={row.roleName || row.roleId} />
                    </td>
                    <td className="px-4 py-2.5 text-slate-800">
                      <span className="font-medium">{row.taskName || row.taskId}</span>
                      {row.taskId && (
                        <span className="ml-2 font-mono text-xs text-slate-400">{row.taskId}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={row.status ?? 'ACTIVE'} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          title="Edit mapping"
                          onClick={() => setEditRow(row)}
                          className="rounded-md p-1.5 text-slate-400 transition
                                     hover:bg-brand-50 hover:text-brand-700"
                        >
                          <Icon name="pencil" className="h-4 w-4" />
                        </button>
                        <button
                          title="Remove mapping"
                          onClick={() => setConfirmDelete(row)}
                          className="rounded-md p-1.5 text-slate-400 transition
                                     hover:bg-red-50 hover:text-red-600"
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
          <div className="border-t border-slate-100 px-4 py-1">
            <Pagination page={page} totalPages={totalPages} totalElements={filtered.length}
              pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </div>

        {/* Mobile */}
        <div className="block divide-y divide-slate-100 sm:hidden">
          <div className="space-y-2 p-3">
            <FilterSelect value={fRole} onChange={setFRole} options={roleOptions} />
            <FilterInput value={fTask} onChange={setFTask} placeholder="Search task…" icon="search" />
            <FilterSelect
              value={fStatus}
              onChange={setFStatus}
              options={[['all', 'All Statuses'], ['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']]}
            />
          </div>
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">
              {mappings.length === 0 ? 'No mappings yet.' : 'No matching records.'}
            </div>
          ) : (
            paged.map((row) => (
              <div key={row.mappingId}
                   className={`flex items-start justify-between gap-3 px-4 py-3 ${
                     (row.status ?? 'ACTIVE') === 'INACTIVE' ? 'opacity-60' : ''
                   }`}>
                <div className="min-w-0 space-y-1.5">
                  <RolePill name={row.roleName || row.roleId} />
                  <div className="text-sm font-medium text-slate-800">
                    {row.taskName || row.taskId}
                  </div>
                  <StatusPill status={row.status ?? 'ACTIVE'} />
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    title="Edit"
                    onClick={() => setEditRow(row)}
                    className="rounded-md p-1.5 text-slate-400 transition hover:bg-brand-50 hover:text-brand-700"
                  >
                    <Icon name="pencil" className="h-4 w-4" />
                  </button>
                  <button
                    title="Remove"
                    onClick={() => setConfirmDelete(row)}
                    className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
          <div className="px-4 py-1">
            <Pagination page={page} totalPages={totalPages} totalElements={filtered.length}
              pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </div>
      </section>

      <AddMappingModal
        open={addOpen}
        roles={roles}
        granularTasks={granularTasks}
        onClose={() => setAddOpen(false)}
        onSave={handleAdd}
      />

      <EditMappingModal
        row={editRow}
        onClose={() => setEditRow(null)}
        onSave={handleEdit}
      />

      <ConfirmDeleteModal
        open={confirmDelete !== null}
        target={confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}

/* ---------- sub-components ---------- */

function FilterInput({ value, onChange, placeholder, icon }) {
  return (
    <div className="relative">
      {icon && (
        <Icon name={icon}
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-md border border-slate-200 bg-white py-1.5
                    text-xs text-slate-700 shadow-sm placeholder:text-slate-400
                    focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100
                    ${icon ? 'pl-8 pr-2.5' : 'px-2.5'}`}
      />
    </div>
  )
}

function FilterSelect({ value, onChange, options }) {
  return <AppSelect value={value} onChange={onChange} options={options} size="sm" isClearable={false} isSearchable menuPortal />
}

function RolePill({ name }) {
  return (
    <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5
                     text-xs font-medium text-violet-700 ring-1 ring-violet-100">
      {name}
    </span>
  )
}

function StatusPill({ status }) {
  const active = status === 'ACTIVE'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1
      ${active
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
        : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

/* ---------- modals ---------- */

function AddMappingModal({ open, roles, granularTasks, onClose, onSave }) {
  const [roleId, setRoleId]           = useState('')
  const [taskId, setTaskId]           = useState('')
  const [submitting, setSubmitting]   = useState(false)

  const tasksByType = useMemo(() => {
    const groups = {}
    granularTasks.forEach((t) => {
      const key = t.taskTypeName || 'Other'
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
    })
    return groups
  }, [granularTasks])

  useEffect(() => {
    if (open) {
      setRoleId(roles[0]?.id ?? '')
      setTaskId(granularTasks[0]?.taskId ?? '')
      setSubmitting(false)
    }
  }, [open, roles, granularTasks])

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    if (!roleId || !taskId) return
    setSubmitting(true)
    try { await onSave(roleId, taskId) } finally { setSubmitting(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Role → Task Mapping"
      footer={
        <>
          <button onClick={onClose}
                  className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button onClick={submit} disabled={submitting || !roleId || !taskId}
                  className="rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white
                             shadow-sm transition hover:bg-brand-700 disabled:opacity-60">
            {submitting ? 'Adding…' : 'Add mapping'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
          <AppSelect
            value={roleId ? String(roleId) : ''}
            onChange={setRoleId}
            options={roles.map(r => ({ value: String(r.id), label: r.name }))}
            placeholder="— Select a role —"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Granular Task</label>
          <AppSelect
            value={taskId ? String(taskId) : ''}
            onChange={setTaskId}
            options={Object.entries(tasksByType).map(([typeName, tasks]) => ({
              label: typeName,
              options: tasks.map(t => ({ value: String(t.taskId), label: t.taskName })),
            }))}
            placeholder="— Select a task —"
          />
        </div>

        {roleId && taskId && (
          <div className="rounded-md border border-brand-100 bg-brand-50 px-3 py-2.5 text-xs text-brand-700">
            <strong className="font-semibold">Preview: </strong>
            {roles.find((r) => r.id === roleId)?.name ?? roleId}
            {' → '}
            {granularTasks.find((t) => t.taskId === taskId)?.taskName ?? taskId}
          </div>
        )}
      </form>
    </Modal>
  )
}

function EditMappingModal({ row, onClose, onSave }) {
  const [status, setStatus]         = useState('ACTIVE')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (row) {
      setStatus(row.status ?? 'ACTIVE')
      setSubmitting(false)
    }
  }, [row])

  if (!row) return null

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try { await onSave(row.mappingId, status) } finally { setSubmitting(false) }
  }

  return (
    <Modal
      open={!!row}
      onClose={onClose}
      title="Edit Mapping"
      footer={
        <>
          <button onClick={onClose}
                  className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button onClick={submit} disabled={submitting}
                  className="rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white
                             shadow-sm transition hover:bg-brand-700 disabled:opacity-60">
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {/* Read-only info */}
        <div className="rounded-md border border-slate-100 bg-slate-50 px-3.5 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">Role</span>
            <RolePill name={row.roleName || row.roleId} />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">Task</span>
            <span className="text-sm font-medium text-slate-800">
              {row.taskName || row.taskId}
              <span className="ml-1.5 font-mono text-xs text-slate-400">{row.taskId}</span>
            </span>
          </div>
        </div>

        {/* Editable: Status */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
          <AppSelect
            value={status}
            onChange={setStatus}
            options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]}
            placeholder="Select status…"
            isClearable={false}
          />
          <p className="mt-1 text-xs text-slate-500">
            Inactive mappings are hidden from routing but not deleted.
          </p>
        </div>
      </form>
    </Modal>
  )
}

function ConfirmDeleteModal({ open, target, onClose, onConfirm }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Remove mapping?"
      size="sm"
      footer={
        <>
          <button onClick={onClose}
                  className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button onClick={onConfirm}
                  className="rounded-md bg-red-600 px-3.5 py-2 text-sm font-semibold text-white
                             shadow-sm transition hover:bg-red-700">
            Yes, remove
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        This will permanently remove the mapping between{' '}
        <strong>{target?.roleName || target?.roleId}</strong> and{' '}
        <strong>{target?.taskName || target?.taskId}</strong>.
      </p>
    </Modal>
  )
}
