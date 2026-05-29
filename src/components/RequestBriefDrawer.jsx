import { useCallback, useEffect, useRef, useState } from 'react'
import campaignsApi from '../api/campaigns'
import tasksApi from '../api/tasks'
import api from '../api/client'
import Icon from './Icon'
import PriorityEditor from './PriorityEditor'
import { useAuth } from '../auth/AuthContext'
import { useToast } from './Toast'
import { printBrief } from '../utils/printBrief'

/** Drop answered comment from local campaign snapshot; recompute badge flags. */
function campaignAfterCommentAnswered(campaign, taskId, commentId) {
  if (!campaign) return campaign
  const workTasks = (campaign.workTasks || []).map(t => {
    if (String(t.taskId) !== String(taskId)) return t
    const activeComments = (t.activeComments || []).filter(
      c => String(c.commentId) !== String(commentId),
    )
    return { ...t, activeComments, hasActiveComments: activeComments.length > 0 }
  })
  const hasUnansweredComments = workTasks.some(t => (t.activeComments || []).length > 0)
  return { ...campaign, workTasks, hasUnansweredComments }
}

/**
 * Full-screen brief viewer — replaced the old slide-in drawer.
 * Shown wherever a complete request context is needed (QC, My Tasks,
 * campaign list, interventions, etc.).
 */
