import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import campaignsApi from '../../api/campaigns'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'

const STATUS_STYLES = {
  PENDING_DEPT_APPROVAL:      'bg-yellow-50 text-yellow-700 ring-yellow-200',
  PENDING_MARKETING_APPROVAL: 'bg-orange-50 text-orange-700 ring-orange-200',
  PENDING_INTERVENTION:       'bg-amber-50 text-amber-700 ring-amber-200',
  IN_PROGRESS:                'bg-blue-50 text-blue-700 ring-blue-200',
  QC_REVIEW:                  'bg-purple-50 text-purple-700 ring-purple-200',
  COMPLETED:                  'bg-green-50 text-green-700 ring-green-200',
  REJECTED:                   'bg-red-50 text-red-700 ring-red-200',
}
const STATUS_LABELS = {
  PENDING_DEPT_APPROVAL:      'Pending Dept Approval',
  PENDING_MARKETING_APPROVAL: 'Pending Marketing Approval',
  PENDING_INTERVENTION:       'Pending Manager Intervention',
  IN_PROGRESS:                'In Progress',
  QC_REVIEW:                  'QC Review',
  COMPLETED:                  'Completed',
  REJECTED:                   'Rejected',
}

const TASK_STYLES = {
  ASSIGNED:    'bg-blue-50 text-blue-700 ring-blue-200',
  IN_PROGRESS: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  REWORK:      'bg-amber-50 text-amber-700 ring-amber-200',
  QC_REVIEW:   'bg-purple-50 text-purple-700 ring-purple-200',
  COMPLETED:   'bg-green-50 text-green-700 ring-green-200',
}
const TASK_LABELS = {
  ASSIGNED: 'Assigned', IN_PROGRESS: 'In Progress', REWORK: 'Rework',
  QC_REVIEW: 'In QC', COMPLETED: 'Completed',
}

