import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import campaignsApi from '../../api/campaigns'
import { masterApi, granularTasksApi } from '../../api/masterData'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'
import AppSelect from '../../components/AppSelect'
import DateRangePicker from '../../components/DateRangePicker'
import Pagination from '../../components/Pagination'
import AssetPreviewModal from '../../components/AssetPreviewModal'
import { useAuth } from '../../auth/AuthContext'
import { useDebounce } from '../../hooks/useDebounce'

/**
 * Requestor view — tasks approved by the Marketing Head, shown as a filterable
 * table. The requestor can view submitted assets and request rework.
 */
export default function CompletedTasksPage() {
  const location  = useLocation()
  const toast     = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)
  const { user }  = useAuth()

  const PAGE_SIZE = 20

  const [tasks,         setTasks]         = useState([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages,    setTotalPages]    = useState(0)
  const [page,          setPage]          = useState(0)
  const [loading,       setLoading]       = useState(true)
  const [refreshSeed,   setRefreshSeed]   = useState(0)

  // ── Master data for dropdowns ───────────────────────────────────────────────
  const [allTaskTypes, setAllTaskTypes] = useState([])
  const [allTaskNames, setAllTaskNames] = useState([])

  // ── Column filters ──────────────────────────────────────────────────────────
  const [fCampaign,    setFCampaign]    = useState('')
  const [fTaskId,      setFTaskId]      = useState('')
  const [fTaskName,    setFTaskName]    = useState('')
  const [fTaskType,    setFTaskType]    = useState('')
  const [fCompletedBy, setFCompletedBy] = useState('')
  const [fDateFrom,    setFDateFrom]    = useState(null)
  const [fDateTo,      setFDateTo]      = useState(null)

  // ── Rework modal ────────────────────────────────────────────────────────────
  const [reworkTask,   setReworkTask]   = useState(null)
  const [reworkMsg,    setReworkMsg]    = useState('')
  const [reworkSaving, setReworkSaving] = useState(false)

  // ── Asset preview modal ─────────────────────────────────────────────────────
  const [assetTask, setAssetTask] = useState(null)

  // ── Debounced text inputs ───────────────────────────────────────────────────
  const dCampaign     = useDebounce(fCampaign)
  const dTaskId       = useDebounce(fTaskId)
  const dCompletedBy  = useDebounce(fCompletedBy)

  // ── Reset page when filters change ─────────────────────────────────────────
  useEffect(() => { setPage(0) },
    [dCampaign, dTaskId, fTaskName, fTaskType, dCompletedBy, fDateFrom, fDateTo]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch from backend ─────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    setLoading(true)
    const params = {
      page, size: PAGE_SIZE,
      ...(dCampaign    && { campaignId:   dCampaign    }),
      ...(dTaskId      && { taskId:       dTaskId      }),
      ...(fTaskName    && { taskName:     fTaskName    }),
      ...(fTaskType    && { taskType:     fTaskType    }),
      ...(dCompletedBy && { completedBy:  dCompletedBy }),
      ...(fDateFrom    && { dateFrom:     fDateFrom    }),
      ...(fDateTo      && { dateTo:       fDateTo      }),
    }
    campaignsApi.completedTasks(params)
      .then(res => {
        if (!alive) return
        const raw = res.data
        if (Array.isArray(raw)) {
          setTasks(raw)
          setTotalElements(raw.length)
          setTotalPages(1)
        } else {
          const d = raw || {}
          setTasks(d.content || [])
          setTotalElements(d.totalElements || 0)
          setTotalPages(d.totalPages || 0)
        }
      })
      .catch(() => { if (alive) showToast('Failed to load completed tasks', 'error') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [dCampaign, dTaskId, fTaskName, fTaskType, dCompletedBy, fDateFrom, fDateTo, page, refreshSeed, location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load master data once for dropdowns ────────────────────────────────────
  useEffect(() => {
    masterApi.list('task-types').then(d => setAllTaskTypes(d.map(t => t.name).sort())).catch(() => {})
    granularTasksApi.list().then(d => setAllTaskNames(d.map(t => t.taskName).filter(Boolean).sort())).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openRework = (task) => { setReworkTask(task); setReworkMsg('') }

  const submitRework = async () => {
    if (!reworkTask || !reworkMsg.trim()) return
    setReworkSaving(true)
    try {
      await campaignsApi.requestorRework(reworkTask.campaignId, reworkTask.taskId, reworkMsg.trim())
      showToast('Rework request sent to the creator.', 'success')
      setReworkTask(null)
      setReworkMsg('')
      setRefreshSeed(s => s + 1)
    } catch (e) {
      showToast(e?.response?.data?.message || 'Failed to request rework', 'error')
    } finally {
      setReworkSaving(false)
    }
  }

  const hasFilters = !!(fCampaign || fTaskId || fTaskName || fTaskType || fCompletedBy || fDateFrom || fDateTo)
  const clearAll   = () => {
    setFCampaign(''); setFTaskId(''); setFTaskName(''); setFTaskType('')
    setFCompletedBy(''); setFDateFrom(null); setFDateTo(null)
  }

  // Server already filtered and sorted — just use directly
  const filtered = tasks

  const colCls = `w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600
    placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-300 focus:border-brand-400`

  const fmtDate = (iso) =>
    iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Completed Tasks</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Deliverables approved by the Marketing Head. Review assets and request rework if needed.
          </p>
        </div>
        {!loading && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1.5 text-sm font-semibold text-green-700">
            <Icon name="check" className="h-4 w-4" />
            {tasks.length} approved task{tasks.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Date range + row count + clear ── */}
      {!loading && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker
              from={fDateFrom}
              to={fDateTo}
              onChange={({ from, to }) => { setFDateFrom(from); setFDateTo(to) }}
              placeholder="All dates"
            />
            <span className="text-xs text-slate-400">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</span>
          </div>
          {hasFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition"
            >
              <Icon name="x" className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="animate-spin h-6 w-6 rounded-full border-2 border-brand-300 border-t-brand-600" />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="w-20 px-3 pt-3 pb-1 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Campaign</th>
                  <th className="w-28 px-3 pt-3 pb-1 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Task ID</th>
                  <th className="px-3 pt-3 pb-1 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Task Name</th>
                  <th className="w-36 px-3 pt-3 pb-1 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Task Type</th>
                  <th className="w-36 px-3 pt-3 pb-1 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Completed By</th>
                  <th className="w-28 px-3 pt-3 pb-1 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Completed At</th>
                  <th className="w-32 px-3 pt-3 pb-1 text-right font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Actions</th>
                </tr>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <td className="px-2 pb-2 pt-1">
                    <input value={fCampaign} onChange={e => setFCampaign(e.target.value)} placeholder="Search…" className={colCls} />
                  </td>
                  <td className="px-2 pb-2 pt-1">
                    <input value={fTaskId} onChange={e => setFTaskId(e.target.value)} placeholder="Search…" className={colCls} />
                  </td>
                  <td className="px-2 pb-2 pt-1">
                    <AppSelect value={fTaskName} onChange={setFTaskName} options={allTaskNames} placeholder="All" size="sm" isSearchable menuPortal />
                  </td>
                  <td className="px-2 pb-2 pt-1">
                    <AppSelect value={fTaskType} onChange={setFTaskType} options={allTaskTypes} placeholder="All" size="sm" isSearchable menuPortal />
                  </td>
                  <td className="px-2 pb-2 pt-1">
                    <input value={fCompletedBy} onChange={e => setFCompletedBy(e.target.value)} placeholder="Search…" className={colCls} />
                  </td>
                  <td className="px-2 pb-2 pt-1" />
                  <td className="px-2 pb-2 pt-1" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-14 text-center">
                      <Icon name="inbox" className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                      <p className="text-sm text-slate-500">
                        {hasFilters ? 'No tasks match the current filters.' : 'No completed tasks yet.'}
                      </p>
                      {hasFilters && (
                        <button onClick={clearAll} className="mt-2 text-xs text-brand-600 hover:underline">
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : filtered.map(t => (
                  <tr key={t.taskId} className="hover:bg-slate-50/70 transition">
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-600">
                        {t.campaignId}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-600">
                        {t.taskId}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-800">
                      {t.granularTaskName || t.taskTypeName || '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {t.taskTypeName
                        ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{t.taskTypeName}</span>
                        : '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{t.assigneeName || '—'}</td>
                    <td className="px-3 py-3 text-slate-500">{fmtDate(t.completedAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setAssetTask(t)}
                          className="flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition"
                          title="View submitted assets"
                        >
                          <Icon name="fileText" className="h-3.5 w-3.5" />
                          Assets
                        </button>
                        <button
                          onClick={() => openRework(t)}
                          className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition"
                        >
                          <Icon name="refresh" className="h-3.5 w-3.5" />
                          Rework
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-1">
            <Pagination
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              loading={loading}
            />
          </div>
        </div>
      )}

      {/* ── Asset preview modal ── */}
      {assetTask && (
        <AssetPreviewModal
          taskId={assetTask.taskId}
          taskName={assetTask.granularTaskName || `Task ${assetTask.taskId}`}
          currentUserId={user?.id}
          onClose={() => setAssetTask(null)}
        />
      )}

      {/* ── Rework modal ── */}
      {reworkTask && (
        <ReworkModal
          task={reworkTask}
          message={reworkMsg}
          onMessageChange={setReworkMsg}
          saving={reworkSaving}
          onCancel={() => setReworkTask(null)}
          onConfirm={submitRework}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function ReworkModal({ task, message, onMessageChange, saving, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Request Rework</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Task #{task.taskId} — {task.granularTaskName || task.taskTypeName || 'Task'}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-full p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <div className="font-semibold mb-0.5">This will send the task back for rework</div>
            <div>The creator will receive your message and need to redo this deliverable.</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Message to creator <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={e => onMessageChange(e.target.value)}
              placeholder="Explain what needs to be changed or improved…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400
                         focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300 resize-none"
              autoFocus
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white transition disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving || !message.trim()}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition disabled:opacity-50"
          >
            {saving ? (
              <><span className="animate-spin h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent" /> Sending…</>
            ) : (
              <><Icon name="send" className="h-3.5 w-3.5" /> Send for Rework</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
