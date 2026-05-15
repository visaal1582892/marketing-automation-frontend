import { useCallback, useEffect, memo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import campaignsApi from '../../api/campaigns'
import { masterApi, granularTasksApi } from '../../api/masterData'
import collaborationApi from '../../api/collaboration'
import api from '../../api/client'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'
import AppSelect from '../../components/AppSelect'
import DateRangePicker from '../../components/DateRangePicker'
import Pagination from '../../components/Pagination'
import AssetPreviewModal from '../../components/AssetPreviewModal'
import RequestBriefDrawer from '../../components/RequestBriefDrawer'
import { useAuth } from '../../auth/AuthContext'
import useDebounce from '../../hooks/useDebounce'

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'
}

function parseJsonArr(val) {
  if (!val) return []
  if (Array.isArray(val)) return val.map(String)
  try { const p = JSON.parse(val); return Array.isArray(p) ? p.map(String) : [] } catch { return [] }
}

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

  const [allTaskTypes, setAllTaskTypes] = useState([])
  const [allTaskNames, setAllTaskNames] = useState([])

  const [fCampaign,    setFCampaign]    = useState('')
  const [fTaskId,      setFTaskId]      = useState('')
  const [fTaskName,    setFTaskName]    = useState('')
  const [fTaskType,    setFTaskType]    = useState('')
  const [fCompletedBy, setFCompletedBy] = useState('')
  const [fDateFrom,    setFDateFrom]    = useState(null)
  const [fDateTo,      setFDateTo]      = useState(null)

  const [assetTask,        setAssetTask]        = useState(null)
  const [briefCampaignId,  setBriefCampaignId]  = useState(null)
  const [briefTaskId,      setBriefTaskId]      = useState(null)
  const [followupTask,     setFollowupTask]      = useState(null)

  const dCampaign    = useDebounce(fCampaign)
  const dTaskId      = useDebounce(fTaskId)
  const dCompletedBy = useDebounce(fCompletedBy)

  useEffect(() => { setPage(0) },
    [dCampaign, dTaskId, fTaskName, fTaskType, dCompletedBy, fDateFrom, fDateTo]) // eslint-disable-line react-hooks/exhaustive-deps

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
          setTasks(raw); setTotalElements(raw.length); setTotalPages(1)
        } else {
          const d = raw || {}
          setTasks(d.content || []); setTotalElements(d.totalElements || 0); setTotalPages(d.totalPages || 0)
        }
      })
      .catch(() => { if (alive) showToast('Failed to load completed tasks', 'error') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [dCampaign, dTaskId, fTaskName, fTaskType, dCompletedBy, fDateFrom, fDateTo, page, refreshSeed, location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    masterApi.list('task-types').then(d => setAllTaskTypes(d.map(t => t.name).sort())).catch(() => {})
    granularTasksApi.list().then(d => setAllTaskNames(d.map(t => t.taskName).filter(Boolean).sort())).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewAssets  = useCallback((t) => setAssetTask(t), [])
  const handleViewBrief   = useCallback((t) => { setBriefCampaignId(t.campaignId); setBriefTaskId(t.taskId) }, [])
  const handleFollowup    = useCallback((t) => setFollowupTask(t), [])

  const hasFilters = !!(fCampaign || fTaskId || fTaskName || fTaskType || fCompletedBy || fDateFrom || fDateTo)
  const clearAll   = () => {
    setFCampaign(''); setFTaskId(''); setFTaskName(''); setFTaskType('')
    setFCompletedBy(''); setFDateFrom(null); setFDateTo(null)
  }

  const filtered = tasks

  const colCls = `w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600
    placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-300 focus:border-brand-400`

  return (
    <div className="space-y-6">

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Completed Tasks</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Deliverables you have approved. Add followup tasks to any campaign if more work is needed.
          </p>
        </div>
        {!loading && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1.5 text-sm font-semibold text-green-700">
            <Icon name="check" className="h-4 w-4" />
            {tasks.length} approved task{tasks.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {!loading && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker
              from={fDateFrom} to={fDateTo}
              onChange={({ from, to }) => { setFDateFrom(from); setFDateTo(to) }}
              placeholder="All dates"
            />
            <span className="text-xs text-slate-400">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</span>
          </div>
          {hasFilters && (
            <button onClick={clearAll}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition">
              <Icon name="x" className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>
      )}

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
                <th className="w-40 px-3 pt-3 pb-1 text-right font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Actions</th>
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
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <span className="inline-flex items-center gap-2 text-sm text-slate-400">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
                      Loading…
                    </span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
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
                <CompletedTaskRow
                  key={t.taskId}
                  task={t}
                  onViewAssets={handleViewAssets}
                  onViewBrief={handleViewBrief}
                  onFollowup={handleFollowup}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-1">
          <Pagination
            page={page} totalPages={totalPages} totalElements={totalElements}
            pageSize={PAGE_SIZE} onPageChange={setPage} loading={loading}
          />
        </div>
      </div>

      {assetTask && (
        <AssetPreviewModal
          taskId={assetTask.taskId}
          taskName={assetTask.granularTaskName || `Task ${assetTask.taskId}`}
          currentUserId={user?.id}
          onClose={() => setAssetTask(null)}
        />
      )}

      {followupTask && (
        <FollowupTaskModal
          task={followupTask}
          onClose={() => setFollowupTask(null)}
          onSuccess={() => {
            setFollowupTask(null)
            showToast('Followup tasks added successfully!', 'success')
            setRefreshSeed(s => s + 1)
          }}
        />
      )}

      {briefCampaignId && (
        <RequestBriefDrawer
          campaignId={briefCampaignId}
          filterTaskId={briefTaskId}
          onClose={() => { setBriefCampaignId(null); setBriefTaskId(null) }}
        />
      )}
    </div>
  )
}

// ─── Memoized table row ───────────────────────────────────────────────────────

const CompletedTaskRow = memo(function CompletedTaskRow({ task: t, onViewAssets, onViewBrief, onFollowup }) {
  return (
    <tr className="hover:bg-slate-50/70 transition">
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
      <td className="px-3 py-3 text-slate-500">{fmtDate(t.requestorApprovedAt || t.managerApprovedAt)}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2 justify-end">
          <button onClick={() => onViewBrief(t)}
            className="flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition"
            title="View campaign brief">
            <Icon name="eye" className="h-3.5 w-3.5" /> Brief
          </button>
          <button onClick={() => onViewAssets(t)}
            className="flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition"
            title="View submitted assets">
            <Icon name="fileText" className="h-3.5 w-3.5" /> Assets
          </button>
          <button onClick={() => onFollowup(t)}
            className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
            title="Add followup tasks to this campaign">
            <Icon name="plus" className="h-3.5 w-3.5" /> Followup Task
          </button>
        </div>
      </td>
    </tr>
  )
})

// ─── Followup Task Modal ──────────────────────────────────────────────────────

function FollowupTaskModal({ task, onClose, onSuccess }) {
  const toast     = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)

  const [phase,               setPhase]               = useState('loading')
  const [completedTaskAssets, setCompletedTaskAssets] = useState([])
  const [allTaskTypes,        setAllTaskTypes]        = useState([])   // [{ id, name }]
  const [allGranularTasks,    setAllGranularTasks]    = useState([])   // [{ taskId, taskName, taskTypeId, taskTypeName }]
  const [lockedTypeIds,       setLockedTypeIds]       = useState(new Set())

  // ── Task type multi-select state ────────────────────────────────────────────
  const [selectedTypeIds,  setSelectedTypeIds]  = useState(new Set())
  const [typeSearch,       setTypeSearch]       = useState('')
  const [typeDropOpen,     setTypeDropOpen]     = useState(false)
  const typeRef = useRef(null)

  // ── Task multi-select state ─────────────────────────────────────────────────
  const [taskSearch,   setTaskSearch]   = useState('')
  const [taskDropOpen, setTaskDropOpen] = useState(false)
  const taskRef = useRef(null)

  // ── Per-selected-task state: { [granularTaskId]: { questionnaire, stagedFiles, selectedAssets } }
  const [taskData,      setTaskData]      = useState({})
  const [taskQuestions, setTaskQuestions] = useState({})
  const [loadingQs,     setLoadingQs]     = useState({})

  const [saving, setSaving] = useState(false)

  // ── Load master data ────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    Promise.all([
      campaignsApi.getById(task.campaignId),
      masterApi.list('task-types'),
      granularTasksApi.list(),
      collaborationApi.getAssets(task.taskId).catch(() => ({ data: [] })),
    ]).then(([campRes, types, granTasks, assetsRes]) => {
      if (!alive) return
      const typeMap = {}
      for (const t of types) typeMap[String(t.id)] = t.name
      setAllTaskTypes(types.map(t => ({ id: String(t.id), name: t.name })))
      setAllGranularTasks(
        (granTasks || [])
          .filter(t => t.taskId !== 'TASK-AUTO-CONTENT')
          .map(t => ({
            taskId:       String(t.taskId),
            taskName:     t.taskName || t.name || '',
            taskTypeId:   String(t.taskTypeId || ''),
            taskTypeName: typeMap[String(t.taskTypeId)] || t.taskTypeName || '',
          }))
      )
      const campTypeIds = new Set(parseJsonArr(campRes.data.taskTypeId))
      setLockedTypeIds(campTypeIds)
      setSelectedTypeIds(new Set(campTypeIds))
      const assets = assetsRes?.data || []
      setCompletedTaskAssets(Array.isArray(assets) ? assets : [])
      setPhase('form')
    }).catch(() => { if (alive) setPhase('error') })
    return () => { alive = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close dropdowns on outside click ───────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if (typeRef.current && !typeRef.current.contains(e.target)) setTypeDropOpen(false)
      if (taskRef.current && !taskRef.current.contains(e.target)) setTaskDropOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // ── Derived ─────────────────────────────────────────────────────────────────
  const filteredByType = allGranularTasks.filter(t => selectedTypeIds.has(t.taskTypeId))
  const taskDropList   = filteredByType.filter(t =>
    t.taskName.toLowerCase().includes(taskSearch.toLowerCase()) ||
    t.taskTypeName.toLowerCase().includes(taskSearch.toLowerCase())
  )
  const selectedTaskIds = Object.keys(taskData)

  // ── Task type helpers ───────────────────────────────────────────────────────
  const toggleType = (typeId) => {
    if (lockedTypeIds.has(typeId)) return
    setSelectedTypeIds(prev => {
      const n = new Set(prev)
      if (n.has(typeId)) {
        n.delete(typeId)
        // deselect tasks belonging to this type
        setTaskData(prev => {
          const nd = { ...prev }
          for (const t of allGranularTasks) if (t.taskTypeId === typeId) delete nd[t.taskId]
          return nd
        })
      } else {
        n.add(typeId)
      }
      return n
    })
  }

  const typeDropItems = allTaskTypes.filter(t =>
    t.name.toLowerCase().includes(typeSearch.toLowerCase())
  )

  // ── Task selection helpers ──────────────────────────────────────────────────
  const toggleTask = (taskId) => {
    if (taskData[taskId]) {
      setTaskData(prev => { const n = { ...prev }; delete n[taskId]; return n })
      return
    }
    setTaskData(prev => ({ ...prev, [taskId]: { questionnaire: {}, stagedFiles: [], selectedAssets: new Set() } }))
    if (!taskQuestions[taskId]) {
      setLoadingQs(prev => ({ ...prev, [taskId]: true }))
      granularTasksApi.getQuestions(taskId)
        .then(qs => setTaskQuestions(prev => ({ ...prev, [taskId]: qs || [] })))
        .catch(() => setTaskQuestions(prev => ({ ...prev, [taskId]: [] })))
        .finally(() => setLoadingQs(prev => ({ ...prev, [taskId]: false })))
    }
  }

  const updateAnswer = (taskId, qid, val) =>
    setTaskData(prev => ({
      ...prev, [taskId]: { ...prev[taskId], questionnaire: { ...prev[taskId]?.questionnaire, [qid]: val } }
    }))

  const addFiles = (taskId, files) =>
    setTaskData(prev => ({
      ...prev, [taskId]: { ...prev[taskId], stagedFiles: [...(prev[taskId]?.stagedFiles || []), ...files] }
    }))

  const removeFile = (taskId, url) =>
    setTaskData(prev => ({
      ...prev, [taskId]: { ...prev[taskId], stagedFiles: (prev[taskId]?.stagedFiles || []).filter(f => f.url !== url) }
    }))

  const toggleAssetForTask = (taskId, assetId) =>
    setTaskData(prev => {
      const cur = new Set(prev[taskId]?.selectedAssets || [])
      if (cur.has(assetId)) cur.delete(assetId); else cur.add(assetId)
      return { ...prev, [taskId]: { ...prev[taskId], selectedAssets: cur } }
    })

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (selectedTaskIds.length === 0) { showToast('Select at least one task.', 'error'); return }
    for (const taskId of selectedTaskIds) {
      const qs  = taskQuestions[taskId] || []
      const ans = taskData[taskId]?.questionnaire || {}
      for (const q of qs) {
        if (!(q.required ?? q.isRequired)) continue
        const v = ans[q.questionId]
        const empty = q.fieldType === 'MULTISELECT'
          ? (() => { try { return JSON.parse(v || '[]').length === 0 } catch { return true } })()
          : (v == null || String(v).trim() === '')
        if (empty) {
          const t = allGranularTasks.find(t => t.taskId === taskId)
          showToast(`"${q.questionText}" required for "${t?.taskName || taskId}".`, 'error')
          return
        }
      }
    }
    setSaving(true)
    try {
      const specs = selectedTaskIds.map(taskId => {
        const qn      = taskData[taskId]?.questionnaire || {}
        const answers = Object.entries(qn)
          .filter(([, v]) => v != null && String(v).trim() !== '')
          .map(([questionId, answerValue]) => ({ questionId, answerValue }))
        // Collect task file URLs: uploaded + selected from completed task
        const fileUrls = []; const fileOriginalNames = []
        for (const f of (taskData[taskId]?.stagedFiles || [])) {
          if (f.url) { fileUrls.push(f.url); fileOriginalNames.push(f.name || f.url.split('/').pop()) }
        }
        for (const assetId of (taskData[taskId]?.selectedAssets || [])) {
          const a = completedTaskAssets.find(a => String(a.assetId) === String(assetId))
          if (a?.url) { fileUrls.push(a.url); fileOriginalNames.push(a.originalFilename || a.url.split('/').pop()) }
        }
        return {
          granularTaskId: taskId,
          questionnaireAnswers: answers,
          ...(fileUrls.length > 0 && { fileUrls, fileOriginalNames }),
        }
      })
      await campaignsApi.addFollowupTasks(task.campaignId, { specs })
      onSuccess()
    } catch (e) {
      showToast(e?.response?.data?.message || 'Failed to add followup tasks.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      {/*
        Layout: header + dropdowns stay outside the scroll container so absolute
        dropdown panels are never clipped. Only the task-cards section scrolls.
      */}
      <div className="w-full max-w-2xl h-[96vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200">

        {/* ── Header ── rounded-t via parent overflow-hidden */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">+ Followup Task</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Campaign #{task.campaignId} · Task #{task.taskId} — {task.granularTaskName || task.taskTypeName}
            </p>
          </div>
          <button onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        {/* Loading / error (full-area) */}
        {phase === 'loading' && (
          <div className="flex-1 flex items-center justify-center">
            <span className="inline-flex items-center gap-2 text-sm text-slate-400">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
              Loading…
            </span>
          </div>
        )}
        {phase === 'error' && (
          <div className="flex-1 flex items-center justify-center text-sm text-red-500">
            Failed to load. Close and try again.
          </div>
        )}

        {phase === 'form' && (
          <>
            {/*
              ── Dropdown fields — NOT inside overflow-y-auto ──
              They live in a shrink-0 section so their absolute panels can
              freely extend downward without being clipped.
            */}
            <div className="shrink-0 px-6 pt-5 pb-3 space-y-4 border-b border-slate-100 relative z-20">
              {/* 1. Task Type */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Task Type
                </label>
                <MultiSearchSelect
                  containerRef={typeRef}
                  open={typeDropOpen}
                  onOpenChange={setTypeDropOpen}
                  search={typeSearch}
                  onSearchChange={setTypeSearch}
                  options={typeDropItems}
                  selectedIds={selectedTypeIds}
                  lockedIds={lockedTypeIds}
                  onToggle={toggleType}
                  getLabel={id => allTaskTypes.find(t => t.id === id)?.name || id}
                  placeholder="Select task types…"
                  searchPlaceholder="Search task types…"
                />
              </div>

              {/* 2. Select Tasks */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Select Tasks
                </label>
                {selectedTypeIds.size === 0 ? (
                  <p className="text-xs text-slate-400">Select task types first.</p>
                ) : (
                  <TaskMultiSelect
                    containerRef={taskRef}
                    open={taskDropOpen}
                    onOpenChange={setTaskDropOpen}
                    search={taskSearch}
                    onSearchChange={setTaskSearch}
                    options={taskDropList}
                    selectedIds={new Set(selectedTaskIds)}
                    onToggle={toggleTask}
                    placeholder="Select tasks to add…"
                  />
                )}
              </div>
            </div>

            {/* ── Task cards scroll area ── */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {selectedTaskIds.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-10">
                  <Icon name="inbox" className="h-10 w-10 text-slate-200 mb-3" />
                  <p className="text-sm text-slate-400">Select tasks above to configure them here.</p>
                </div>
              ) : selectedTaskIds.map(taskId => {
                const t = allGranularTasks.find(x => x.taskId === taskId)
                if (!t) return null
                return (
                  <SelectedTaskCard
                    key={taskId}
                    task={t}
                    data={taskData[taskId]}
                    questions={taskQuestions[taskId] || []}
                    loadingQs={!!loadingQs[taskId]}
                    completedAssets={completedTaskAssets}
                    onRemove={() => toggleTask(taskId)}
                    onAnswerChange={(qid, val) => updateAnswer(taskId, qid, val)}
                    onFilesAdd={files => addFiles(taskId, files)}
                    onFileRemove={url => removeFile(taskId, url)}
                    onToggleAsset={assetId => toggleAssetForTask(taskId, assetId)}
                  />
                )
              })}
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
              <span className="text-xs text-slate-500">
                {selectedTaskIds.length > 0
                  ? `${selectedTaskIds.length} task${selectedTaskIds.length !== 1 ? 's' : ''} selected`
                  : 'No tasks selected'}
              </span>
              <div className="flex gap-3">
                <button onClick={onClose} disabled={saving}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white transition disabled:opacity-60">
                  Cancel
                </button>
                <button onClick={handleSubmit} disabled={saving || selectedTaskIds.length === 0}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50">
                  {saving
                    ? <><span className="animate-spin h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent" /> Saving…</>
                    : <><Icon name="plus" className="h-3.5 w-3.5" /> Add Followup Tasks</>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Multi-search-select for task types ──────────────────────────────────────

const MultiSearchSelect = ({ containerRef, open, onOpenChange, search, onSearchChange,
  options, selectedIds, lockedIds, onToggle, getLabel, placeholder, searchPlaceholder }) => {
  const selected = [...selectedIds]
  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <div
        onClick={() => onOpenChange(!open)}
        className="min-h-[38px] flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 cursor-pointer hover:border-brand-400 transition">
        {selected.length === 0 && (
          <span className="text-sm text-slate-400">{placeholder}</span>
        )}
        {selected.map(id => {
          const isLocked = lockedIds?.has(id)
          return (
            <span key={id}
              className="inline-flex items-center gap-1 rounded-full bg-brand-100 text-brand-800 px-2.5 py-0.5 text-xs font-semibold">
              {getLabel(id)}
              {!isLocked && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onToggle(id) }}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-brand-200 transition">
                  <Icon name="x" className="h-2.5 w-2.5" />
                </button>
              )}
            </span>
          )
        })}
        <Icon name="chevronDown" className={`ml-auto h-4 w-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input autoFocus value={search} onChange={e => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-300" />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {options.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">No results</li>}
            {options.map(opt => {
              const checked  = selectedIds.has(opt.id)
              const isLocked = lockedIds?.has(opt.id)
              return (
                <li key={opt.id}>
                  <label className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer transition
                    ${checked ? 'bg-brand-50 text-brand-800' : 'hover:bg-slate-50 text-slate-700'}
                    ${isLocked ? 'opacity-75' : ''}`}>
                    <input type="checkbox" checked={checked} disabled={isLocked}
                      onChange={() => onToggle(opt.id)}
                      className="h-4 w-4 accent-brand-600 shrink-0" />
                    <span className="flex-1">{opt.name}</span>
                    {isLocked && <span className="text-[10px] text-brand-500 bg-brand-100 rounded px-1">existing</span>}
                  </label>
                </li>
              )
            })}
          </ul>
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
            <span>{selected.length} selected</span>
            <button onClick={() => onOpenChange(false)}
              className="font-semibold text-brand-600 hover:underline">Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Multi-search-select for tasks ───────────────────────────────────────────

const TaskMultiSelect = ({ containerRef, open, onOpenChange, search, onSearchChange,
  options, selectedIds, onToggle, placeholder }) => {
  const selectedArr = [...selectedIds]
  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => onOpenChange(!open)}
        className="min-h-[38px] flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 cursor-pointer hover:border-brand-400 transition">
        {selectedArr.length === 0 && <span className="text-sm text-slate-400">{placeholder}</span>}
        {selectedArr.slice(0, 2).map(id => (
          <span key={id}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-xs font-semibold truncate max-w-[160px]">
            <span className="truncate">{options.find(o => o.taskId === id)?.taskName || id}</span>
            <button type="button" onClick={e => { e.stopPropagation(); onToggle(id) }}
              className="ml-0.5 rounded-full p-0.5 hover:bg-slate-300 transition shrink-0">
              <Icon name="x" className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {selectedArr.length > 2 && (
          <span className="rounded-full bg-brand-600 text-white px-2 py-0.5 text-xs font-bold">
            +{selectedArr.length - 2} more
          </span>
        )}
        <Icon name="chevronDown" className={`ml-auto h-4 w-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input autoFocus value={search} onChange={e => onSearchChange(e.target.value)}
                placeholder="Search tasks…"
                className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-300" />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {options.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">No tasks available</li>}
            {options.map(t => {
              const checked = selectedIds.has(t.taskId)
              return (
                <li key={t.taskId}>
                  <label className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer transition
                    ${checked ? 'bg-brand-50 text-brand-800' : 'hover:bg-slate-50 text-slate-700'}`}>
                    <input type="checkbox" checked={checked} onChange={() => onToggle(t.taskId)}
                      className="h-4 w-4 accent-brand-600 shrink-0" />
                    <span className="flex-1">{t.taskName}</span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {t.taskTypeName}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
            <span>{selectedArr.length} selected</span>
            <button onClick={() => onOpenChange(false)}
              className="font-semibold text-brand-600 hover:underline">Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Selected task expanded card ──────────────────────────────────────────────

function SelectedTaskCard({ task: t, data, questions, loadingQs, completedAssets,
  onRemove, onAnswerChange, onFilesAdd, onFileRemove, onToggleAsset }) {
  return (
    <div className="rounded-xl border border-brand-200 bg-white shadow-sm">
      {/* Card header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-brand-50 border-b border-brand-100 rounded-t-xl">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full bg-brand-500 shrink-0" />
          <span className="text-sm font-semibold text-brand-800 truncate">{t.taskName}</span>
          <span className="shrink-0 text-xs text-brand-500 bg-brand-100 rounded-full px-2 py-0.5">
            {t.taskTypeName}
          </span>
        </div>
        <button type="button" onClick={onRemove}
          className="rounded-full p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition shrink-0"
          title="Remove task">
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Questions */}
        {loadingQs ? (
          <p className="text-xs text-slate-400">Loading questions…</p>
        ) : questions.length > 0 && (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Questions</p>
            {questions.map((q, idx) => (
              <QuestionField key={q.questionId} question={q} index={idx}
                value={data?.questionnaire?.[q.questionId]}
                onChange={v => onAnswerChange(q.questionId, v)} />
            ))}
          </div>
        )}

        {/* File upload */}
        <TaskFileUpload
          stagedFiles={data?.stagedFiles || []}
          onFilesAdd={onFilesAdd}
          onFileRemove={onFileRemove}
        />

        {/* Reuse from completed task */}
        {completedAssets.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Reuse from completed task
              <span className="ml-1 normal-case text-slate-400 font-normal">
                — select to share with this new task
              </span>
            </p>
            <div className="space-y-1">
              {completedAssets.map(a => {
                const name    = a.originalFilename || a.url?.split('/').pop() || 'File'
                const checked = (data?.selectedAssets || new Set()).has(String(a.assetId))
                return (
                  <label key={a.assetId}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition
                      ${checked ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}>
                    <input type="checkbox" checked={checked}
                      onChange={() => onToggleAsset(String(a.assetId))}
                      className="h-4 w-4 accent-emerald-600 shrink-0" />
                    <Icon name="fileText" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="flex-1 truncate text-xs text-slate-700">{name}</span>
                    <a href={a.url} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="shrink-0 text-xs text-brand-600 hover:underline">View</a>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Question field ────────────────────────────────────────────────────────────

function parseQuestionOptions(opts) {
  if (!opts) return []
  if (Array.isArray(opts)) return opts.map(String)
  try { const p = JSON.parse(opts); return Array.isArray(p) ? p.map(String) : [String(p)] } catch { return [String(opts)] }
}

function QuestionField({ question: q, index, value, onChange }) {
  const req = q.required ?? q.isRequired
  const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500'

  const getMultiValues = () => {
    if (!value) return []
    try { return JSON.parse(value) } catch { return [] }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {index + 1}. {q.questionText}
        {req && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {q.fieldType === 'TEXT' && (
        <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)}
          className={inputCls} placeholder="Your answer…" />
      )}
      {q.fieldType === 'NUMBER' && (
        <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value)}
          className={inputCls} placeholder="0" />
      )}
      {q.fieldType === 'TEXTAREA' && (
        <textarea rows={3} value={value ?? ''} onChange={e => onChange(e.target.value)}
          className={`${inputCls} resize-y`} placeholder="Your answer…" />
      )}
      {q.fieldType === 'DATE' && (
        <input type="date" value={value ?? ''} onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500" />
      )}
      {q.fieldType === 'DROPDOWN' && (
        <AppSelect value={value ?? ''} onChange={onChange}
          options={parseQuestionOptions(q.options)} placeholder="Select…" />
      )}
      {q.fieldType === 'MULTISELECT' && (
        <div className="flex flex-wrap gap-2">
          {parseQuestionOptions(q.options).map(opt => {
            const cur = getMultiValues()
            const checked = cur.includes(opt)
            return (
              <label key={opt}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs cursor-pointer transition
                  ${checked ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                <input type="checkbox" checked={checked}
                  onChange={() => onChange(JSON.stringify(checked ? cur.filter(x => x !== opt) : [...cur, opt]))}
                  className="h-3.5 w-3.5 accent-brand-600" />
                {opt}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Per-task file upload ─────────────────────────────────────────────────────

function TaskFileUpload({ stagedFiles, onFilesAdd, onFileRemove }) {
  const [pendingUploads, setPendingUploads] = useState([])
  const [dragOver,       setDragOver]       = useState(false)
  const fileInputRef = useRef(null)

  const uploadOne = async (file, id) => {
    try {
      const fd = new FormData(); fd.append('files', file)
      const res = await api.post('/upload/asset', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const url = res.data?.urls?.[0]
      if (!url) throw new Error(res.data?.errors?.[0] || 'Upload failed')
      return { url, name: file.name }
    } catch (err) {
      const raw = err?.response?.data?.message || err?.message || 'Upload failed'
      throw new Error(raw.length > 60 ? 'Upload failed' : raw)
    }
  }

  const startUploads = async (files) => {
    if (!files?.length) return
    const entries = Array.from(files).map(f => ({
      id: Math.random().toString(36).slice(2), name: f.name, uploading: true, error: null, file: f,
    }))
    setPendingUploads(prev => [...prev, ...entries])
    for (const entry of entries) {
      try {
        const result = await uploadOne(entry.file, entry.id)
        setPendingUploads(prev => prev.filter(p => p.id !== entry.id))
        onFilesAdd([result])
      } catch (err) {
        setPendingUploads(prev => prev.map(p => p.id === entry.id
          ? { ...p, uploading: false, error: err.message }
          : p))
      }
    }
  }

  const retryUpload = async (id) => {
    const entry = pendingUploads.find(p => p.id === id)
    if (!entry?.file) return
    setPendingUploads(prev => prev.map(p => p.id === id ? { ...p, uploading: true, error: null } : p))
    try {
      const result = await uploadOne(entry.file, id)
      setPendingUploads(prev => prev.filter(p => p.id !== id))
      onFilesAdd([result])
    } catch (err) {
      setPendingUploads(prev => prev.map(p => p.id === id
        ? { ...p, uploading: false, error: err.message }
        : p))
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        Task Reference Files
        {stagedFiles.length > 0 && (
          <span className="ml-1.5 normal-case font-medium text-violet-600">({stagedFiles.length} staged)</span>
        )}
      </p>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); startUploads(Array.from(e.dataTransfer.files)) }}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer py-5 transition select-none
          ${dragOver ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-slate-50/50 hover:border-brand-300 hover:bg-brand-50/30'}`}>
        <Icon name="upload" className={`h-5 w-5 ${dragOver ? 'text-brand-500' : 'text-slate-400'}`} />
        <p className={`text-xs font-medium ${dragOver ? 'text-brand-600' : 'text-slate-500'}`}>Click or drag files here</p>
        <input ref={fileInputRef} type="file" multiple className="hidden"
          onChange={e => { startUploads(Array.from(e.target.files)); e.target.value = '' }} />
      </div>

      {/* In-progress / failed */}
      {pendingUploads.length > 0 && (
        <ul className="space-y-1">
          {pendingUploads.map(p => (
            <li key={p.id} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs
              ${p.error ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
              {p.uploading ? (
                <svg className="h-3.5 w-3.5 animate-spin text-brand-400 shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <Icon name="alertCircle" className="h-3.5 w-3.5 text-red-400 shrink-0" />
              )}
              <span className={`flex-1 truncate ${p.error ? 'text-red-600' : 'text-slate-600'}`}>
                {p.error ? `${p.name} — ${p.error}` : p.name}
              </span>
              {p.uploading && <span className="shrink-0 text-slate-400 text-[10px]">Uploading…</span>}
              {p.error && (
                <button type="button" onClick={() => retryUpload(p.id)}
                  className="shrink-0 text-xs font-medium text-brand-600 hover:underline">Retry</button>
              )}
              {!p.uploading && (
                <button type="button" onClick={() => setPendingUploads(prev => prev.filter(x => x.id !== p.id))}
                  className="shrink-0 text-slate-400 hover:text-red-500 transition">
                  <Icon name="x" className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Staged files */}
      {stagedFiles.length > 0 && (
        <ul className="space-y-1">
          {stagedFiles.map(f => (
            <li key={f.url} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">
              <Icon name="fileText" className="h-3.5 w-3.5 shrink-0 text-red-400" />
              <span className="flex-1 truncate text-slate-700">{f.name}</span>
              <a href={f.url} target="_blank" rel="noopener noreferrer"
                className="shrink-0 text-brand-600 hover:underline font-medium">View</a>
              <button type="button" onClick={() => onFileRemove(f.url)}
                className="shrink-0 text-slate-400 hover:text-red-500 transition">
                <Icon name="x" className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
