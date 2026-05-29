import { useCallback, useEffect, memo, useState, useMemo } from 'react'
import { masterApi, granularTasksApi, roleTaskApi, campaignTaskConfigApi } from '../../api/masterData'
import campaignSpecsApi from '../../api/campaignSpecs'
import useDebounce from '../../hooks/useDebounce'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import { useToast } from '../../components/Toast'
import AppSelect from '../../components/AppSelect'
import BackToMaster from '../../components/admin/BackToMaster'
import { TableStatusRow } from '../../components/dataTable'

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'role-task',    label: 'Role → Task',            icon: 'shield'  },
  { id: 'campaign-task', label: 'Campaign Task Config',   icon: 'list'    },
]

// ─── Shared helpers ───────────────────────────────────────────────────────────

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
      ${active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

// ─── Role → Task tab ──────────────────────────────────────────────────────────

function RoleTaskTab() {
  const toast = useToast()
  const PAGE_SIZE = 20

  const [rows, setRows]                   = useState([])
  const [total, setTotal]                 = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [roles, setRoles]                 = useState([])
  const [granularTasks, setGranularTasks] = useState([])
  const [loading, setLoading]             = useState(true)
  const [addOpen, setAddOpen]             = useState(false)
  const [editRow, setEditRow]             = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [page, setPage]                   = useState(0)
  const [refreshSeed, setRefreshSeed]     = useState(0)

  const [fRole,   setFRole]   = useState('')
  const [fTask,   setFTask]   = useState('')
  const [fStatus, setFStatus] = useState('all')

  const dRole = useDebounce(fRole, 400)
  const dTask = useDebounce(fTask, 400)

  useEffect(() => { setPage(0) }, [dRole, dTask, fStatus]) // eslint-disable-line

  useEffect(() => {
    Promise.all([masterApi.list('roles', false), granularTasksApi.list(false)])
      .then(([roleList, taskList]) => { setRoles(roleList); setGranularTasks(taskList) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    roleTaskApi.listPaged({ roleName: dRole || undefined, taskName: dTask || undefined,
      status: fStatus !== 'all' ? fStatus : undefined, page, size: PAGE_SIZE })
      .then((res) => {
        if (!alive) return
        setRows(res.content ?? [])
        setTotal(res.totalElements ?? 0)
        setTotalPages(res.totalPages ?? 0)
      })
      .catch((e) => { if (alive) toast.error(e?.response?.data?.message || 'Failed to load data') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dRole, dTask, fStatus, page, refreshSeed])

  const refresh = () => setRefreshSeed((s) => s + 1)

  const handleAdd = async (roleId, taskId) => {
    try { await roleTaskApi.create(roleId, taskId); setAddOpen(false); toast.success('Mapping added'); refresh() }
    catch (e) { toast.error(e?.response?.data?.message || 'Failed to add mapping') }
  }
  const handleEdit = async (mappingId, roleId, taskId, status) => {
    try { await roleTaskApi.update(mappingId, { roleId, taskId, status }); setEditRow(null); toast.success('Mapping updated'); refresh() }
    catch (e) { toast.error(e?.response?.data?.message || 'Update failed') }
  }
  const handleDelete = async () => {
    if (!confirmDelete) return
    try { await roleTaskApi.remove(confirmDelete.mappingId); setConfirmDelete(null); toast.success('Mapping removed'); refresh() }
    catch (e) { toast.error(e?.response?.data?.message || 'Delete failed') }
  }

  const handleEditRow   = useCallback((row) => setEditRow(row), [])
  const handleDeleteRow = useCallback((row) => setConfirmDelete(row), [])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3.5 py-2
                     text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
          <Icon name="plus" className="h-4 w-4" /> Add mapping
        </button>
      </div>

      <section className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200/70">
        <div className="hidden w-full overflow-x-auto sm:block">
          <table className="w-full min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="w-20 px-4 py-2.5">ID</th>
                <th className="w-48 px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Granular Task</th>
                <th className="w-32 px-4 py-2.5">Status</th>
                <th className="w-24 px-4 py-2.5 text-right">Actions</th>
              </tr>
              <tr className="border-y border-slate-100 bg-slate-50/40">
                <th />
                <th className="px-4 py-2"><FilterInput value={fRole} onChange={setFRole} placeholder="Search role…" icon="search" /></th>
                <th className="px-4 py-2"><FilterInput value={fTask} onChange={setFTask} placeholder="Search task…" icon="search" /></th>
                <th className="px-4 py-2"><FilterSelect value={fStatus} onChange={setFStatus}
                  options={[['all','All'],['ACTIVE','Active'],['INACTIVE','Inactive']]} /></th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <TableStatusRow colSpan={5} className="py-12">Loading…</TableStatusRow>
              ) : rows.length === 0 ? (
                <TableStatusRow colSpan={5} className="py-12">No matching records.</TableStatusRow>
              ) : rows.map((row) => (
                <RoleTaskRow key={row.mappingId} row={row} onEdit={handleEditRow} onDelete={handleDeleteRow} />
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-100 px-4 py-1">
            <Pagination page={page} totalPages={totalPages} totalElements={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </div>

        {/* Mobile */}
        <div className="block divide-y divide-slate-100 sm:hidden">
          <div className="space-y-2 p-3">
            <FilterInput value={fRole} onChange={setFRole} placeholder="Search role…" icon="search" />
            <FilterInput value={fTask} onChange={setFTask} placeholder="Search task…" icon="search" />
            <FilterSelect value={fStatus} onChange={setFStatus} options={[['all','All Statuses'],['ACTIVE','Active'],['INACTIVE','Inactive']]} />
          </div>
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">No matching records.</div>
          ) : rows.map((row) => (
            <RoleTaskRow key={row.mappingId} row={row} onEdit={handleEditRow} onDelete={handleDeleteRow} mobile />
          ))}
          <div className="px-4 py-1">
            <Pagination page={page} totalPages={totalPages} totalElements={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </div>
      </section>

      <RoleTaskAddModal open={addOpen} roles={roles} granularTasks={granularTasks} onClose={() => setAddOpen(false)} onSave={handleAdd} />
      <RoleTaskEditModal row={editRow} roles={roles} granularTasks={granularTasks} onClose={() => setEditRow(null)} onSave={handleEdit} />
      <ConfirmDeleteModal open={confirmDelete !== null} target={confirmDelete}
        onClose={() => setConfirmDelete(null)} onConfirm={handleDelete}
        message={<>Remove mapping between <strong>{confirmDelete?.roleName || confirmDelete?.roleId}</strong> and{' '}
          <strong>{confirmDelete?.taskName || confirmDelete?.taskId}</strong>?</>} />
    </div>
  )
}

const RoleTaskRow = memo(function RoleTaskRow({ row, onEdit, onDelete, mobile = false }) {
  const inactive = (row.status ?? 'ACTIVE') === 'INACTIVE'
  if (mobile) return (
    <div className={`flex items-start justify-between gap-3 px-4 py-3 ${inactive ? 'opacity-60' : ''}`}>
      <div className="min-w-0 space-y-1.5">
        <RolePill name={row.roleName || row.roleId} />
        <div className="text-sm font-medium text-slate-800">{row.taskName || row.taskId}</div>
        <StatusPill status={row.status ?? 'ACTIVE'} />
      </div>
      <div className="flex shrink-0 gap-0.5">
        <button title="Edit" onClick={() => onEdit(row)} className="rounded-md p-1.5 text-slate-400 transition hover:bg-brand-50 hover:text-brand-700"><Icon name="pencil" className="h-4 w-4" /></button>
        <button title="Remove" onClick={() => onDelete(row)} className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"><Icon name="trash" className="h-4 w-4" /></button>
      </div>
    </div>
  )
  return (
    <tr className={`transition hover:bg-slate-50/60 ${inactive ? 'opacity-60' : ''}`}>
      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{row.mappingId}</td>
      <td className="px-4 py-2.5"><RolePill name={row.roleName || row.roleId} /></td>
      <td className="px-4 py-2.5 text-slate-800">
        <span className="font-medium">{row.taskName || row.taskId}</span>
        {row.taskId && <span className="ml-2 font-mono text-xs text-slate-400">{row.taskId}</span>}
      </td>
      <td className="px-4 py-2.5"><StatusPill status={row.status ?? 'ACTIVE'} /></td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-0.5">
          <button title="Edit" onClick={() => onEdit(row)} className="rounded-md p-1.5 text-slate-400 transition hover:bg-brand-50 hover:text-brand-700"><Icon name="pencil" className="h-4 w-4" /></button>
          <button title="Remove" onClick={() => onDelete(row)} className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"><Icon name="trash" className="h-4 w-4" /></button>
        </div>
      </td>
    </tr>
  )
})

// ─── Campaign Task Config tab ─────────────────────────────────────────────────

function CampaignTaskTab() {
  const toast = useToast()

  const [groups,        setGroups]        = useState([])
  const [loading,       setLoading]       = useState(true)
  const [granularTasks, setGranularTasks] = useState([])
  const [verticals,     setVerticals]     = useState([])
  const [bizTypes,      setBizTypes]      = useState([])
  const [formats,       setFormats]       = useState([])
  const [campTypes,     setCampTypes]     = useState([])

  const [addOpen,    setAddOpen]    = useState(false)
  const [editGroup,  setEditGroup]  = useState(null)
  const [delTarget,  setDelTarget]  = useState(null) // { type: 'row'|'group', id?, combo? }

  // Filters
  const [fCampType,  setFCampType]  = useState('')
  const [fVertical,  setFVertical]  = useState('')
  const [fBizType,   setFBizType]   = useState('')
  const [fFormat,    setFFormat]    = useState('')

  const loadGroups = useCallback(() => {
    setLoading(true)
    campaignTaskConfigApi.list()
      .then(setGroups)
      .catch(() => toast.error('Failed to load campaign task configs'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadGroups()
    Promise.all([
      granularTasksApi.list(false),
      masterApi.list('campaign-types'),
      masterApi.list('business-verticals'),
      masterApi.list('business-types'),
      masterApi.list('store-format-types'),
    ]).then(([tasks, ct, bv, bt, sft]) => {
      setGranularTasks(tasks)
      setCampTypes(ct)
      setVerticals(bv)
      setBizTypes(bt)
      setFormats(sft)
    }).catch(() => {})
  }, [loadGroups])

  const filtered = useMemo(() => groups.filter((g) => {
    if (fCampType && g.campaignTypeId !== fCampType)       return false
    if (fVertical && g.businessVerticalId !== fVertical)   return false
    if (fBizType  && g.businessTypeId !== fBizType)        return false
    if (fFormat   && g.storeFormatTypeId !== fFormat)      return false
    return true
  }), [groups, fCampType, fVertical, fBizType, fFormat])

  const toOpt = (item) => ({ value: item.id, label: item.name })

  const handleCreate = async (payload) => {
    try {
      await campaignTaskConfigApi.create(payload)
      toast.success('Configuration added')
      setAddOpen(false)
      loadGroups()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to save')
      throw e
    }
  }

  const handleUpdate = async (payload) => {
    try {
      await campaignTaskConfigApi.updateCombination(payload)
      toast.success('Configuration updated')
      setEditGroup(null)
      loadGroups()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to update')
      throw e
    }
  }

  const handleDeleteRow = async (id) => {
    try {
      await campaignTaskConfigApi.deleteById(id)
      toast.success('Task removed')
      loadGroups()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to delete')
    }
  }

  const handleDeleteGroup = async (g) => {
    try {
      await campaignTaskConfigApi.deleteByCombination(
        g.campaignTypeId, g.businessVerticalId, g.businessTypeId, g.storeFormatTypeId)
      toast.success('Configuration deleted')
      setDelTarget(null)
      loadGroups()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to delete')
    }
  }

  const label = (id, list, idKey, nameKey) => {
    const item = list.find((x) => String(x[idKey]) === String(id))
    return item?.[nameKey] || id || '—'
  }

  const specLabel = (g) => {
    const parts = []
    if (g.campaignTypeId)     parts.push(g.campaignTypeName     || g.campaignTypeId)
    if (g.businessVerticalId) parts.push(g.businessVerticalName || g.businessVerticalId)
    if (g.businessTypeId)     parts.push(g.businessTypeName     || g.businessTypeId)
    if (g.storeFormatTypeId)  parts.push(g.storeFormatTypeName  || g.storeFormatTypeId)
    return parts.join(' › ') || 'All campaigns'
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <div className="w-44">
            <AppSelect value={fCampType} onChange={setFCampType} size="sm" isSearchable
              options={[{ value: '', label: 'All Campaign Types' }, ...campTypes.map(toOpt)]} />
          </div>
          <div className="w-44">
            <AppSelect value={fVertical} onChange={setFVertical} size="sm" isSearchable
              options={[{ value: '', label: 'All Verticals' }, ...verticals.map(toOpt)]} />
          </div>
          <div className="w-44">
            <AppSelect value={fBizType} onChange={setFBizType} size="sm" isSearchable
              options={[{ value: '', label: 'All Business Types' }, ...bizTypes.map(toOpt)]} />
          </div>
          <div className="w-44">
            <AppSelect value={fFormat} onChange={setFFormat} size="sm" isSearchable
              options={[{ value: '', label: 'All Formats' }, ...formats.map(toOpt)]} />
          </div>
        </div>
        <button onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3.5 py-2
                     text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
          <Icon name="plus" className="h-4 w-4" /> Add config
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200/70 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
              <th className="px-4 py-3 whitespace-nowrap">Campaign Type</th>
              <th className="px-4 py-3 whitespace-nowrap">Business Vertical</th>
              <th className="px-4 py-3 whitespace-nowrap">Business Type</th>
              <th className="px-4 py-3 whitespace-nowrap">Store / Format</th>
              <th className="px-4 py-3">Configured Tasks</th>
              <th className="px-4 py-3 text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Loading…
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm italic">
                  No configurations found
                </td>
              </tr>
            ) : filtered.map((g, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition align-top">
                <td className="px-4 py-3 text-slate-700">
                  {g.campaignTypeId ? (g.campaignTypeName || g.campaignTypeId) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {g.businessVerticalId ? (g.businessVerticalName || g.businessVerticalId) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {g.businessTypeId ? (g.businessTypeName || g.businessTypeId) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {g.storeFormatTypeId ? (g.storeFormatTypeName || g.storeFormatTypeId) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {g.tasks.map((t) => (
                      <span key={t.id}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-100">
                        {t.taskName || t.taskId}
                        <button
                          onClick={() => handleDeleteRow(t.id)}
                          className="ml-0.5 hover:text-red-500 transition"
                          title="Remove this task"
                        >×</button>
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-0.5">
                    <button title="Edit" onClick={() => setEditGroup(g)}
                      className="rounded-md p-1.5 text-slate-400 transition hover:bg-brand-50 hover:text-brand-700">
                      <Icon name="pencil" className="h-4 w-4" />
                    </button>
                    <button title="Delete all" onClick={() => setDelTarget(g)}
                      className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600">
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && (
          <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
            {filtered.length} configuration{filtered.length !== 1 ? 's' : ''}
            {filtered.length !== groups.length ? ` (of ${groups.length})` : ''}
          </div>
        )}
      </div>

      {/* Add modal */}
      {addOpen && (
        <CampaignTaskModal
          title="Add Campaign Task Configuration"
          granularTasks={granularTasks}
          campTypes={campTypes}
          verticals={verticals}
          onClose={() => setAddOpen(false)}
          onSave={handleCreate}
        />
      )}

      {/* Edit modal */}
      {editGroup && (
        <CampaignTaskModal
          title="Edit Configuration"
          initial={editGroup}
          granularTasks={granularTasks}
          campTypes={campTypes}
          verticals={verticals}
          onClose={() => setEditGroup(null)}
          onSave={handleUpdate}
        />
      )}

      {/* Delete group confirm */}
      {delTarget && (
        <ConfirmDeleteModal
          open
          onClose={() => setDelTarget(null)}
          onConfirm={() => handleDeleteGroup(delTarget)}
          message={<>Delete all tasks configured for <strong>{specLabel(delTarget)}</strong>? This cannot be undone.</>}
        />
      )}
    </div>
  )
}

function SpecChip({ label, color }) {
  const colors = {
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
    blue:   'bg-blue-50 text-blue-700 ring-blue-100',
    cyan:   'bg-cyan-50 text-cyan-700 ring-cyan-100',
    teal:   'bg-teal-50 text-teal-700 ring-teal-100',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${colors[color] || colors.violet}`}>
      {label}
    </span>
  )
}

// ─── Campaign Task Modal (add / edit) ─────────────────────────────────────────

function CampaignTaskModal({ title, initial, granularTasks, campTypes, verticals, onClose, onSave }) {
  const [campTypeId,    setCampTypeId]    = useState(initial?.campaignTypeId     || '')
  const [verticalId,    setVerticalId]    = useState(initial?.businessVerticalId || '')
  const [bizTypeId,     setBizTypeId]     = useState(initial?.businessTypeId     || '')
  const [formatId,      setFormatId]      = useState(initial?.storeFormatTypeId  || '')
  const [selectedTasks, setSelectedTasks] = useState(
    initial?.tasks?.map((t) => ({ value: t.taskId, label: t.taskName || t.taskId })) || []
  )
  const [saving, setSaving] = useState(false)

  // Cascade: filtered options driven by parent selection
  const [bizTypeOpts,  setBizTypeOpts]  = useState([])
  const [formatOpts,   setFormatOpts]   = useState([])
  const [loadingBiz,   setLoadingBiz]   = useState(false)
  const [loadingFmt,   setLoadingFmt]   = useState(false)

  // On open with initial data (edit mode): pre-load child options
  useEffect(() => {
    if (!initial?.businessVerticalId) return
    campaignSpecsApi.getBusinessTypesByVertical(initial.businessVerticalId)
      .then((d) => setBizTypeOpts(d))
      .catch(() => setBizTypeOpts([]))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!initial?.businessTypeId) return
    campaignSpecsApi.getStoreFormatsByBusinessType(initial.businessTypeId)
      .then((d) => setFormatOpts(d))
      .catch(() => setFormatOpts([]))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cascade: reload biz types when vertical changes (add mode)
  useEffect(() => {
    if (!!initial) return // edit mode: locked
    if (!verticalId) { setBizTypeOpts([]); setBizTypeId(''); setFormatOpts([]); setFormatId(''); return }
    setLoadingBiz(true)
    campaignSpecsApi.getBusinessTypesByVertical(verticalId)
      .then((d) => { setBizTypeOpts(d); setBizTypeId(''); setFormatOpts([]); setFormatId('') })
      .catch(() => { setBizTypeOpts([]); setBizTypeId('') })
      .finally(() => setLoadingBiz(false))
  }, [verticalId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cascade: reload store formats when biz type changes (add mode)
  useEffect(() => {
    if (!!initial) return // edit mode: locked
    if (!bizTypeId) { setFormatOpts([]); setFormatId(''); return }
    setLoadingFmt(true)
    campaignSpecsApi.getStoreFormatsByBusinessType(bizTypeId)
      .then((d) => { setFormatOpts(d); setFormatId('') })
      .catch(() => { setFormatOpts([]); setFormatId('') })
      .finally(() => setLoadingFmt(false))
  }, [bizTypeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const tasksByType = useMemo(() => {
    const groups = {}
    granularTasks.forEach((t) => {
      const key = t.taskTypeName || 'Other'
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
    })
    return groups
  }, [granularTasks])

  const taskOptions = Object.entries(tasksByType).map(([typeName, tasks]) => ({
    label: typeName,
    options: tasks.map((t) => ({ value: String(t.taskId), label: t.taskName })),
  }))

  const toOpt = (item) => ({ value: item.id, label: item.name })

  const handleSave = async () => {
    if (selectedTasks.length === 0) return
    setSaving(true)
    try {
      await onSave({
        campaignTypeId:     campTypeId  || '',
        businessVerticalId: verticalId  || '',
        businessTypeId:     bizTypeId   || '',
        storeFormatTypeId:  formatId    || '',
        taskIds:            selectedTasks.map((t) => t.value),
      })
    } finally {
      setSaving(false)
    }
  }

  const bizLocked   = !!initial || !verticalId
  const fmtLocked   = !!initial || !bizTypeId

  return (
    <Modal open size="lg" onClose={onClose} title={title}
      footer={
        <>
          <button onClick={onClose} className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
          <button onClick={handleSave} disabled={saving || selectedTasks.length === 0}
            className="rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white
                       shadow-sm transition hover:bg-brand-700 disabled:opacity-60">
            {saving ? 'Saving…' : (initial ? 'Update' : 'Add')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          Select optional specification filters, then choose one or more tasks to assign to this combination.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Campaign Type</label>
            <AppSelect value={campTypeId} onChange={setCampTypeId}
              options={[{ value: '', label: 'Any' }, ...campTypes.map(toOpt)]}
              placeholder="Any" isSearchable menuPortal isClearable={false}
              isDisabled={!!initial} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Business Vertical</label>
            <AppSelect value={verticalId} onChange={setVerticalId}
              options={[{ value: '', label: 'Any' }, ...verticals.map(toOpt)]}
              placeholder="Any" isSearchable menuPortal isClearable={false}
              isDisabled={!!initial} />
          </div>
          <div>
            <label className={`mb-1 block text-sm font-medium ${bizLocked ? 'text-slate-400' : 'text-slate-700'}`}>
              Business Type
              {!initial && !verticalId && <span className="ml-1 text-xs text-slate-400">(select vertical first)</span>}
            </label>
            <AppSelect value={bizTypeId} onChange={setBizTypeId}
              options={[{ value: '', label: 'Any' }, ...bizTypeOpts.map(toOpt)]}
              placeholder={loadingBiz ? 'Loading…' : bizLocked ? '— select vertical first —' : 'Any'}
              isSearchable menuPortal isClearable={false}
              isDisabled={bizLocked || loadingBiz} />
          </div>
          <div>
            <label className={`mb-1 block text-sm font-medium ${fmtLocked ? 'text-slate-400' : 'text-slate-700'}`}>
              Store / Format Type
              {!initial && !bizTypeId && <span className="ml-1 text-xs text-slate-400">(select type first)</span>}
            </label>
            <AppSelect value={formatId} onChange={setFormatId}
              options={[{ value: '', label: 'Any' }, ...formatOpts.map(toOpt)]}
              placeholder={loadingFmt ? 'Loading…' : fmtLocked ? '— select business type first —' : 'Any'}
              isSearchable menuPortal isClearable={false}
              isDisabled={fmtLocked || loadingFmt} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Tasks <span className="text-red-500">*</span>
          </label>
          <AppSelect
            value={selectedTasks}
            onChange={setSelectedTasks}
            options={taskOptions}
            placeholder="Search & select tasks…"
            isSearchable
            isMulti
            menuPortal
          />
          {selectedTasks.length === 0 && (
            <p className="mt-1 text-xs text-red-500">Select at least one task.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─── Shared modals ────────────────────────────────────────────────────────────

function RoleTaskAddModal({ open, roles, granularTasks, onClose, onSave }) {
  const [roleId, setRoleId]         = useState('')
  const [taskId, setTaskId]         = useState('')
  const [submitting, setSubmitting] = useState(false)

  const tasksByType = useMemo(() => {
    const groups = {}
    granularTasks.forEach((t) => {
      const key = t.taskTypeName || 'Other'
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
    })
    return groups
  }, [granularTasks])

  useEffect(() => { if (open) { setRoleId(''); setTaskId(''); setSubmitting(false) } }, [open])

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    if (!roleId || !taskId) return
    setSubmitting(true)
    try { await onSave(roleId, taskId) } finally { setSubmitting(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Role → Task Mapping"
      footer={
        <>
          <button onClick={onClose} className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
          <button onClick={submit} disabled={submitting || !roleId || !taskId}
            className="rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60">
            {submitting ? 'Adding…' : 'Add mapping'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
          <AppSelect value={roleId ? String(roleId) : ''} onChange={setRoleId}
            options={roles.map((r) => ({ value: String(r.id), label: r.name }))}
            placeholder="Search & select a role…" isSearchable menuPortal />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Granular Task</label>
          <AppSelect value={taskId ? String(taskId) : ''} onChange={setTaskId}
            options={Object.entries(tasksByType).map(([typeName, tasks]) => ({
              label: typeName,
              options: tasks.map((t) => ({ value: String(t.taskId), label: t.taskName })),
            }))}
            placeholder="Search & select a task…" isSearchable menuPortal />
        </div>
        {roleId && taskId && (
          <div className="rounded-md border border-brand-100 bg-brand-50 px-3 py-2.5 text-xs text-brand-700">
            <strong className="font-semibold">Preview: </strong>
            {roles.find((r) => String(r.id) === String(roleId))?.name ?? roleId}{' → '}
            {granularTasks.find((t) => String(t.taskId) === String(taskId))?.taskName ?? taskId}
          </div>
        )}
      </form>
    </Modal>
  )
}

function RoleTaskEditModal({ row, roles, granularTasks, onClose, onSave }) {
  const [roleId, setRoleId]         = useState('')
  const [taskId, setTaskId]         = useState('')
  const [status, setStatus]         = useState('ACTIVE')
  const [submitting, setSubmitting] = useState(false)

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
    if (row) { setRoleId(String(row.roleId ?? '')); setTaskId(String(row.taskId ?? '')); setStatus(row.status ?? 'ACTIVE'); setSubmitting(false) }
  }, [row])

  if (!row) return null

  const submit = async (e) => {
    e.preventDefault()
    if (!roleId || !taskId) return
    setSubmitting(true)
    try { await onSave(row.mappingId, roleId, taskId, status) } finally { setSubmitting(false) }
  }

  return (
    <Modal open={!!row} onClose={onClose} title="Edit Mapping"
      footer={
        <>
          <button onClick={onClose} className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
          <button onClick={submit} disabled={submitting || !roleId || !taskId}
            className="rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60">
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
          <AppSelect value={roleId} onChange={setRoleId}
            options={roles.map((r) => ({ value: String(r.id), label: r.name }))}
            placeholder="Search & select a role…" isSearchable menuPortal />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Granular Task</label>
          <AppSelect value={taskId} onChange={setTaskId}
            options={Object.entries(tasksByType).map(([typeName, tasks]) => ({
              label: typeName,
              options: tasks.map((t) => ({ value: String(t.taskId), label: t.taskName })),
            }))}
            placeholder="Search & select a task…" isSearchable menuPortal />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
          <AppSelect value={status} onChange={setStatus}
            options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]}
            isClearable={false} />
          <p className="mt-1 text-xs text-slate-500">Inactive mappings are hidden from routing but not deleted.</p>
        </div>
        {roleId && taskId && (
          <div className="rounded-md border border-brand-100 bg-brand-50 px-3 py-2.5 text-xs text-brand-700">
            <strong className="font-semibold">Preview: </strong>
            {roles.find((r) => String(r.id) === String(roleId))?.name ?? row.roleName ?? roleId}
            {' → '}
            {granularTasks.find((t) => String(t.taskId) === String(taskId))?.taskName ?? row.taskName ?? taskId}
          </div>
        )}
      </form>
    </Modal>
  )
}

function ConfirmDeleteModal({ open, onClose, onConfirm, message }) {
  return (
    <Modal open={open} onClose={onClose} title="Confirm Delete" size="sm"
      footer={
        <>
          <button onClick={onClose} className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
          <button onClick={onConfirm} className="rounded-md bg-red-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700">
            Yes, delete
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TaskMappingsPage() {
  const [activeTab, setActiveTab] = useState('role-task')

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <BackToMaster />
      {/* Page header */}
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
          <Icon name="shield" className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Task Mappings</h1>
          <p className="text-xs text-slate-500">Configure which tasks apply to roles and campaign specifications</p>
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex gap-0.5 border-b border-slate-200">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${activeTab === tab.id
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
            <Icon name={tab.icon} className="h-3.5 w-3.5 shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'role-task'     && <RoleTaskTab />}
        {activeTab === 'campaign-task' && <CampaignTaskTab />}
      </div>
    </div>
  )
}
