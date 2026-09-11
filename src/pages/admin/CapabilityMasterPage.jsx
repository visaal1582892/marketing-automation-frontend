import { useCallback, useEffect, useState } from 'react'
import { masterApi, capabilityTaskApi, granularTasksApi } from '../../api/masterData'
import useDebounce from '../../hooks/useDebounce'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import { useToast } from '../../components/Toast'
import AppSelect from '../../components/AppSelect'
import MultiSelectDropdown from '../../components/MultiSelectDropdown'
import OverflowPillList from '../../components/OverflowPillList'
import BackToMaster from '../../components/admin/BackToMaster'
import { TableStatusRow } from '../../components/dataTable'

export default function CapabilityMasterPage() {
  const toast = useToast()
  const PAGE_SIZE = 20

  const [capabilities, setCapabilities] = useState([])
  const [total, setTotal]               = useState(0)
  const [totalPages, setTotalPages]     = useState(0)
  const [loading, setLoading]           = useState(true)
  const [page, setPage]                 = useState(0)
  const [refreshSeed, setRefreshSeed]   = useState(0)

  // Mappings & all available granular tasks
  const [allMappings, setAllMappings]     = useState([])
  const [granularTasks, setGranularTasks] = useState([])

  // Filters
  const [fCode, setFCode]     = useState('')
  const [fName, setFName]     = useState('')
  const [fStatus, setFStatus] = useState('all')

  const dCode = useDebounce(fCode, 400)
  const dName = useDebounce(fName, 400)

  // Modal state
  const [editing, setEditing]             = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Reset page on filter changes
  useEffect(() => { setPage(0) }, [dCode, dName, fStatus])

  const refresh = () => setRefreshSeed(s => s + 1)

  // Load granular tasks once
  useEffect(() => {
    granularTasksApi.list(true)
      .then(tasks => setGranularTasks(tasks || []))
      .catch(() => {})
  }, [])

  // Load capabilities & all mappings
  useEffect(() => {
    let alive = true
    setLoading(true)

    Promise.all([
      masterApi.listPaged('capabilities', {
        id:     dCode   || undefined,
        name:   dName   || undefined,
        status: fStatus !== 'all' ? fStatus.toUpperCase() : 'all',
        page,
        size: PAGE_SIZE,
      }),
      capabilityTaskApi.list(),
    ])
      .then(([capRes, mapRes]) => {
        if (!alive) return
        setCapabilities(capRes.content ?? [])
        setTotal(capRes.totalElements ?? 0)
        setTotalPages(capRes.totalPages ?? 0)
        setAllMappings(mapRes || [])
      })
      .catch((e) => {
        if (alive) toast.error(e?.response?.data?.message || 'Failed to load capabilities')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => { alive = false }
  }, [dCode, dName, fStatus, page, refreshSeed, toast])

  const handleEdit = useCallback((cap) => {
    setEditing({
      id: cap.id,
      code: cap.code || '',
      name: cap.name || '',
      isActive: cap.status === 'ACTIVE',
    })
  }, [])

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await masterApi.remove('capabilities', confirmDelete.id)
      setConfirmDelete(null)
      toast.success(`Capability "${confirmDelete.name}" deactivated`)
      refresh()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Deactivation failed')
    }
  }

  const handleRestore = async (cap) => {
    try {
      await masterApi.restore('capabilities', cap.id)
      toast.success(`Capability "${cap.name}" reactivated`)
      refresh()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Reactivation failed')
    }
  }

  const handleSaveCapability = async ({ id, code, name, isActive, selectedTaskIds }) => {
    try {
      const payload = { code, name, status: isActive ? 'ACTIVE' : 'INACTIVE' }
      let targetCode = code

      if (id) {
        await masterApi.update('capabilities', id, payload)
      } else {
        const created = await masterApi.create('capabilities', payload)
        if (created?.code) targetCode = created.code
      }

      // Sync capability-task mappings
      const existingMappings = await capabilityTaskApi.listByCapability(targetCode)
      const existingTaskIds = new Set((existingMappings || []).map(m => m.taskId))
      const targetTaskIds   = new Set(selectedTaskIds || [])

      // Remove unselected mappings
      for (const m of existingMappings || []) {
        if (!targetTaskIds.has(m.taskId)) {
          await capabilityTaskApi.remove(m.mappingId)
        }
      }

      // Add newly selected mappings
      for (const taskId of selectedTaskIds || []) {
        if (!existingTaskIds.has(taskId)) {
          await capabilityTaskApi.create(targetCode, taskId)
        }
      }

      setEditing(null)
      toast.success(`Capability "${name}" saved successfully`)
      refresh()
    } catch (e) {
      throw e
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <BackToMaster />

      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Icon name="zap" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-900">Capabilities & Task Assignments</h1>
            <p className="text-xs text-slate-500">{total} capability record{total === 1 ? '' : 's'} total</p>
          </div>
        </div>
        <button
          onClick={() => setEditing({ code: '', name: '', isActive: true })}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98]"
        >
          <Icon name="plus" className="h-4 w-4" />
          Add Capability
        </button>
      </header>

      {/* Table Card */}
      <section className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="w-36 px-4 py-2.5">Code</th>
                <th className="w-48 px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Associated Tasks</th>
                <th className="w-28 px-4 py-2.5">Status</th>
                <th className="w-28 px-4 py-2.5 text-right">Actions</th>
              </tr>
              <tr className="border-y border-slate-100 bg-slate-50/40">
                <th className="px-4 py-2">
                  <FilterInput value={fCode} onChange={setFCode} placeholder="Filter Code…" />
                </th>
                <th className="px-4 py-2">
                  <FilterInput value={fName} onChange={setFName} placeholder="Search name…" icon="search" />
                </th>
                <th className="px-4 py-2" />
                <th className="px-4 py-2">
                  <FilterSelect
                    value={fStatus}
                    onChange={setFStatus}
                    options={[['all','All'],['active','Active'],['inactive','Inactive']]}
                  />
                </th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <TableStatusRow colSpan={5} className="py-12">Loading capabilities…</TableStatusRow>
              ) : capabilities.length === 0 ? (
                <TableStatusRow colSpan={5} className="py-12">No capabilities found.</TableStatusRow>
              ) : (
                capabilities.map((cap) => {
                  const capCode = cap.code || cap.id
                  const mappedTasks = allMappings.filter(m => (m.capabilityId === capCode || m.capabilityId === cap.id) && m.status === 'ACTIVE')
                  const taskNames = mappedTasks.map(m => m.taskName || m.taskId)
                  const active = cap.status === 'ACTIVE'

                  return (
                    <tr key={cap.id} className={`transition hover:bg-slate-50/60 ${!active ? 'bg-slate-50/50 opacity-75' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{capCode}</td>
                      <td className={`px-4 py-3 font-medium text-slate-900 ${!active ? 'line-through text-slate-400' : ''}`}>
                        {cap.name}
                      </td>
                      <td className="px-4 py-3">
                        <OverflowPillList items={taskNames} maxVisible={2} color="brand" />
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill active={active} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!active ? (
                            <button
                              type="button"
                              onClick={() => handleRestore(cap)}
                              className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                            >
                              <Icon name="arrow-path" className="h-3.5 w-3.5" />
                              Reactivate
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEdit(cap)}
                                title="Edit Capability & Associated Tasks"
                                className="inline-flex items-center gap-1 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                              >
                                <Icon name="pencil" className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setConfirmDelete(cap)}
                                title="Deactivate Capability"
                                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                              >
                                <Icon name="trash" className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 py-2">
          <Pagination page={page} totalPages={totalPages} totalElements={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </section>

      {/* Edit / Create Capability Modal */}
      {editing !== null && (
        <CapabilityModal
          open={editing !== null}
          initial={editing}
          allTasks={granularTasks}
          allMappings={allMappings}
          onClose={() => setEditing(null)}
          onSave={handleSaveCapability}
        />
      )}

      {/* Deactivate Confirmation Modal */}
      {confirmDelete !== null && (
        <Modal
          open={confirmDelete !== null}
          onClose={() => setConfirmDelete(null)}
          title="Deactivate Capability"
          footer={
            <>
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Deactivate
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-600">
            Are you sure you want to deactivate <span className="font-semibold text-slate-900">{confirmDelete.name}</span>?
          </p>
        </Modal>
      )}
    </div>
  )
}

/* ---------------- Sub-components ---------------- */

function FilterInput({ value, onChange, placeholder, icon }) {
  return (
    <div className="relative">
      {icon && (
        <Icon name={icon} className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-md border border-slate-200 bg-white py-1.5 text-xs text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 ${icon ? 'pl-8 pr-2.5' : 'px-2.5'}`}
      />
    </div>
  )
}

function FilterSelect({ value, onChange, options }) {
  return <AppSelect value={value} onChange={onChange} options={options} size="sm" isClearable={false} isSearchable menuPortal />
}

function StatusPill({ active }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function CapabilityModal({ open, initial, allTasks, allMappings, onClose, onSave }) {
  const isEdit = Boolean(initial?.id)
  const [name, setName]               = useState('')
  const [code, setCode]               = useState('')
  const [isActive, setIsActive]       = useState(true)
  const [selectedTaskIds, setSelectedTaskIds] = useState([])
  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setCode(initial?.code ?? '')
      setIsActive(initial?.isActive ?? true)
      setSubmitting(false)
      setSubmitError('')

      // Pre-populate mapped task IDs for this capability
      const capCode = initial?.code
      if (capCode) {
        const mapped = allMappings
          .filter(m => (m.capabilityId === capCode || m.capabilityId === initial?.id) && m.status === 'ACTIVE')
          .map(m => m.taskId)
        setSelectedTaskIds(mapped)
      } else {
        setSelectedTaskIds([])
      }
    }
  }, [open, initial, allMappings])

  if (!open) return null

  const handleNameChange = (e) => {
    const val = e.target.value
    setName(val)
    const derived = val.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    setCode(derived)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !code.trim()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await onSave({
        id: initial?.id,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        isActive,
        selectedTaskIds,
      })
    } catch (err) {
      setSubmitError(err?.response?.data?.message || 'Failed to save capability')
    } finally {
      setSubmitting(false)
    }
  }

  const taskOptions = allTasks.map(t => ({
    id: t.taskId,
    name: t.taskName || t.taskId,
    subtitle: t.taskId,
  }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${isEdit ? 'Edit' : 'New'} Capability`}
      footer={
        <>
          <button onClick={onClose} className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || !name.trim() || !code.trim()}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Capability')}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {submitError && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-600 ring-1 ring-red-200">
            {submitError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Capability Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. GRAPHIC_DESIGNER"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs font-mono font-semibold uppercase text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700">Capability Name</label>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. Graphic Designer"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Associated Granular Tasks Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Associated Granular Tasks <span className="text-slate-400 font-normal">(select one or more)</span>
          </label>
          <MultiSelectDropdown
            options={taskOptions}
            value={selectedTaskIds}
            onChange={ids => setSelectedTaskIds(ids)}
            placeholder="Search and select associated tasks..."
          />
        </div>
      </form>
    </Modal>
  )
}