export default function RequestBriefDrawer({
  campaignId, onClose, onCampaignChanged, onCommentAnswered, filterTaskId,
}) {
  const [campaign, setCampaign] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const { isMarketingManager, isAdmin, isRequestor, user } = useAuth()
  const toast           = useToast()
  const canEditPriority = isMarketingManager || isAdmin

  const [printing, setPrinting] = useState(false)
  const handlePrint = useCallback(() => {
    if (!campaign) return
    setPrinting(true)
    try   { printBrief(campaign, filterTaskId) }
    catch (e) { console.error('Print failed:', e) }
    finally   { setPrinting(false) }
  }, [campaign, filterTaskId])

  const [reworkTask,   setReworkTask]   = useState(null)
  const [reworkMsg,    setReworkMsg]    = useState('')
  const [submittingRw, setSubmittingRw] = useState(false)

  const [markingCommentId, setMarkingCommentId] = useState(null)
  const handleMarkAnswered = useCallback(async (taskId, commentId) => {
    if (!campaign?.campaignId) return
    setMarkingCommentId(commentId)
    try {
      await tasksApi.markCommentAnswered(taskId, commentId)
      const patched = campaignAfterCommentAnswered(campaign, taskId, commentId)
      setCampaign(patched)
      const task = patched.workTasks?.find(t => String(t.taskId) === String(taskId))
      onCommentAnswered?.({
        campaignId: patched.campaignId,
        taskId,
        commentId,
        hasActiveComments: !!task?.hasActiveComments,
        hasUnansweredComments: !!patched.hasUnansweredComments,
      })
      const res = await campaignsApi.getById(campaign.campaignId)
      setCampaign(res.data)
      onCampaignChanged?.(res.data)
      toast.success?.('Comment marked as answered.')
    } catch (e) {
      toast.error?.(e?.response?.data?.message || 'Failed to mark comment as answered.')
    } finally {
      setMarkingCommentId(null)
    }
  }, [campaign, onCampaignChanged, onCommentAnswered, toast])

  const [locExpanded, setLocExpanded] = useState(false)

  // ── Slide-in / slide-out animation ────────────────────────────────────────
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)

  // Trigger slide-in on the frame after mount so the transition plays
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const handleClose = useCallback(() => {
    setClosing(true)
    setTimeout(() => onClose(), 310)
  }, [onClose])
  // ──────────────────────────────────────────────────────────────────────────

  const myUserId = user?.userId ?? user?.id
  // Marketing Managers approve/reject via QC — they must not request rework after delivery.
  const canRequestRework =
    campaign != null &&
    !isMarketingManager &&
    (isAdmin || (isRequestor && myUserId != null &&
      Number(campaign.requestorId) === Number(myUserId)))

  const handleRequestorRework = async () => {
    if (!reworkTask || !reworkMsg.trim()) return
    setSubmittingRw(true)
    try {
      await campaignsApi.requestorRework(
        campaign.campaignId, reworkTask.taskId, reworkMsg.trim(),
      )
      toast.success?.('Task sent for rework.')
      setReworkTask(null); setReworkMsg('')
      const res = await campaignsApi.getById(campaign.campaignId)
      setCampaign(res.data)
      onCampaignChanged?.(res.data)
    } catch (e) {
      toast.error?.(e?.response?.data?.message || 'Failed to send for rework.')
    } finally { setSubmittingRw(false) }
  }

  const handlePriorityChange = (updated) => {
    setCampaign(prev => prev ? { ...prev, ...updated } : updated)
    toast.success?.(`Priority updated to ${updated.priority}.`)
    onCampaignChanged?.(updated)
  }

  useEffect(() => {
    if (!campaignId) return
    setLoading(true); setError(null)
    campaignsApi.getById(campaignId)
      .then(res  => setCampaign(res.data))
      .catch(()  => setError('Failed to load request details.'))
      .finally(() => setLoading(false))
  }, [campaignId])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const c          = campaign
  const isTerminal = ['COMPLETED', 'REJECTED'].includes(c?.status)

  // The single task the caller navigated from (if filterTaskId is supplied)
  const filteredTask = filterTaskId
    ? (c?.workTasks || []).find(t => String(t.taskId) === String(filterTaskId))
    : null

  const visibleTasks = (() => {
    if (!filterTaskId) return c?.workTasks || []
    return (c?.workTasks || [])
      .filter(t => {
        if (String(t.taskId) === String(filterTaskId)) return true
        // Focal task is a source (designer) task → also show its linked auto-generated content task
        if (!filteredTask?.autoGenerated && t.autoGenerated &&
            t.sourceTaskId && String(t.sourceTaskId) === String(filterTaskId)) return true
        // Focal task is auto-generated → also show the source task so the content writer has context
        if (filteredTask?.autoGenerated && filteredTask.sourceTaskId &&
            String(t.taskId) === String(filteredTask.sourceTaskId)) return true
        return false
      })
      // Source tasks always appear before auto-generated tasks
      .sort((a, b) => {
        if (!a.autoGenerated && b.autoGenerated) return -1
        if (a.autoGenerated && !b.autoGenerated) return 1
        return 0
      })
  })()

  const isOpen = visible && !closing

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        aria-hidden="true"
        onClick={handleClose}
        className="fixed inset-0 z-modal bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300"
        style={{ opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none' }}
      />

      {/* ── Sliding panel ── */}
      <div
        className="fixed inset-y-0 right-0 z-modal flex w-full flex-col bg-slate-50 shadow-2xl overflow-hidden"
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 310ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >

      {/* ── Sticky top bar ─────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_3px_0_rgb(0,0,0,0.05)]">
        <div className="max-w-5xl mx-auto px-5 h-[60px] flex items-center justify-between gap-4">
          {/* Left */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleClose}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium
                         text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition shrink-0"
            >
              <Icon name="chevron" className="h-4 w-4 rotate-180" />
              <span className="hidden sm:block">Back</span>
            </button>
            <div className="h-5 w-px bg-slate-200 shrink-0" />
            {c && (
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <IdChip label="REQ" value={c.campaignId} />
                <StatusBadge status={c.status} />
                {canEditPriority && !isTerminal ? (
                  <PriorityEditor
                    campaignId={c.campaignId}
                    value={c.priority}
                    editable
                    onChanged={handlePriorityChange}
                    onError={msg => toast.error?.(msg)}
                  />
                ) : (
                  <PriorityBadge v={c?.priority} />
                )}
                <span className="text-sm font-semibold text-slate-800 truncate hidden sm:block">
                  {c.businessObjective || ''}
                </span>
              </div>
            )}
          </div>
          {/* Right */}
          <div className="flex items-center gap-2 shrink-0">
            {c && !loading && (
              <button
                onClick={handlePrint}
                disabled={printing}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white
                           px-3 py-1.5 text-xs font-semibold text-slate-600
                           hover:bg-slate-50 disabled:opacity-50 transition"
              >
                <Icon name="printer" className="h-3.5 w-3.5" />
                Print / PDF
              </button>
            )}
            <button
              onClick={handleClose}
              className="rounded-lg p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-5 py-8 space-y-5 pb-16">

          {loading && (
            <div className="flex flex-col items-center justify-center py-28 gap-3 text-slate-400">
              <svg className="h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span className="text-sm">Loading brief…</span>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-28">
              <p className="text-sm text-rose-500">{error}</p>
            </div>
          )}

          {!loading && !error && c && (
            <>
              {/* ── Hero card ── */}
              <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 text-white shadow-md">
                <div className="px-7 py-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                        Campaign Brief
                      </p>
                      <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">
                        {c.businessObjective || 'Request Brief'}
                      </h1>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-white/55">
                        {c.requestorName && <span>{c.requestorName}</span>}
                        {c.departmentName && (
                          <><span className="text-white/25">·</span><span>{c.departmentName}</span></>
                        )}
                        {c.createdAt && (
                          <><span className="text-white/25">·</span><span>{fmtDateTime(c.createdAt)}</span></>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-4xl font-black text-white/10 tabular-nums select-none">
                        #{c.campaignId}
                      </span>
                    </div>
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
                    {parseLocations(c.targetLocation).length > 0 && (() => {
                      const locs = parseLocations(c.targetLocation)
                      return (
                        <span className="text-xs text-white/60">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 mr-2">
                            Location
                          </span>
                          {locs[0]}{locs.length > 1 && <span className="text-white/40"> +{locs.length - 1}</span>}
                        </span>
                      )
                    })()}
                    {c.storeId && (
                      <span className="text-xs text-white/60">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 mr-2">
                          Store ID
                        </span>
                        {c.storeId}
                      </span>
                    )}
                    {c.contactNumber && (
                      <span className="text-xs text-white/60">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 mr-2">
                          Contact
                        </span>
                        {c.contactNumber}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* ── Inline alerts ── */}
              {c.inconsistencyReason && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5">
                  <Icon name="alertCircle" className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-rose-800">Inconsistency Detected</p>
                    <p className="text-xs text-rose-700 mt-0.5 whitespace-pre-wrap">{c.inconsistencyReason}</p>
                  </div>
                </div>
              )}
              {c.routingNotes && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
                  <Icon name="alertCircle" className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-800">Routing Note</p>
                    <p className="text-xs text-amber-700 mt-0.5 whitespace-pre-wrap">{c.routingNotes}</p>
                  </div>
                </div>
              )}

              {/* ── Approval trail ── */}
              <ApprovalTrail c={c} />

              {/* ── Target Locations (full-width) ── */}
              {parseLocations(c.targetLocation).length > 0 && (() => {
                const locs = parseLocations(c.targetLocation)
                const SHOW = 4
                return (
                  <BriefCard title="Target Locations" icon="mapPin" accent="brand">
                    <div className="flex flex-wrap gap-2">
                      {(locExpanded ? locs : locs.slice(0, SHOW)).map(loc => (
                        <span key={loc}
                          className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 text-brand-700
                            px-3 py-1 text-xs font-medium ring-1 ring-brand-200">
                          <Icon name="mapPin" className="h-3 w-3 shrink-0 text-brand-400" />
                          {loc}
                        </span>
                      ))}
                      {!locExpanded && locs.length > SHOW && (
                        <button type="button" onClick={() => setLocExpanded(true)}
                          className="inline-flex items-center rounded-full bg-slate-100 text-slate-500
                            px-3 py-1 text-xs font-medium hover:bg-slate-200 transition">
                          +{locs.length - SHOW} more
                        </button>
                      )}
                      {locExpanded && locs.length > SHOW && (
                        <button type="button" onClick={() => setLocExpanded(false)}
                          className="inline-flex items-center rounded-full bg-slate-100 text-slate-500
                            px-3 py-1 text-xs font-medium hover:bg-slate-200 transition">
                          Show less
                        </button>
                      )}
                    </div>
                  </BriefCard>
                )
              })()}

              {/* ── 3-column info sections ── */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <BriefCard title="Campaign Overview" icon="fileText" accent="blue">
                  {c.storeId       && <DetailRow label="Store ID"       value={c.storeId} />}
                  {c.contactNumber && <DetailRow label="Contact Number" value={c.contactNumber} />}
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

              {/* ── Files ── */}
              {c.fileUrls?.length > 0 && (
                <BriefCard title={`Campaign Files (${c.fileUrls.length})`} icon="paperclip" accent="slate">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {c.fileUrls.map((url, i) => {
                      const origName = c.fileOriginalNames?.[i]
                      const { label, icon } = fileDisplayInfo(url, i, origName)
                      return (
                        <div key={i}
                          className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                          <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50">
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${icon.cls}`}>
                              {icon.tag}
                            </span>
                            <span className="truncate text-xs font-medium text-slate-700" title={label}>{label}</span>
                          </div>
                          <div className="flex border-t border-slate-200">
                            <a href={url} target="_blank" rel="noopener noreferrer"
                              className="flex flex-1 items-center justify-center gap-1.5 py-2 text-[11px] font-medium
                                         text-brand-600 hover:bg-brand-50 transition">
                              <Icon name="externalLink" className="h-3 w-3" />
                              Open
                            </a>
                            <span className="w-px bg-slate-200 shrink-0" />
                            <button
                              onClick={() => downloadCampaignFile(url, origName)}
                              className="flex flex-1 items-center justify-center gap-1.5 py-2 text-[11px] font-medium
                                         text-slate-600 hover:bg-slate-50 transition">
                              <Icon name="download" className="h-3 w-3" />
                              Download
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </BriefCard>
              )}

              {/* ── Deliverables ── */}
              {c.deliverables?.length > 0 && (
                <BriefCard title={`Deliverables (${c.deliverables.length})`} icon="checkSquare" accent="slate">
                  <div className="flex flex-wrap gap-2">
                    {c.deliverables.map((d) => (
                      <div key={d.taskId ?? d.granularTaskId}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200
                                   bg-white px-3 py-1.5">
                        <span className="flex items-center justify-center rounded-full
                                         bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 whitespace-nowrap">
                          {d.taskId}
                        </span>
                        <span className="text-xs font-medium text-slate-700">
                          {d.granularTaskName || d.granularTaskId}
                        </span>
                      </div>
                    ))}
                  </div>
                </BriefCard>
              )}

              {/* ── Work tasks ── */}
              {visibleTasks.length > 0 && (
                <BriefCard
                  title={
                    !filterTaskId
                      ? `Work Tasks (${visibleTasks.length})`
                      : filteredTask?.autoGenerated
                        ? 'Your Task & Source Task'
                        : visibleTasks.length > 1
                          ? 'Your Task & Content Task'
                          : 'Your Task'
                  }
                  icon="clipboard"
                  accent="brand"
                >
                  <div className="space-y-4">
                    {visibleTasks.map(t => (
                      <div key={t.taskId}
                        className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                        {/* Task header */}
                        <div className="flex flex-wrap items-start justify-between gap-3
                                        bg-slate-50/70 px-4 py-3 border-b border-slate-100">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <IdChip value={t.taskId} />
                              <span className="text-sm font-bold text-slate-900">
                                {t.granularTaskName || 'Task'}
                              </span>
                              {t.taskTypeName && (
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5
                                                 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                                  {t.taskTypeName}
                                </span>
                              )}
                              <TaskBadge status={t.status} />
                              {t.autoGenerated && <AutoGeneratedBadge />}
                              {t.reworkCount > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full
                                                 bg-orange-50 px-2 py-0.5 text-xs font-medium
                                                 text-orange-700 ring-1 ring-orange-200"
                                  title={`QC Manager sent back ${t.reworkCount} time${t.reworkCount === 1 ? '' : 's'}`}>
                                  <Icon name="refresh" className="h-2.5 w-2.5" />
                                  QC {t.reworkCount}×
                                </span>
                              )}
                              {t.requestorReworkCount > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full
                                                 bg-purple-50 px-2 py-0.5 text-xs font-medium
                                                 text-purple-700 ring-1 ring-purple-200"
                                  title={`Requestor sent back ${t.requestorReworkCount} time${t.requestorReworkCount === 1 ? '' : 's'}`}>
                                  <Icon name="refresh" className="h-2.5 w-2.5" />
                                  Requestor {t.requestorReworkCount}×
                                </span>
                              )}
                              {t.status === 'HELD' && t.activeComments?.length > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full
                                                 bg-amber-50 px-2 py-0.5 text-xs font-medium
                                                 text-amber-700 ring-1 ring-amber-200">
                                  <Icon name="messageSquare" className="h-2.5 w-2.5" /> On Hold
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              {t.assigneeName ? `Assigned to ${t.assigneeName}` : 'Unassigned'}
                              {t.totalTimeLoggedMinutes != null &&
                                ` · ${t.totalTimeLoggedMinutes} min logged`}
                            </p>
                            {t.autoGenerated && (
                              <p className="text-xs text-violet-700">
                                Auto-generated content task
                                {t.sourceTaskId ? ` for designer task ${t.sourceTaskId}` : ''}
                                {t.contentRequestedByName ? ` · requested by ${t.contentRequestedByName}` : ''}
                                {t.contentRequestStatus ? ` · ${t.contentRequestStatus}` : ''}
                              </p>
                            )}
                            {t.latestActionDoneByName && (
                              <p className="text-xs text-slate-400">
                                Last action by{' '}
                                <span className="font-medium text-slate-600">
                                  {t.latestActionDoneByName}
                                </span>
                              </p>
                            )}
                          </div>
                          {t.status === 'REQUESTOR_QC_REVIEW' && canRequestRework && (
                            <button
                              onClick={() => { setReworkTask(t); setReworkMsg('') }}
                              className="flex items-center gap-1.5 rounded-lg border border-amber-200
                                         bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700
                                         hover:bg-amber-100 transition shrink-0"
                            >
                              <Icon name="refresh" className="h-3 w-3" /> Request Rework
                            </button>
                          )}
                        </div>

                        {/* Task body */}
                        <div className="px-4 py-4 space-y-3">
                          <TaskTimestamps task={t} />

                          {t.submissionNotes && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                                Submission notes
                              </p>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">{t.submissionNotes}</p>
                            </div>
                          )}

                          {t.activeComments?.length > 0 && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <Icon name="messageSquare" className="h-3.5 w-3.5 text-amber-600" />
                                <span className="text-xs font-bold text-amber-800">
                                  Worker comment{t.activeComments.length > 1 ? 's' : ''}
                                  {t.status === 'HELD' && <span className="font-normal ml-1">— task on hold</span>}
                                </span>
                              </div>
                              {t.activeComments.map((wc) => (
                                <div key={wc.commentId} className="border-t border-amber-200 pt-2 first:border-0 first:pt-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[10px] font-semibold text-amber-700 mb-0.5">
                                        {wc.userName}
                                        {wc.createdAt && (
                                          <span className="font-normal text-amber-500 ml-1">
                                            · {new Date(wc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                          </span>
                                        )}
                                      </p>
                                      <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
                                        {wc.comment}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => handleMarkAnswered(t.taskId, wc.commentId)}
                                      disabled={markingCommentId === wc.commentId}
                                      title="Mark this comment as answered"
                                      className="mt-0.5 shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold
                                                 bg-amber-100 text-amber-700 border border-amber-300
                                                 hover:bg-amber-200 transition disabled:opacity-50">
                                      {markingCommentId === wc.commentId ? '…' : '✓ Answered'}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {['REWORK', 'IN_PROGRESS', 'ASSIGNED', 'HELD'].includes(t.status) && t.latestReworkComment && (() => {
                            const isRequestor = t.latestReworkSource === 'REQUESTOR_REWORK'
                            return (
                              <div className={`rounded-xl border px-4 py-3 ${isRequestor ? 'border-purple-200 bg-purple-50' : 'border-orange-200 bg-orange-50'}`}>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Icon name="alertCircle" className={`h-3.5 w-3.5 ${isRequestor ? 'text-purple-500' : 'text-orange-500'}`} />
                                  <span className={`text-xs font-bold ${isRequestor ? 'text-purple-700' : 'text-orange-700'}`}>
                                    {isRequestor ? 'Requestor rework note' : 'Manager rework note'}
                                  </span>
                                </div>
                                <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isRequestor ? 'text-purple-800' : 'text-orange-800'}`}>
                                  {t.latestReworkComment}
                                </p>
                              </div>
                            )
                          })()}

                          <TaskQuestionnaireBrief items={t.questionnaire} />

                          <TaskFilesSection
                            task={t}
                            campaign={c}
                            canEdit={false}
                            onFilesChanged={() =>
                              campaignsApi.getById(c.campaignId).then(r => setCampaign(r.data))
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </BriefCard>
              )}
            </>
          )}
        </div>
      </div>

      {/* Rework modal */}
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
      </div>{/* end sliding panel */}
    </>
  )
}

// ─── Compact summary card (used inside action modals elsewhere) ───────────────
export function RequestSummaryCard({ campaign }) {
  if (!campaign) return null
  const deliverables = campaign.deliverables?.length ?? null
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 space-y-1.5 ring-1 ring-slate-200">
      <div className="flex items-center gap-2 flex-wrap">
        <IdChip value={campaign.campaignId} />
        <PriorityBadge v={campaign.priority} />
        {campaign.flaggedInconsistency && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5
                           text-xs font-medium text-rose-700 ring-1 ring-rose-200">
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

// ─── Section card ─────────────────────────────────────────────────────────────
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

// ─── Approval trail ───────────────────────────────────────────────────────────
function ApprovalTrail({ c }) {
  const hasAny = c.deptDecision || c.marketingDecision || c.interventionDecision
  if (!hasAny) return null

  const Stage = ({ label, decision, byName, at }) => (
    <div className="flex items-center gap-3 flex-wrap text-xs">
      <span className="w-[100px] shrink-0 text-slate-400 font-medium">{label}</span>
      {decision === 'APPROVED' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5
                         text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <Icon name="check" className="h-3 w-3" /> Approved
        </span>
      )}
      {decision === 'REJECTED' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5
                         text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
          <Icon name="x" className="h-3 w-3" /> Rejected
        </span>
      )}
      {!decision && (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5
                         text-xs font-medium text-slate-500">
          Pending
        </span>
      )}
      {byName && <span className="text-slate-500">by <span className="font-semibold">{byName}</span></span>}
      {at && <span className="text-slate-400">· {fmtDateTime(at)}</span>}
    </div>
  )

  return (
    <BriefCard title="Approval Trail" icon="checkCircle" accent="emerald">
      <div className="space-y-3">
        <Stage label="Department"  decision={c.deptDecision}         byName={c.deptDecisionByName}         at={c.deptDecisionAt} />
        <Stage label="Marketing"   decision={c.marketingDecision}    byName={c.marketingDecisionByName}    at={c.marketingDecisionAt} />
        {c.interventionDecision && (
          <Stage label="Intervention" decision={c.interventionDecision} byName={c.interventionDecisionByName} at={c.interventionDecisionAt} />
        )}
        {c.rejectionReason && (
          c.deptDecision === 'REJECTED' ||
          c.marketingDecision === 'REJECTED' ||
          c.interventionDecision === 'REJECTED'
        ) && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">
            <p className="font-bold mb-0.5">Rejection reason</p>
            <p className="whitespace-pre-wrap">{c.rejectionReason}</p>
          </div>
        )}
      </div>
    </BriefCard>
  )
}

// ─── Task Q&A ─────────────────────────────────────────────────────────────────
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

// ─── Task timestamps strip ────────────────────────────────────────────────────
function TaskTimestamps({ task }) {
  const steps = [
    {
      key: 'assigned', label: 'Assigned', ts: task.assignedAt || task.createdAt,
      done: { dot: 'bg-slate-500', line: 'bg-slate-300', text: 'text-slate-600', card: 'bg-slate-50 border-slate-200' },
      icon: <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm4 1.5a4.5 4.5 0 0 1 1 2.833V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-.667A4.5 4.5 0 0 1 4 9.5h8Z"/></svg>,
    },
    {
      key: 'accepted', label: 'Accepted', ts: task.acceptedAt,
      done: { dot: 'bg-blue-500', line: 'bg-blue-200', text: 'text-blue-700', card: 'bg-blue-50 border-blue-200' },
      icon: <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm11.78-1.72a.75.75 0 0 0-1.06-1.06L7 8.94 5.28 7.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25Z"/></svg>,
    },
    {
      key: 'submitted', label: 'Submitted', ts: task.submittedAt,
      done: { dot: 'bg-violet-500', line: 'bg-violet-200', text: 'text-violet-700', card: 'bg-violet-50 border-violet-200' },
      icon: <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path d="M.5 9.9a.5.5 0 0 1 .5.5V13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.6a.5.5 0 0 1 1 0V13a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.6a.5.5 0 0 1 .5-.5Z"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3Z"/></svg>,
    },
    {
      key: 'mgr_approved', label: 'Mgr Approved', ts: task.managerApprovedAt,
      done: { dot: 'bg-emerald-500', line: 'bg-emerald-200', text: 'text-emerald-700', card: 'bg-emerald-50 border-emerald-200' },
      icon: <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0Z"/></svg>,
    },
    {
      key: 'req_approved', label: 'Req Approved', ts: task.requestorApprovedAt,
      done: { dot: 'bg-green-600', line: 'bg-green-200', text: 'text-green-700', card: 'bg-green-50 border-green-200' },
      icon: <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm11.78-1.72a.75.75 0 0 0-1.06-1.06L7 8.94 5.28 7.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25Z"/></svg>,
    },
  ]
  const fmt = ts => new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  return (
    <div className="overflow-x-auto pb-0.5">
      <div className="flex items-stretch min-w-max gap-0">
        {steps.map((step, i) => {
          const active = !!step.ts
          const isLast = i === steps.length - 1
          const s      = step.done
          return (
            <div key={step.key} className="flex items-center">
              <div className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 transition ${
                active ? s.card : 'bg-slate-50 border-slate-100'
              }`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full shrink-0 ${
                  active ? `${s.dot} text-white` : 'bg-slate-200 text-slate-400'
                }`}>
                  <span className="scale-75">{step.icon}</span>
                </span>
                <div className="leading-tight">
                  <div className={`text-[9px] font-bold uppercase tracking-wider ${
                    active ? s.text : 'text-slate-400'
                  }`}>{step.label}</div>
                  <div className={`text-[10px] font-semibold whitespace-nowrap ${
                    active ? 'text-slate-700' : 'text-slate-400'
                  }`}>{active ? fmt(step.ts) : '—'}</div>
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

// ─── Shared badge / chip components ──────────────────────────────────────────
function IdChip({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5
                     text-[10px] font-bold tabular-nums text-slate-500 shrink-0">
      {label && <span className="font-normal text-slate-400">{label}</span>}
      {value}
    </span>
  )
}
function PriorityBadge({ v }) {
  const m = {
    HIGH:   'bg-red-50 text-red-700 ring-red-200',
    MEDIUM: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
    LOW:    'bg-green-50 text-green-700 ring-green-200',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1
                      ${m[v] || 'bg-slate-100 text-slate-600'}`}>
      {v || '—'}
    </span>
  )
}
function StatusBadge({ status }) {
  const S = {
    IN_PROGRESS:         'bg-blue-50 text-blue-700 ring-blue-200',
    MANAGER_QC_REVIEW:   'bg-purple-50 text-purple-700 ring-purple-200',
    REQUESTOR_QC_REVIEW: 'bg-violet-50 text-violet-700 ring-violet-200',
    COMPLETED:           'bg-green-50 text-green-700 ring-green-200',
    REJECTED:            'bg-red-50 text-red-700 ring-red-200',
    CANCELLED:           'bg-slate-100 text-slate-500 ring-slate-200',
  }
  const L = {
    IN_PROGRESS: 'In Progress', MANAGER_QC_REVIEW: 'Manager QC',
    REQUESTOR_QC_REVIEW: 'Requestor QC',
    COMPLETED: 'Completed', REJECTED: 'Rejected', CANCELLED: 'Cancelled',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1
                      ${S[status] || 'bg-slate-100 text-slate-600'}`}>
      {L[status] || status}
    </span>
  )
}
function TaskBadge({ status }) {
  const S = {
    ASSIGNED:             'bg-blue-50 text-blue-700 ring-blue-200',
    IN_PROGRESS:          'bg-emerald-50 text-emerald-700 ring-emerald-200',
    REWORK:               'bg-amber-50 text-amber-700 ring-amber-200',
    MANAGER_QC_REVIEW:    'bg-purple-50 text-purple-700 ring-purple-200',
    REQUESTOR_QC_REVIEW:  'bg-violet-50 text-violet-700 ring-violet-200',
    COMPLETED:            'bg-green-50 text-green-700 ring-green-200',
    HELD:                 'bg-amber-50 text-amber-600 ring-amber-200',
    CANCELLED:            'bg-slate-100 text-slate-500 ring-slate-200',
  }
  const L = {
    ASSIGNED: 'Assigned', IN_PROGRESS: 'In Progress', REWORK: 'Rework',
    MANAGER_QC_REVIEW: 'Manager QC', REQUESTOR_QC_REVIEW: 'Requestor QC',
    COMPLETED: 'Completed', HELD: 'Held', CANCELLED: 'Cancelled',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1
                      ${S[status] || 'bg-slate-100 text-slate-600'}`}>
      {L[status] || status}
    </span>
  )
}

// ─── Requestor rework modal ───────────────────────────────────────────────────
function RequestorReworkModal({ task, message, onMessageChange, onConfirm, onClose, submitting }) {
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Request Rework</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Task <span className="font-semibold text-slate-700">#{task.taskId}</span>
              {' · '}{task.granularTaskName}
            </p>
          </div>
          <button onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
            Rework Message <span className="text-rose-500 normal-case font-normal">*</span>
          </label>
          <textarea
            value={message}
            onChange={e => onMessageChange(e.target.value)}
            rows={4}
            placeholder="Describe what needs to be changed or improved…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800
                       placeholder:text-slate-400 focus:border-rose-400 focus:outline-none
                       focus:ring-2 focus:ring-rose-100 resize-none transition"
          />
          <p className="text-xs text-slate-400">This message will be visible to the marketing team.</p>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} disabled={submitting}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600
                       hover:bg-slate-50 transition disabled:opacity-60">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={submitting || !message?.trim()}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 text-sm font-bold
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
// ─── Per-task reference files section ────────────────────────────────────────
function TaskFilesSection({ task, campaign, canEdit, onFilesChanged }) {
  const [uploading, setUploading] = useState(false)
  const [removing,  setRemoving]  = useState(null)
  const fileInputRef = useRef(null)
  const toast = useToast()

  const handleAdd = async (files) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const fd = new FormData()
      files.forEach(f => fd.append('files', f))
      const uploadRes = await api.post('/upload/asset', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const urls  = uploadRes.data?.urls || []
      const names = Array.from(files).map(f => f.name)
      if (urls.length > 0) {
        await tasksApi.addTaskFiles(task.taskId, campaign.campaignId, urls, names)
        await onFilesChanged()
        toast?.success?.('Files added.')
      }
    } catch {
      toast?.error?.('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemove = async (url) => {
    setRemoving(url)
    try {
      await tasksApi.removeTaskFile(task.taskId, url)
      await onFilesChanged()
    } catch {
      toast?.error?.('Failed to remove file.')
    } finally {
      setRemoving(null)
    }
  }

  const files     = task.fileUrls || []
  const names     = task.fileOriginalNames || []
  const hasFiles  = files.length > 0

  if (!hasFiles && !canEdit) return null

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Task Files {hasFiles ? `(${files.length})` : ''}
        </span>
        {canEdit && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50
                         px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100
                         disabled:opacity-50 transition">
              {uploading
                ? <><Icon name="loader" className="h-3 w-3 animate-spin" /> Uploading…</>
                : <><Icon name="upload" className="h-3 w-3" /> Add Files</>
              }
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => { handleAdd(Array.from(e.target.files)); e.target.value = '' }}
            />
          </>
        )}
      </div>

      {hasFiles && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {files.map((url, i) => {
            const origName = names[i]
            const { label, icon } = fileDisplayInfo(url, i, origName)
            const isRemoving = removing === url
            return (
              <div key={url}
                className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${icon.cls}`}>
                    {icon.tag}
                  </span>
                  <span className="flex-1 truncate text-xs font-medium text-slate-700" title={label}>
                    {label}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => handleRemove(url)}
                      disabled={isRemoving}
                      title="Remove file"
                      className="shrink-0 rounded p-0.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50
                                 disabled:opacity-40 transition">
                      {isRemoving
                        ? <Icon name="loader" className="h-3 w-3 animate-spin" />
                        : <Icon name="x" className="h-3 w-3" />
                      }
                    </button>
                  )}
                </div>
                <div className="flex border-t border-slate-200">
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1 py-1.5 text-[11px] font-medium
                               text-brand-600 hover:bg-brand-50 transition">
                    <Icon name="externalLink" className="h-3 w-3" /> Open
                  </a>
                  <span className="w-px bg-slate-200 shrink-0" />
                  <button
                    onClick={() => downloadCampaignFile(url, origName)}
                    className="flex flex-1 items-center justify-center gap-1 py-1.5 text-[11px] font-medium
                               text-slate-600 hover:bg-slate-50 transition">
                    <Icon name="download" className="h-3 w-3" /> Download
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!hasFiles && canEdit && (
        <p className="text-[11px] text-slate-400 italic">No files yet. Click "Add Files" to attach reference assets.</p>
      )}
    </div>
  )
}

