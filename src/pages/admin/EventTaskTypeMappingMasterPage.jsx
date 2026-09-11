import { useEffect, useState, useMemo } from 'react'
import { eventTaskTypeApi, masterApi, eventCategoryApi } from '../../api/masterData'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import { useToast } from '../../components/Toast'
import BackToMaster from '../../components/admin/BackToMaster'
import AppSelect from '../../components/AppSelect'
import SingleSelectDropdown from '../../components/SingleSelectDropdown'
import MultiSelectDropdown from '../../components/MultiSelectDropdown'
import OverflowPillList from '../../components/OverflowPillList'
import { TableStatusRow } from '../../components/dataTable'

export default function EventTaskTypeMappingMasterPage() {
  const toast = useToast()

  const [rows, setRows] = useState([])
  const [verticals, setVerticals] = useState([])
  const [taskTypes, setTaskTypes] = useState([])
  const [allCategories, setAllCategories] = useState([])
  const [loading, setLoading] = useState(true)

  // Column level filters using AppSelect search & select
  const [fVertical, setFVertical] = useState('')
  const [fCategory, setFCategory] = useState('')
  const [fTaskType, setFTaskType] = useState('')

  // Modal states
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [grouped, verts, ttList, cats] = await Promise.all([
        eventTaskTypeApi.listGroupedTasks(),
        masterApi.list('business-verticals'),
        masterApi.list('task-types'),
        eventCategoryApi.list(),
      ])
      setRows(grouped || [])
      setVerticals(verts || [])
      setTaskTypes(ttList || [])
      setAllCategories(cats || [])
    } catch {
      toast.error('Failed to load event & task mappings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSave = async (eventCategoryId, businessVerticalId, taskTypeIds) => {
    try {
      await eventTaskTypeApi.saveTasks(eventCategoryId, businessVerticalId, { taskTypeIds })
      toast.success('Event & task mappings saved successfully')
      setEditing(null)
      loadData()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to save mappings')
    }
  }

  const handleDelete = async (eventCategoryId, businessVerticalId) => {
    try {
      await eventTaskTypeApi.saveTasks(eventCategoryId, businessVerticalId, { taskTypeIds: [] })
      toast.success('Mapping deleted successfully')
      setDeleting(null)
      loadData()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to delete mapping')
    }
  }

  // Filter options for AppSelect
  const verticalFilterOptions = useMemo(() => {
    return verticals.map(v => ({ value: String(v.id), label: v.name }))
  }, [verticals])

  const categoryFilterOptions = useMemo(() => {
    return allCategories.map(c => ({ value: String(c.id), label: c.name }))
  }, [allCategories])

  const taskTypeFilterOptions = useMemo(() => {
    return taskTypes.map(t => ({
      value: String(t.id || t.taskTypeId),
      label: t.name || t.taskName,
    }))
  }, [taskTypes])

  // Filtered rows using AppSelect search & select filters
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (fVertical && String(r.businessVerticalId) !== String(fVertical) && r.businessVerticalName !== fVertical) {
        return false
      }
      if (fCategory && String(r.eventCategoryId) !== String(fCategory) && r.eventCategoryName !== fCategory) {
        return false
      }
      if (fTaskType) {
        const match = (r.tasks || []).some(t =>
          String(t.taskTypeId) === String(fTaskType) || String(t.taskName) === String(fTaskType)
        )
        if (!match) return false
      }
      return true
    })
  }, [rows, fVertical, fCategory, fTaskType])

  const hasActiveFilters = Boolean(fVertical || fCategory || fTaskType)

  const clearFilters = () => {
    setFVertical('')
    setFCategory('')
    setFTaskType('')
  }

  const taskTypeFormOptions = useMemo(() => {
    return taskTypes.map(t => ({
      value: String(t.id || t.taskTypeId),
      label: t.name || t.taskName,
    }))
  }, [taskTypes])

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <BackToMaster />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Icon name="gitMerge" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-900">Event & Task Mappings</h1>
            <p className="text-xs text-slate-500">Configure allowable task types per Vertical and Event Category</p>
          </div>
        </div>
        <button
          onClick={() => setEditing({ isEdit: false, businessVerticalId: '', eventCategoryId: '', selectedTaskTypeIds: [] })}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98]"
        >
          <Icon name="plus" className="h-4 w-4" />
          Add Mapping
        </button>
      </header>

      {/* Table Card with Common AppSelect Search & Select Filters */}
      <section className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-full text-sm text-left">
            <thead className="bg-slate-50">
              <tr className="bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="px-4 py-3 w-1/4">Business Vertical</th>
                <th className="px-4 py-3 w-1/4">Event Category</th>
                <th className="px-4 py-3 w-2/5">Mapped Task Types</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
              {/* Column Level Filters Row using AppSelect */}
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="px-4 py-2">
                  <AppSelect
                    value={fVertical}
                    onChange={v => setFVertical(v || '')}
                    options={verticalFilterOptions}
                    placeholder="All Verticals"
                    size="sm"
                    isSearchable
                    isClearable
                    menuPortal
                  />
                </th>
                <th className="px-4 py-2">
                  <AppSelect
                    value={fCategory}
                    onChange={v => setFCategory(v || '')}
                    options={categoryFilterOptions}
                    placeholder="All Event Categories"
                    size="sm"
                    isSearchable
                    isClearable
                    menuPortal
                  />
                </th>
                <th className="px-4 py-2">
                  <AppSelect
                    value={fTaskType}
                    onChange={v => setFTaskType(v || '')}
                    options={taskTypeFilterOptions}
                    placeholder="Search task types…"
                    size="sm"
                    isSearchable
                    isClearable
                    menuPortal
                  />
                </th>
                <th className="px-4 py-2 text-right">
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-xs text-brand-600 hover:text-brand-700 font-semibold underline"
                    >
                      Clear Filters
                    </button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <TableStatusRow colSpan={4} className="py-12">Loading mappings…</TableStatusRow>
              ) : filteredRows.length === 0 ? (
                <TableStatusRow colSpan={4} className="py-12">
                  {hasActiveFilters ? 'No mappings match the active filters.' : 'No event & task type mappings found.'}
                </TableStatusRow>
              ) : (
                filteredRows.map((row) => (
                  <tr key={`${row.businessVerticalId}_${row.eventCategoryId}`} className="transition hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-semibold text-slate-800">{row.businessVerticalName || row.businessVerticalId}</td>
                    <td className="px-4 py-3 font-medium text-brand-700">{row.eventCategoryName || row.eventCategoryId}</td>
                    <td className="px-4 py-3">
                      {/* Standard OverflowPillList component for multi-value column */}
                      <OverflowPillList
                        items={(row.tasks || []).map(t => t.taskName || t.taskTypeId)}
                        maxVisible={3}
                        color="brand"
                        emptyText="No tasks mapped"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing({
                            isEdit: true,
                            businessVerticalId: row.businessVerticalId,
                            businessVerticalName: row.businessVerticalName,
                            eventCategoryId: row.eventCategoryId,
                            eventCategoryName: row.eventCategoryName,
                            selectedTaskTypeIds: (row.tasks || []).map(t => String(t.taskTypeId)),
                          })}
                          className="text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-md p-1.5 transition"
                          title="Edit Mapping"
                        >
                          <Icon name="pencil" className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleting(row)}
                          className="text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-md p-1.5 transition"
                          title="Delete Mapping"
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
      </section>

      {/* Add / Edit Form Modal */}
      <EventTaskTypeMappingModal
        open={editing !== null}
        initial={editing}
        existingRows={rows}
        verticals={verticals}
        taskTypeOptions={taskTypeFormOptions}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />

      {/* Delete Confirmation Modal */}
      {deleting && (
        <Modal
          open={Boolean(deleting)}
          onClose={() => setDeleting(null)}
          title="Delete Mapping"
          footer={
            <>
              <button onClick={() => setDeleting(null)} className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleting.eventCategoryId, deleting.businessVerticalId)}
                className="rounded-md bg-red-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
              >
                Delete Mapping
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-600">
            Are you sure you want to delete all mapped task types for{' '}
            <strong className="text-slate-900">{deleting.businessVerticalName || deleting.businessVerticalId} ➔ {deleting.eventCategoryName || deleting.eventCategoryId}</strong>?
          </p>
        </Modal>
      )}
    </div>
  )
}

