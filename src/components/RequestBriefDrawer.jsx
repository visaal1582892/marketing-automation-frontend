import { useCallback, useEffect, useState } from 'react'
import campaignsApi from '../api/campaigns'
import Icon from './Icon'
import PriorityEditor from './PriorityEditor'
import { useAuth } from '../auth/AuthContext'
import { useToast } from './Toast'
import { generateBriefPdf } from '../utils/generateBriefPdf'

/**
 * Slide-in drawer that shows the *complete* request brief for a campaign.
 *
 * Used everywhere a manager / member needs to see the full context of a
 * request (approvals, QC review, intervention, accept-task) — so people
 * can make informed decisions without leaving the page.
 */
export default function RequestBriefDrawer({ campaignId, onClose, onCampaignChanged, filterTaskId }) {
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  // Marketing Head / Admin can edit priority directly from the brief.
  const { isMarketingManager, isAdmin, isRequestor, user } = useAuth()
  const toast = useToast()
  const canEditPriority = isMarketingManager || isAdmin

  const [downloading, setDownloading] = useState(false)

  const handleDownloadPdf = useCallback(async () => {
    if (!campaign) return
    setDownloading(true)
    try {
      await generateBriefPdf(campaign)
    } catch (e) {
      console.error('PDF generation failed:', e)
    } finally {
      setDownloading(false)
    }
  }, [campaign])

  // Requestor rework state
  const [reworkTask,    setReworkTask]    = useState(null)
  const [reworkMsg,     setReworkMsg]     = useState('')
  const [submittingRw,  setSubmittingRw]  = useState(false)

  const myUserId = user?.userId ?? user?.id
  const canRequestRework = campaign != null && (
    isAdmin ||
    (isRequestor && myUserId != null && Number(campaign.requestorId) === Number(myUserId))
  )

  const handleRequestorRework = async () => {
    if (!reworkTask || !reworkMsg.trim()) return
    setSubmittingRw(true)
    try {
      await campaignsApi.requestorRework(campaign.campaignId, reworkTask.taskId, reworkMsg.trim())
      toast.success?.('Task sent for rework.')
      setReworkTask(null)
      setReworkMsg('')
      // Refresh campaign to reflect updated task statuses
      const res = await campaignsApi.getById(campaign.campaignId)
      setCampaign(res.data)
      onCampaignChanged?.(res.data)
    } catch (e) {
      toast.error?.(e?.response?.data?.message || 'Failed to send for rework.')
    } finally {
      setSubmittingRw(false)
    }
  }

  const handlePriorityChange = (updated) => {
    setCampaign(prev => prev ? { ...prev, ...updated } : updated)
    toast.success?.(`Priority updated to ${updated.priority}.`)
    onCampaignChanged?.(updated)
  }

  useEffect(() => {
    if (!campaignId) return
    setLoading(true)
    setError(null)
    campaignsApi.getById(campaignId)
      .then(res => setCampaign(res.data))
      .catch(() => setError('Failed to load request details.'))
      .finally(() => setLoading(false))
  }, [campaignId])

  // Lock background scroll while the drawer is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-slate-900/40 transition" onClick={onClose} aria-hidden="true" />
      <aside className="w-full max-w-2xl bg-slate-50 shadow-2xl overflow-y-auto flex flex-col">
        <DrawerHeader
          campaign={campaign}
          onClose={onClose}
          canEditPriority={canEditPriority}
          onPriorityChanged={handlePriorityChange}
          onPriorityError={(msg) => toast.error?.(msg)}
          onDownloadPdf={handleDownloadPdf}
          downloading={downloading}
          canDownload={!!campaign && !loading}
        />
        <div className="flex-1 px-5 py-5 space-y-4 bg-slate-50/50">
          {loading ? (
            <p className="text-center text-slate-400 py-12 text-sm">Loading full brief…</p>
          ) : error ? (
            <p className="text-center text-red-500 py-12 text-sm">{error}</p>
          ) : campaign ? (
            <RequestBriefBody
              campaign={campaign}
              filterTaskId={filterTaskId}
              canRequestRework={canRequestRework}
              onRequestRework={(t) => { setReworkTask(t); setReworkMsg('') }}
            />
          ) : null}
        </div>
      </aside>

      {reworkTask && (
        <RequestorReworkModal
          task={reworkTask}
          message={reworkMsg}
          onMessageChange={setReworkMsg}
          onConfirm={handleRequestorRework}
          onClose={() => { setReworkTask(null); setReworkMsg('') }}
          submitting={submittingRw}
        />
      )}
    </div>
  )
}

