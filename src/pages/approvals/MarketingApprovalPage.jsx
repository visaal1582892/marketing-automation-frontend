import { useEffect, useMemo, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import campaignsApi from '../../api/campaigns'
import managerApi from '../../api/manager'
import Icon from '../../components/Icon'
import { EmptyState, ActionModal, HistoryTable } from './DeptApprovalPage'
import RequestBriefDrawer from '../../components/RequestBriefDrawer'
import PriorityEditor from '../../components/PriorityEditor'

export default function MarketingApprovalPage() {
  const toast     = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)
  const location  = useLocation()

  const [tab,             setTab]             = useState('pending')
  const [pending,         setPending]         = useState([])
  const [history,         setHistory]         = useState([])
  const [historyFilter,   setHistoryFilter]   = useState('ALL')
  const [loading,         setLoading]         = useState(true)
  const [loadingHistory,  setLoadingHistory]  = useState(false)
  const [historyLoaded,   setHistoryLoaded]   = useState(false)
  const [selected,        setSelected]        = useState(null)
  const [action,          setAction]          = useState(null)
  const [reason,          setReason]          = useState('')
  const [saving,          setSaving]          = useState(false)
  const [briefCampaignId, setBriefCampaignId] = useState(null)

  // Held tasks (shown inside My Decisions tab)
  const [heldTasks,       setHeldTasks]       = useState([])
  const [loadingHeld,     setLoadingHeld]     = useState(false)
  const [heldLoaded,      setHeldLoaded]      = useState(false)
  const [unholdingId,     setUnholdingId]     = useState(null)

  // Capacity / busy-modal state
  const [capacityModal,   setCapacityModal]   = useState(null)  // { campaign, report }
  const [capacityLoading, setCapacityLoading] = useState(null)  // campaignId being checked
  const [holdingTaskId,   setHoldingTaskId]   = useState(null)

  const loadPending = useCallback(() => {
    setLoading(true)
    campaignsApi.pendingMarketing()
      .then((res) => setPending(res.data || []))
      .catch(() => showToast('Failed to load requests', 'error'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadHistory = () => {
    setLoadingHistory(true)
    campaignsApi.historyMarketing()
      .then((res) => { setHistory(res.data || []); setHistoryLoaded(true) })
      .catch(() => showToast('Failed to load approval history', 'error'))
      .finally(() => setLoadingHistory(false))
  }

  const loadHeldTasks = () => {
    setLoadingHeld(true)
    managerApi.heldTasks()
      .then((res) => { setHeldTasks(res.data || []); setHeldLoaded(true) })
      .catch(() => showToast('Failed to load held tasks', 'error'))
      .finally(() => setLoadingHeld(false))
  }

  const handleUnhold = async (task) => {
    setUnholdingId(task.taskId)
    try {
      await managerApi.unholdTask(task.taskId)
      showToast(`Task #${task.taskId} re-routed successfully.`, 'success')
      // Refresh held list and also pending (unholding frees a slot which may let the head approve now)
      loadHeldTasks()
      loadPending()
    } catch (e) {
      if (e?.response?.status === 409) {
        showToast('No available user yet — free a slot and retry.', 'error')
      } else {
        showToast(e?.response?.data?.message || 'Unhold failed. Please retry.', 'error')
      }
    } finally {
      setUnholdingId(null)
    }
  }

  useEffect(loadPending, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'history') {
      if (!historyLoaded) loadHistory()
      if (!heldLoaded)    loadHeldTasks()
    }
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'ALL') return history
    return history.filter(c => c.marketingDecision === historyFilter)
  }, [history, historyFilter])

  const historyCounts = useMemo(() => ({
    all:      history.length,
    approved: history.filter(c => c.marketingDecision === 'APPROVED').length,
    rejected: history.filter(c => c.marketingDecision === 'REJECTED').length,
    held:     heldTasks.length,
  }), [history, heldTasks])

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

  /**
   * When the user clicks "Approve & Route", first run a capacity check.
   * If the team can absorb the campaign → show the normal confirm modal.
   * If blocked → open the busy-team modal instead.
   */
  const handleApproveClick = async (campaign) => {
    setCapacityLoading(campaign.campaignId)
    try {
      const res = await managerApi.campaignCapacity(campaign.campaignId)
      const report = res.data
      if (report.canRoute) {
        // All clear — proceed to normal confirm modal
        openAction(campaign, 'approve')
      } else {
        // Team is full — show busy modal
        setCapacityModal({ campaign, report })
      }
    } catch {
      showToast('Failed to load capacity data. Proceeding anyway.', 'error')
      openAction(campaign, 'approve')
    } finally {
      setCapacityLoading(null)
    }
  }

  /**
   * Hold a task from inside the busy modal, then re-fetch capacity to see
   * if there's now a free slot.
   */
  const handleHoldTask = async (taskId) => {
    if (!capacityModal) return
    setHoldingTaskId(taskId)
    try {
      await managerApi.holdTask(taskId)
      showToast('Task held — slot freed.', 'success')
      // Re-fetch capacity for the same campaign
      const res = await managerApi.campaignCapacity(capacityModal.campaign.campaignId)
      const report = res.data
      setCapacityModal(prev => ({ ...prev, report }))
      if (report.canRoute) {
        showToast('All slots are now available. You can approve!', 'success')
      }
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to hold task.'
      showToast(msg, 'error')
    } finally {
      setHoldingTaskId(null)
    }
  }

  const handleConfirm = async () => {
    if (!selected) return
    setSaving(true)
    try {
      if (action === 'approve') {
        await campaignsApi.marketingApprove(selected.campaignId)
        showToast('Request approved — routing to execution team.', 'success')
      } else {
        if (!reason.trim()) { showToast('Please provide a rejection reason.', 'error'); setSaving(false); return }
        await campaignsApi.marketingReject(selected.campaignId, reason)
        showToast('Request rejected.', 'success')
      }
      closeAction()
      loadPending()
      setHistoryLoaded(false)
      if (tab === 'history') loadHistory()
    } catch (e) {
      // 409 means capacity was consumed between the check and the click
      if (e?.response?.status === 409 && e?.response?.data?.capacityReport) {
        const report = e.response.data.capacityReport
        setCapacityModal({ campaign: selected, report })
        closeAction()
      } else {
        showToast('Action failed. Please try again.', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Marketing Head Approvals</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Requests that have passed department approval await your final sign-off before execution.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
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
          <p className="text-center text-slate-400 py-12 text-sm">Loading…</p>
        ) : pending.length === 0 ? (
          <EmptyState message="No requests awaiting marketing approval." />
        ) : (
          <div className="space-y-3">
            {pending.map((c) => (
              <CampaignCard
                key={c.campaignId}
                campaign={c}
                onApprove={() => handleApproveClick(c)}
                onReject={() => openAction(c, 'reject')}
                onViewBrief={() => setBriefCampaignId(c.campaignId)}
                checkingCapacity={capacityLoading === c.campaignId}
                onPriorityChanged={(updated) => {
                  setPending(prev => prev.map(p =>
                    p.campaignId === updated.campaignId ? { ...p, ...updated } : p
                  ))
                  showToast(`Priority updated to ${updated.priority}.`, 'success')
                }}
                onPriorityError={(msg) => showToast(msg, 'error')}
              />
            ))}
          </div>
        )
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {/* Filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill label={`All (${historyCounts.all})`}           active={historyFilter === 'ALL'}      onClick={() => setHistoryFilter('ALL')} />
            <FilterPill label={`Approved (${historyCounts.approved})`} active={historyFilter === 'APPROVED'} onClick={() => setHistoryFilter('APPROVED')} />
            <FilterPill label={`Rejected (${historyCounts.rejected})`} active={historyFilter === 'REJECTED'} onClick={() => setHistoryFilter('REJECTED')} />
            {/* Held Tasks pill — visually distinct with amber colour */}
            <FilterPill
              label={`On Hold (${historyCounts.held})`}
              active={historyFilter === 'HELD'}
              onClick={() => setHistoryFilter('HELD')}
              variant="amber"
            />
          </div>

          {/* ── Held Tasks view ── */}
          {historyFilter === 'HELD' ? (
            loadingHeld ? (
              <p className="text-center text-slate-400 py-12 text-sm">Loading held tasks…</p>
            ) : heldTasks.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white py-14 text-center">
                <Icon name="pause" className="mx-auto h-9 w-9 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-600">No tasks on hold</p>
                <p className="mt-1 text-xs text-slate-400">
                  Held tasks appear here when the team's capacity is freed via the busy-team modal.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {heldTasks.map(t => (
                  <HeldTaskRow
                    key={t.taskId}
                    task={t}
                    busy={unholdingId === t.taskId}
                    onUnhold={() => handleUnhold(t)}
                    onViewBrief={() => setBriefCampaignId(t.campaignId)}
                  />
                ))}
              </div>
            )
          ) : (
            /* ── Approved / Rejected history view ── */
            loadingHistory ? (
              <p className="text-center text-slate-400 py-12 text-sm">Loading history…</p>
            ) : filteredHistory.length === 0 ? (
              <EmptyState message="No decisions yet — campaigns you approve or reject will appear here." />
            ) : (
              <HistoryTable
                campaigns={filteredHistory}
                stage="marketing"
                onViewBrief={setBriefCampaignId}
              />
            )
          )}
        </div>
      )}

      {/* Normal Approve / Reject confirm modal */}
      {selected && (
        <ActionModal
          title={action === 'approve' ? 'Approve & Route Request' : 'Reject Request'}
          campaign={selected}
          action={action}
          reason={reason}
          setReason={setReason}
          onConfirm={handleConfirm}
          onCancel={closeAction}
          saving={saving}
          approveNote="Approving this request will immediately trigger the routing engine to create and assign work tasks."
          onViewBrief={() => setBriefCampaignId(selected.campaignId)}
        />
      )}

      {/* Busy-team modal — shown when capacity check fails */}
      {capacityModal && (
        <BusyTeamModal
          campaign={capacityModal.campaign}
          report={capacityModal.report}
          holdingTaskId={holdingTaskId}
          onHoldTask={handleHoldTask}
          onApprove={() => {
            const c = capacityModal.campaign
            setCapacityModal(null)
            openAction(c, 'approve')
          }}
          onClose={() => setCapacityModal(null)}
          onViewBrief={() => setBriefCampaignId(capacityModal.campaign.campaignId)}
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

// ---------------------------------------------------------------------------
// Busy-Team Modal
// ---------------------------------------------------------------------------

function BusyTeamModal({ campaign: c, report, holdingTaskId, onHoldTask, onApprove, onClose, onViewBrief }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden my-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100">
                <Icon name="alertCircle" className="h-4 w-4 text-amber-600" />
              </span>
              <h3 className="text-base font-semibold text-slate-900">No Team Members Available</h3>
            </div>
            <p className="mt-1 text-xs text-slate-500 ml-9">
              Some roles needed for <span className="font-medium text-slate-700">#{c.campaignId} — {c.taskTypeName}</span> have no active members.
              Please add users to the required roles, then approve.
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        {/* Body — one card per role */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {(report.roles || []).map((role) => (
            <RoleCapacityCard
              key={role.roleId || 'unknown'}
              role={role}
              holdingTaskId={holdingTaskId}
              onHoldTask={onHoldTask}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <button
              onClick={onViewBrief}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-white transition"
            >
              <Icon name="eye" className="h-3.5 w-3.5" /> View Brief
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white transition"
            >
              Close
            </button>
            <button
              onClick={onApprove}
              disabled={!report.canRoute}
              title={report.canRoute ? 'Team members available — approve now' : 'Add team members to required roles first'}
              className={`flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold text-white transition
                ${report.canRoute
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-slate-300 cursor-not-allowed'}`}
            >
              <Icon name="check" className="h-3.5 w-3.5" />
              {report.canRoute ? 'Approve & Route' : 'Slots still needed'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RoleCapacityCard({ role, holdingTaskId, onHoldTask }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className={`rounded-xl border overflow-hidden ${role.blocked ? 'border-rose-200 bg-rose-50/30' : 'border-emerald-200 bg-emerald-50/30'}`}>
      {/* Role header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-sm font-semibold text-slate-800">{role.roleName}</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1
            ${role.blocked
              ? 'bg-rose-100 text-rose-700 ring-rose-200'
              : 'bg-emerald-100 text-emerald-700 ring-emerald-200'}`}>
            {role.blocked ? 'Blocked' : 'Available'}
          </span>
          <span className="text-xs text-slate-500">
              Needs {role.requiredSlots} assignee{role.requiredSlots !== 1 ? 's' : ''} · {role.availableSlots} member{role.availableSlots !== 1 ? 's' : ''} available
          </span>
        </div>
        <Icon
          name="chevron"
          className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {(role.users || []).length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-400">No active users in this role.</p>
          ) : (
            role.users.map((u) => (
              <UserRow
                key={u.userId}
                user={u}
                holdingTaskId={holdingTaskId}
                onHoldTask={onHoldTask}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function UserRow({ user, holdingTaskId, onHoldTask }) {
  const [showTasks, setShowTasks] = useState(false)
  const holdableTasks = user.openTasks || []

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-brand-400 to-brand-600
                          flex items-center justify-center text-xs font-bold text-white">
            {(user.fullName || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-800 truncate">{user.fullName}</div>
            <div className="text-xs text-slate-500">
              {user.currentActiveTasks ?? 0} active task{(user.currentActiveTasks ?? 0) !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {holdableTasks.length > 0 && (
          <button
            onClick={() => setShowTasks(s => !s)}
            className="shrink-0 flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1
                       text-xs text-slate-600 hover:bg-slate-100 transition"
          >
            <Icon name="list" className="h-3 w-3" />
            {showTasks ? 'Hide' : `Tasks (${holdableTasks.length})`}
          </button>
        )}
      </div>

      {showTasks && holdableTasks.length > 0 && (
        <div className="mt-2 space-y-1.5 pl-9">
          {holdableTasks.map((t) => (
            <div
              key={t.taskId}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <PriorityDot priority={t.campaignPriority} />
                  <span className="text-xs font-medium text-slate-800 truncate">
                    {t.granularTaskName || t.taskTypeName || `Task #${t.taskId}`}
                  </span>
                  <span className="text-xs text-slate-400">#{t.campaignId}</span>
                </div>
                {t.taskTypeName && (
                  <div className="text-xs text-slate-500 mt-0.5">{t.taskTypeName}</div>
                )}
              </div>
              <button
                onClick={() => onHoldTask(t.taskId)}
                disabled={holdingTaskId === t.taskId}
                className="shrink-0 flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50
                           px-2.5 py-1 text-xs font-medium text-amber-700
                           hover:bg-amber-100 transition disabled:opacity-60"
              >
                {holdingTaskId === t.taskId
                  ? <><Icon name="refresh" className="h-3 w-3 animate-spin" /> Holding…</>
                  : <><Icon name="pause" className="h-3 w-3" /> Hold</>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Campaign card (with split Approve / Reject buttons)
// ---------------------------------------------------------------------------

function CampaignCard({ campaign: c, onApprove, onReject, onViewBrief, checkingCapacity, onPriorityChanged, onPriorityError }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-start justify-between p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-400">#{c.campaignId}</span>
            <span className="text-sm font-semibold text-slate-800">{c.taskTypeName}</span>
            <PriorityEditor
              campaignId={c.campaignId}
              value={c.priority}
              editable
              onChanged={onPriorityChanged}
              onError={onPriorityError}
            />
            {c.flaggedInconsistency && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                <Icon name="alertCircle" className="h-3 w-3 mr-0.5" /> Flagged
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Icon name="users" className="h-3.5 w-3.5" />
              {c.requestorName}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="building" className="h-3.5 w-3.5" />
              {c.departmentName || '—'}
            </span>
            {c.deptDecisionByName && (
              <span className="flex items-center gap-1">
                <Icon name="check" className="h-3.5 w-3.5 text-emerald-500" />
                Approved by {c.deptDecisionByName}
              </span>
            )}
            {c.budgetTier && (
              <span className="flex items-center gap-1">
                <span className="font-semibold">₹</span>
                {fmtEnum(c.budgetTier)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-3 shrink-0">
          <button
            onClick={onViewBrief}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 transition flex items-center gap-1"
            title="View full request brief"
          >
            <Icon name="eye" className="h-3.5 w-3.5" />
            Brief
          </button>
          <button
            onClick={onReject}
            className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition flex items-center gap-1"
          >
            <Icon name="x" className="h-3.5 w-3.5" /> Reject
          </button>
          <button
            onClick={onApprove}
            disabled={checkingCapacity}
            className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition disabled:opacity-60 flex items-center gap-1"
          >
            {checkingCapacity
              ? <><Icon name="refresh" className="h-3.5 w-3.5 animate-spin" /> Checking…</>
              : <><Icon name="check" className="h-3.5 w-3.5" /> Approve &amp; Route</>}
          </button>
        </div>
      </div>

      {c.flaggedInconsistency && c.inconsistencyReason && (
        <div className="border-t border-amber-100 bg-amber-50 px-4 py-2 flex items-start gap-2 text-xs text-amber-800">
          <Icon name="alertCircle" className="h-4 w-4 shrink-0 mt-0.5" />
          <span><span className="font-semibold">Inconsistency:</span> {c.inconsistencyReason}</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

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

function FilterPill({ label, active, onClick, variant = 'brand' }) {
  const activeClass = variant === 'amber'
    ? 'bg-amber-50 text-amber-700 ring-amber-300'
    : 'bg-brand-50 text-brand-700 ring-brand-200'
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ring-1 ${
        active
          ? activeClass
          : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  )
}

function PriorityDot({ priority }) {
  const colours = {
    HIGH:   'bg-rose-500',
    MEDIUM: 'bg-yellow-400',
    LOW:    'bg-emerald-400',
  }
  return (
    <span className={`h-2 w-2 rounded-full shrink-0 ${colours[priority] || 'bg-slate-300'}`} />
  )
}

// ---------------------------------------------------------------------------
// HeldTaskRow — shown inside the "On Hold" filter of My Decisions tab
// ---------------------------------------------------------------------------

function HeldTaskRow({ task: t, busy, onUnhold, onViewBrief }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        {/* Left — task info */}
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-400">#{t.taskId}</span>
            <span className="text-sm font-semibold text-slate-800">
              {t.granularTaskName || t.taskTypeName || `Task #${t.taskId}`}
            </span>
            <PriorityDot priority={t.campaignPriority} />
            <span className="text-xs font-medium text-amber-700 bg-amber-50 ring-1 ring-amber-200
                             rounded-full px-2 py-0.5 inline-flex items-center gap-1">
              <Icon name="pause" className="h-3 w-3" /> On Hold
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {t.taskTypeName && (
              <span className="flex items-center gap-1">
                <Icon name="fileText" className="h-3.5 w-3.5" />
                {t.taskTypeName}
              </span>
            )}
            {t.assigneeName && (
              <span className="flex items-center gap-1">
                <Icon name="users" className="h-3.5 w-3.5" />
                Previously: {t.assigneeName}
              </span>
            )}
            {t.platformName && (
              <span className="flex items-center gap-1">
                <Icon name="megaphone" className="h-3.5 w-3.5" />
                {t.platformName}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Campaign #{t.campaignId}
            {t.requestorName && <> · {t.requestorName}</>}
          </div>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onViewBrief}
            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs
                       text-slate-600 hover:bg-slate-50 transition flex items-center gap-1"
          >
            <Icon name="eye" className="h-3.5 w-3.5" /> Brief
          </button>
          <button
            onClick={onUnhold}
            disabled={busy}
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs
                       font-medium text-emerald-700 hover:bg-emerald-100 transition
                       disabled:opacity-60 flex items-center gap-1.5"
          >
            {busy
              ? <><Icon name="refresh" className="h-3.5 w-3.5 animate-spin" /> Re-routing…</>
              : <><Icon name="check" className="h-3.5 w-3.5" /> Unhold &amp; Route</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function fmtEnum(v) { return v ? v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—' }
