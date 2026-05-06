import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import managerApi from '../../api/manager'
import campaignsApi from '../../api/campaigns'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'
import RequestBriefDrawer, { RequestSummaryCard } from '../../components/RequestBriefDrawer'
import AppSelect from '../../components/AppSelect'

/**
 * Module 2-B — Manager Intervention queue.
 * Lists campaigns paused at PENDING_INTERVENTION (full team capacity) and
 * lets the manager retry routing, force-assign a specific user, or reject.
 */
export default function InterventionPage() {
  const location = useLocation()
  const toast    = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)

  const [campaigns, setCampaigns] = useState([])
  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [busyId, setBusyId]       = useState(null)
  const [override, setOverride]   = useState(null)
  const [overrideForm, setOverrideForm] = useState({ userId: '', granularTaskId: '' })
  const [rejecting, setRejecting] = useState(null)
  const [reason, setReason]       = useState('')
  const [briefCampaignId, setBriefCampaignId] = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      managerApi.pendingIntervention().then(r => r.data || []),
      managerApi.capacity().then(r => r.data || []),
    ])
      .then(([camps, caps]) => { setCampaigns(camps); setUsers(caps) })
      .catch(() => showToast('Failed to load intervention queue', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const retry = async (c) => {
    setBusyId(c.campaignId)
    try {
      await managerApi.retryIntervention(c.campaignId)
      showToast('Routing retried.', 'success')
      load()
    } catch (e) {
      const msg = e?.response?.data?.message || 'Retry failed — capacity is still full?'
      showToast(msg, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const startOverride = async (c) => {
    setOverrideForm({ userId: '', granularTaskId: '' })
    try {
      const detail = await campaignsApi.getById(c.campaignId).then(r => r.data)
      setOverride(detail)
    } catch {
      setOverride(c)
    }
  }

  const confirmOverride = async () => {
    if (!override || !overrideForm.userId) {
      showToast('Pick a user to assign.', 'error')
      return
    }
    setBusyId(override.campaignId)
    try {
      await managerApi.overrideIntervention(override.campaignId, {
        userId: Number(overrideForm.userId),
        granularTaskId: overrideForm.granularTaskId || null,
      })
      showToast('Override applied — task assigned.', 'success')
      setOverride(null)
      load()
    } catch (e) {
      const msg = e?.response?.data?.message || 'Override failed'
      showToast(msg, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const startReject = (c) => { setRejecting(c); setReason('') }
  const confirmReject = async () => {
    if (!rejecting) return
    if (!reason.trim()) { showToast('Reason is required.', 'error'); return }
    setBusyId(rejecting.campaignId)
    try {
      await managerApi.rejectIntervention(rejecting.campaignId, reason.trim())
      showToast('Campaign rejected.', 'success')
      setRejecting(null)
      load()
    } catch (e) {
      const msg = e?.response?.data?.message || 'Reject failed'
      showToast(msg, 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Manager Intervention Queue</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Campaigns paused because the assigned team has hit maximum capacity. Resolve by raising
          a member's cap, force-assigning a specific user, or rejecting the request.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-2">
          <Icon name="alertCircle" className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-700">{campaigns.length} need attention</span>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-slate-400 py-12 text-sm">Loading…</p>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-14 text-center">
          <Icon name="inbox" className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">No campaigns pending intervention.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <InterventionCard
              key={c.campaignId}
              campaign={c}
              busy={busyId === c.campaignId}
              onRetry={() => retry(c)}
              onOverride={() => startOverride(c)}
              onReject={() => startReject(c)}
              onView={() => setBriefCampaignId(c.campaignId)}
            />
          ))}
        </div>
      )}

      {override && (
        <OverrideModal
          campaign={override}
          users={users}
          form={overrideForm}
          setForm={setOverrideForm}
          saving={busyId === override.campaignId}
          onCancel={() => setOverride(null)}
          onConfirm={confirmOverride}
        />
      )}

      {rejecting && (
        <RejectModal
          campaign={rejecting}
          reason={reason}
          setReason={setReason}
          saving={busyId === rejecting.campaignId}
          onCancel={() => setRejecting(null)}
          onConfirm={confirmReject}
          onViewBrief={() => setBriefCampaignId(rejecting.campaignId)}
        />
      )}

      {briefCampaignId && (
        <RequestBriefDrawer
          campaignId={briefCampaignId}
          onClose={() => setBriefCampaignId(null)}
          onCampaignChanged={(updated) => {
            // Reflect priority / inconsistency edits made from inside the drawer
            // immediately on the intervention card behind it.
            setCampaigns(prev => prev.map(p =>
              p.campaignId === updated.campaignId ? { ...p, ...updated } : p
            ))
          }}
        />
      )}
    </div>
  )
}

function InterventionCard({ campaign, busy, onRetry, onOverride, onReject, onView }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-400">#{campaign.campaignId}</span>
            <span className="text-sm font-semibold text-slate-800">{campaign.taskTypeName}</span>
            <PriorityBadge v={campaign.priority} />
            {campaign.flaggedInconsistency && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
                <Icon name="alertCircle" className="h-3 w-3" /> Inconsistent
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Requested by {campaign.requestorName} • {campaign.departmentName}
          </div>
          {campaign.routingNotes && (
            <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
              <Icon name="alertCircle" className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{campaign.routingNotes}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onView}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 transition flex items-center gap-1"
          >
            <Icon name="eye" className="h-3.5 w-3.5" /> Brief
          </button>
          <button
            onClick={onRetry}
            disabled={busy}
            className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition disabled:opacity-60 flex items-center gap-1"
          >
            <Icon name="refresh" className="h-3.5 w-3.5" /> Retry routing
          </button>
          <button
            onClick={onOverride}
            disabled={busy}
            className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-60 flex items-center gap-1"
          >
            <Icon name="users" className="h-3.5 w-3.5" /> Force assign
          </button>
          <button
            onClick={onReject}
            disabled={busy}
            className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition disabled:opacity-60 flex items-center gap-1"
          >
            <Icon name="x" className="h-3.5 w-3.5" /> Reject
          </button>
        </div>
      </div>
    </div>
  )
}

function OverrideModal({ campaign, users, form, setForm, saving, onCancel, onConfirm }) {
  const candidates = useMemo(() =>
    [...users].sort((a, b) => (a.currentActiveTasks || 0) - (b.currentActiveTasks || 0)),
    [users])

  const deliverables = (campaign.deliverables || [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Force-assign deliverable</h3>
          <button onClick={onCancel} className="rounded p-1 text-slate-400 hover:bg-slate-100 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <RequestSummaryCard campaign={campaign} />

        {campaign.routingNotes && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 ring-1 ring-amber-200">
            <Icon name="alertCircle" className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{campaign.routingNotes}</span>
          </div>
        )}

        {deliverables.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Deliverable (optional)</label>
            <AppSelect
              value={form.granularTaskId}
              onChange={v => setForm({ ...form, granularTaskId: v })}
              options={[{ value: '', label: 'First un-routed deliverable' }, ...deliverables.map(d => ({ value: d.granularTaskId, label: d.granularTaskName || d.granularTaskId }))]}
              placeholder="First un-routed deliverable"
              isClearable={false}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Assign to user <span className="text-red-500">*</span>
          </label>
          <AppSelect
            value={form.userId ? String(form.userId) : ''}
            onChange={v => setForm({ ...form, userId: v })}
            options={candidates.map(u => ({ value: String(u.userId), label: `${u.fullName} — ${u.roleName || '—'} (${u.currentActiveTasks ?? 0} active tasks)` }))}
            placeholder="Select user…"
          />
          <p className="mt-1 text-xs text-amber-600">
            This will assign the task even if the user is at max capacity.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60"
          >
            {saving ? 'Assigning…' : 'Confirm assign'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RejectModal({ campaign, reason, setReason, saving, onCancel, onConfirm, onViewBrief }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Reject paused campaign</h3>
          <button onClick={onCancel} className="rounded p-1 text-slate-400 hover:bg-slate-100 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <RequestSummaryCard campaign={campaign} />

        <button
          type="button"
          onClick={onViewBrief}
          className="text-xs text-brand-600 hover:underline flex items-center gap-1"
        >
          <Icon name="eye" className="h-3 w-3" /> View full request brief
        </button>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is the campaign being rejected?"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 resize-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">Cancel</button>
          <button onClick={onConfirm} disabled={saving} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-60">
            {saving ? 'Rejecting…' : 'Confirm reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PriorityBadge({ v }) {
  const m = { HIGH: 'bg-red-50 text-red-700 ring-red-200', MEDIUM: 'bg-yellow-50 text-yellow-700 ring-yellow-200', LOW: 'bg-green-50 text-green-700 ring-green-200' }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${m[v] || 'bg-slate-100 text-slate-600'}`}>{v || '—'}</span>
}
