import { useCallback, useEffect, useState } from 'react'
import { masterApi } from '../../api/masterData'
import campaignSpecsApi from '../../api/campaignSpecs'
import useDebounce from '../../hooks/useDebounce'
import Modal from '../../components/Modal'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import AppSelect from '../../components/AppSelect'

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'campaign-types',     label: 'Campaign Types',     icon: 'tag'      },
  { id: 'business-verticals', label: 'Business Verticals', icon: 'building' },
  { id: 'business-types',     label: 'Business Types',     icon: 'list'     },
  { id: 'store-format-types', label: 'Store / Format Types', icon: 'globe'  },
  { id: 'vt-mappings',        label: 'Vertical → Type',    icon: 'shield'   },
  { id: 'tf-mappings',        label: 'Type → Format',      icon: 'shield'   },
]

// ─── Shared helpers ───────────────────────────────────────────────────────────

const inputCls = `w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm
  text-slate-800 placeholder-slate-400 shadow-sm focus:border-brand-500 focus:outline-none
  focus:ring-2 focus:ring-brand-200 transition`

function Badge({ active }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
      ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function FilterInput({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs
          placeholder-slate-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
      />
    </div>
  )
}

// ─── Edit / Create modal ──────────────────────────────────────────────────────

function EditModal({ item, title, onSave, onClose, saving }) {
  const [name,     setName]     = useState(item.name)
  const [isActive, setIsActive] = useState(item.isActive)
  return (
    <Modal onClose={onClose}>
      <div className="p-5 space-y-4 min-w-[320px]">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            placeholder="Enter name…"
            autoFocus
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="edit-is-active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          <label htmlFor="edit-is-active" className="text-sm text-slate-700 cursor-pointer">Active</label>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button
            disabled={!name.trim() || saving}
            onClick={() => onSave({ id: item.id, name: name.trim(), isActive })}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white
              hover:bg-brand-700 disabled:opacity-50 transition"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Generic CRUD table ───────────────────────────────────────────────────────

function MasterCrudTable({ slug, title }) {
  const toast = useToast()
  const PAGE_SIZE = 20

  const [rows,    setRows]    = useState([])
  const [total,   setTotal]   = useState(0)
  const [pages,   setPages]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(0)
  const [seed,    setSeed]    = useState(0)

  const [fName,   setFName]   = useState('')
  const [fStatus, setFStatus] = useState('all')

  const dName = useDebounce(fName, 400)

  const [editing,       setEditing]       = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [saving,        setSaving]        = useState(false)

  useEffect(() => { setPage(0) }, [dName, fStatus])

  useEffect(() => {
    let alive = true
    setLoading(true)
    masterApi.listPaged(slug, {
      name:   dName   || undefined,
      status: fStatus !== 'all' ? fStatus.toUpperCase() : 'all',
      page,
      size: PAGE_SIZE,
    })
      .then((res) => {
        if (!alive) return
        setRows(res.content ?? [])
        setTotal(res.totalElements ?? 0)
        setPages(res.totalPages ?? 0)
      })
      .catch(() => { if (alive) toast.error('Failed to load ' + title) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, dName, fStatus, page, seed])

  const refresh = () => setSeed((s) => s + 1)

  const handleSave = async (form) => {
    setSaving(true)
    try {
      const payload = { name: form.name, status: form.isActive ? 'ACTIVE' : 'INACTIVE' }
      if (form.id) {
        await masterApi.update(slug, form.id, payload)
        toast.success('Updated successfully')
      } else {
        await masterApi.create(slug, payload)
        toast.success('Created successfully')
      }
      setEditing(null)
      refresh()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await masterApi.remove(slug, id)
      toast.success('Deleted')
      setConfirmDelete(null)
      refresh()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed')
    }
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <div className="w-52">
            <FilterInput value={fName} onChange={setFName} placeholder="Filter by name…" />
          </div>
          <div className="w-40">
            <AppSelect
              value={fStatus}
              onChange={setFStatus}
              size="sm"
              options={[
                { value: 'all',      label: 'All statuses' },
                { value: 'ACTIVE',   label: 'Active'       },
                { value: 'INACTIVE', label: 'Inactive'     },
              ]}
            />
          </div>
        </div>
        <button
          onClick={() => setEditing({ id: null, name: '', isActive: true })}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm
            font-medium text-white hover:bg-brand-700 transition"
        >
          <Icon name="plus" className="h-3.5 w-3.5" /> Add New
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-medium w-20">ID</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium w-28">Status</th>
                <th className="px-4 py-3 text-right font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Loading…
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400 text-xs italic">
                    No records found
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">{row.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                  <td className="px-4 py-3"><Badge active={row.status === 'ACTIVE'} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditing({ id: row.id, name: row.name, isActive: row.status === 'ACTIVE' })}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition"
                        title="Edit"
                      >
                        <Icon name="edit" className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ id: row.id, name: row.name })}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
                        title="Delete"
                      >
                        <Icon name="trash" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 text-xs text-slate-500">
            <span>{total} records · Page {page + 1} of {pages}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded px-2.5 py-1 hover:bg-slate-100 disabled:opacity-40 transition"
              >‹ Prev</button>
              <button
                onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                disabled={page >= pages - 1}
                className="rounded px-2.5 py-1 hover:bg-slate-100 disabled:opacity-40 transition"
              >Next ›</button>
            </div>
          </div>
        )}
      </div>

      {/* Footer count */}
      {!loading && (
        <p className="text-xs text-slate-400">{total} record{total !== 1 ? 's' : ''} total</p>
      )}

      {/* Modals */}
      {editing && (
        <EditModal
          item={editing}
          title={editing.id ? `Edit — ${title}` : `New — ${title}`}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          saving={saving}
        />
      )}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)}>
          <div className="p-5 space-y-4">
            <h3 className="font-semibold text-slate-800">Delete "{confirmDelete.name}"?</h3>
            <p className="text-sm text-slate-500">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDelete.id)}
                className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-600 transition">
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Mapping table ────────────────────────────────────────────────────────────