function EventTaskTypeMappingModal({ open, initial, existingRows, verticals, taskTypeOptions, onClose, onSave }) {
  const toast = useToast()
  const isEdit = Boolean(initial?.isEdit)

  const [businessVerticalId, setBusinessVerticalId] = useState('')
  const [eventCategoryId, setEventCategoryId] = useState('')
  const [selectedTaskTypeIds, setSelectedTaskTypeIds] = useState([])
  const [filteredCategories, setFilteredCategories] = useState([])
  const [loadingCats, setLoadingCats] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Vertical dropdown options
  const verticalOptions = useMemo(() => {
    return verticals.map(v => ({ value: String(v.id), label: v.name }))
  }, [verticals])

  // Category dropdown options
  const categoryOptions = useMemo(() => {
    return filteredCategories.map(c => ({ value: String(c.id), label: c.name }))
  }, [filteredCategories])

  // Reset form when modal opens
  useEffect(() => {
    if (open && initial) {
      const bvId = String(initial.businessVerticalId || '')
      const ecId = String(initial.eventCategoryId || '')
      setBusinessVerticalId(bvId)
      setEventCategoryId(ecId)
      setSelectedTaskTypeIds(initial.selectedTaskTypeIds || [])
      setValidationError('')
      setSubmitting(false)

      if (bvId) {
        setLoadingCats(true)
        eventCategoryApi.getByVertical(bvId)
          .then(cats => setFilteredCategories(cats || []))
          .catch(() => setFilteredCategories([]))
          .finally(() => setLoadingCats(false))
      } else {
        setFilteredCategories([])
      }
    }
  }, [open, initial])

  // Cascading fetch when Business Vertical changes
  const handleVerticalChange = (bvId) => {
    setBusinessVerticalId(bvId)
    setEventCategoryId('')
    setValidationError('')

    if (bvId) {
      setLoadingCats(true)
      eventCategoryApi.getByVertical(bvId)
        .then(cats => setFilteredCategories(cats || []))
        .catch(() => setFilteredCategories([]))
        .finally(() => setLoadingCats(false))
    } else {
      setFilteredCategories([])
    }
  }

  // Validate duplicate row combination
  const handleCategoryChange = (ecId) => {
    setEventCategoryId(ecId)
    setValidationError('')

    if (!isEdit && businessVerticalId && ecId) {
      checkDuplicateCombination(businessVerticalId, ecId)
    }
  }

  const checkDuplicateCombination = (bvId, ecId) => {
    const exists = existingRows.some(r => String(r.businessVerticalId) === String(bvId) && String(r.eventCategoryId) === String(ecId))
    if (exists) {
      const vertName = verticals.find(v => String(v.id) === String(bvId))?.name || bvId
      const catName = filteredCategories.find(c => String(c.id) === String(ecId))?.name || ecId
      const msg = `A mapping for "${vertName} ➔ ${catName}" already exists. Please edit the existing row instead of creating a duplicate row.`
      setValidationError(msg)
      toast.error(msg)
      return true
    }
    return false
  }

  const handleTaskTypeChange = (ids) => {
    setSelectedTaskTypeIds(ids)
    if (ids && ids.length > 0) {
      setValidationError('')
    }
  }

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!businessVerticalId) {
      setValidationError('Please select a Business Vertical.')
      return
    }
    if (!eventCategoryId) {
      setValidationError('Please select an Event Category.')
      return
    }
    if (!selectedTaskTypeIds || selectedTaskTypeIds.length === 0) {
      const msg = 'Please select at least one task type for this mapping.'
      setValidationError(msg)
      toast.error(msg)
      return
    }
    if (!isEdit && checkDuplicateCombination(businessVerticalId, eventCategoryId)) {
      return
    }

    setSubmitting(true)
    await onSave(Number(eventCategoryId), businessVerticalId, selectedTaskTypeIds)
    setSubmitting(false)
  }

  const isSaveDisabled = submitting || !businessVerticalId || !eventCategoryId || !selectedTaskTypeIds || selectedTaskTypeIds.length === 0 || Boolean(validationError)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${isEdit ? 'Edit' : 'Add New'} Event & Task Type Mapping`}
      footer={
        <>
          <button onClick={onClose} className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaveDisabled}
            className="rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Save Mapping'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Validation Alert */}
        {validationError && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
            <Icon name="alertCircle" className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Business Vertical Selection */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Business Vertical <span className="text-red-500">*</span>
          </label>
          {isEdit ? (
            <input
              type="text"
              disabled
              value={initial?.businessVerticalName || businessVerticalId}
              className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700"
            />
          ) : (
            <SingleSelectDropdown
              value={businessVerticalId}
              onChange={handleVerticalChange}
              options={verticalOptions}
              placeholder="Select Business Vertical…"
            />
          )}
        </div>

        {/* Event Category Selection (Blocked until Vertical is selected) */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Event Category <span className="text-red-500">*</span>
          </label>
          {isEdit ? (
            <input
              type="text"
              disabled
              value={initial?.eventCategoryName || eventCategoryId}
              className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700"
            />
          ) : (
            <SingleSelectDropdown
              value={eventCategoryId}
              onChange={handleCategoryChange}
              options={categoryOptions}
              disabled={!businessVerticalId || loadingCats}
              placeholder={
                !businessVerticalId
                  ? 'Select Business Vertical first…'
                  : loadingCats
                  ? 'Loading event categories…'
                  : categoryOptions.length === 0
                  ? 'No event categories mapped to this vertical'
                  : 'Select Event Category…'
              }
            />
          )}
          {!businessVerticalId && !isEdit && (
            <p className="mt-1 text-[11px] text-amber-600 italic">
              * Select a Business Vertical above to enable Event Category selection.
            </p>
          )}
        </div>

        {/* Task Types Selection */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Allowable Task Types <span className="text-red-500">*</span>
          </label>
          <MultiSelectDropdown
            options={taskTypeOptions}
            value={selectedTaskTypeIds}
            onChange={handleTaskTypeChange}
            placeholder="Select task types allowed for this combination…"
          />
          {selectedTaskTypeIds.length === 0 && (
            <p className="mt-1 text-[11px] text-red-600 font-medium">
              * At least one task type is required.
            </p>
          )}
        </div>
      </form>
    </Modal>
  )
}
