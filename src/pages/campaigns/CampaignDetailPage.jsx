import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import campaignsApi from '../../api/campaigns'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'
import { printBrief } from '../../utils/printBrief'
import AssetPreviewModal from '../../components/AssetPreviewModal'

const STATUS_STYLES = {
  IN_PROGRESS:                'bg-blue-50 text-blue-700 ring-blue-200',
  QC_REVIEW:                  'bg-purple-50 text-purple-700 ring-purple-200',
  COMPLETED:                  'bg-green-50 text-green-700 ring-green-200',
  REJECTED:                   'bg-red-50 text-red-700 ring-red-200',
}
const STATUS_LABELS = {
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
  const { user, isAdmin, isRequestor, isMarketingManager } = useAuth()

  const [c, setC] = useState(null)
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)

  const handlePrint = useCallback(() => {
    if (!c) return
    setPrinting(true)
    try   { printBrief(c) }
    catch (e) { console.error('Print failed:', e) }
    finally   { setPrinting(false) }
  }, [c])

  const [assetPreviewTask, setAssetPreviewTask] = useState(null)

  // Requestor rework modal state
  const [reworkTask,    setReworkTask]    = useState(null)   // task object to rework
  const [reworkMsg,     setReworkMsg]     = useState('')
  const [submittingRw,  setSubmittingRw]  = useState(false)

  const load = () => {
    setLoading(true)
    campaignsApi.getById(id)
      .then(res => setC(res.data))
      .catch(() => showToast('Failed to load campaign', 'error'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [id, location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRequestorRework = async () => {
    if (!reworkTask) return
    setSubmittingRw(true)
    try {
      await campaignsApi.requestorRework(c.campaignId, reworkTask.taskId, reworkMsg)
      showToast('Task sent back for rework.', 'success')
      setReworkTask(null)
      setReworkMsg('')
      load()
    } catch (e) {
      showToast(e?.response?.data?.message || 'Failed to request rework.', 'error')
    } finally {
      setSubmittingRw(false)
    }
  }

  // Can request rework? Only the campaign's requestor (or an admin who is not acting as
  // Marketing Manager). Marketing Managers approve/reject via QC — they should never
  // request rework on an already-completed task.
  const myUserId = user?.userId ?? user?.id
  const isOwnerOfCampaign = user && c && myUserId != null && Number(c.requestorId) === Number(myUserId)
  const canRequestRework = !isMarketingManager && (isAdmin || isOwnerOfCampaign)

  // Bookmark
  const [bookmarked, setBookmarked]   = useState(false)
  const [bookmarking, setBookmarking] = useState(false)
  useEffect(() => { if (c) setBookmarked(c.bookmarked ?? false) }, [c])

  const toggleBookmark = async () => {
    setBookmarking(true)
    try {
      const res = await campaignsApi.toggleBookmark(c.campaignId)
      setBookmarked(res.data?.bookmarked ?? false)
    } catch {
      showToast('Failed to update bookmark.', 'error')
    } finally {
      setBookmarking(false)
    }
  }

  // Clone
  const [cloning, setCloning] = useState(false)
  const handleClone = async () => {
    setCloning(true)
    try {
      const res = await campaignsApi.cloneCampaign(c.campaignId)
      const newId = res.data?.campaignId
      showToast('Campaign cloned — loading form to review and submit.', 'success')
      navigate(`/campaigns/${newId}/edit`)
    } catch {
      showToast('Failed to clone campaign.', 'error')
    } finally {
      setCloning(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
      <svg className="h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <span className="text-sm">Loading…</span>
    </div>
  )
  if (!c) return <p className="text-center text-slate-400 py-12 text-sm">Campaign not found.</p>

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* ── Top action bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium
                     text-slate-500 hover:text-slate-800 hover:bg-white transition"
        >
          <Icon name="chevron" className="h-4 w-4 rotate-180" /> Back
        </button>
        <div className="flex items-center gap-2">
          {/* Bookmark */}
          <button
            onClick={toggleBookmark}
            disabled={bookmarking}
            title={bookmarked ? 'Remove bookmark' : 'Bookmark this request'}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold
                        transition shadow-sm disabled:opacity-50
                        ${bookmarked
                          ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24"
              fill={bookmarked ? 'currentColor' : 'none'}
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
            {bookmarked ? 'Bookmarked' : 'Bookmark'}
          </button>
          {/* Clone */}
          {(isRequestor || isAdmin) && (
            <button
              onClick={handleClone}
              disabled={cloning}
              title="Clone this request into a new draft"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white
                         px-3 py-1.5 text-xs font-semibold text-slate-600
                         hover:bg-slate-50 disabled:opacity-50 transition shadow-sm"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              {cloning ? 'Cloning…' : 'Clone Request'}
            </button>
          )}
          <button
            onClick={handlePrint}
            disabled={printing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white
                       px-3 py-1.5 text-xs font-semibold text-slate-600
                       hover:bg-slate-50 disabled:opacity-50 transition shadow-sm"
          >
            <Icon name="printer" className="h-3.5 w-3.5" />
            Print / PDF
          </button>
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white
                       px-3 py-1.5 text-xs font-semibold text-slate-600
                       hover:bg-slate-50 transition shadow-sm"
          >
            <Icon name="refresh" className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* ── Hero banner ── */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 text-white shadow-md">
        <div className="px-7 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                Campaign Detail
              </p>
              <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">
                {c.requirementTypeName || 'Marketing Request'}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-white/55">
                {c.requestorName && <span>{c.requestorName}</span>}
                {c.departmentName && (
                  <><span className="text-white/25">·</span><span>{c.departmentName}</span></>
                )}
                {c.createdAt && (
                  <><span className="text-white/25">·</span><span>{fmtDate(c.createdAt)}</span></>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={c.status} />
                <PriorityBadge v={c.priority} />
                {c.flaggedInconsistency && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-900/50 px-2 py-0.5
                                   text-xs font-medium text-rose-200 ring-1 ring-rose-700">
                    <Icon name="alertCircle" className="h-3 w-3" /> Inconsistency
                  </span>
                )}
              </div>
            </div>
            <span className="text-4xl font-black text-white/10 tabular-nums select-none shrink-0">
              #{c.campaignId}
            </span>
          </div>
        </div>
        {(c.businessObjective || fmtTargetLocation(c.targetLocation)) && (
          <div className="border-t border-white/10 px-7 py-3 flex flex-wrap gap-x-8 gap-y-1.5">
            {c.businessObjective && (
              <span className="text-xs text-white/60">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 mr-2">
                  Objective
                </span>
                {c.businessObjective}
              </span>
            )}
            {fmtTargetLocation(c.targetLocation) && (
              <span className="text-xs text-white/60">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 mr-2">
                  Location
                </span>
                {fmtTargetLocation(c.targetLocation)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Alerts */}
      {c.inconsistencyReason && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5">
          <Icon name="alertCircle" className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-rose-800">Inconsistency Detected</p>
            <p className="text-xs text-rose-700 mt-0.5">{c.inconsistencyReason}</p>
          </div>
        </div>
      )}
      {c.routingNotes && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <Icon name="alertCircle" className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">Routing Note</p>
            <p className="text-xs text-amber-700 mt-0.5">{c.routingNotes}</p>
          </div>
        </div>
      )}

      {/* ── 3-col info sections ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <BriefCard title="Campaign Overview" icon="fileText" accent="blue">
          <DetailRow label="Requirement Type" value={c.requirementTypeName} />
          <DetailRow label="Audience Type"    value={fmtMultiValue(c.audienceName || c.audienceTypeId)} />
          <DetailRow label="Language"         value={fmtMultiValue(c.language)} />
          <DetailRow label="Tone / Style"     value={fmtMultiValue(c.tone)} />
        </BriefCard>

        <BriefCard title="Message & Offer" icon="messageSquare" accent="violet">
          <DetailRow label="Has Offer"        value={c.hasOffer} />
          {c.hasOffer === 'YES' && (
            <>
              <DetailRow label="Offer Type"       value={c.offerTypeId || c.offerTypeName} />
              <DetailRow label="Supporting Proof" value={c.supportingProof} />
            </>
          )}
          <DetailRow label="Key Message" value={c.keyMessage} multiline />
        </BriefCard>

        <BriefCard title="Budget & Goals" icon="trendingUp" accent="emerald">
          <DetailRow label="Budget Tier"     value={c.budgetTier} />
          <DetailRow label="KPI Type"        value={c.kpiType} />
          <DetailRow label="Expected Output" value={c.expectedOutput} />
          <DetailRow label="Vendor Required" value={c.vendorRequired} />
          {c.vendorRequired === 'YES' && (
            <DetailRow label="Vendor Type" value={fmtMultiValue(c.vendorType)} />
          )}
        </BriefCard>
      </div>

      {/* ── Deliverables ── */}
      {c.deliverables?.length > 0 && (
        <BriefCard title={`Deliverables (${c.deliverables.length})`} icon="checkSquare" accent="slate">
          <div className="flex flex-wrap gap-2">
            {c.deliverables.map((d, i) => (
              <div key={d.specId ?? i}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full
                                 bg-brand-100 text-[10px] font-bold text-brand-700">
                  {i + 1}
                </span>
                <span className="text-xs font-medium text-slate-700">
                  {d.granularTaskName || d.granularTaskId}
                </span>
              </div>
            ))}
          </div>
        </BriefCard>
      )}

      {/* ── Work Tasks ── */}
      <BriefCard
        title={`Work Tasks${c.workTasks?.length ? ` (${c.workTasks.length})` : ''}`}
        icon="clipboard"
        accent="brand"
      >
        {(!c.workTasks || c.workTasks.length === 0) ? (
          <p className="text-center text-slate-400 py-6 text-sm">No work tasks yet — pending routing.</p>
        ) : (
          <div className="space-y-4">
            {c.workTasks.map(t => (
              <div key={t.taskId}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                {/* Task header */}
                <div className="flex flex-wrap items-start justify-between gap-3
                                bg-slate-50/70 px-4 py-3 border-b border-slate-100">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5
                                       text-[10px] font-bold tabular-nums text-slate-500">
                        <span className="font-normal text-slate-400">TASK</span>{t.taskId}
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {t.granularTaskName || 'Task'}
                      </span>
                      <TaskBadge status={t.status} />
                      {t.reworkCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5
                                         text-xs font-medium text-orange-700 ring-1 ring-orange-200">
                          <Icon name="refresh" className="h-2.5 w-2.5" />
                          {t.reworkCount}× QC rework
                        </span>
                      )}
                      {t.requestorReworkCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5
                                         text-xs font-medium text-purple-700 ring-1 ring-purple-200">
                          <Icon name="refresh" className="h-2.5 w-2.5" />
                          {t.requestorReworkCount}× requestor rework
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {t.assigneeName ? `Assigned to ${t.assigneeName}` : 'Unassigned'}
                      {t.totalTimeLoggedMinutes != null && ` · ${t.totalTimeLoggedMinutes} min logged`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {(t.status === 'QC_REVIEW' || t.status === 'COMPLETED') && (
                      <button
                        onClick={() => setAssetPreviewTask(t)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200
                                   bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700
                                   hover:bg-brand-100 transition">
                        <Icon name="fileText" className="h-3 w-3" />
                        View Assets
                      </button>
                    )}
                    {t.status === 'COMPLETED' && canRequestRework && (
                      <button
                        onClick={() => { setReworkTask(t); setReworkMsg('') }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200
                                   bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700
                                   hover:bg-amber-100 transition">
                        <Icon name="refresh" className="h-3 w-3" /> Request Rework
                      </button>
                    )}
                  </div>
                </div>

                {/* Task body */}
                <div className="px-4 py-4 space-y-3">
                  <TaskTimestamps task={t} />
                  {t.submissionNotes && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                        Submission notes
                      </p>
                      <p className="text-sm text-slate-700">{t.submissionNotes}</p>
                    </div>
                  )}
                  <TaskQuestionnaireBrief items={t.questionnaire} />
                </div>
              </div>
            ))}
          </div>
        )}
      </BriefCard>

      {/* Requestor Rework Modal */}
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

      {assetPreviewTask && (
        <AssetPreviewModal
          taskId={assetPreviewTask.taskId}
          taskName={assetPreviewTask.granularTaskName || assetPreviewTask.requirementTypeName || `Task ${assetPreviewTask.taskId}`}
          currentUserId={myUserId}
          onClose={() => setAssetPreviewTask(null)}
        />
      )}
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

const ACCENT_ICON = {
  blue:    'from-blue-500 to-blue-600',
  violet:  'from-violet-500 to-violet-600',
  emerald: 'from-emerald-500 to-emerald-600',
  amber:   'from-amber-500 to-amber-600',
  brand:   'from-brand-500 to-brand-700',
  slate:   'from-slate-500 to-slate-700',
}

function BriefCard({ title, icon, accent = 'slate', children }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-3.5">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg
                         bg-gradient-to-br ${ACCENT_ICON[accent] || ACCENT_ICON.slate}
                         text-white shadow-sm`}>
          <Icon name={icon} className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      <div className="px-5 py-4 space-y-3.5">
        {children}
      </div>
    </div>
  )
}

function DetailRow({ label, value, multiline = false }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
        {label}
      </p>
      {value ? (
        <p className={`text-sm font-medium text-slate-800 leading-snug
                       ${multiline ? 'whitespace-pre-wrap' : ''}`}>
          {value}
        </p>
      ) : (
        <p className="text-sm text-slate-300 select-none">—</p>
      )}
    </div>
  )
}

function TaskQuestionnaireBrief({ items }) {
  if (!items?.length) return null
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-indigo-100 px-4 py-2.5">
        <Icon name="clipboard" className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
          Task Q&amp;A
        </span>
      </div>
      <ul className="divide-y divide-indigo-100/70">
        {items.map(row => (
          <li key={row.questionId} className="px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-0.5">
              {row.questionText}
            </p>
            <p className="text-sm text-slate-800 font-medium whitespace-pre-wrap break-words">
              {row.answerDisplay ?? <span className="text-slate-400 font-normal italic">—</span>}
            </p>
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

function TaskTimestamps({ task }) {
  const fmt = ts => new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  const steps = [
    { key: 'assigned',  label: 'Assigned',  ts: task.assignedAt || task.createdAt, done: { dot: 'bg-slate-500',   line: 'bg-slate-300',   text: 'text-slate-600',   card: 'bg-slate-50 border-slate-200'   } },
    { key: 'accepted',  label: 'Accepted',  ts: task.acceptedAt,                   done: { dot: 'bg-blue-500',    line: 'bg-blue-200',    text: 'text-blue-700',    card: 'bg-blue-50 border-blue-200'     } },
    { key: 'submitted', label: 'Submitted', ts: task.submittedAt,                  done: { dot: 'bg-violet-500',  line: 'bg-violet-200',  text: 'text-violet-700',  card: 'bg-violet-50 border-violet-200' } },
    { key: 'approved',  label: 'Approved',  ts: task.completedAt,                  done: { dot: 'bg-emerald-500', line: 'bg-emerald-200', text: 'text-emerald-700', card: 'bg-emerald-50 border-emerald-200' } },
  ]
  return (
    <div className="overflow-x-auto pb-0.5">
      <div className="flex items-stretch min-w-max gap-0">
        {steps.map((step, i) => {
          const active = !!step.ts
          const isLast = i === steps.length - 1
          const s = step.done
          return (
            <div key={step.key} className="flex items-center">
              <div className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 transition ${
                active ? s.card : 'bg-slate-50 border-slate-100'
              }`}>
                <span className={`flex h-4 w-4 items-center justify-center rounded-full shrink-0 ${
                  active ? `${s.dot} text-white` : 'bg-slate-200 text-slate-400'
                }`}>
                  <Icon name="check" className="h-2.5 w-2.5" strokeWidth={3} />
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

// ─── Requestor Rework Modal ───────────────────────────────────────────────────

function RequestorReworkModal({ task, message, onMessageChange, onConfirm, onClose, submitting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl flex flex-col">

        {/* Header */}
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

        {/* Task info */}
        <div className="mx-5 mt-4 rounded-lg border border-rose-200 bg-rose-50/50 px-4 py-3">
          <p className="text-xs font-semibold text-slate-600 mb-0.5">
            {task.granularTaskName || 'Task'}
          </p>
          <p className="text-xs text-slate-500">
            Task {task.taskId} · Currently{' '}
            <span className="font-medium text-green-700">Delivered</span>
          </p>
        </div>

        {/* Message input */}
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
          <p className="mt-1 text-xs text-slate-400">
            This message will be visible to the marketing team.
          </p>
        </div>

        {/* Footer */}
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
              <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg> Sending…</>
            ) : (
              <><Icon name="refresh" className="h-4 w-4" /> Send for Rework</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
