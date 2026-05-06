import { useEffect, useMemo, useState } from 'react'
import { granularTasksApi, masterApi } from '../../api/masterData'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import { useToast } from '../../components/Toast'
import AppSelect from '../../components/AppSelect'

export default function GranularTaskPage() {
  const toast = useToast()

  const [items, setItems]                 = useState([])
  const [taskTypes, setTaskTypes]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [editing, setEditing]             = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Column filters
  const [fId, setFId]               = useState('')
  const [fName, setFName]           = useState('')
  const [fTaskType, setFTaskType]   = useState('all')
  const [fCategory, setFCategory]   = useState('all')
  const [fStatus, setFStatus]       = useState('all')

  // Load task types for dropdown
  useEffect(() => {
    masterApi.list('task-types', false)
      .then((data) => setTaskTypes(data))
      .catch(() => {/* non-fatal */})
  }, [])

  // Load granular tasks
  useEffect(() => {
    let alive = true
    setLoading(true)
    granularTasksApi.list(false)
      .then((data) => { if (alive) setItems(data) })
      .catch((e) => { if (alive) toast.error(e?.response?.data?.message || 'Failed to load granular tasks') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------- helpers
  const isActive = (row) => row.status === 'ACTIVE'

  const upsertLocal = (row) =>
    setItems((curr) => {
      const i = curr.findIndex((x) => x.taskId === row.taskId)
      if (i === -1) return [...curr, row]
      const next = curr.slice()
      next[i] = row
      return next
    })

  const removeLocal = (taskId) =>
    setItems((curr) => curr.filter((x) => x.taskId !== taskId))

  // ---------------------------------------------------------------- handlers
  const handleSave = async (form) => {
    try {
      const payload = {
        taskId:       form.taskId || undefined,
        taskName:     form.taskName,
        taskTypeId:   form.taskTypeId,
        taskCategory: form.taskCategory || null,
        status:       form.isActive ? 'ACTIVE' : 'INACTIVE',
      }
      const saved = form.taskId
        ? await granularTasksApi.update(form.taskId, payload)
        : await granularTasksApi.create(payload)
      upsertLocal(saved)
      setEditing(null)
      toast.success(`Granular task ${form.taskId ? 'updated' : 'created'}`)
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Save failed')
    }
  }

  const handleDelete = async () => {
    const row = confirmDelete
    if (!row) return
    try {
      await granularTasksApi.remove(row.taskId)
      removeLocal(row.taskId)
      setConfirmDelete(null)
      toast.success(`${row.taskName} deleted`)
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Delete failed')
    }
  }

  // ---------------------------------------------------------------- filter
  const filtered = useMemo(() => items.filter((it) => {
    if (fId   && !String(it.taskId).toLowerCase().includes(fId.toLowerCase())) return false
    if (fName && !it.taskName.toLowerCase().includes(fName.toLowerCase())) return false
    if (fTaskType !== 'all' && it.taskTypeId !== fTaskType) return false
    if (fCategory !== 'all' && (it.taskCategory || '').toUpperCase() !== fCategory.toUpperCase()) return false
    if (fStatus !== 'all') {
      const want = fStatus === 'active'
      if (isActive(it) !== want) return false
    }
    return true
  }), [items, fId, fName, fTaskType, fCategory, fStatus])

  const counts = useMemo(() => ({
    total:    items.length,
    active:   items.filter(isActive).length,
    inactive: items.filter((i) => !isActive(i)).length,
  }), [items])

  const taskTypeOptions = useMemo(() =>
    [['all', 'All Types'], ...taskTypes.map((t) => [t.id, t.name])],
    [taskTypes]
  )

  // ---------------------------------------------------------------- render
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg
                           bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Icon name="list" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-900">
              Granular Tasks
            </h1>
            <p className="text-xs text-slate-500">
              {counts.total} record{counts.total === 1 ? '' : 's'} •{' '}
              <span className="text-accent-700">{counts.active} active</span> •{' '}
              <span className="text-slate-500">{counts.inactive} inactive</span>
            </p>
          </div>
        </div>
        <button
          onClick={() => setEditing({ taskName: '', taskTypeId: taskTypes[0]?.id ?? '', isActive: true })}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3.5 py-2
                     text-sm font-semibold text-white shadow-sm transition
                     hover:bg-brand-700 active:scale-[0.98]"
        >
          <Icon name="plus" className="h-4 w-4" />
          Add new
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
                <th className="w-36 px-4 py-2.5">Task ID</th>
                <th className="px-4 py-2.5">Task Name</th>
                <th className="w-40 px-4 py-2.5">Task Type</th>
                <th className="w-28 px-4 py-2.5">Category</th>
                <th className="w-28 px-4 py-2.5">Status</th>
                <th className="w-24 px-4 py-2.5 text-right">Actions</th>
              </tr>
              {/* Column filters */}
              <tr className="border-y border-slate-100 bg-slate-50/40">
                <th className="px-4 py-2">
                  <FilterInput value={fId} onChange={setFId} placeholder="TASK-…" />
                </th>
                <th className="px-4 py-2">
                  <FilterInput value={fName} onChange={setFName} placeholder="Search name" icon="search" />
                </th>
                <th className="px-4 py-2">
                  <FilterSelect value={fTaskType} onChange={setFTaskType} options={taskTypeOptions} />
                </th>
                <th className="px-4 py-2">
                  <FilterSelect value={fCategory} onChange={setFCategory}
                    options={[['all','All'],['DIGITAL','Digital'],['OFFLINE','Offline']]} />
                </th>
                <th className="px-4 py-2">
                  <FilterSelect value={fStatus} onChange={setFStatus}
                    options={[['all','All'],['active','Active'],['inactive','Inactive']]} />
                </th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="6" className="px-4 py-12 text-center text-slate-500">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="6" className="px-4 py-12 text-center text-slate-500">No matching records.</td></tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.taskId} className="transition hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{row.taskId}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{row.taskName}</td>
                    <td className="px-4 py-2.5">
                      {row.taskTypeName
                        ? <TypePill name={row.taskTypeName} />
                        : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.taskCategory
                        ? <CategoryPill category={row.taskCategory} />
                        : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5"><StatusPill active={isActive(row)} /></td>
                    <td className="px-4 py-2.5">
                      <RowActions
                        onEdit={() => setEditing({ ...row, isActive: isActive(row) })}
                        onDelete={() => setConfirmDelete(row)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="block divide-y divide-slate-100 sm:hidden">
          <div className="space-y-2 p-3">
            <FilterInput value={fName} onChange={setFName} placeholder="Search name" icon="search" />
            <div className="grid grid-cols-2 gap-2">
              <FilterSelect value={fTaskType} onChange={setFTaskType} options={taskTypeOptions} />
              <FilterSelect value={fStatus} onChange={setFStatus}
                options={[['all','All'],['active','Active'],['inactive','Inactive']]} />
            </div>
          </div>
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">No matching records.</div>
          ) : (
            filtered.map((row) => (
              <div key={row.taskId} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">{row.taskId}</span>
                    <span className="font-medium text-slate-800">{row.taskName}</span>
                  </div>
                  {row.taskTypeName && (
                    <div className="mt-1"><TypePill name={row.taskTypeName} /></div>
                  )}
                  <div className="mt-1.5">
                    <StatusPill active={isActive(row)} />
                  </div>
                </div>
                <RowActions
                  onEdit={() => setEditing({ ...row, isActive: isActive(row) })}
                  onDelete={() => setConfirmDelete(row)}
                />
              </div>
            ))
          )}
        </div>
      </section>

      <GranularTaskFormModal
        open={editing !== null}
        initial={editing}
        taskTypes={taskTypes}
        onClose={() => setEditing(null)}
        onSave={handleSave}
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
  return <AppSelect value={value} onChange={onChange} options={options} size="sm" isClearable={false} menuPortal />
}

function StatusPill({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium
                  ${active
                    ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-200'
                    : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-accent-500' : 'bg-slate-400'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function TypePill({ name }) {
  return (
    <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5
                     text-xs font-medium text-brand-700 ring-1 ring-brand-100">
      {name}
    </span>
  )
}

function CategoryPill({ category }) {
  const isDigital = category === 'DIGITAL'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1
      ${isDigital
        ? 'bg-sky-50 text-sky-700 ring-sky-200'
        : 'bg-orange-50 text-orange-700 ring-orange-200'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isDigital ? 'bg-sky-500' : 'bg-orange-500'}`} />
      {isDigital ? 'Digital' : 'Offline'}
    </span>
  )
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <button
        title="Edit"
        onClick={onEdit}
        className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <Icon name="pencil" className="h-4 w-4" />
      </button>
      <button
        title="Delete"
        onClick={onDelete}
        className="rounded-md p-1.5 text-slate-400 transition hover:bg-brand-50 hover:text-brand-700"
      >
        <Icon name="trash" className="h-4 w-4" />
      </button>
    </div>
  )
}

/* ---------- modals ---------- */

function GranularTaskFormModal({ open, initial, taskTypes, onClose, onSave }) {
  const isEdit = Boolean(initial?.taskId)
  const [taskName,     setTaskName]     = useState('')
  const [taskTypeId,   setTaskTypeId]   = useState('')
  const [taskCategory, setTaskCategory] = useState('')
  const [isActive,     setIsActive]     = useState(true)
  const [submitting,   setSubmitting]   = useState(false)

  useEffect(() => {
    if (open) {
      setTaskName(initial?.taskName ?? '')
      setTaskTypeId(initial?.taskTypeId ?? taskTypes[0]?.id ?? '')
      setTaskCategory(initial?.taskCategory ?? '')
      setIsActive(initial?.isActive ?? true)
      setSubmitting(false)
    }
  }, [open, initial, taskTypes])

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    if (!taskName.trim() || !taskTypeId) return
    setSubmitting(true)
    try {
      await onSave({ taskId: initial?.taskId, taskName: taskName.trim(), taskTypeId, taskCategory, isActive })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${isEdit ? 'Edit' : 'New'} Granular Task`}
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || !taskName.trim() || !taskTypeId}
            className="rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white
                       shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : (isEdit ? 'Save changes' : 'Create')}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3.5">
        {isEdit && (
          <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
            ID: <span className="font-mono text-slate-700">{initial.taskId}</span>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Task Name</label>
          <input
            autoFocus
            type="text"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            placeholder="e.g. Design Social Media Banner"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                       text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none
                       focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Task Type</label>
          <AppSelect
            value={taskTypeId ? String(taskTypeId) : ''}
            onChange={setTaskTypeId}
            options={taskTypes.map(t => ({ value: String(t.id), label: t.name }))}
            placeholder="— Select a task type —"
          />
          {taskTypes.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">
              No task types available. Add some in the Task Types master table first.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
          <AppSelect
            value={taskCategory}
            onChange={setTaskCategory}
            options={[{ value: 'DIGITAL', label: 'Digital' }, { value: 'OFFLINE', label: 'Offline' }]}
            placeholder="— Not specified —"
          />
          <p className="mt-1 text-xs text-slate-500">
            Indicates whether this task is digital or offline in nature.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
          <AppSelect
            value={isActive ? 'ACTIVE' : 'INACTIVE'}
            onChange={v => setIsActive(v === 'ACTIVE')}
            options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]}
            placeholder="Select status…"
            isClearable={false}
          />
          <p className="mt-1 text-xs text-slate-500">
            Inactive tasks are hidden from end-user dropdowns.
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
      title="Delete granular task?"
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white
                       shadow-sm transition hover:bg-brand-700"
          >
            Yes, delete
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        This will <strong>permanently delete</strong> <strong>{target?.taskName}</strong> ({target?.taskId}).
        This action cannot be undone.
      </p>
    </Modal>
  )
}