export default function CampaignDetailPage() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const location   = useLocation()
  const toast      = useToast()
  const showToast  = (m, t = 'info') => toast[t]?.(m)

  const [c, setC] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    campaignsApi.getById(id)
      .then(res => setC(res.data))
      .catch(() => showToast('Failed to load campaign', 'error'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [id, location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p className="text-center text-slate-400 py-12 text-sm">Loading…</p>
  if (!c)      return <p className="text-center text-slate-400 py-12 text-sm">Campaign not found.</p>

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900"
        >
          <Icon name="chevron" className="h-3.5 w-3.5 rotate-180" /> Back
        </button>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition"
        >
          <Icon name="refresh" className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-slate-400">Campaign #{c.campaignId}</span>
              <StatusBadge status={c.status} />
              <PriorityBadge v={c.priority} />
              {c.flaggedInconsistency && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200" title={c.inconsistencyReason}>
                  <Icon name="alertCircle" className="h-3 w-3" /> Inconsistency flagged
                </span>
              )}
            </div>
            <h2 className="mt-2 text-xl font-bold text-slate-900">{c.requirementTypeName || 'Marketing Request'}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Requested by {c.requestorName || '—'} • {c.departmentName || '—'} • {fmtDate(c.createdAt)}
            </p>
            {c.inconsistencyReason && (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-rose-50 p-2 text-xs text-rose-800 ring-1 ring-rose-200">
                <Icon name="alertCircle" className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{c.inconsistencyReason}</span>
              </div>
            )}
            {c.routingNotes && (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800 ring-1 ring-amber-200">
                <Icon name="alertCircle" className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{c.routingNotes}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 1: Campaign Overview ── */}
      <BriefSection title="Campaign Overview">
        {/* Row 1: type + objective fills row cleanly */}
        <Detail label="Requirement Type"   value={c.requirementTypeName} />
        <Detail label="Business Objective" value={c.businessObjective} span={2} />
        {/* Row 2: location spans full width so multiple cities don't get clipped */}
        <Detail label="Target Location"    value={fmtTargetLocation(c.targetLocation)} span={3} />
        {/* Row 3: audience trio */}
        <Detail label="Audience Type"      value={fmtMultiValue(c.audienceName || c.audienceTypeId)} />
        <Detail label="Language"           value={fmtMultiValue(c.language)} />
        <Detail label="Tone / Style"       value={fmtMultiValue(c.tone)} />
      </BriefSection>

      {/* ── Section 2: Message & Offer ── */}
      <BriefSection title="Message & Offer">
        <Detail label="Key Message"      value={c.keyMessage}                         span={3} />
        <Detail label="Supporting Proof" value={c.supportingProof} />
        <Detail label="Has Offer"        value={c.hasOffer} />
        <Detail label="Offer Type"       value={c.offerTypeId || c.offerTypeName} />
      </BriefSection>

      {/* ── Section 3: Budget & Goals ── */}
      <BriefSection title="Budget & Goals">
        <Detail label="Budget Tier"     value={c.budgetTier} />
        <Detail label="KPI Type"        value={c.kpiType} />
        <Detail label="Expected Output" value={c.expectedOutput} />
        <Detail label="Vendor Required" value={c.vendorRequired} />
        <Detail label="Vendor Type"     value={fmtMultiValue(c.vendorType)} span={2} />
      </BriefSection>

      {/* Deliverables */}
      {c.deliverables?.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Deliverables</h3>
            <span className="text-xs text-slate-500">{c.deliverables.length}</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {c.deliverables.map((d, i) => (
              <li key={d.specId ?? i} className="flex items-center gap-3 px-5 py-3">
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
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-800">Work Tasks</h3>
          <span className="text-xs text-slate-500">{c.workTasks?.length || 0} created</span>
        </div>
        {(!c.workTasks || c.workTasks.length === 0) ? (
          <p className="text-center text-slate-400 py-8 text-sm">No work tasks yet — pending routing.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {c.workTasks.map(t => (
              <div key={t.taskId} className="px-5 py-4 space-y-2.5">
                {/* Task header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-slate-400">#{t.taskId}</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {t.granularTaskName || 'Task'}
                      </span>
                      <TaskBadge status={t.status} />
                      {t.reworkCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-orange-200">
                          <Icon name="refresh" className="h-2.5 w-2.5" />
                          {t.reworkCount}× rework
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {t.assigneeName ? `Assigned to ${t.assigneeName}` : 'Unassigned'}
                      {t.totalTimeLoggedMinutes != null && ` • ${t.totalTimeLoggedMinutes} min logged`}
                    </div>
                  </div>
                  {/* Asset links */}
                  {parseAssetUrls(t.assetUrl).length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {parseAssetUrls(t.assetUrl).map((url, i, arr) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          className="text-brand-600 hover:underline text-xs flex items-center gap-1">
                          <Icon name="fileText" className="h-3.5 w-3.5" />
                          {arr.length > 1 ? `File ${i + 1}` : 'View submitted file'}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <TaskTimestamps task={t} />

                {/* Submission notes */}
                {t.submissionNotes && (
                  <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-100">
                    <span className="text-slate-400 font-medium">Submission notes: </span>
                    {t.submissionNotes}
                  </div>
                )}

                {/* Task-specific Q&A */}
                <TaskQuestionnaireBrief items={t.questionnaire} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

/** Card section for work-task blocks (full-width header + content). */
function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  )
}

/** Brief section — compact header with a 3-column detail grid underneath. */
function BriefSection({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</span>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        {children}
      </div>
    </div>
  )
}

function Detail({ label, value, span = 1 }) {
  const cls = span === 3 ? 'sm:col-span-2 lg:col-span-3' : span === 2 ? 'sm:col-span-2' : ''
  return (
    <div className={cls}>
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-sm text-slate-800 font-medium break-words">{value || '—'}</div>
    </div>
  )
}

function TaskQuestionnaireBrief({ items }) {
  if (!items?.length) return null
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2.5 space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
        <Icon name="clipboard" className="h-3 w-3 shrink-0" />
        Task-specific Q&amp;A
      </div>
      <ul className="space-y-2.5">
        {items.map((row) => (
          <li key={row.questionId} className="text-xs">
            <div className="text-slate-600 font-medium leading-snug">{row.questionText}</div>
            <div className="text-slate-900 mt-0.5 break-words">{row.answerDisplay ?? '—'}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cls}`}>{STATUS_LABELS[status] || status}</span>
}
function TaskBadge({ status }) {
  const cls = TASK_STYLES[status] || 'bg-slate-100 text-slate-600'
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}>{TASK_LABELS[status] || status}</span>
}
function PriorityBadge({ v }) {
  const m = { HIGH: 'bg-red-50 text-red-700 ring-red-200', MEDIUM: 'bg-yellow-50 text-yellow-700 ring-yellow-200', LOW: 'bg-green-50 text-green-700 ring-green-200' }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${m[v] || 'bg-slate-100 text-slate-600'}`}>{v || '—'}</span>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parses target_location (stored as JSON array or plain string) into readable text. */
function fmtTargetLocation(raw) {
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.join(', ')
  } catch { /* fall through */ }
  return raw
}

/**
 * Multi-select fields are stored as comma-separated display names.
 * Renders them as a readable comma-joined string.
 */
function fmtMultiValue(v) {
  if (!v) return ''
  return String(v).split(',').map(s => s.trim()).filter(Boolean).join(', ')
}

function fmtDate(d) { return d ? new Date(d).toLocaleString('en-IN') : '' }

function parseAssetUrls(assetUrl) {
  if (!assetUrl) return []
  try {
    const parsed = JSON.parse(assetUrl)
    if (Array.isArray(parsed)) return parsed
  } catch { /* plain URL */ }
  return [assetUrl]
}

function TaskTimestamps({ task }) {
  const steps = [
    { key: 'assigned',  icon: 'inbox', label: 'Assigned',  ts: task.assignedAt || task.createdAt },
    { key: 'accepted',  icon: 'play',  label: 'Accepted',  ts: task.acceptedAt },
    { key: 'submitted', icon: 'send',  label: 'Submitted', ts: task.submittedAt },
    { key: 'approved',  icon: 'check', label: 'Approved',  ts: task.completedAt },
  ]
  return (
    <div className="rounded-md bg-slate-50 px-3 py-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {steps.map(s => (
        <div key={s.key} className="flex items-center gap-1">
          <Icon name={s.icon} className={`h-3 w-3 ${s.ts ? 'text-emerald-600' : 'text-slate-300'}`} />
          <span className={`font-medium ${s.ts ? 'text-slate-700' : 'text-slate-400'}`}>{s.label}:</span>
          <span className={s.ts ? 'text-slate-600' : 'text-slate-400'}>
            {s.ts
              ? new Date(s.ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
              : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}