// ─── Compact header summary used inside confirmation modals ───────────────────

/**
 * One-glance summary card for use *inside* an action modal (approve, reject,
 * accept, submit, etc.) — supplements the modal with the most-decision-
 * relevant brief facts so the actor doesn't have to open the full drawer.
 */
export function RequestSummaryCard({ campaign }) {
  if (!campaign) return null
  const deliverables = campaign.deliverables?.length ?? null
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700 space-y-1.5 ring-1 ring-slate-200">
      <div className="flex items-center gap-2 flex-wrap">
        <IdChip value={campaign.campaignId} />
        <span className="font-semibold text-slate-800">{campaign.requirementTypeName || '—'}</span>
        <PriorityBadge v={campaign.priority} />
        {campaign.flaggedInconsistency && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
            <Icon name="alertCircle" className="h-3 w-3" /> Inconsistent
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <div><span className="text-slate-400">By:</span> <span className="font-medium">{campaign.requestorName || '—'}</span></div>
        <div><span className="text-slate-400">Dept:</span> <span className="font-medium">{campaign.departmentName || '—'}</span></div>
        <div><span className="text-slate-400">Budget:</span> <span className="font-medium">{campaign.budgetTier || '—'}</span></div>
        <div><span className="text-slate-400">Deliverables:</span> <span className="font-medium">{deliverables ?? '—'}</span></div>
      </div>
      {campaign.keyMessage && (
        <p className="text-slate-600 text-xs line-clamp-2 mt-1 italic">"{campaign.keyMessage}"</p>
      )}
    </div>
  )
}

// ─── Internals ───────────────────────────────────────────────────────────────

