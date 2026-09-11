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
import { LinkedTaskModal } from '../../components/tasks/LinkedTaskModal'
import ActionMenu, { ActionMenuItem } from '../../components/ActionMenu'
import { useAuth } from '../../auth/AuthContext'
import { Rights } from '../../constants/rights'
import useDebounce from '../../hooks/useDebounce'
import StoreIdDisplay from '../../components/StoreIdDisplay'
import { DATA_TABLE_CLASS, DataTableColGroup, TableStatusRow, dataTableStyle } from '../../components/dataTable'
import { formatTaskId } from '../../utils/formatters'

const completedCellCls = 'min-w-0 overflow-hidden px-4 py-3'

/** Sticky Actions column — solid bg so fixed column obvious */
const ACTIONS_STICKY_HEADER = 'sticky right-0 z-30 bg-slate-100'
const ACTIONS_STICKY_BODY = 'sticky right-0 z-[1] bg-slate-50'
const COMPLETED_TABLE_COLS = [116, 100, 116, 300, 256, 176, 140, 80]
const COMPLETED_TABLE_MIN_WIDTH = COMPLETED_TABLE_COLS.reduce((s, w) => s + w, 0)

const filterWrapCls = 'min-w-0 w-full [&_.app-select__control]:!min-h-[28px] [&_.app-select__control]:!h-[28px]'

