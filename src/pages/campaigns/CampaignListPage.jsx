import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useAuth } from '../../auth/AuthContext'
import { Rights } from '../../constants/rights'
import AppSelect from '../../components/AppSelect'
import { DATA_TABLE_CLASS, DataTableColGroup, TableStatusRow, dataTableStyle } from '../../components/dataTable'
import DateRangePicker from '../../components/DateRangePicker'
import Pagination from '../../components/Pagination'
import { useToast } from '../../components/Toast'
import campaignsApi from '../../api/campaigns'
import { masterApi, granularTasksApi } from '../../api/masterData'
import tasksApi from '../../api/tasks'
import api from '../../api/client'
import Icon from '../../components/Icon'
import RequestBriefDrawer from '../../components/RequestBriefDrawer'
import useDebounce from '../../hooks/useDebounce'
import PosStoreMultiSelect from '../../components/PosStoreMultiSelect'
import PosLocationMultiSelect from '../../components/PosLocationMultiSelect'
import MultiSelectDropdown from '../../components/MultiSelectDropdown'
import StoreIdDisplay from '../../components/StoreIdDisplay'
import ActionMenu, { ActionMenuItem } from '../../components/ActionMenu'
import Modal from '../../components/Modal'
import { parseTargetLocations, serializeTargetLocations } from '../../utils/targetLocations'

// ─── Status / Priority helpers ────────────────────────────────────────────────

const CAMPAIGN_STATUS_STYLES = {
  IN_PROGRESS:                'bg-blue-50 text-blue-700 ring-blue-200',
  MARKETING_REVIEW:          'bg-purple-50 text-purple-700 ring-purple-200',
  REQUESTOR_REVIEW:        'bg-violet-50 text-violet-700 ring-violet-200',
  COMPLETED:                  'bg-green-50 text-green-700 ring-green-200',
  REJECTED:                   'bg-red-50 text-red-700 ring-red-200',
  CANCELLED:                  'bg-slate-100 text-slate-500 ring-slate-200',
}

const CAMPAIGN_STATUS_LABELS = {
  IN_PROGRESS:                'In Progress',
  MARKETING_REVIEW:          'Marketing Review',
  REQUESTOR_REVIEW:        'Requestor Review',
  COMPLETED:                  'Completed',
  REJECTED:                   'Rejected',
  CANCELLED:                  'Cancelled',
}

function CampaignStatusBadge({ status }) {
  const cls = CAMPAIGN_STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {CAMPAIGN_STATUS_LABELS[status] || status}
    </span>
  )
}