function DrawerHeader({ campaign, onClose, canEditPriority, onPriorityChanged, onPriorityError, onDownloadPdf, downloading, canDownload }) {
  const editablePriority = canEditPriority
    && campaign
    && !['COMPLETED', 'REJECTED'].includes(campaign.status)

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-5 py-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <IdChip label="REQ" value={campaign?.campaignId ?? '—'} />
          {campaign && <StatusBadge status={campaign.status} />}
          {campaign && (
            editablePriority ? (
              <PriorityEditor
                campaignId={campaign.campaignId}
                value={campaign.priority}
                editable
                onChanged={onPriorityChanged}
                onError={onPriorityError}
              />
            ) : (
              <PriorityBadge v={campaign.priority} />
            )
          )}
          {campaign?.flaggedInconsistency && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
              <Icon name="alertCircle" className="h-3 w-3" /> Inconsistent
            </span>
          )}
        </div>
        <h3 className="mt-1.5 text-base font-bold text-slate-900 truncate">
          {campaign?.requirementTypeName || 'Request Brief'}
        </h3>
        <p className="text-xs text-slate-500 truncate">
          {campaign?.requestorName || '—'} • {campaign?.departmentName || '—'}
          {campaign?.createdAt && ` • ${fmtDateTime(campaign.createdAt)}`}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {canDownload && (
          <button
            onClick={onDownloadPdf}
            disabled={downloading}
            title="Download brief as PDF"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50
                       px-2.5 py-1.5 text-xs font-medium text-slate-600
                       hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 transition"
          >
            {downloading ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Generating…
              </>
            ) : (
              <>
                <Icon name="download" className="h-3.5 w-3.5" />
                Download PDF
              </>
            )}
          </button>
        )}
        <button
          onClick={onClose}
          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 transition"
          aria-label="Close brief"
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function RequestBriefBody({ campaign: c, filterTaskId, canRequestRework = false, onRequestRework }) {
  // When opened from a worker's task card, only show their specific task.
  const visibleTasks = filterTaskId
    ? (c.workTasks || []).filter(t => String(t.taskId) === String(filterTaskId))
    : (c.workTasks || [])
  return (
    <>
      {/* Inline alerts */}
      {c.inconsistencyReason && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-800 ring-1 ring-rose-200">
          <Icon name="alertCircle" className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Inconsistency Detected</div>
            <div>{c.inconsistencyReason}</div>
          </div>
        </div>
      )}
      {c.routingNotes && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 ring-1 ring-amber-200">
          <Icon name="alertCircle" className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Routing Note</div>
            <div>{c.routingNotes}</div>
          </div>
        </div>
      )}

      {/* Approval audit trail */}
      <ApprovalTrail c={c} />

      {/* ── Campaign Overview ── */}
      <Section title="Campaign Overview">
        <Detail label="Requirement Type"   value={c.requirementTypeName} />
        <Detail label="Business Objective" value={c.businessObjective} span={2} />
        <Detail label="Target Location"    value={fmtTargetLocation(c.targetLocation)} span={3} />
        <Detail label="Audience Type"      value={fmtMultiValue(c.audienceName || c.audienceTypeId)} />
        <Detail label="Language"           value={fmtMultiValue(c.language)} />
        <Detail label="Tone / Style"       value={fmtMultiValue(c.tone)} />
      </Section>

      {/* ── Message & Offer ── */}
      <Section title="Message & Offer">
        <Detail label="Key Message"      value={c.keyMessage}      span={3} />
        <Detail label="Supporting Proof" value={c.supportingProof} />
        <Detail label="Has Offer"        value={c.hasOffer} />
        <Detail label="Offer Type"       value={c.offerTypeId || c.offerTypeName} />
      </Section>

      {/* ── Budget & Goals ── */}
      <Section title="Budget & Goals">
        <Detail label="Budget Tier"     value={c.budgetTier} />
        <Detail label="KPI Type"        value={c.kpiType} />
        <Detail label="Expected Output" value={c.expectedOutput} />
        <Detail label="Vendor Required" value={c.vendorRequired} />
        <Detail label="Vendor Type"     value={fmtMultiValue(c.vendorType)} span={2} />
      </Section>

      {/* Campaign Files */}
      {c.fileUrls?.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-2.5 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800">Campaign Files</h4>
            <span className="text-xs text-slate-500">{c.fileUrls.length}</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {c.fileUrls.map((url, i) => {
              const { label, icon } = fileDisplayInfo(url, i)
              return (
                <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`text-xs font-bold shrink-0 rounded px-1.5 py-0.5 ${icon.cls}`}>{icon.tag}</span>
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-brand-600 hover:underline truncate flex-1">
                    {label}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Deliverables */}
      {c.deliverables?.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-2.5 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800">Deliverables</h4>
            <span className="text-xs text-slate-500">{c.deliverables.length}</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {c.deliverables.map((d, i) => (
              <li key={d.specId ?? i} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-slate-800">{d.granularTaskName || d.granularTaskId}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Work Tasks */}
      {visibleTasks.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-800">
                {filterTaskId ? 'Your Task' : 'Work Tasks'}
              </h4>
              {!filterTaskId && <span className="text-xs text-slate-500">{visibleTasks.length}</span>}
            </div>
            {!filterTaskId && (
              <p className="mt-1 text-xs text-slate-500 leading-snug">
                Assignment, timing, and any <span className="font-medium text-slate-600">task questionnaire</span> answers
                (from the request form or updated by the assignee).
              </p>
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {visibleTasks.map(t => (
              <div key={t.taskId} className="px-4 py-4 space-y-3">
                {/* Task header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <IdChip label="TASK" value={t.taskId} />
                      <span className="text-sm font-bold text-slate-900">{t.granularTaskName || 'Task'}</span>
                      <TaskBadge status={t.status} />
                      {t.reworkCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-orange-200"
                          title={`Reworked ${t.reworkCount} time${t.reworkCount === 1 ? '' : 's'}`}>
                          <Icon name="refresh" className="h-2.5 w-2.5" />
                          {t.reworkCount}× rework
                        </span>
                      )}
                      {t.workerComment && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                          <Icon name="messageSquare" className="h-2.5 w-2.5" />
                          On Hold
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t.assigneeName ? `Assigned to ${t.assigneeName}` : 'Unassigned'}
                      {t.totalTimeLoggedMinutes != null && ` · ${t.totalTimeLoggedMinutes} min logged`}
                    </div>
                  </div>
                  {t.status === 'COMPLETED' && canRequestRework && (
                    <button
                      onClick={() => onRequestRework?.(t)}
                      className="flex items-center gap-1.5 rounded-md border border-amber-200
                                 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700
                                 hover:bg-amber-100 transition shrink-0">
                      <Icon name="refresh" className="h-3 w-3" />
                      Request Rework
                    </button>
                  )}
                </div>

                {/* Timeline */}
                <TaskTimestamps task={t} />

                {/* Submission notes */}
                {t.submissionNotes && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Submission notes</p>
                    <p>{t.submissionNotes}</p>
                  </div>
                )}

                {/* Worker comment / on-hold alert */}
                {t.workerComment && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Icon name="messageSquare" className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="font-bold text-amber-800 text-xs">Worker comment — task is on hold</span>
                    </div>
                    <p className="text-amber-900 whitespace-pre-wrap leading-relaxed">{t.workerComment}</p>
                  </div>
                )}

                {/* Task-specific Q&A */}
                <TaskQuestionnaireBrief items={t.questionnaire} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Tiny subcomponents (kept local for portability) ──────────────────────────

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-2.5 flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{title}</span>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">{children}</div>
    </div>
  )
}

function Detail({ label, value, span = 1 }) {
  const cls = span === 3 ? 'sm:col-span-2 lg:col-span-3'
            : span === 2 ? 'sm:col-span-2'
            : ''
  return (
    <div className={cls}>
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm text-slate-800 font-medium break-words">{value || <span className="text-slate-400 font-normal">—</span>}</div>
    </div>
  )
}

function StatusBadge({ status }) {
  const STYLES = {
    IN_PROGRESS:                'bg-blue-50 text-blue-700 ring-blue-200',
    QC_REVIEW:                  'bg-purple-50 text-purple-700 ring-purple-200',
    COMPLETED:                  'bg-green-50 text-green-700 ring-green-200',
    REJECTED:                   'bg-red-50 text-red-700 ring-red-200',
    CANCELLED:                  'bg-slate-100 text-slate-500 ring-slate-200',
  }
  const LABELS = {
    IN_PROGRESS:                'In Progress',
    QC_REVIEW:                  'QC Review',
    COMPLETED:                  'Completed',
    REJECTED:                   'Rejected',
    CANCELLED:                  'Cancelled',
  }
  const cls = STYLES[status] || 'bg-slate-100 text-slate-600'
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}>{LABELS[status] || status}</span>
}

function TaskBadge({ status }) {
  const TASK_STYLES = {
    ASSIGNED:    'bg-blue-50 text-blue-700 ring-blue-200',
    IN_PROGRESS: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    REWORK:      'bg-amber-50 text-amber-700 ring-amber-200',
    QC_REVIEW:   'bg-purple-50 text-purple-700 ring-purple-200',
    COMPLETED:   'bg-green-50 text-green-700 ring-green-200',
    HELD:        'bg-amber-50 text-amber-600 ring-amber-200',
    CANCELLED:   'bg-slate-100 text-slate-500 ring-slate-200',
  }
  const TASK_LABELS = {
    ASSIGNED: 'Assigned', IN_PROGRESS: 'In Progress', REWORK: 'Rework',
    QC_REVIEW: 'In QC',   COMPLETED: 'Completed', HELD: 'Held', CANCELLED: 'Cancelled',
  }
  const cls = TASK_STYLES[status] || 'bg-slate-100 text-slate-600'
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}>{TASK_LABELS[status] || status}</span>
}

/** Compact ID chip — replaces bare "#N" displays with a legible badge. */
function IdChip({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-500 shrink-0">
      {label && <span className="font-normal text-slate-400">{label}</span>}
      {value}
    </span>
  )
}

function PriorityBadge({ v }) {
  const m = { HIGH: 'bg-red-50 text-red-700 ring-red-200', MEDIUM: 'bg-yellow-50 text-yellow-700 ring-yellow-200', LOW: 'bg-green-50 text-green-700 ring-green-200' }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${m[v] || 'bg-slate-100 text-slate-600'}`}>{v || '—'}</span>
}

function ApprovalTrail({ c }) {
  // Don't render the trail at all if no decisions have been made yet — keeps
  // the drawer clean while a request is still freshly submitted.
  const hasAny = c.deptDecision || c.marketingDecision || c.interventionDecision
  if (!hasAny) return null

  const Stage = ({ label, decision, byName, at }) => (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <span className="text-slate-400 w-[110px] shrink-0">{label}</span>
      {decision === 'APPROVED' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
          <Icon name="check" className="h-3 w-3" /> Approved
        </span>
      )}
      {decision === 'REJECTED' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
          <Icon name="x" className="h-3 w-3" /> Rejected
        </span>
      )}
      {!decision && (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          Pending
        </span>
      )}
      {byName && <span className="text-slate-600">by <span className="font-medium">{byName}</span></span>}
      {at && <span className="text-slate-400">• {fmtDateTime(at)}</span>}
    </div>
  )

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-2.5">
        <h4 className="text-sm font-semibold text-slate-800">Approval Trail</h4>
      </div>
      <div className="p-4 space-y-2">
        <Stage
          label="Department"
          decision={c.deptDecision}
          byName={c.deptDecisionByName}
          at={c.deptDecisionAt}
        />
        <Stage
          label="Marketing"
          decision={c.marketingDecision}
          byName={c.marketingDecisionByName}
          at={c.marketingDecisionAt}
        />
        {c.interventionDecision && (
          // Manager intervention rejection — recorded in its own audit slot
          // so the original marketing-stage approval row is preserved.
          <Stage
            label="Intervention"
            decision={c.interventionDecision}
            byName={c.interventionDecisionByName}
            at={c.interventionDecisionAt}
          />
        )}
        {c.rejectionReason && (
          c.deptDecision === 'REJECTED' ||
          c.marketingDecision === 'REJECTED' ||
          c.interventionDecision === 'REJECTED'
        ) && (
          <div className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800 ring-1 ring-rose-200">
            <span className="font-semibold">Rejection reason:</span> {c.rejectionReason}
          </div>
        )}
      </div>
    </div>
  )
}

/** Renders requestor/worker answers for dynamic questions on this work task (from campaign API). */
function TaskQuestionnaireBrief({ items }) {
  if (!items?.length) return null
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 overflow-hidden">
      <div className="px-3 py-2 border-b border-indigo-100 flex items-center gap-1.5">
        <Icon name="clipboard" className="h-3 w-3 text-indigo-500 shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Task Q&amp;A</span>
      </div>
      <ul className="divide-y divide-indigo-100/70">
        {items.map((row) => (
          <li key={row.questionId} className="px-3 py-2.5">
            <div className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider mb-0.5">{row.questionText}</div>
            <div className="text-sm text-slate-800 font-medium whitespace-pre-wrap break-words">
              {row.answerDisplay ?? <span className="text-slate-400 font-normal italic">—</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TaskTimestamps({ task }) {
  const steps = [
    {
      key: 'assigned',
      label: 'Assigned',
      ts: task.assignedAt || task.createdAt,
      icon: (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm4 1.5a4.5 4.5 0 0 1 1 2.833V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-.667A4.5 4.5 0 0 1 4 9.5h8Z"/>
        </svg>
      ),
      done: { dot: 'bg-slate-500', line: 'bg-slate-300', text: 'text-slate-600', card: 'bg-slate-50 border-slate-200' },
    },
    {
      key: 'accepted',
      label: 'Accepted',
      ts: task.acceptedAt,
      icon: (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path fillRule="evenodd" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm11.78-1.72a.75.75 0 0 0-1.06-1.06L7 8.94 5.28 7.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25Z"/>
        </svg>
      ),
      done: { dot: 'bg-blue-500', line: 'bg-blue-200', text: 'text-blue-700', card: 'bg-blue-50 border-blue-200' },
    },
    {
      key: 'submitted',
      label: 'Submitted',
      ts: task.submittedAt,
      icon: (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M.5 9.9a.5.5 0 0 1 .5.5V13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.6a.5.5 0 0 1 1 0V13a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.6a.5.5 0 0 1 .5-.5Z"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3Z"/>
        </svg>
      ),
      done: { dot: 'bg-violet-500', line: 'bg-violet-200', text: 'text-violet-700', card: 'bg-violet-50 border-violet-200' },
    },
    {
      key: 'approved',
      label: 'Approved',
      ts: task.completedAt,
      icon: (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0Z"/>
        </svg>
      ),
      done: { dot: 'bg-emerald-500', line: 'bg-emerald-200', text: 'text-emerald-700', card: 'bg-emerald-50 border-emerald-200' },
    },
  ]

  const fmt = (ts) => new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="overflow-x-auto pb-0.5">
      <div className="flex items-stretch min-w-max gap-0">
        {steps.map((step, i) => {
          const active = !!step.ts
          const isLast = i === steps.length - 1
          const s = step.done
          return (
            <div key={step.key} className="flex items-center">
              {/* Step card */}
              <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition ${
                active ? s.card : 'bg-slate-50 border-slate-100'
              }`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full shrink-0 ${
                  active ? `${s.dot} text-white` : 'bg-slate-200 text-slate-400'
                }`}>
                  <span className="scale-75">{step.icon}</span>
                </span>
                <div className="leading-tight">
                  <div className={`text-[9px] font-bold uppercase tracking-wider ${active ? s.text : 'text-slate-400'}`}>
                    {step.label}
                  </div>
                  <div className={`text-[10px] font-semibold whitespace-nowrap ${active ? 'text-slate-700' : 'text-slate-400'}`}>
                    {active ? fmt(step.ts) : '—'}
                  </div>
                </div>
              </div>
              {/* Connector */}
              {!isLast && (
                <div className={`h-px w-3 shrink-0 ${active ? s.line : 'bg-slate-200'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns a human-readable label and a type tag/colour for a file URL.
 * Avoids showing raw server-generated hash filenames to users.
 */
function fileDisplayInfo(url, index) {
  const clean = (url || '').split('?')[0].toLowerCase()
  const ext   = clean.split('.').pop()

  const MAP = {
    jpg: { name: 'Image',        cls: 'bg-blue-50 text-blue-600'   },
    jpeg:{ name: 'Image',        cls: 'bg-blue-50 text-blue-600'   },
    png: { name: 'Image',        cls: 'bg-blue-50 text-blue-600'   },
    gif: { name: 'Image',        cls: 'bg-blue-50 text-blue-600'   },
    webp:{ name: 'Image',        cls: 'bg-blue-50 text-blue-600'   },
    svg: { name: 'Graphic',      cls: 'bg-cyan-50 text-cyan-600'   },
    mp4: { name: 'Video',        cls: 'bg-violet-50 text-violet-600'},
    mov: { name: 'Video',        cls: 'bg-violet-50 text-violet-600'},
    avi: { name: 'Video',        cls: 'bg-violet-50 text-violet-600'},
    webm:{ name: 'Video',        cls: 'bg-violet-50 text-violet-600'},
    wmv: { name: 'Video',        cls: 'bg-violet-50 text-violet-600'},
    pdf: { name: 'PDF',          cls: 'bg-red-50 text-red-600'     },
    doc: { name: 'Document',     cls: 'bg-indigo-50 text-indigo-600'},
    docx:{ name: 'Document',     cls: 'bg-indigo-50 text-indigo-600'},
    xls: { name: 'Spreadsheet',  cls: 'bg-green-50 text-green-600' },
    xlsx:{ name: 'Spreadsheet',  cls: 'bg-green-50 text-green-600' },
    ppt: { name: 'Presentation', cls: 'bg-orange-50 text-orange-600'},
    pptx:{ name: 'Presentation', cls: 'bg-orange-50 text-orange-600'},
  }

  const entry = MAP[ext]
  const num   = index + 1
  const label = entry ? `${entry.name} ${num}` : `Attachment ${num}`
  const icon  = entry
    ? { tag: entry.name.slice(0, 3).toUpperCase(), cls: entry.cls }
    : { tag: 'FILE', cls: 'bg-slate-100 text-slate-500' }

  return { label, icon }
}

/**
 * Multi-select fields are stored as comma-separated display names.
 * Splits and re-joins to normalise spacing.
 */
function fmtMultiValue(v) {
  if (!v) return ''
  return String(v).split(',').map(s => s.trim()).filter(Boolean).join(', ')
}
function fmtDateTime(d) {
  return d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''
}
/** target_location is stored as a JSON-string of city names — pretty-print it. */
function fmtTargetLocation(raw) {
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.join(', ')
  } catch { /* fall through — raw was not JSON */ }
  return raw
}

// ─── Requestor Rework Modal ───────────────────────────────────────────────────

function RequestorReworkModal({ task, message, onMessageChange, onConfirm, onClose, submitting }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Request Rework</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Tell the team what needs to be changed for task{' '}
              <span className="font-medium text-slate-700">#{task.taskId}</span>.
            </p>
          </div>
          <button onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="mx-5 mt-4 rounded-lg border border-rose-200 bg-rose-50/50 px-4 py-3">
          <p className="text-xs font-semibold text-slate-600 mb-0.5">
            {task.granularTaskName || 'Task'}
          </p>
          <p className="text-xs text-slate-500">
            Task {task.taskId} · Currently{' '}
            <span className="font-medium text-green-700">Delivered</span>
          </p>
        </div>
        <div className="px-5 py-4">
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Rework Message <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={message}
            onChange={e => onMessageChange(e.target.value)}
            rows={4}
            placeholder="Describe what needs to be changed or improved…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800
                       placeholder:text-slate-400 focus:border-rose-400 focus:outline-none
                       focus:ring-1 focus:ring-rose-300 resize-none"
          />
          <p className="mt-1 text-xs text-slate-400">This message will be visible to the marketing team.</p>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600
                       hover:bg-slate-50 transition disabled:opacity-60">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={submitting || !message?.trim()}
            className="flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold
                       text-white hover:bg-rose-700 disabled:opacity-50 transition shadow-sm">
            {submitting ? (
              <><span className="animate-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" /> Sending…</>
            ) : (
              <><Icon name="refresh" className="h-4 w-4" /> Send for Rework</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
