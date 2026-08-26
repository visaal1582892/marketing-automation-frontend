import { useEffect, useState, useMemo } from 'react'
import { eventCategoryApi, masterApi } from '../../api/masterData'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import { useToast } from '../../components/Toast'
import BackToMaster from '../../components/admin/BackToMaster'
import MultiSelectDropdown from '../../components/MultiSelectDropdown'
import AppSelect from '../../components/AppSelect'
import { TableStatusRow } from '../../components/dataTable'

export default function EventCategoryMasterPage() {
  const toast = useToast()
  
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  
  // To fetch business verticals for the dropdown
  const [verticals, setVerticals] = useState([])

  const loadData = async () => {
    setLoading(true)
    try {
      const [cats, verts] = await Promise.all([
        eventCategoryApi.list(),
        masterApi.list('business-verticals')
      ])
      setRows(cats || [])
      setVerticals(verts || [])
    } catch (e) {
      toast.error('Failed to load event categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSave = async (form) => {
    try {
      if (form.id) {
        await eventCategoryApi.update(form.id, form)
        toast.success('Event Category updated')
      } else {
        await eventCategoryApi.create(form)
        toast.success('Event Category created')
      }
      setEditing(null)
      loadData()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Save failed')
    }
  }

  const verticalOptions = useMemo(() => {
    return verticals.map(v => ({ id: v.id, name: v.name }))
  }, [verticals])

  const getVerticalNames = (ids) => {
    if (!ids || ids.length === 0) return 'None'
    return ids.map(id => verticals.find(v => v.id === id)?.name || id).join(', ')
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <BackToMaster />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Icon name="list" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-900">Event Categories</h1>
            <p className="text-xs text-slate-500">{rows.length} records</p>
          </div>
        </div>
        <button
          onClick={() => setEditing({ name: '', isActive: true, businessVerticalIds: [] })}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98]"
        >
          <Icon name="plus" className="h-4 w-4" />
          Add new
        </button>
      </header>

      <section className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Mapped Verticals</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <TableStatusRow colSpan={5} className="py-12">Loading…</TableStatusRow>
              ) : rows.length === 0 ? (
                <TableStatusRow colSpan={5} className="py-12">No records found.</TableStatusRow>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{row.id}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{row.name}</td>
                    <td className="px-4 py-2.5 text-slate-600 truncate max-w-xs">{getVerticalNames(row.businessVerticalIds)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${row.isActive ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-200' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'}`}>
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => setEditing(row)} className="text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-md p-1.5 transition">
                        <Icon name="pencil" className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <EventCategoryFormModal
        open={editing !== null}
        initial={editing}
        onClose={() => setEditing(null)}
        onSave={handleSave}
        verticalOptions={verticalOptions}
      />
    </div>
  )
}

function EventCategoryFormModal({ open, initial, onClose, onSave, verticalOptions }) {
  const isEdit = Boolean(initial?.id)
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [businessVerticalIds, setBusinessVerticalIds] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setIsActive(initial?.isActive ?? true)
      setBusinessVerticalIds(initial?.businessVerticalIds ?? [])
      setSubmitting(false)
    }
  }, [open, initial])

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    await onSave({ id: initial?.id, name: name.trim(), isActive, businessVerticalIds })
    setSubmitting(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${isEdit ? 'Edit' : 'New'} Event Category`}
      footer={
        <>
          <button onClick={onClose} className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
          <button onClick={submit} disabled={submitting || !name.trim()} className="rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60">
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Category Name</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Mapped Verticals</label>
          <MultiSelectDropdown
            options={verticalOptions}
            value={businessVerticalIds}
            onChange={setBusinessVerticalIds}
            placeholder="Select verticals..."
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
          <AppSelect
            value={isActive ? 'ACTIVE' : 'INACTIVE'}
            onChange={v => setIsActive(v === 'ACTIVE')}
            options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]}
            isClearable={false}
            menuPortal
          />
        </div>
      </form>
    </Modal>
  )
}
