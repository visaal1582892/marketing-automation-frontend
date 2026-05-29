import { useCallback, useEffect, useState } from 'react'
import qcRoutingApi from '../../api/qcRouting'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import BackToMaster from '../../components/admin/BackToMaster'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a Set key for a mapping pair. */
const key = (workerRoleId, managerRoleId) => `${workerRoleId}::${managerRoleId}`

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QcRoutingPage() {
  const toast = useToast()

  const [workerRoles,  setWorkerRoles]  = useState([])
  const [managerRoles, setManagerRoles] = useState([])
  /** Set of "workerRoleId::managerRoleId" strings — current draft state. */
  const [checked,      setChecked]      = useState(new Set())
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  /** Original state as loaded from the server — used to detect unsaved changes. */
  const [savedState,   setSavedState]   = useState(new Set())

  const loadConfig = useCallback(() => {
    setLoading(true)
    qcRoutingApi.getConfig()
      .then(res => {
        const { workerRoles: wr, managerRoles: mr, mappings } = res.data
        setWorkerRoles(wr  || [])
        setManagerRoles(mr || [])
        const s = new Set((mappings || []).map(m => key(m.workerRoleId, m.managerRoleId)))
        setChecked(new Set(s))
        setSavedState(new Set(s))
      })
      .catch(() => toast.error?.('Failed to load QC routing configuration.'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadConfig() }, [loadConfig])

  const toggle = (workerRoleId, managerRoleId) => {
    const k = key(workerRoleId, managerRoleId)
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const isDirty = () => {
    if (checked.size !== savedState.size) return true
    for (const k of checked) if (!savedState.has(k)) return true
    return false
  }

  const save = async () => {
    setSaving(true)
    try {
      const mappings = []
      for (const k of checked) {
        const [workerRoleId, managerRoleId] = k.split('::')
        mappings.push({ workerRoleId, managerRoleId })
      }
      await qcRoutingApi.saveConfig(mappings)
      setSavedState(new Set(checked))
      toast.success?.('QC routing configuration saved.')
    } catch {
      toast.error?.('Failed to save configuration.')
    } finally {
      setSaving(false)
    }
  }

  const reset = () => setChecked(new Set(savedState))

  // ── Derived helpers ──────────────────────────────────────────────────────────

  /** True if a worker role has no manager selected — will default to all managers. */
  const hasNoManager = (workerRoleId) =>
    !managerRoles.some(mr => checked.has(key(workerRoleId, mr.role_id)))

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl pb-12 space-y-6">
      <BackToMaster />

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
              <Icon name="shield" className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">QC Routing</h1>
              <p className="text-xs text-slate-500">
                Configure which manager roles receive QC submissions from each worker role
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDirty() && (
              <button
                onClick={reset}
                disabled={saving}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Reset
              </button>
            )}
            <button
              onClick={save}
              disabled={saving || !isDirty()}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition disabled:opacity-50"
            >
              <Icon name="check" className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Info banner ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700 flex items-start gap-2">
        <Icon name="alertCircle" className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />
        <span>
          Worker roles with <strong>no manager selected</strong> will route submitted tasks
          to <strong>all manager roles</strong> (the default). Select at least one manager
          to restrict visibility. Any configured manager can approve the task.
        </span>
      </div>

      {/* ── Matrix table ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
          <p className="text-sm text-slate-400">Loading configuration…</p>
        </div>
      ) : workerRoles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <p className="text-sm font-semibold text-slate-600">No worker roles found.</p>
          <p className="mt-1 text-xs text-slate-400">Make sure worker roles exist in the Roles master table.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-64">
                  Worker Role
                </th>
                {managerRoles.map(mr => (
                  <th
                    key={mr.role_id}
                    className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider"
                  >
                    {mr.role_name}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Default?
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workerRoles.map((wr, idx) => {
                const isDefault = hasNoManager(wr.role_id)
                return (
                  <tr
                    key={wr.role_id}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                  >
                    {/* Worker role name */}
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-slate-800 text-sm">{wr.role_name}</span>
                    </td>

                    {/* One checkbox per manager role */}
                    {managerRoles.map(mr => {
                      const isChecked = checked.has(key(wr.role_id, mr.role_id))
                      return (
                        <td key={mr.role_id} className="px-4 py-3.5 text-center">
                          <label className="inline-flex items-center justify-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggle(wr.role_id, mr.role_id)}
                              className="h-4 w-4 rounded border-slate-300 text-brand-600
                                focus:ring-brand-500 focus:ring-offset-0 cursor-pointer"
                            />
                          </label>
                        </td>
                      )
                    })}

                    {/* Default indicator */}
                    <td className="px-4 py-3.5 text-center">
                      {isDefault ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                          <Icon name="alertCircle" className="h-3 w-3" />
                          All managers
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          <Icon name="check" className="h-3 w-3" />
                          Configured
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