function PriorityBadge({ priority }) {
  const map = {
    HIGH:   'bg-red-50 text-red-700 ring-red-200',
    MEDIUM: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
    LOW:    'bg-green-50 text-green-700 ring-green-200',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${map[priority] || 'bg-slate-100 text-slate-600'}`}>
      {priority || '—'}
    </span>
  )
}

// ─── File display helpers ─────────────────────────────────────────────────────

const FILE_TYPE_MAP = {
  jpg: 'Image', jpeg: 'Image', png: 'Image', gif: 'Image', webp: 'Image', svg: 'Graphic',
  mp4: 'Video', mov: 'Video', avi: 'Video', webm: 'Video', wmv: 'Video',
  pdf: 'PDF Document', doc: 'Document', docx: 'Document',
  xls: 'Spreadsheet', xlsx: 'Spreadsheet',
  ppt: 'Presentation', pptx: 'Presentation',
}

function friendlyFileName(url, index) {
  const ext  = (url || '').split('?')[0].toLowerCase().split('.').pop()
  const type = FILE_TYPE_MAP[ext]
  return type ? `${type} ${index + 1}` : `Attachment ${index + 1}`
}


// ─── Helpers shared with CampaignRow ─────────────────────────────────────────

const fmtRequestorDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'

const ROW_TERMINAL = ['COMPLETED', 'REJECTED', 'CANCELLED']

const BUDGET_LABELS = {
  NO_BUDGET_ORGANIC: 'No Budget (Organic)',
  UNDER_50K: '< ₹50K',
  FIFTY_K_TO_2L: '₹50K – ₹2L',
  TWO_L_TO_10L: '₹2L – ₹10L',
  ABOVE_10L: '₹10L+',
}

const REQUEST_TABLE_COLS = [110, 90, 100, 120, 130, 130, 110, 80]
const REQUEST_TABLE_MIN_WIDTH = REQUEST_TABLE_COLS.reduce((s, w) => s + w, 0)
const requestorCellCls = 'min-w-0 overflow-hidden px-4 py-3'

// ─── Memoised table row for RequestorCampaignView ────────────────────────────

const CampaignRow = memo(function CampaignRow({
  campaign: c,
  bookmarkingId,
  isLoading,
  onToggleBookmark,
  onViewBrief,
  onClone,
  onEdit,
  onDelete,
}) {
  const taskCount           = c.taskCount ?? (c.workTasks || []).length
  const doneCount           = c.completedTaskCount ?? (c.workTasks || []).filter(t => t.status === 'COMPLETED').length
  const hasRework           = c.hasRework   ?? (c.workTasks || []).some(t => t.status === 'REWORK')
  const hasQcReview         = c.hasQcReview ?? (c.workTasks || []).some(t => t.status === 'MARKETING_REVIEW' || t.status === 'REQUESTOR_REVIEW')
  const hasUnansweredComments = !!c.hasUnansweredComments
  const canEdit             = !ROW_TERMINAL.includes(c.status)
  const isBookmarked        = !!c.bookmarked
  const canDelete           = !ROW_TERMINAL.includes(c.status) && doneCount === 0 && !hasRework && !hasQcReview
  const deleteDisabledReason = canDelete ? '' : 'Cannot delete campaign while work is in progress or completed'

  const rowStyle = isBookmarked
    ? 'border-l-4 border-l-amber-400 bg-white hover:bg-slate-50/80'
    : hasUnansweredComments
    ? 'bg-sky-50/40 hover:bg-sky-100/50'
    : 'hover:bg-slate-50/70'

  return (
    <tr className={`transition ${rowStyle}`}>
      <td className={requestorCellCls}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-600">{c.campaignId}</span>
          {isBookmarked && (
            <Icon name="starFilled" className="h-3.5 w-3.5 text-amber-400 shrink-0" title="Bookmarked" />
          )}
        </div>
      </td>
      <td className={requestorCellCls}>
        <StoreIdDisplay storeId={c.storeId} customStoreIds={c.customStoreIds} stores={c.stores} />
      </td>
      <td className={requestorCellCls}><PriorityBadge priority={c.priority} /></td>
      <td className={requestorCellCls}>
        <CampaignStatusBadge status={c.status} />
      </td>
      <td className={`${requestorCellCls} text-slate-600`}>
        <div className="flex items-center gap-2 flex-wrap">
          {taskCount === 0
            ? <span className="italic text-slate-400">None yet</span>
            : <span>{doneCount}/{taskCount} done</span>}
          {hasRework && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 ring-1 ring-orange-200">
              ↩ Rework
            </span>
          )}
          {hasQcReview && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 ring-1 ring-purple-200">
              ⏳ QC
            </span>
          )}
          {hasUnansweredComments && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500" />
              </span>
              New comment
            </span>
          )}
        </div>
      </td>
      <td className={requestorCellCls}>
        <span className="text-xs font-medium text-slate-600">
          {c.budgetTier ? (BUDGET_LABELS[c.budgetTier] || c.budgetTier) : <span className="text-slate-300 italic text-xs">—</span>}
        </span>
      </td>
      <td className={`${requestorCellCls} text-slate-500`}>{fmtRequestorDate(c.createdAt)}</td>

      <td className={`${requestorCellCls} text-right`}>
        <div className="flex items-center justify-end pr-1">
          <ActionMenu align="right">
            <ActionMenuItem icon="eye" label="View Brief" onClick={() => onViewBrief(c.campaignId)} />
            <ActionMenuItem
              icon={isBookmarked ? 'starFilled' : 'star'}
              label={isBookmarked ? 'Unbookmark' : 'Bookmark'}
              variant={isBookmarked ? 'warning' : undefined}
              disabled={bookmarkingId === c.campaignId}
              onClick={(e) => onToggleBookmark(e, c.campaignId)}
            />
            <ActionMenuItem icon="copy" label="Clone" onClick={(e) => onClone(e, c.campaignId)} />
            {canEdit && (
              <ActionMenuItem icon="edit" label="Edit" variant="warning" onClick={() => onEdit(c)} disabled={isLoading} />
            )}
            <ActionMenuItem
              icon="trash"
              label="Delete"
              danger
              disabled={!canDelete}
              title={deleteDisabledReason}
              onClick={() => onDelete(c)}
            />
          </ActionMenu>
        </div>
      </td>
    </tr>
  )
})

// ─── Requestor campaign-level view ───────────────────────────────────────────

function RequestorCampaignView({ onTotalChange, onNewRequest }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const toast     = useToast()

  const PAGE_SIZE = 20

  // ── Data state ─────────────────────────────────────────────────────────────
  const [campaigns,     setCampaigns]     = useState([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages,    setTotalPages]    = useState(0)
  const [page,          setPage]          = useState(0)
  const [loading,       setLoading]       = useState(true)
  const [refreshSeed,   setRefreshSeed]   = useState(0)

  const [briefId,      setBriefId]      = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting,     setDeleting]     = useState(false)

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await campaignsApi.deleteCampaign(deleteTarget.campaignId)
      toast.success(`Campaign #${deleteTarget.campaignId} deleted successfully`)
      setRefreshSeed(s => s + 1)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete campaign')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }


  // ── Column filters ──────────────────────────────────────────────────────────
  const [fCampaign,  setFCampaign]  = useState('')
  const [fStoreId,   setFStoreId]   = useState('')
  const [fTaskType,  setFTaskType]  = useState('')
  const [fPriority,  setFPriority]  = useState('')
  const [fStatus,    setFStatus]    = useState(() => new URLSearchParams(location.search).get('status') || '')
  const [fDateFrom,  setFDateFrom]  = useState(null)
  const [fDateTo,    setFDateTo]    = useState(null)

  // ── Debounced text filters ─────────────────────────────────────────────────
  const dCampaign = useDebounce(fCampaign)
  const dStoreId  = useDebounce(fStoreId)

  // ── Reset page when filters change ────────────────────────────────────
  useEffect(() => { setPage(0) },
    [dCampaign, dStoreId, fTaskType, fPriority, fStatus, fDateFrom, fDateTo]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    setLoading(true)
    const params = {
      page, size: PAGE_SIZE,
      ...(dCampaign  && { campaignId: dCampaign  }),
      ...(dStoreId   && { storeId:    dStoreId   }),
      ...(fTaskType  && { taskType:   fTaskType  }),
      ...(fPriority  && { priority:   fPriority  }),
      ...(fStatus    && { status:     fStatus    }),
      ...(fDateFrom  && { dateFrom:   fDateFrom  }),
      ...(fDateTo    && { dateTo:     fDateTo    }),
    }

    campaignsApi.list(params)
      .then(res => {
        if (!alive) return
        const raw = res.data
        if (Array.isArray(raw)) {
          setCampaigns(raw)
          setTotalElements(raw.length)
          setTotalPages(1)
          onTotalChange?.(raw.length)
        } else {
          const d = raw || {}
          setCampaigns(d.content || [])
          setTotalElements(d.totalElements || 0)
          setTotalPages(d.totalPages || 0)
          onTotalChange?.(d.totalElements || 0)
        }
      })
      .catch(() => { if (alive) toast.error?.('Failed to load campaigns') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [dCampaign, dStoreId, fTaskType, fPriority, fStatus, fDateFrom, fDateTo, page, refreshSeed, location.key])

  // ── Bookmark handling ─────────────────────────────────────────────────────
  const [bookmarkingId, setBookmarkingId] = useState(null)

  const toggleBookmark = useCallback(async (e, campaignId) => {
    e.stopPropagation()
    setBookmarkingId(campaignId)
    try {
      const res = await campaignsApi.toggleBookmark(campaignId)
      const isNow = res.data?.bookmarked ?? false
      // Optimistically update the bookmarked flag in the list
      setCampaigns(prev => prev.map(c =>
        c.campaignId === campaignId ? { ...c, bookmarked: isNow } : c
      ))
    } catch {
      toast.error?.('Failed to update bookmark.')
    } finally {
      setBookmarkingId(null)
    }
  }, [toast])

  const handleClone = useCallback((e, campaignId) => {
    e.stopPropagation()
    navigate(`/campaigns/new?cloneFrom=${campaignId}`)
  }, [navigate])

  // ── Master data for filter dropdowns ──────────────────────────────────────
  const [allTaskTypes, setAllTaskTypes] = useState([])
  useEffect(() => {
    masterApi.list('task-types').then(d => setAllTaskTypes(d.map(t => t.name).sort())).catch(() => {})
  }, [])

  const PRIORITY_OPTS = ['HIGH', 'MEDIUM', 'LOW']
  const STATUS_OPTS   = ['IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED']

  const TERMINAL = ['COMPLETED', 'REJECTED', 'CANCELLED']

  const hasFilters = !!(fCampaign || fStoreId || fTaskType || fPriority || fStatus || fDateFrom || fDateTo)
  const clearAll   = useCallback(() => {
    setFCampaign(''); setFStoreId(''); setFTaskType(''); setFPriority(''); setFStatus('')
    setFDateFrom(null); setFDateTo(null)
    if (location.search) navigate('/campaigns', { replace: true })
  }, [location.search, navigate])

  const colFilterCls = `w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600
    placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-300 focus:border-brand-400`
  const filterWrapCls = 'min-w-0 w-full [&_.app-select__control]:!min-h-[28px] [&_.app-select__control]:!h-[28px]'

  // Sort campaigns so bookmarked items are brought to the top
  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => (b.bookmarked ? 1 : 0) - (a.bookmarked ? 1 : 0))
  }, [campaigns])

  // ── Stable callbacks for CampaignRow ───────────────────────────────────────
  const cbViewBrief = useCallback((id) => setBriefId(id), [setBriefId])
  const cbEdit      = useCallback((campaign) => navigate('/campaigns/' + campaign.campaignId + '/edit'), [navigate])

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Header + New Request */}
      {onNewRequest && (
        <div className="shrink-0 flex items-center justify-end gap-2 flex-wrap border-b border-slate-200 pb-3">
          <button
            onClick={onNewRequest}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition"
          >
            <Icon name="plus" className="h-3.5 w-3.5" /> New Request
          </button>
        </div>
      )}

      {/* Date range + row count + clear */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            from={fDateFrom}
            to={fDateTo}
            onChange={({ from, to }) => { setFDateFrom(from); setFDateTo(to) }}
            placeholder="All dates"
            maxDate={new Date().toISOString().slice(0, 10)}
          />
          <span className="text-xs text-slate-400">{totalElements} campaign{totalElements !== 1 ? 's' : ''}</span>
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
              style={dataTableStyle(REQUEST_TABLE_MIN_WIDTH)}
            >
              <DataTableColGroup widths={REQUEST_TABLE_COLS} />
              <thead className="sticky top-0 z-20 bg-slate-50">
                <tr className="bg-slate-50">
                  <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Campaign</th>
                  <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Store ID</th>
                  <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Priority</th>
                  <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Status</th>
                  <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Tasks</th>
                  <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Budget Tier</th>
                  <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Submitted</th>
                  <th className="min-w-0 border-b border-slate-100 px-4 pb-1 pt-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                    Actions
                  </th>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="min-w-0 bg-slate-50 px-3 pb-2 pt-1 align-top">
                    <input value={fCampaign} onChange={e => setFCampaign(e.target.value)} placeholder="Filter…" className={colFilterCls} />
                  </td>
                  <td className="min-w-0 bg-slate-50 px-3 pb-2 pt-1 align-top">
                    <input value={fStoreId} onChange={e => setFStoreId(e.target.value)} placeholder="Filter…" className={colFilterCls} />
                  </td>
                  <td className="min-w-0 bg-slate-50 px-3 pb-2 pt-1 align-top">
                    <div className={filterWrapCls}>
                      <AppSelect className="w-full" value={fPriority} onChange={setFPriority} options={PRIORITY_OPTS} placeholder="All" size="sm" isSearchable menuPortal />
                    </div>
                  </td>
                  <td className="min-w-0 bg-slate-50 px-3 pb-2 pt-1 align-top">
                    <div className={filterWrapCls}>
                      <AppSelect className="w-full" value={fStatus} onChange={setFStatus} options={STATUS_OPTS.map(v => ({ value: v, label: CAMPAIGN_STATUS_LABELS[v] || v }))} placeholder="All" size="sm" isSearchable menuPortal />
                    </div>
                  </td>
                  <td className="min-w-0 bg-slate-50 px-3 pb-2 pt-1" />
                  <td className="min-w-0 bg-slate-50 px-3 pb-2 pt-1" />
                  <td className="min-w-0 bg-slate-50 px-3 pb-2 pt-1" />
                  <td className="min-w-0 bg-slate-50 px-3 pb-2 pt-1" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <TableStatusRow colSpan={8}>
                    <span className="inline-flex items-center gap-2 text-sm text-slate-400">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Loading…
                    </span>
                  </TableStatusRow>
                ) : sortedCampaigns.length === 0 ? (
                  <TableStatusRow colSpan={8}>
                    <Icon name="inbox" className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                    <p className="text-sm text-slate-500">No requests found.</p>
                    {hasFilters && (
                      <button onClick={clearAll} className="mt-2 text-xs text-brand-600 hover:underline">
                        Clear filters
                      </button>
                    )}
                  </TableStatusRow>
                ) : sortedCampaigns.map((c) => (
                  <CampaignRow
                    key={c.campaignId}
                    campaign={c}
                    bookmarkingId={bookmarkingId}
                    isLoading={loading}
                    onToggleBookmark={toggleBookmark}
                    onViewBrief={cbViewBrief}
                    onClone={handleClone}
                    onEdit={cbEdit}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-4 py-1">
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

      {/* Brief drawer */}
      {briefId && (
        <RequestBriefDrawer
          campaignId={briefId}
          onClose={() => setBriefId(null)}
          onCommentAnswered={({ campaignId, hasUnansweredComments }) => {
            setCampaigns(prev => prev.map(c =>
              c.campaignId === campaignId ? { ...c, hasUnansweredComments } : c
            ))
          }}
          onCampaignChanged={(updated) => {
            setCampaigns(prev => prev.map(c =>
              c.campaignId === updated.campaignId
                ? { ...c, hasUnansweredComments: !!updated.hasUnansweredComments }
                : c
            ))
          }}
        />
      )}


    </div>
  )
}

