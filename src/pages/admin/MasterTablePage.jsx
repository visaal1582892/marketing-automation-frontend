import { useCallback, useEffect, memo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { findResource, masterApi, MASTER_RESOURCES } from '../../api/masterData'
import useDebounce from '../../hooks/useDebounce'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import { useToast } from '../../components/Toast'
import AppSelect from '../../components/AppSelect'
import BackToMaster from '../../components/admin/BackToMaster'
import { TableStatusRow } from '../../components/dataTable'

/**
 * Single page rendering the table for one master resource.
 *  URL: /admin/master/:slug
 *  Server-side pagination, filtering, and sorting (newest first by ID).
 */
export default function MasterTablePage() {
  const { slug } = useParams()
  const resource = findResource(slug)
  const toast = useToast()

  const PAGE_SIZE = 20

  const [rows, setRows]                   = useState([])
  const [total, setTotal]                 = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [loading, setLoading]             = useState(true)
  const [editing, setEditing]             = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [page, setPage]                   = useState(0)
  const [refreshSeed, setRefreshSeed]     = useState(0)

  // Column filters
  const [fId, setFId]         = useState('')
  const [fName, setFName]     = useState('')
  const [fStatus, setFStatus] = useState('all')

  const dId   = useDebounce(fId,   400)
  const dName = useDebounce(fName, 400)

  // Reset filters and page when switching resource
  useEffect(() => {
    setFId(''); setFName(''); setFStatus('all'); setPage(0)
  }, [slug])

  // Reset to page 0 when debounced filters or status change
  useEffect(() => { setPage(0) }, [dId, dName, fStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // Server-side fetch
  useEffect(() => {
    if (!resource) return
    let alive = true
    setLoading(true)
    masterApi.listPaged(slug, {
      id:     dId     || undefined,
      name:   dName   || undefined,
      status: fStatus !== 'all' ? fStatus.toUpperCase() : 'all',
      page,
      size: PAGE_SIZE,
    })
      .then((res) => {
        if (!alive) return
        setRows(res.content ?? [])
        setTotal(res.totalElements ?? 0)
        setTotalPages(res.totalPages ?? 0)
      })
      .catch((e) => { if (alive) toast.error(e?.response?.data?.message || 'Failed to load records') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, dId, dName, fStatus, page, refreshSeed])

  if (!resource) return <Navigate to="/dashboard" replace />

  const refresh = () => setRefreshSeed((s) => s + 1)

  const handleSave = async (form) => {
    try {
      const payload = { name: form.name, status: form.isActive ? 'ACTIVE' : 'INACTIVE' }
      form.id
        ? await masterApi.update(slug, form.id, payload)
        : await masterApi.create(slug, payload)
      setEditing(null)
      toast.success(`${singular(resource)} ${form.id ? 'updated' : 'created'}`)
      refresh()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Save failed')
    }
  }

  const handleDelete = async () => {
    const row = confirmDelete
    if (!row) return
    try {
      await masterApi.remove(slug, row.id)
      setConfirmDelete(null)
      toast.success(`${row.name} deleted`)
      refresh()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Delete failed')
    }
  }

  const handleEditRow   = useCallback((row) => setEditing({ ...row, isActive: row.status === 'ACTIVE' }), [])
  const handleDeleteRow = useCallback((row) => setConfirmDelete(row), [])

  // ---------------------------------------------------------------- render
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <BackToMaster />
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg
                           bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Icon name={resource.icon} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-900">{resource.label}</h1>
            <p className="text-xs text-slate-500">{total} record{total === 1 ? '' : 's'} total</p>
          </div>
        </div>
        <button
          onClick={() => setEditing({ name: '', isActive: true })}
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
        {/* Desktop / tablet */}
        <div className="hidden w-full overflow-x-auto sm:block">
          <table className="w-full min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="bg-slate-50/70 text-left text-xs font-semibold uppercase
                              tracking-wider text-slate-500">
                <th className="w-36 px-4 py-2.5">ID</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="w-36 px-4 py-2.5">Status</th>
                <th className="w-28 px-4 py-2.5 text-right">Actions</th>
              </tr>
              <tr className="border-y border-slate-100 bg-slate-50/40">
                <th className="px-4 py-2">
                  <FilterInput value={fId} onChange={setFId} placeholder="Filter ID…" />
                </th>
                <th className="px-4 py-2">
                  <FilterInput value={fName} onChange={setFName} placeholder="Search name…" icon="search" />
                </th>
                <th className="px-4 py-2">
                  <FilterSelect value={fStatus} onChange={setFStatus}
                    options={[['all','All'],['active','Active'],['inactive','Inactive']]} />
                </th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <TableStatusRow colSpan={4} className="py-12">Loading…</TableStatusRow>
              ) : rows.length === 0 ? (
                <TableStatusRow colSpan={4} className="py-12">No matching records.</TableStatusRow>
              ) : (
                rows.map((row) => (
                  <MasterRow key={row.id} row={row} onEdit={handleEditRow} onDelete={handleDeleteRow} />
                ))
              )}
            </tbody>
          </table>
          <div className="border-t border-slate-100 px-4 py-1">
            <Pagination page={page} totalPages={totalPages} totalElements={total}
              pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </div>

        {/* Mobile */}
        <div className="block divide-y divide-slate-100 sm:hidden">
          <div className="space-y-2 p-3">
            <FilterInput value={fName} onChange={setFName} placeholder="Search name…" icon="search" />
            <div className="grid grid-cols-2 gap-2">
              <FilterInput value={fId} onChange={setFId} placeholder="Filter ID…" />
              <FilterSelect value={fStatus} onChange={setFStatus}
                options={[['all','All'],['active','Active'],['inactive','Inactive']]} />
            </div>
          </div>
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">No matching records.</div>
          ) : (
            rows.map((row) => (
              <MasterRow key={row.id} row={row} onEdit={handleEditRow} onDelete={handleDeleteRow} mobile />
            ))
          )}
          <div className="px-4 py-1">
            <Pagination page={page} totalPages={totalPages} totalElements={total}
              pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </div>
      </section>

      <MasterFormModal
        open={editing !== null}
        resource={resource}
        initial={editing}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />

      <ConfirmDeleteModal
        open={confirmDelete !== null}
        target={confirmDelete}
        resource={resource}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}

/* ---------------- helpers + sub-components ---------------- */

function singular(resource) {
  if (!resource) return 'Record'
  return resource.label.replace(/s$/, '')
}

const MasterRow = memo(function MasterRow({ row, onEdit, onDelete, mobile = false }) {
  const active = row.status === 'ACTIVE'
  if (mobile) {
    return (
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-500">{row.id}</span>
            <span className="font-medium text-slate-800">{row.name}</span>
          </div>
          <div className="mt-1.5">
            <StatusPill active={active} />
          </div>
        </div>
        <RowActions onEdit={() => onEdit(row)} onDelete={() => onDelete(row)} />
      </div>
    )
  }
  return (
    <tr className="transition hover:bg-slate-50/60">
      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{row.id}</td>
      <td className="px-4 py-2.5 font-medium text-slate-800">{row.name}</td>
      <td className="px-4 py-2.5"><StatusPill active={active} /></td>
      <td className="px-4 py-2.5">
        <RowActions onEdit={() => onEdit(row)} onDelete={() => onDelete(row)} />
      </td>
    </tr>
  )
})

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

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <IconButton title="Edit" onClick={onEdit}>
        <Icon name="pencil" className="h-4 w-4" />
      </IconButton>
      <IconButton title="Delete" tone="danger" onClick={onDelete}>
        <Icon name="trash" className="h-4 w-4" />
      </IconButton>
    </div>
  )
}