function FilterCell({ children }) {
  return (
    <td className="min-w-0 bg-slate-50 px-3 pb-2 pt-1 align-top">
      {children != null ? <div className="min-w-0 w-full">{children}</div> : null}
    </td>
  )
}

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
  const { user, hasRight }  = useAuth()
  
  const canAddFollowup = hasRight(Rights.ADD_FOLLOWUP_TASKS)

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
  const [fStoreId,     setFStoreId]     = useState('')
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
  const dStoreId     = useDebounce(fStoreId)
  const dTaskId      = useDebounce(fTaskId)
  const dCompletedBy = useDebounce(fCompletedBy)

  useEffect(() => { setPage(0) },
    [dCampaign, dStoreId, dTaskId, fTaskName, fTaskType, dCompletedBy, fDateFrom, fDateTo]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true
    setLoading(true)
    const params = {
      page, size: PAGE_SIZE,
      ...(dCampaign    && { campaignId:   dCampaign    }),
      ...(dStoreId     && { storeId:      dStoreId     }),
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
  }, [dCampaign, dStoreId, dTaskId, fTaskName, fTaskType, dCompletedBy, fDateFrom, fDateTo, page, refreshSeed, location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    masterApi.list('task-types', true).then(d => setAllTaskTypes(d.map(t => t.name).sort())).catch(() => {})
    granularTasksApi.list(true).then(d => setAllTaskNames(d.map(t => t.taskName).filter(Boolean).sort())).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewAssets  = useCallback((t) => setAssetTask(t), [])
  const handleViewBrief   = useCallback((t) => { setBriefCampaignId(t.campaignId); setBriefTaskId(t.taskId) }, [])
  const handleFollowup    = useCallback((t) => setFollowupTask(t), [])

  const hasFilters = !!(fCampaign || fStoreId || fTaskId || fTaskName || fTaskType || fCompletedBy || fDateFrom || fDateTo)
  const clearAll   = () => {
    setFCampaign(''); setFStoreId(''); setFTaskId(''); setFTaskName(''); setFTaskType(''); setFCompletedBy('');
    setFDateFrom(null); setFDateTo(null)
  }

  const filtered = tasks

  const colCls = `w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600
    placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-300 focus:border-brand-400`

  return (
    <div className="h-full flex flex-col gap-2">

      {/* ── Controls bar ── */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            from={fDateFrom} to={fDateTo}
            onChange={({ from, to }) => { setFDateFrom(from); setFDateTo(to) }}
            placeholder="All dates"
          />
          {!loading && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-semibold text-green-700">
              <Icon name="check" className="h-3.5 w-3.5" />
              {tasks.length} approved task{tasks.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {hasFilters && (
          <button onClick={clearAll}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition">
            <Icon name="x" className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="w-full flex-1 overflow-auto">
          <table
            className={DATA_TABLE_CLASS}
            style={dataTableStyle(COMPLETED_TABLE_MIN_WIDTH)}
          >
            <DataTableColGroup widths={COMPLETED_TABLE_COLS} />
            <thead className="sticky top-0 z-20 bg-slate-50">
              <tr className="bg-slate-50">
                <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Campaign</th>
                <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Store ID</th>
                <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Task ID</th>
                <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Task Name</th>
                <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Task Type</th>
                <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Completed By</th>
                <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Completed At</th>
                <th className={`${ACTIONS_STICKY_HEADER} min-w-0 border-b border-slate-200 px-4 pb-1 pt-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap`}>Actions</th>
              </tr>
              <tr className="border-b border-slate-200">
                <FilterCell>
                  <input value={fCampaign} onChange={e => setFCampaign(e.target.value)} placeholder="Search…" className={colCls} />
                </FilterCell>
                <FilterCell>
                  <input value={fStoreId} onChange={e => setFStoreId(e.target.value)} placeholder="Search…" className={colCls} />
                </FilterCell>
                <FilterCell>
                  <input value={fTaskId} onChange={e => setFTaskId(e.target.value)} placeholder="Search…" className={colCls} />
                </FilterCell>
                <FilterCell>
                  <div className={filterWrapCls}>
                    <AppSelect className="w-full" value={fTaskName} onChange={setFTaskName} options={allTaskNames} placeholder="All" size="sm" isSearchable menuPortal />
                  </div>
                </FilterCell>
                <FilterCell>
                  <div className={filterWrapCls}>
                    <AppSelect className="w-full" value={fTaskType} onChange={setFTaskType} options={allTaskTypes} placeholder="All" size="sm" isSearchable menuPortal />
                  </div>
                </FilterCell>
                <FilterCell>
                  <input value={fCompletedBy} onChange={e => setFCompletedBy(e.target.value)} placeholder="Search…" className={colCls} />
                </FilterCell>
                <FilterCell />
                <td className={`${ACTIONS_STICKY_HEADER} min-w-0 border-b border-slate-200 px-2 pb-2 pt-1`} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <TableStatusRow colSpan={8}>
                  <span className="inline-flex items-center gap-2 text-sm text-slate-400">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
                    Loading…
                  </span>
                </TableStatusRow>
              ) : filtered.length === 0 ? (
                <TableStatusRow colSpan={8}>
                  <Icon name="inbox" className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-sm text-slate-500">
                    {hasFilters ? 'No tasks match the current filters.' : 'No completed tasks yet.'}
                  </p>
                  {hasFilters && (
                    <button onClick={clearAll} className="mt-2 text-xs text-brand-600 hover:underline">
                      Clear filters
                    </button>
                  )}
                </TableStatusRow>
              ) : filtered.map(t => (
                <CompletedTaskRow
                  key={t.taskId}
                  task={t}
                  canAddFollowup={canAddFollowup}
                  onViewAssets={handleViewAssets}
                  onViewBrief={handleViewBrief}
                  onFollowup={handleFollowup}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-4 py-1">
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
        <LinkedTaskModal mode="followup"
          task={followupTask}
          parentTaskId={followupTask.taskId}
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

const CompletedTaskRow = memo(function CompletedTaskRow({ task: t, canAddFollowup, onViewAssets, onViewBrief, onFollowup }) {
  const completedLabel = fmtDate(t.requestorApprovedAt || t.managerApprovedAt)
  return (
    <tr className="hover:bg-slate-50/70 transition">
      <td className={completedCellCls}>
        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-600">
          {t.campaignId}
        </span>
      </td>
      <td className={completedCellCls}>
        <StoreIdDisplay storeId={t.storeId} customStoreIds={t.customStoreIds} />
      </td>
      <td className={completedCellCls}>
        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-600">
          {formatTaskId(t.taskId)}
        </span>
      </td>
      <td className={`${completedCellCls} font-medium text-slate-800`}>
        <span className="block truncate" title={t.granularTaskName || t.taskTypeName}>
          {t.granularTaskName || t.taskTypeName || '—'}
        </span>
      </td>
      <td className={`${completedCellCls} text-slate-600`}>
        {t.taskTypeName
          ? <span className="inline-block max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600" title={t.taskTypeName}>{t.taskTypeName}</span>
          : '—'}
      </td>
      <td className={`${completedCellCls} text-slate-600`}>
        <span className="block truncate" title={t.assigneeName}>{t.assigneeName || '—'}</span>
      </td>
      <td className={`${completedCellCls} whitespace-nowrap text-slate-500`}>
        <span className="block truncate" title={completedLabel !== '—' ? completedLabel : undefined}>
          {completedLabel}
        </span>
      </td>
      <td className={`${completedCellCls} ${ACTIONS_STICKY_BODY}`}>
        <div className="flex items-center justify-end pr-1">
          <ActionMenu align="right">
            <ActionMenuItem icon="eye" label="View Brief" onClick={() => onViewBrief(t)} />
            <ActionMenuItem icon="fileText" label="View Assets" onClick={() => onViewAssets(t)} />
            {canAddFollowup && (
              <ActionMenuItem icon="plus" label="Add Followup" onClick={() => onFollowup(t)} />
            )}
          </ActionMenu>
        </div>
      </td>
    </tr>
  )
})

