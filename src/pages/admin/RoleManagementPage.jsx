import { useCallback, useEffect, memo, useState, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import api from '../../api/client'
import useDebounce from '../../hooks/useDebounce'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import { useToast } from '../../components/Toast'
import AppSelect from '../../components/AppSelect'
import SingleSelectDropdown from '../../components/SingleSelectDropdown'
import MultiSelectDropdown from '../../components/MultiSelectDropdown'
import OverflowPillList from '../../components/OverflowPillList'
import BackToMaster from '../../components/admin/BackToMaster'
import { TableStatusRow } from '../../components/dataTable'

const BASE = '/admin/roles'

const rolesApi = {
  listPaged: (params) => api.get(BASE, { params }).then(r => r.data),
  create:    (data)   => api.post(BASE, data).then(r => r.data),
  update:    (id, data) => api.put(`${BASE}/${id}`, data).then(r => r.data),
}

export default function RoleManagementPage() {
  const toast = useToast()
  const PAGE_SIZE = 20

  const [rows, setRows]                   = useState([])
  const [total, setTotal]                 = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [loading, setLoading]             = useState(true)
  const [editing, setEditing]             = useState(null)
  const [page, setPage]                   = useState(0)
  const [refreshSeed, setRefreshSeed]     = useState(0)

  // Master rights for selection
  const [allRights, setAllRights] = useState([])

  // Column filters
  const [fId, setFId]         = useState('')
  const [fName, setFName]     = useState('')
  const [fStatus, setFStatus] = useState('all')

  const dId   = useDebounce(fId,   400)
  const dName = useDebounce(fName, 400)

  // Reset to page 0 when debounced filters or status change
  useEffect(() => { setPage(0) }, [dId, dName, fStatus])

  // Fetch rights list once
  useEffect(() => {
    api.get('/master/rights')
      .then(res => setAllRights(res.data.filter(r => r.status === 'ACTIVE')))
      .catch(e => console.error('Failed to load rights', e))
  }, [])

  // Server-side fetch roles
  useEffect(() => {
    let alive = true
    setLoading(true)
    rolesApi.listPaged({
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
      .catch((e) => { if (alive) toast.error(e?.response?.data?.message || 'Failed to load roles') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [dId, dName, fStatus, page, refreshSeed])

  const refresh = () => setRefreshSeed((s) => s + 1)

  const handleSave = async (form) => {
    try {
      const payload = {
        roleId: form.roleId,
        roleName: form.name,
        status: form.isActive ? 'ACTIVE' : 'INACTIVE',
        rights: form.rightIds.map(id => ({ rightId: id }))
      }
      form.dbId
        ? await rolesApi.update(form.dbId, payload)
        : await rolesApi.create(payload)
      setEditing(null)
      toast.success(`Role ${form.dbId ? 'updated' : 'created'}`)
      refresh()
    } catch (e) {
      const msg = e?.response?.data?.message || 'Save failed'
      toast.error(msg)
      throw e
    }
  }

  const handleEditRow = useCallback((row) => {
    // Fetch full role details by integer DB id
    api.get(`${BASE}/${row.id}`)
      .then(res => {
         const fullRole = res.data
         setEditing({
           dbId: fullRole.id,          // integer DB id for PUT
           roleId: fullRole.roleId,    // role_code, editable
           name: fullRole.roleName,
           isActive: fullRole.status === 'ACTIVE',
           rightIds: (fullRole.rights || []).map(r => r.rightId)
         })
      })
      .catch(e => toast.error('Failed to fetch role details'))
  }, [])

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <BackToMaster />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Icon name="shield" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-900">Roles</h1>
            <p className="text-xs text-slate-500">{total} record{total === 1 ? '' : 's'} total</p>
          </div>
        </div>
        <button
          onClick={() => setEditing({ roleId: '', name: '', isActive: true, rightIds: [] })}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3.5 py-2
                     text-sm font-semibold text-white shadow-sm transition
                     hover:bg-brand-700 active:scale-[0.98]"
        >
          <Icon name="plus" className="h-4 w-4" />
          Add new
        </button>
      </header>

      <section className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200/70">
        <div className="hidden w-full overflow-x-auto sm:block">
          <table className="w-full min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="w-36 px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Rights</th>
                <th className="w-36 px-4 py-2.5">Status</th>
                <th className="w-28 px-4 py-2.5 text-right">Actions</th>
              </tr>
              <tr className="border-y border-slate-100 bg-slate-50/40">
                <th className="px-4 py-2">
                  <FilterInput value={fId} onChange={setFId} placeholder="Filter Code…" />
                </th>
                <th className="px-4 py-2">
                  <FilterInput value={fName} onChange={setFName} placeholder="Search name…" icon="search" />
                </th>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2">
                  <FilterSelect value={fStatus} onChange={setFStatus}
                    options={[['all','All'],['active','Active'],['inactive','Inactive']]} />
                </th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <TableStatusRow colSpan={5} className="py-12">Loading…</TableStatusRow>
              ) : rows.length === 0 ? (
                <TableStatusRow colSpan={5} className="py-12">No matching records.</TableStatusRow>
              ) : (
                rows.map((row) => (
                  <MasterRow key={row.id} row={row} onEdit={handleEditRow} />
                ))
              )}
            </tbody>
          </table>
          <div className="border-t border-slate-100 px-4 py-1">
            <Pagination page={page} totalPages={totalPages} totalElements={total}
              pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </div>
      </section>

      <RoleFormModal
        open={editing !== null}
        initial={editing}
        allRights={allRights}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />
    </div>
  )
}

const MasterRow = memo(function MasterRow({ row, onEdit }) {
  const active = row.status === 'ACTIVE'
  return (
    <tr className={`transition hover:bg-slate-50/60 ${!active ? 'bg-slate-50/50 opacity-75' : ''}`}>
      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{row.roleId}</td>
      <td className={`px-4 py-2.5 font-medium text-slate-800 ${!active ? 'line-through text-slate-400' : ''}`}>{row.roleName}</td>
      <td className="px-4 py-2.5">
        <OverflowPillList
          items={row.rightsList ? row.rightsList.split(',').map(s => s.trim()) : []}
          maxVisible={2}
          color="brand"
        />
      </td>
      <td className="px-4 py-2.5"><StatusPill active={active} /></td>
      <td className="px-4 py-2.5 text-right">
         <button onClick={() => onEdit(row)} title="Edit"
                 className="rounded-md p-1.5 transition text-slate-400 hover:bg-slate-100 hover:text-slate-700">
           <Icon name="pencil" className="h-4 w-4" />
         </button>
      </td>
    </tr>
  )
})

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
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium
                  ${active ? 'bg-slate-100 text-slate-700 ring-1 ring-slate-200' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function RoleFormModal({ open, initial, allRights, onClose, onSave }) {
  const isEdit = Boolean(initial?.dbId)
  const [name, setName]             = useState('')
  const [roleId, setRoleId]         = useState('')
  const [isActive, setIsActive]     = useState(true)
  const [rightIds, setRightIds]     = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const prevNameRef = useRef('')

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setRoleId(initial?.roleId ?? '')
      setIsActive(initial?.isActive ?? true)
      setRightIds(initial?.rightIds ?? [])
      setSubmitting(false)
      setSubmitError('')
      prevNameRef.current = initial?.name ?? ''
    }
  }, [open, initial])

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim() || (!isEdit && !roleId.trim())) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await onSave({ dbId: initial?.dbId, roleId: roleId.trim(), name: name.trim(), isActive, rightIds })
    } catch (e) {
      const msg = e?.response?.data?.message || 'Save failed'
      setSubmitError(msg)
      // Don't swallow — let handleSave also show toast
      throw e
    } finally {
      setSubmitting(false)
    }
  }

  const handleNameChange = (e) => {
    const val = e.target.value
    setName(val)
    // Auto-derive code when name changes and code hasn't been manually edited
    const derived = val.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    setRoleId(derived)
  }

  const mappedRights = allRights.map(r => ({ id: r.id, name: r.name || r.rightName || r.id }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${isEdit ? 'Edit' : 'New'} Role`}
      footer={
        <>
          <button onClick={onClose} className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
          <button onClick={submit} disabled={submitting || !name.trim() || (!isEdit && !roleId.trim())} className="rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60">
            {submitting ? 'Saving…' : (isEdit ? 'Save changes' : 'Create')}
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

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Role Name</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder="e.g. Marketing Manager"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            System Role Code
            <span className="ml-1.5 font-normal text-slate-400">(auto-generated, editable)</span>
          </label>
          <input
            type="text"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
            placeholder="e.g. MARKETING_MANAGER"
            className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 font-mono shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Assigned Rights</label>
          <MultiSelectDropdown
            options={mappedRights.map(r => ({ value: r.id, label: r.name }))}
            value={rightIds}
            onChange={vals => setRightIds(vals)}
            placeholder="Search rights..."
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
          <SingleSelectDropdown
            value={isActive ? 'ACTIVE' : 'INACTIVE'}
            onChange={v => setIsActive(v === 'ACTIVE')}
            options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]}
            placeholder="Select status…"
          />
        </div>
      </form>
    </Modal>
  )
}