function IconButton({ children, onClick, title, tone = 'default' }) {
  const cls = tone === 'danger'
    ? 'text-slate-400 hover:bg-brand-50 hover:text-brand-700'
    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
  return (
    <button onClick={onClick} title={title} aria-label={title}
            className={`rounded-md p-1.5 transition ${cls}`}>
      {children}
    </button>
  )
}

/* ---------------- modals ---------------- */

function MasterFormModal({ open, resource, initial, onClose, onSave }) {
  const isEdit = Boolean(initial?.id)
  const [name, setName]             = useState('')
  const [isActive, setIsActive]     = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setIsActive(initial?.isActive ?? true)
      setSubmitting(false)
    }
  }, [open, initial])

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    try {
      await onSave({ id: initial?.id, name: name.trim(), isActive })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${isEdit ? 'Edit' : 'New'} ${singular(resource)}`}
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
            disabled={submitting || !name.trim()}
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
            ID: <span className="font-mono text-slate-700">{initial.id}</span>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`e.g. ${exampleFor(resource?.slug)}`}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                       text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none
                       focus:ring-2 focus:ring-brand-100"
          />
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
            Inactive entries are hidden from end-user dropdowns.
          </p>
        </div>
      </form>
    </Modal>
  )
}

function ConfirmDeleteModal({ open, target, resource, onClose, onConfirm }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete record?"
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
        This will <strong>permanently delete</strong> <strong>{target?.name}</strong> ({target?.id}) from the
        list of <strong>{resource?.label}</strong>. This action cannot be undone.
      </p>
    </Modal>
  )
}

function exampleFor(slug) {
  switch (slug) {
    case 'departments':       return 'Sales Operations'
    case 'roles':             return 'Marketing Manager'
    case 'requirement-types': return 'Performance Marketing Campaign'
    case 'task-types':        return 'Design'
    case 'regions':           return 'South'
    case 'audiences':         return 'Doctors / Clinics'
    case 'platforms':         return 'Instagram'
    case 'creative-formats':  return 'Carousel'
    default:                  return 'New entry'
  }
}

/* Avoid unused-import warnings in environments that tree-shake by usage */
export const __resources = MASTER_RESOURCES