async function downloadCampaignFile(url, originalName) {
  try {
    const res = await api.get('/upload/proxy-download', {
      params: { url },
      responseType: 'blob',
    })
    // Use the stored original filename; fall back to extracting from the URL
    const safeName = originalName || url.split('/').pop().split('?')[0] || 'file'
    const blobUrl  = window.URL.createObjectURL(new Blob([res.data]))
    const a        = document.createElement('a')
    a.href         = blobUrl
    a.download     = safeName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, '_blank')
  }
}

function fileDisplayInfo(url, index, originalName) {
  const clean = (url || '').split('?')[0].toLowerCase()
  const ext   = clean.split('.').pop()
  const MAP = {
    jpg:  { name: 'Image',        cls: 'bg-blue-50 text-blue-600' },
    jpeg: { name: 'Image',        cls: 'bg-blue-50 text-blue-600' },
    png:  { name: 'Image',        cls: 'bg-blue-50 text-blue-600' },
    gif:  { name: 'Image',        cls: 'bg-blue-50 text-blue-600' },
    webp: { name: 'Image',        cls: 'bg-blue-50 text-blue-600' },
    svg:  { name: 'Graphic',      cls: 'bg-cyan-50 text-cyan-600' },
    mp4:  { name: 'Video',        cls: 'bg-violet-50 text-violet-600' },
    mov:  { name: 'Video',        cls: 'bg-violet-50 text-violet-600' },
    avi:  { name: 'Video',        cls: 'bg-violet-50 text-violet-600' },
    webm: { name: 'Video',        cls: 'bg-violet-50 text-violet-600' },
    wmv:  { name: 'Video',        cls: 'bg-violet-50 text-violet-600' },
    pdf:  { name: 'PDF',          cls: 'bg-red-50 text-red-600' },
    doc:  { name: 'Document',     cls: 'bg-indigo-50 text-indigo-600' },
    docx: { name: 'Document',     cls: 'bg-indigo-50 text-indigo-600' },
    xls:  { name: 'Spreadsheet',  cls: 'bg-green-50 text-green-600' },
    xlsx: { name: 'Spreadsheet',  cls: 'bg-green-50 text-green-600' },
    ppt:  { name: 'Presentation', cls: 'bg-orange-50 text-orange-600' },
    pptx: { name: 'Presentation', cls: 'bg-orange-50 text-orange-600' },
  }
  const entry = MAP[ext]
  const num   = index + 1
  // Display the original filename when available; fall back to "Type N"
  const label = originalName || (entry ? `${entry.name} ${num}` : `Attachment ${num}`)
  return {
    label,
    icon: entry
      ? { tag: entry.name.slice(0, 3).toUpperCase(), cls: entry.cls }
      : { tag: 'FILE', cls: 'bg-slate-100 text-slate-500' },
  }
}
function fmtMultiValue(v) {
  if (!v) return ''
  return String(v).split(',').map(s => s.trim()).filter(Boolean).join(', ')
}
function fmtDateTime(d) {
  return d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''
}
function fmtTargetLocation(raw) {
  if (!raw) return ''
  try {
    const p = JSON.parse(raw)
    if (Array.isArray(p)) return p.join(', ')
  } catch { /* not JSON */ }
  return raw
}

function parseLocations(raw) {
  if (!raw) return []
  try {
    const p = JSON.parse(raw)
    if (Array.isArray(p)) return p.filter(Boolean)
  } catch { /* not JSON */ }
  return raw ? [raw] : []
}

function AutoGeneratedBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-200">
      Auto Generated
    </span>
  )
}