// ─── Standard campaign-level view (non-requestor) ────────────────────────────

function CampaignTableView({ campaigns, loading, onRefresh, refreshing }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const filtered = campaigns.filter((c) => {
    const q = search.toLowerCase()
    return (
      !q ||
      c.requestorName?.toLowerCase().includes(q) ||
      c.departmentName?.toLowerCase().includes(q) ||
      c.status?.toLowerCase().includes(q)
    )
  })

  if (loading) return <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="relative w-full max-w-sm">
        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm
            placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500"
          placeholder="Search by type, requestor, department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center">
          <Icon name="inbox" className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">No requests found.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[760px] divide-y divide-slate-200 text-sm sm:min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  {['#', 'Requestor', 'Department', 'Priority', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.campaignId} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-600">{c.campaignId}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.requestorName || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.departmentName || '—'}</td>
                    <td className="px-4 py-3"><PriorityBadge priority={c.priority} /></td>
                    <td className="px-4 py-3"><CampaignStatusBadge status={c.status} /></td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/campaigns/${c.campaignId}`)}
                        className="flex items-center gap-1 text-brand-600 hover:text-brand-800 text-xs font-medium"
                      >
                        <Icon name="eye" className="h-3.5 w-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CampaignListPage() {
  const { hasRight } = useAuth()
  const toast     = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)
  const navigate  = useNavigate()
  const location  = useLocation()

  const [campaigns,     setCampaigns]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [requestorTotal, setRequestorTotal] = useState(0)
  const [successBanner, setSuccessBanner] = useState(
    location.state?.justSubmitted
      ? 'Your request was submitted successfully.'
      : null
  )

  const canCreateCampaign = hasRight(Rights.CREATE_CAMPAIGN)
  const isRequestorView = hasRight(Rights.VIEW_OWN_CAMPAIGNS)

  const load = async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)

    try {
      if (!isRequestorView) {
        // Non-requestor path: load all campaigns (manager / admin view)
        const res = await campaignsApi.list({
          campaignId: undefined,
          storeId: undefined,
          status: undefined,
        })
        const list = res.data?.content || res.data || []
        setCampaigns(Array.isArray(list) ? list : [])
      }
      // Requestor path: RequestorCampaignView handles its own data loading
    } catch {
      showToast('Failed to load requests', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
    if (location.state?.justSubmitted) {
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Success banner */}
      {successBanner && (
        <div className="shrink-0 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <svg className="h-5 w-5 shrink-0 text-green-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          <p className="flex-1 text-sm font-medium text-green-800">{successBanner}</p>
          <button onClick={() => setSuccessBanner(null)} className="text-green-500 hover:text-green-700 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Action bar — non-requestors only (requestor gets New Request inside tabs row) */}
      {!isRequestorView && (
        <div className="shrink-0 flex items-center justify-end gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            title="Refresh"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <svg className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      )}

      {/* View */}
      <div className="flex-1 min-h-0 h-full">
        {isRequestorView ? (
          <RequestorCampaignView
            onTotalChange={setRequestorTotal}
            onNewRequest={canCreateCampaign ? () => navigate('/campaigns/new') : null}
          />
        ) : loading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>
        ) : (
          <CampaignTableView
            campaigns={campaigns}
            loading={loading}
            onRefresh={() => load(true)}
            refreshing={refreshing}
          />
        )}
      </div>
    </div>
  )
}
