import { useState } from 'react'
import Icon from '../Icon'
import AppSelect from '../AppSelect'
import { useToast } from '../Toast'

export default function CampaignMappingTable({
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
  const [adding, setAdding] = useState(false)
  const [newParent, setNewParent] = useState('')
  const [newChild, setNewChild] = useState('')
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const filtered = mappings.filter((m) => {
    if (filterParentId && m.parentId !== filterParentId) return false
    if (filterChildId && m.childId !== filterChildId) return false
    return true
  })

  const handleAdd = async () => {
    if (!newParent || !newChild) {
      toast.error('Select both values')
      return
    }
    setSaving(true)
    try {
      await onAdd(newParent, newChild)
      setNewParent('')
      setNewChild('')
      setAdding(false)
    } catch {
      // error toasted by caller
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
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
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm
            font-medium text-white hover:bg-brand-700 transition"
        >
          <Icon name="plus" className="h-3.5 w-3.5" /> Add Mapping
        </button>
      </div>

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
                type="button"
                onClick={handleAdd}
                disabled={saving || !newParent || !newChild}
                className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white
                  hover:bg-brand-700 disabled:opacity-50 transition"
              >
                {saving ? 'Saving…' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => { setAdding(false); setNewParent(''); setNewChild('') }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
                      type="button"
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
