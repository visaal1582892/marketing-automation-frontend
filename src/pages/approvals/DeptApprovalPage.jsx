import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../components/Toast'
import campaignsApi from '../../api/campaigns'
import Icon from '../../components/Icon'
import RequestBriefDrawer, { RequestSummaryCard } from '../../components/RequestBriefDrawer'

export default function DeptApprovalPage() {
  const { user } = useAuth()
  const toast            = useToast()
  const showToast        = (msg, type = 'info') => toast[type]?.(msg)
  const location         = useLocation()

  const [tab,             setTab]             = useState('pending') // 'pending' | 'history'
  const [pending,         setPending]         = useState([])
  const [history,         setHistory]         = useState([])
  const [historyFilter,   setHistoryFilter]   = useState('ALL')     // ALL | APPROVED | REJECTED
  const [loading,         setLoading]         = useState(true)
  const [loadingHistory,  setLoadingHistory]  = useState(false)
  const [historyLoaded,   setHistoryLoaded]   = useState(false)
  const [selected,        setSelected]        = useState(null)
  const [action,          setAction]          = useState(null) // 'approve' | 'reject'
  const [reason,          setReason]          = useState('')
  const [saving,          setSaving]          = useState(false)
  const [briefCampaignId, setBriefCampaignId] = useState(null)

  const loadPending = () => {
    setLoading(true)
    campaignsApi.pendingDept()
      .then((res) => setPending(res.data || []))
      .catch(() => showToast('Failed to load requests', 'error'))
      .finally(() => setLoading(false))
  }

  const loadHistory = () => {
    setLoadingHistory(true)
    campaignsApi.historyDept()
      .then((res) => { setHistory(res.data || []); setHistoryLoaded(true) })
      .catch(() => showToast('Failed to load approval history', 'error'))
      .finally(() => setLoadingHistory(false))
  }

  // Always refetch pending on navigation
  useEffect(loadPending, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy-load history the first time the tab is opened
  useEffect(() => {
    if (tab === 'history' && !historyLoaded) loadHistory()
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'ALL') return history
    return history.filter(c => c.deptDecision === historyFilter)
  }, [history, historyFilter])

  const historyCounts = useMemo(() => ({
    all:      history.length,
    approved: history.filter(c => c.deptDecision === 'APPROVED').length,
    rejected: history.filter(c => c.deptDecision === 'REJECTED').length,
  }), [history])

  const openAction = (campaign, type) => {
    setSelected(campaign)
    setAction(type)
    setReason('')
  }

  const closeAction = () => {
    setSelected(null)
    setAction(null)
    setReason('')
  }

  const handleConfirm = async () => {
    if (!selected) return
    setSaving(true)
    try {
      if (action === 'approve') {
        await campaignsApi.deptApprove(selected.campaignId)
        showToast('Request approved ù sent to Marketing Head.', 'success')
      } else {
        if (!reason.trim()) { showToast('Please provide a rejection reason.', 'error'); setSaving(false); return }
        await campaignsApi.deptReject(selected.campaignId, reason)
        showToast('Request rejected.', 'success')
      }
      closeAction()
      loadPending()
      // Invalidate history so it refreshes the next time the user views it
      setHistoryLoaded(false)
      if (tab === 'history') loadHistory()
    } catch {
      showToast('Action failed. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const roleLabel = 'Regional Manager'
  const scope     = 'Showing requests from departments awaiting your approval.'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">{roleLabel} Approvals</h2>
        <p className="mt-0.5 text-sm text-slate-500">{scope}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200">
        <Tab
          label={`Pending (${pending.length})`}
          icon="inbox"
          active={tab === 'pending'}
          onClick={() => setTab('pending')}
        />
        <Tab
          label={`My Decisions${historyLoaded ? ` (${history.length})` : ''}`}
          icon="clipboard"
          active={tab === 'history'}
          onClick={() => setTab('history')}
        />
      </div>

      {tab === 'pending' && (
        loading ? (
          <p className="text-center text-slate-400 py-12 text-sm">Loadingù</p>
        ) : pending.length === 0 ? (
          <EmptyState />
        ) : (
          <PendingTable
            campaigns={pending}
            onAction={openAction}
            onViewBrief={setBriefCampaignId}
          />
        )
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill
              label={`All (${historyCounts.all})`}
              active={historyFilter === 'ALL'}
              onClick={() => setHistoryFilter('ALL')}
            />
            <FilterPill
              label={`Approved (${historyCounts.approved})`}
              active={historyFilter === 'APPROVED'}
              onClick={() => setHistoryFilter('APPROVED')}
            />
            <FilterPill
              label={`Rejected (${historyCounts.rejected})`}
              active={historyFilter === 'REJECTED'}
              onClick={() => setHistoryFilter('REJECTED')}
            />
          </div>

          {loadingHistory ? (
            <p className="text-center text-slate-400 py-12 text-sm">Loading historyù</p>
          ) : filteredHistory.length === 0 ? (
            <EmptyState message="No decisions yet ù campaigns you approve or reject will appear here." />
          ) : (
            <HistoryTable
              campaigns={filteredHistory}
              stage="dept"
              onViewBrief={setBriefCampaignId}
            />
          )}
        </div>
      )}

      {/* Action modal */}
      {selected && (
        <ActionModal
          title={action === 'approve' ? 'Approve Request' : 'Reject Request'}
          campaign={selected}
          action={action}
          reason={reason}
          setReason={setReason}
          onConfirm={handleConfirm}
          onCancel={closeAction}
          saving={saving}
          onViewBrief={() => setBriefCampaignId(selected.campaignId)}
        />
      )}

      {briefCampaignId && (
        <RequestBriefDrawer
          campaignId={briefCampaignId}
          onClose={() => setBriefCampaignId(null)}
          onCampaignChanged={(updated) => {
            setPending(prev => prev.map(p =>
              p.campaignId === updated.campaignId ? { ...p, ...updated } : p
            ))
            setHistory(prev => prev.map(p =>
              p.campaignId === updated.campaignId ? { ...p, ...updated } : p
            ))
          }}
        />
      )}
    </div>
  )
}

// --- Pending queue table ------------------------------------------------------

function PendingTable({ campaigns, onAction, onViewBrief }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
      <table className="min-w-[900px] divide-y divide-slate-200 text-sm sm:min-w-full">
        <thead className="bg-slate-50">
          <tr>
            {['#', 'Objective', 'Requestor', 'Department', 'Campaign Type', 'Priority', 'Submitted', 'Actions'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {campaigns.map((c) => (
            <tr key={c.campaignId} className="hover:bg-slate-50/60 transition">
              <td className="px-4 py-3 text-slate-500 font-mono text-xs">#{c.campaignId}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{c.businessObjective || 'ù'}</td>
              <td className="px-4 py-3 text-slate-600">{c.requestorName}</td>
              <td className="px-4 py-3 text-slate-600">{c.departmentName || 'ù'}</td>
              <td className="px-4 py-3 text-slate-500 text-xs">{c.campaignTypeName || 'ù'}</td>
              <td className="px-4 py-3"><PriorityBadge v={c.priority} /></td>
              <td className="px-4 py-3 text-slate-500 text-xs">{fmtDateTime(c.createdAt)}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => onViewBrief(c.campaignId)}
                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 transition flex items-center gap-1"
                    title="View full request brief"
                  >
                    <Icon name="eye" className="h-3.5 w-3.5" /> Brief
                  </button>
                  <ActionButton label="Approve" icon="check" color="green" onClick={() => onAction(c, 'approve')} />
                  <ActionButton label="Reject"  icon="x"     color="red"   onClick={() => onAction(c, 'reject')} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}

// --- History table (re-used by Marketing page too) ----------------------------

export function HistoryTable({ campaigns, stage, onViewBrief }) {
  const decisionField = stage === 'marketing' ? 'marketingDecision' : 'deptDecision'
  const timestampField = stage === 'marketing' ? 'marketingDecisionAt' : 'deptDecisionAt'

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
      <table className="min-w-[900px] divide-y divide-slate-200 text-sm sm:min-w-full">
        <thead className="bg-slate-50">
          <tr>
            {['#', 'Requirement', 'Requestor', 'Department', 'Decision', 'Decided', 'Reason / Status', ''].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {campaigns.map((c) => (
            <tr key={c.campaignId} className="hover:bg-slate-50/60 transition">
              <td className="px-4 py-3 text-slate-500 font-mono text-xs">#{c.campaignId}</td>
              <td className="px-4 py-3 font-medium text-slate-800">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span>{c.businessObjective || 'ù'}</span>
                  <PriorityBadge v={c.priority} />
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600">{c.requestorName}</td>
              <td className="px-4 py-3 text-slate-600">{c.departmentName || 'ù'}</td>
              <td className="px-4 py-3"><DecisionBadge v={c[decisionField]} /></td>
              <td className="px-4 py-3 text-slate-500 text-xs">{fmtDateTime(c[timestampField])}</td>
              <td className="px-4 py-3 text-slate-600 text-xs max-w-[300px]">
                {c[decisionField] === 'REJECTED'
                  ? <span className="text-red-700 whitespace-pre-wrap">{c.rejectionReason || 'ù'}</span>
                  : <StatusBadge v={c.status} />}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => onViewBrief(c.campaignId)}
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 transition flex items-center gap-1"
                  title="View full request brief"
                >
                  <Icon name="eye" className="h-3.5 w-3.5" /> Brief
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}

// --- Shared approval modal ----------------------------------------------------

export function ActionModal({ title, campaign, action, reason, setReason, onConfirm, onCancel, saving, onViewBrief, approveNote }) {
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onCancel} className="rounded p-1 text-slate-400 hover:bg-slate-100 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <RequestSummaryCard campaign={campaign} />

        {onViewBrief && (
          <button
            type="button"
            onClick={onViewBrief}
            className="text-xs text-brand-600 hover:underline flex items-center gap-1"
          >
            <Icon name="eye" className="h-3 w-3" /> View full request brief
          </button>
        )}

        {action === 'reject' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a clear reason for rejectionù"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 resize-none"
            />
          </div>
        )}

        {action === 'approve' && (
          <p className="text-sm text-slate-500">
            {approveNote || 'This request will be forwarded to the Marketing Head for final approval.'}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:gap-3">
          <button
            onClick={onCancel}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition sm:w-auto"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 transition sm:w-auto ${
              action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {saving ? 'Savingù' : action === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Shared helpers / mini components ----------------------------------------

export function EmptyState({ message = 'No pending requests in your queue.' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white py-14 text-center">
      <Icon name="inbox" className="mx-auto h-10 w-10 text-slate-300 mb-3" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  )
}

function ActionButton({ label, icon, color, onClick }) {
  const cls = color === 'green'
    ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
    : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition ${cls}`}
    >
      <Icon name={icon} className="h-3.5 w-3.5" /> {label}
    </button>
  )
}

function Tab({ label, icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition ${
        active
          ? 'border-brand-600 text-brand-700'
          : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      <Icon name={icon} className="h-4 w-4" />
      {label}
    </button>
  )
}

function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ring-1 ${
        active
          ? 'bg-brand-50 text-brand-700 ring-brand-200'
          : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  )
}

export function DecisionBadge({ v }) {
  const map = {
    APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    REJECTED: 'bg-rose-50 text-rose-700 ring-rose-200',
  }
  const label = { APPROVED: 'Approved', REJECTED: 'Rejected' }
  const icon  = { APPROVED: 'check', REJECTED: 'x' }
  const cls   = map[v] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {v && <Icon name={icon[v]} className="h-3 w-3" />}
      {label[v] || 'ù'}
    </span>
  )
}

function StatusBadge({ v }) {
  const STYLES = {
    PENDING_DEPT_APPROVAL:      'bg-yellow-50 text-yellow-700 ring-yellow-200',
    PENDING_MARKETING_APPROVAL: 'bg-orange-50 text-orange-700 ring-orange-200',
    PENDING_INTERVENTION:       'bg-amber-50 text-amber-700 ring-amber-200',
    IN_PROGRESS:                'bg-blue-50 text-blue-700 ring-blue-200',
    MANAGER_QC_REVIEW:          'bg-purple-50 text-purple-700 ring-purple-200',
    REQUESTOR_QC_REVIEW:        'bg-violet-50 text-violet-700 ring-violet-200',
    COMPLETED:                  'bg-green-50 text-green-700 ring-green-200',
    REJECTED:                   'bg-red-50 text-red-700 ring-red-200',
  }
  const LABELS = {
    PENDING_DEPT_APPROVAL:      'Pending Dept',
    PENDING_MARKETING_APPROVAL: 'Pending Marketing',
    PENDING_INTERVENTION:       'Intervention',
    IN_PROGRESS:                'In Progress',
    MANAGER_QC_REVIEW:          'Manager QC',
    REQUESTOR_QC_REVIEW:        'Requestor QC',
    COMPLETED:                  'Completed',
    REJECTED:                   'Rejected',
  }
  const cls = STYLES[v] || 'bg-slate-100 text-slate-600'
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}>{LABELS[v] || v || 'ù'}</span>
}

function PriorityBadge({ v }) {
  const m = { HIGH: 'bg-red-50 text-red-700 ring-red-200', MEDIUM: 'bg-yellow-50 text-yellow-700 ring-yellow-200', LOW: 'bg-green-50 text-green-700 ring-green-200' }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${m[v] || 'bg-slate-100 text-slate-600'}`}>{v || 'ù'}</span>
}

function fmtDateTime(d) {
  if (!d) return 'ù'
  return new Date(d).toLocaleString('en-IN', {
    day:    '2-digit',
    month:  'short',
    year:   '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
  })
}
function fmtEnum(v) { return v ? v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'ù' }