function MappingTable({
  mappings,
  loading,
  parentLabel,
  childLabel,
  parentOptions,
  childOptions,
  onAdd,
  onDelete,
  filterParentId,
  setFilterParentId,
  filterChildId,
  setFilterChildId,
}) {
  const [adding,    setAdding]    = useState(false)
  const [newParent, setNewParent] = useState('')
  const [newChild,  setNewChild]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const toast = useToast()

  const filtered = mappings.filter((m) => {
    if (filterParentId && m.parentId !== filterParentId) return false
    if (filterChildId  && m.childId  !== filterChildId)  return false
    return true
  })

  const handleAdd = async () => {
    if (!newParent || !newChild) { toast.error('Select both values'); return }
    setSaving(true)
    try {
      await onAdd(newParent, newChild)
      setNewParent('')
      setNewChild('')
      setAdding(false)
    } catch {
      // error already toasted by caller
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <div className="w-56">
            <AppSelect
              value={filterParentId}
              onChange={setFilterParentId}
              size="sm"
              isSearchable
              options={[{ value: '', label: `All ${parentLabel}s` }, ...parentOptions]}
            />
          </div>
          <div className="w-56">
            <AppSelect
              value={filterChildId}
              onChange={setFilterChildId}
              size="sm"
              isSearchable
              options={[{ value: '', label: `All ${childLabel}s` }, ...childOptions]}
            />
          </div>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm
            font-medium text-white hover:bg-brand-700 transition"
        >
          <Icon name="plus" className="h-3.5 w-3.5" /> Add Mapping
        </button>
      </div>

      {/* Add row */}
      {adding && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
          <p className="text-xs font-semibold text-brand-700 mb-3 uppercase tracking-wide">New Mapping</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">{parentLabel}</label>
              <AppSelect value={newParent} onChange={setNewParent} options={parentOptions} placeholder="Select…" />
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">{childLabel}</label>
              <AppSelect value={newChild} onChange={setNewChild} options={childOptions} placeholder="Select…" />
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleAdd}
                disabled={saving || !newParent || !newChild}
                className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white
                  hover:bg-brand-700 disabled:opacity-50 transition"
              >
                {saving ? 'Saving…' : 'Add'}
              </button>
              <button
                onClick={() => { setAdding(false); setNewParent(''); setNewChild('') }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-medium w-8">#</th>
                <th className="px-4 py-3 text-left font-medium">{parentLabel}</th>
                <th className="px-4 py-3 text-left font-medium">{childLabel}</th>
                <th className="px-4 py-3 text-right font-medium w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Loading…
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400 text-xs italic">
                    No mappings found
                  </td>
                </tr>
              ) : filtered.map((m, idx) => (
                <tr key={m.mappingId} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">{idx + 1}</td>
                  <td className="px-4 py-3 text-slate-600">{m.parentName}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{m.childName}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onDelete(m.mappingId)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
                      title="Remove mapping"
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && (
        <p className="text-xs text-slate-400">
          {filtered.length} mapping{filtered.length !== 1 ? 's' : ''}
          {filterParentId ? ` for selected ${parentLabel.toLowerCase()}` : ' total'}
        </p>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CampaignSpecificationsPage() {
  const toast = useToast()

  const [activeTab, setActiveTab] = useState('campaign-types')

  // Mapping data + loading state
  const [vtMappings,    setVtMappings]    = useState([])
  const [tfMappings,    setTfMappings]    = useState([])
  const [mappingLoading, setMappingLoading] = useState(false)

  // Options for mapping dropdowns
  const [verticals, setVerticals] = useState([])
  const [bizTypes,  setBizTypes]  = useState([])
  const [formats,   setFormats]   = useState([])

  // Filters for mapping tabs (parent + child)
  const [vtFilter,      setVtFilter]      = useState('')
  const [vtChildFilter, setVtChildFilter] = useState('')
  const [tfFilter,      setTfFilter]      = useState('')
  const [tfChildFilter, setTfChildFilter] = useState('')

  const loadMappings = useCallback(() => {
    setMappingLoading(true)
    Promise.all([
      campaignSpecsApi.listVerticalTypeMappings(),
      campaignSpecsApi.listTypeFormatMappings(),
    ])
      .then(([vt, tf]) => { setVtMappings(vt); setTfMappings(tf) })
      .catch(() => toast.error('Failed to load mappings'))
      .finally(() => setMappingLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    masterApi.list('business-verticals').then(setVerticals).catch(() => {})
    masterApi.list('business-types').then(setBizTypes).catch(() => {})
    masterApi.list('store-format-types').then(setFormats).catch(() => {})
    loadMappings()
  }, [loadMappings])

  const toOpt = (item) => ({ value: item.id, label: item.name })

  // Reload mapping options when switching to mapping tabs
  useEffect(() => {
    if (activeTab === 'vt-mappings' || activeTab === 'tf-mappings') {
      loadMappings()
    }
  }, [activeTab, loadMappings])

  const handleAddVT = async (verticalId, typeId) => {
    try {
      await campaignSpecsApi.createVerticalTypeMapping(verticalId, typeId)
      toast.success('Mapping added')
      loadMappings()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add mapping')
      throw err
    }
  }

  const handleDeleteVT = async (id) => {
    try {
      await campaignSpecsApi.deleteVerticalTypeMapping(id)
      toast.success('Mapping removed')
      loadMappings()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to remove mapping')
    }
  }

  const handleAddTF = async (typeId, formatId) => {
    try {
      await campaignSpecsApi.createTypeFormatMapping(typeId, formatId)
      toast.success('Mapping added')
      loadMappings()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add mapping')
      throw err
    }
  }

  const handleDeleteTF = async (id) => {
    try {
      await campaignSpecsApi.deleteTypeFormatMapping(id)
      toast.success('Mapping removed')
      loadMappings()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to remove mapping')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-10">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Campaign Specifications</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Manage lookup tables and hierarchical mappings used in campaign creation.
        </p>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-0.5 border-b border-slate-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium
              border-b-2 transition-colors
              ${activeTab === tab.id
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
          >
            <Icon name={tab.icon} className="h-3.5 w-3.5 shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div>
        {activeTab === 'campaign-types' && (
          <MasterCrudTable slug="campaign-types" title="Campaign Types" />
        )}
        {activeTab === 'business-verticals' && (
          <MasterCrudTable slug="business-verticals" title="Business Verticals" />
        )}
        {activeTab === 'business-types' && (
          <MasterCrudTable slug="business-types" title="Business Types" />
        )}
        {activeTab === 'store-format-types' && (
          <MasterCrudTable slug="store-format-types" title="Store / Format Types" />
        )}

        {activeTab === 'vt-mappings' && (
          <div className="space-y-2">
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                Business Vertical → Business Type
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Define which Business Types are available for each Business Vertical.
              </p>
            </div>
            <MappingTable
              mappings={vtMappings}
              loading={mappingLoading}
              parentLabel="Business Vertical"
              childLabel="Business Type"
              parentOptions={verticals.map(toOpt)}
              childOptions={bizTypes.map(toOpt)}
              onAdd={handleAddVT}
              onDelete={handleDeleteVT}
              filterParentId={vtFilter}
              setFilterParentId={setVtFilter}
              filterChildId={vtChildFilter}
              setFilterChildId={setVtChildFilter}
            />
          </div>
        )}

        {activeTab === 'tf-mappings' && (
          <div className="space-y-2">
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                Business Type → Store / Format Type
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Define which Store / Format Types are available for each Business Type.
              </p>
            </div>
            <MappingTable
              mappings={tfMappings}
              loading={mappingLoading}
              parentLabel="Business Type"
              childLabel="Store / Format Type"
              parentOptions={bizTypes.map(toOpt)}
              childOptions={formats.map(toOpt)}
              onAdd={handleAddTF}
              onDelete={handleDeleteTF}
              filterParentId={tfFilter}
              setFilterParentId={setTfFilter}
              filterChildId={tfChildFilter}
              setFilterChildId={setTfChildFilter}
            />
          </div>
        )}
      </div>
    </div>
  )
}
