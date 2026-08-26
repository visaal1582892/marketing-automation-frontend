import { useCallback, useEffect, useState } from 'react'
import api from '../../api/client'
import { masterApi } from '../../api/masterData'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import { useToast } from '../../components/Toast'
import BackToMaster from '../../components/admin/BackToMaster'

const BASE = '/admin/approval-flows'

const flowApi = {
  list: () => api.get(BASE).then(r => r.data),
  get: (id) => api.get(`${BASE}/${id}`).then(r => r.data),
  create: (data) => api.post(BASE, data).then(r => r.data),
  update: (id, data) => api.put(`${BASE}/${id}`, data).then(r => r.data),
  deactivate: (id) => api.patch(`${BASE}/${id}/status`, { status: 'INACTIVE' }),
  supportedRoles: () => api.get(`${BASE}/supported-roles`).then(r => r.data),
}

export default function ApprovalFlowMasterPage() {
  const [flows, setFlows] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [levels, setLevels] = useState([])
  const [isInUse, setIsInUse] = useState(false)
  
  const [roles, setRoles] = useState([])
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await flowApi.list()
      setFlows(data)
      const rs = await flowApi.supportedRoles()
      setRoles(rs)
    } catch (err) {
      toast.error('Failed to load approval flows')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openCreateModal = () => {
    setEditingId(null)
    setName('')
    setDescription('')
    setLevels([{ levelNumber: 1, approverRoleId: '' }])
    setIsInUse(false)
    setModalOpen(true)
  }

  const openEditModal = async (id) => {
    try {
      const data = await flowApi.get(id)
      setEditingId(data.id)
      setName(data.name)
      setDescription(data.description || '')
      setLevels(data.levels || [])
      setIsInUse(data.isInUse)
      setModalOpen(true)
    } catch (err) {
      toast.error('Failed to fetch flow details')
    }
  }

  const handleClone = async (id, e) => {
    e.stopPropagation()
    try {
      const data = await flowApi.get(id)
      setEditingId(null) // It's a new flow
      setName(`${data.name} (Copy)`)
      setDescription(data.description || '')
      setLevels(data.levels || [])
      setIsInUse(false)
      setModalOpen(true)
    } catch (err) {
      toast.error('Failed to clone flow')
    }
  }

  const handleDeactivate = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to deactivate this flow?')) return
    try {
      await flowApi.deactivate(id)
      toast.success('Flow deactivated')
      loadData()
    } catch (err) {
      toast.error('Failed to deactivate flow')
    }
  }

  const addLevel = () => {
    setLevels(prev => [
      ...prev,
      { levelNumber: prev.length + 1, approverRoleId: '' }
    ])
  }

  const removeLevel = (idx) => {
    setLevels(prev => {
      const newLevels = prev.filter((_, i) => i !== idx)
      return newLevels.map((lvl, i) => ({ ...lvl, levelNumber: i + 1 }))
    })
  }

  const updateLevel = (idx, field, value) => {
    setLevels(prev => {
      const newLevels = [...prev]
      newLevels[idx] = { ...newLevels[idx], [field]: value }
      return newLevels
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    
    // Validations
    if (levels.length === 0) {
      toast.error('At least one level is required')
      return
    }


    setSaving(true)
    try {
      const payload = { name, description, levels }
      if (editingId) {
        await flowApi.update(editingId, payload)
        toast.success('Approval Flow updated')
      } else {
        await flowApi.create(payload)
        toast.success('Approval Flow created')
      }
      setModalOpen(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save flow')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4">
        <BackToMaster />
      </div>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Approval Flows
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Configure dynamic, multi-level approval workflows
            </p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
        >
          <Icon name="plus" className="h-4 w-4" />
          Create Flow
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-6 py-4 font-semibold">Flow Name</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">In Use</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    <Icon name="loading" className="mx-auto h-6 w-6 animate-spin" />
                  </td>
                </tr>
              ) : flows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No approval flows found.
                  </td>
                </tr>
              ) : (
                flows.map(flow => (
                  <tr key={flow.id} className="transition hover:bg-slate-50/50">
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-900">
                      {flow.name}
                      {flow.description && <p className="text-xs text-slate-500 font-normal mt-0.5">{flow.description}</p>}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        flow.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
                      }`}>
                        {flow.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {flow.isInUse ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
                          <Icon name="lock" className="h-3 w-3" /> Locked
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">No</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleClone(flow.id, e)}
                          className="p-1.5 text-slate-400 hover:text-brand-600 transition"
                          title="Clone Flow"
                        >
                          <Icon name="copy" className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(flow.id)}
                          className="p-1.5 text-slate-400 hover:text-brand-600 transition"
                          title="Edit"
                        >
                          <Icon name="edit" className="h-4 w-4" />
                        </button>
                        {flow.status === 'ACTIVE' && (
                          <button
                            onClick={(e) => handleDeactivate(flow.id, e)}
                            className="p-1.5 text-slate-400 hover:text-red-600 transition"
                            title="Deactivate"
                          >
                            <Icon name="trash" className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Approval Flow' : 'Create Approval Flow'} maxWidth="max-w-6xl">
        <form onSubmit={handleSave} className="flex flex-col md:flex-row h-full max-h-[85vh]">
          {/* Left Side: Form */}
          <div className="flex-1 overflow-y-auto p-6 border-r border-slate-100">
            {isInUse && (
              <div className="mb-6 rounded-lg bg-amber-50 p-4 border border-amber-200 flex gap-3 text-amber-800 text-sm">
                <Icon name="alertTriangle" className="h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <strong className="font-semibold block mb-1">Flow is locked</strong>
                  This approval flow is currently in-use by active tasks. You cannot modify the level structure, you can only update the name/description or clone it to create a new version.
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="col-span-1 md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Flow Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="w-full rounded-lg border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="col-span-1 md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Approval Levels</h3>
              {!isInUse && (
                <button
                  type="button"
                  onClick={addLevel}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  <Icon name="plus" className="h-4 w-4" /> Add Level
                </button>
              )}
            </div>

            <div className="space-y-4">
              {levels.map((level, idx) => (
                <div key={idx} className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="absolute -left-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white ring-4 ring-white shadow-sm">
                    {level.levelNumber}
                  </div>
                  {!isInUse && levels.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLevel(idx)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-red-600 transition"
                    >
                      <Icon name="x" className="h-4 w-4" />
                    </button>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">Approver Role</label>
                      <select
                        value={level.approverRoleId}
                        onChange={e => updateLevel(idx, 'approverRoleId', e.target.value)}
                        disabled={isInUse}
                        required
                        className="w-full rounded-md border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
                      >
                        <option value="" disabled>Select Role...</option>
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side: Live Preview */}
          <div className="w-full md:w-1/3 bg-slate-50 p-6 flex flex-col">
            <h3 className="text-sm font-bold tracking-wider text-slate-400 uppercase mb-6 flex items-center gap-2">
              <Icon name="eye" className="h-4 w-4" /> Live Preview
            </h3>
            
            <div className="flex-1 relative pl-4">
              <div className="absolute left-6 top-4 bottom-4 w-px bg-slate-200" />
              
              <div className="space-y-6 relative z-10">
                <div className="flex items-start gap-4">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 mt-0.5">
                    <Icon name="play" className="h-3 w-3 ml-0.5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Task Submitted</p>
                    <p className="text-xs text-slate-500 mt-1">Creator submits task for QC</p>
                  </div>
                </div>

                {levels.map((level, idx) => {
                  const roleName = roles.find(r => r.id === level.approverRoleId)?.name || 'Unknown Role'
                  return (
                    <div key={idx} className="flex items-start gap-4">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white border-2 border-brand-500 mt-0.5">
                        <span className="text-[10px] font-bold text-brand-700">{level.levelNumber}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{roleName}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {level.approverRoleId === 'TEAM_LEADER' ? 'Assignee\'s Dept Head' : 'Existing Manager routing'}
                        </p>
                      </div>
                    </div>
                  )
                })}

                <div className="flex items-start gap-4">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mt-0.5">
                    <Icon name="check" className="h-3 w-3" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Final Approval</p>
                    <p className="text-xs text-slate-500 mt-1">Task becomes ACTIVE</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 mt-8 opacity-60">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 mt-0.5">
                    <Icon name="rotateCcw" className="h-3 w-3" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">If Rework Requested...</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Always returns to creator (Rework)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100 bg-white">
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? <Icon name="loading" className="h-4 w-4 animate-spin" /> : <Icon name="check" className="h-4 w-4" />}
            {editingId ? 'Save Changes' : 'Create Flow'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
