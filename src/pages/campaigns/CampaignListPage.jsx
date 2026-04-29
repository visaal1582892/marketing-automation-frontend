import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../components/Toast'
import campaignsApi from '../../api/campaigns'
import { masterApi, granularTasksApi } from '../../api/masterData'
import Icon from '../../components/Icon'
import RequestBriefDrawer from '../../components/RequestBriefDrawer'

// ─── Status / Priority helpers ────────────────────────────────────────────────

const CAMPAIGN_STATUS_STYLES = {
  PENDING_DEPT_APPROVAL:      'bg-yellow-50 text-yellow-700 ring-yellow-200',
  PENDING_MARKETING_APPROVAL: 'bg-orange-50 text-orange-700 ring-orange-200',
  PENDING_INTERVENTION:       'bg-amber-50 text-amber-700 ring-amber-200',
  IN_PROGRESS:                'bg-blue-50 text-blue-700 ring-blue-200',
  QC_REVIEW:                  'bg-purple-50 text-purple-700 ring-purple-200',
  COMPLETED:                  'bg-green-50 text-green-700 ring-green-200',
  REJECTED:                   'bg-red-50 text-red-700 ring-red-200',
  CANCELLED:                  'bg-slate-100 text-slate-500 ring-slate-200',
}

const CAMPAIGN_STATUS_LABELS = {
  PENDING_DEPT_APPROVAL:      'Pending Dept Approval',
  PENDING_MARKETING_APPROVAL: 'Pending Marketing Approval',
  PENDING_INTERVENTION:       'Pending Intervention',
  IN_PROGRESS:                'In Progress',
  QC_REVIEW:                  'QC Review',
  COMPLETED:                  'Completed',
  REJECTED:                   'Rejected',
  CANCELLED:                  'Cancelled',
}

const TASK_STATUS_STYLES = {
  ASSIGNED:    'bg-blue-50 text-blue-700 ring-blue-200',
  IN_PROGRESS: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  REWORK:      'bg-orange-50 text-orange-700 ring-orange-200',
  QC_REVIEW:   'bg-purple-50 text-purple-700 ring-purple-200',
  COMPLETED:   'bg-green-50 text-green-700 ring-green-200',
  CANCELLED:   'bg-slate-100 text-slate-500 ring-slate-200',
  HELD:        'bg-amber-50 text-amber-700 ring-amber-200',
}
const TASK_STATUS_LABELS = {
  ASSIGNED:    'Assigned',
  IN_PROGRESS: 'In Progress',
  REWORK:      'Rework',
  QC_REVIEW:   'QC Review',
  COMPLETED:   'Completed',
  CANCELLED:   'Cancelled',
  HELD:        'Held',
}

function CampaignStatusBadge({ status }) {
  const cls = CAMPAIGN_STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {CAMPAIGN_STATUS_LABELS[status] || status}
    </span>
  )
}

function TaskStatusBadge({ status }) {
  const cls = TASK_STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {TASK_STATUS_LABELS[status] || status}
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

// ─── Add Task modal (requestor — append new deliverables to a campaign) ───────

/** Parses a question's options field (stored as JSON array string or comma-sep). */
function parseOpts(raw) {
  if (!raw) return []
  try { const p = JSON.parse(raw); if (Array.isArray(p)) return p } catch {}
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

/** Inline question renderer for a single question inside the Add Task modal. */
function TaskQuestion({ q, answer, onChange }) {
  const req = q.required ?? q.isRequired

  const getMulti = () => {
    if (!answer) return []
    try { return JSON.parse(answer) } catch { return [] }
  }

  const cls = `w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm
    focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 transition`

  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">
        {q.questionText}{req && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {(q.fieldType === 'TEXT') && (
        <input type="text" value={answer ?? ''} onChange={e => onChange(e.target.value)} className={cls} placeholder="Your answer…" />
      )}
      {(q.fieldType === 'NUMBER') && (
        <input type="number" value={answer ?? ''} onChange={e => onChange(e.target.value)} className={cls} placeholder="0" />
      )}
      {(q.fieldType === 'TEXTAREA') && (
        <textarea rows={2} value={answer ?? ''} onChange={e => onChange(e.target.value)} className={`${cls} resize-none`} placeholder="Your answer…" />
      )}
      {(q.fieldType === 'DATE') && (
        <input type="date" value={answer ?? ''} onChange={e => onChange(e.target.value)} className={cls} />
      )}
      {(q.fieldType === 'DROPDOWN') && (
        <select value={answer ?? ''} onChange={e => onChange(e.target.value)} className={cls}>
          <option value="">Select…</option>
          {parseOpts(q.options).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      )}
      {(q.fieldType === 'MULTISELECT') && (
        <div className="flex flex-wrap gap-2 mt-1">
          {parseOpts(q.options).map(opt => {
            const selected = getMulti()
            const checked  = selected.includes(opt)
            return (
              <label key={opt}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs cursor-pointer transition
                  ${checked ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                <input type="checkbox" checked={checked} className="h-3.5 w-3.5 accent-brand-600"
                  onChange={() => {
                    const next = checked ? selected.filter(x => x !== opt) : [...selected, opt]
                    onChange(JSON.stringify(next))
                  }} />
                {opt}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AddTaskModal({ campaign, onClose, onSuccess }) {
  const toast     = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)

  const [availableTasks, setAvailableTasks] = useState([])
  const [loadingTasks,   setLoadingTasks]   = useState(true)
  // { [taskId]: { granularTaskId, questionnaire: { [questionId]: value } } }
  const [selections,     setSelections]     = useState({})
  // { [taskId]: Question[] }
  const [taskQuestions,  setTaskQuestions]  = useState({})
  const [loadingQs,      setLoadingQs]      = useState({})
  const [saving,         setSaving]         = useState(false)

  const existingIds = useMemo(
    () => new Set((campaign.deliverables || []).map(d => d.granularTaskId)),
    [campaign]
  )

  useEffect(() => {
    masterApi.list('granular-tasks')
      .then(d => setAvailableTasks(d))
      .catch(() => showToast('Failed to load tasks.', 'error'))
      .finally(() => setLoadingTasks(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTask = (taskId) => {
    setSelections(prev => {
      if (prev[taskId]) {
        const next = { ...prev }
        delete next[taskId]
        return next
      }
      // Add to selections
      const next = { ...prev, [taskId]: { granularTaskId: taskId, questionnaire: {} } }
      return next
    })

    // Fetch questions for this task if not already loaded
    if (!taskQuestions[taskId]) {
      setLoadingQs(prev => ({ ...prev, [taskId]: true }))
      granularTasksApi.getQuestions(taskId)
        .then(data => setTaskQuestions(prev => ({ ...prev, [taskId]: data || [] })))
        .catch(() => setTaskQuestions(prev => ({ ...prev, [taskId]: [] })))
        .finally(() => setLoadingQs(prev => ({ ...prev, [taskId]: false })))
    }
  }

  const updateAnswer = (taskId, questionId, value) => {
    setSelections(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        questionnaire: { ...prev[taskId]?.questionnaire, [questionId]: value },
      },
    }))
  }

  const selectedIds = Object.keys(selections)

  const handleSave = async () => {
    if (selectedIds.length === 0) {
      showToast('Select at least one new task.', 'error')
      return
    }
    // Validate required questions
    for (const taskId of selectedIds) {
      const qs = taskQuestions[taskId] || []
      const ans = selections[taskId]?.questionnaire || {}
      for (const q of qs) {
        if (!(q.required ?? q.isRequired)) continue
        const v = ans[q.questionId]
        let empty = true
        if (q.fieldType === 'MULTISELECT') {
          try { empty = JSON.parse(v || '[]').length === 0 } catch { empty = true }
        } else {
          empty = v == null || String(v).trim() === ''
        }
        if (empty) {
          const task = availableTasks.find(t => t.taskId === taskId)
          showToast(`"${q.questionText}" is required for task "${task?.taskName || taskId}".`, 'error')
          return
        }
      }
    }

    setSaving(true)
    try {
      const specs = selectedIds.map(taskId => {
        const qn  = selections[taskId]?.questionnaire || {}
        const answers = Object.entries(qn)
          .filter(([, v]) => {
            if (v == null || String(v).trim() === '') return false
            try { if (Array.isArray(JSON.parse(v)) && JSON.parse(v).length === 0) return false } catch {}
            return true
          })
          .map(([questionId, answerValue]) => ({ questionId, answerValue }))
        return { granularTaskId: taskId, questionnaireAnswers: answers }
      })
      await campaignsApi.addTasks(campaign.campaignId, specs)
      showToast('Tasks added and routed successfully!', 'success')
      onSuccess()
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to add tasks.'
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  const existingTasks = availableTasks.filter(t => existingIds.has(t.taskId))
  const newTasks      = availableTasks.filter(t => !existingIds.has(t.taskId))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Add Task to Campaign #{campaign.campaignId}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{campaign.requirementTypeName || '—'}</p>
          </div>
          <button onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loadingTasks ? (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-400">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span className="text-sm">Loading tasks…</span>
            </div>
          ) : (
            <>
              {/* Existing tasks — chips only */}
              {existingTasks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Already in campaign
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {existingTasks.map(t => (
                      <span key={t.taskId}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                        <Icon name="check" className="h-3 w-3 text-slate-400" />
                        {t.taskName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* New tasks — selectable with expandable Q&A */}
              {newTasks.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  All available tasks are already in this campaign.
                </p>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Select new tasks
                  </p>
                  <div className="space-y-2">
                    {newTasks.map(t => {
                      const isSelected = Boolean(selections[t.taskId])
                      const qs         = taskQuestions[t.taskId] || []
                      const loadingQ   = loadingQs[t.taskId]
                      return (
                        <div key={t.taskId}
                          className={`rounded-xl border transition ${isSelected ? 'border-brand-400 bg-brand-50/40' : 'border-slate-200 bg-white'}`}>
                          {/* Task row */}
                          <button type="button" onClick={() => toggleTask(t.taskId)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition
                              ${isSelected ? 'border-brand-500 bg-brand-500' : 'border-slate-300 bg-white'}`}>
                              {isSelected && <Icon name="check" className="h-3 w-3 text-white" />}
                            </span>
                            <span className="text-sm font-medium text-slate-800">{t.taskName}</span>
                            {t.taskTypeName && (
                              <span className="text-xs text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 ml-auto shrink-0">{t.taskTypeName}</span>
                            )}
                          </button>

                          {/* Questions — visible when selected */}
                          {isSelected && (
                            <div className="px-4 pb-4 border-t border-brand-100 pt-3 space-y-3">
                              {loadingQ ? (
                                <p className="text-xs text-slate-400 flex items-center gap-1">
                                  <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                  </svg>
                                  Loading questions…
                                </p>
                              ) : qs.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">No task-specific questions.</p>
                              ) : (
                                qs.map(q => (
                                  <TaskQuestion
                                    key={q.questionId}
                                    q={q}
                                    answer={selections[t.taskId]?.questionnaire?.[q.questionId]}
                                    onChange={v => updateAnswer(t.taskId, q.questionId, v)}
                                  />
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || selectedIds.length === 0 || loadingTasks}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white
              hover:bg-brand-700 disabled:opacity-50 transition">
            {saving ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Adding…
              </>
            ) : (
              <><Icon name="check" className="h-3.5 w-3.5" /> Add {selectedIds.length > 0 ? `${selectedIds.length} Task${selectedIds.length > 1 ? 's' : ''}` : 'Tasks'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Requestor campaign-level view ───────────────────────────────────────────

function RequestorCampaignView({ campaigns, loadingDetails, onRefresh }) {
  const [briefId,       setBriefId]       = useState(null)
  const [addTaskCampaign, setAddTaskCampaign] = useState(null) // campaign object for the modal
  const [fCampaign,  setFCampaign]  = useState('')
  const [fReqType,   setFReqType]   = useState('')
  const [fPriority,  setFPriority]  = useState('')
  const [fStatus,    setFStatus]    = useState('')

  const reqTypeOptions = useMemo(() => [...new Set(campaigns.map(c => c.requirementTypeName).filter(Boolean))].sort(), [campaigns])
  const priorityOptions = useMemo(() => [...new Set(campaigns.map(c => c.priority).filter(Boolean))].sort(), [campaigns])
  const statusOptions   = useMemo(() => [...new Set(campaigns.map(c => c.status).filter(Boolean))].sort(), [campaigns])

  const TERMINAL = ['COMPLETED', 'REJECTED', 'CANCELLED']

  const filtered = useMemo(() => campaigns.filter(c => {
    if (fCampaign && !String(c.campaignId).includes(fCampaign.trim())) return false
    if (fReqType  && c.requirementTypeName !== fReqType)                return false
    if (fPriority && c.priority !== fPriority)                          return false
    if (fStatus   && c.status   !== fStatus)                            return false
    return true
  }), [campaigns, fCampaign, fReqType, fPriority, fStatus])

  const hasFilters = fCampaign || fReqType || fPriority || fStatus
  const clearAll   = () => { setFCampaign(''); setFReqType(''); setFPriority(''); setFStatus('') }

  const colFilterCls = `w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600
    placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-300 focus:border-brand-400`

  return (
    <div className="space-y-3">
      {/* Row count + clear */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{filtered.length} campaign{filtered.length !== 1 ? 's' : ''}</span>
        {hasFilters && (
          <button onClick={clearAll}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition">
            <Icon name="x" className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>

      {loadingDetails ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <span className="text-sm">Loading…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-14 text-center">
          <Icon name="inbox" className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">No requests found.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-3 pt-3 pb-1 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Campaign #</th>
                  <th className="px-3 pt-3 pb-1 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Requirement Type</th>
                  <th className="px-3 pt-3 pb-1 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Priority</th>
                  <th className="px-3 pt-3 pb-1 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Status</th>
                  <th className="px-3 pt-3 pb-1 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Tasks</th>
                  <th className="px-3 pt-3 pb-1 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Submitted</th>
                  <th className="px-3 pt-3 pb-1" />
                </tr>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <td className="px-2 pb-2 pt-1">
                    <input value={fCampaign} onChange={e => setFCampaign(e.target.value)} placeholder="Filter…" className={colFilterCls} />
                  </td>
                  <td className="px-2 pb-2 pt-1">
                    <select value={fReqType} onChange={e => setFReqType(e.target.value)} className={colFilterCls}>
                      <option value="">All</option>
                      {reqTypeOptions.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </td>
                  <td className="px-2 pb-2 pt-1">
                    <select value={fPriority} onChange={e => setFPriority(e.target.value)} className={colFilterCls}>
                      <option value="">All</option>
                      {priorityOptions.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </td>
                  <td className="px-2 pb-2 pt-1">
                    <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={colFilterCls}>
                      <option value="">All</option>
                      {statusOptions.map(v => <option key={v} value={v}>{CAMPAIGN_STATUS_LABELS[v] || v}</option>)}
                    </select>
                  </td>
                  <td className="px-2 pb-2 pt-1" />
                  <td className="px-2 pb-2 pt-1" />
                  <td className="px-2 pb-2 pt-1" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const taskCount  = (c.workTasks || []).length
                  const doneCount  = (c.workTasks || []).filter(t => t.status === 'COMPLETED').length
                  const canEdit    = !TERMINAL.includes(c.status)
                  const fmtDate    = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'
                  return (
                    <tr key={c.campaignId} className="hover:bg-slate-50/70 transition">
                      <td className="px-3 py-3 font-mono text-slate-500">#{c.campaignId}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">{c.requirementTypeName || '—'}</td>
                      <td className="px-3 py-3"><PriorityBadge priority={c.priority} /></td>
                      <td className="px-3 py-3"><CampaignStatusBadge status={c.status} /></td>
                      <td className="px-3 py-3 text-slate-600">
                        {taskCount === 0
                          ? <span className="italic text-slate-400">None yet</span>
                          : <span>{doneCount}/{taskCount} done</span>}
                      </td>
                      <td className="px-3 py-3 text-slate-500">{fmtDate(c.createdAt)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setBriefId(c.campaignId)}
                            className="flex items-center gap-1 text-brand-600 hover:text-brand-800 text-xs font-medium whitespace-nowrap">
                            <Icon name="eye" className="h-3.5 w-3.5" /> Brief
                          </button>
                          {canEdit && (
                            <button onClick={() => setAddTaskCampaign(c)}
                              className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs font-medium whitespace-nowrap border border-slate-200 rounded px-2 py-0.5 hover:bg-slate-50 transition">
                              <Icon name="plus" className="h-3.5 w-3.5" /> Add Task
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Brief drawer */}
      {briefId && (
        <RequestBriefDrawer
          campaignId={briefId}
          onClose={() => setBriefId(null)}
        />
      )}

      {/* Add Task modal */}
      {addTaskCampaign && (
        <AddTaskModal
          campaign={addTaskCampaign}
          onClose={() => setAddTaskCampaign(null)}
          onSuccess={() => { setAddTaskCampaign(null); onRefresh() }}
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
      c.requirementTypeName?.toLowerCase().includes(q) ||
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
                  {['#', 'Requirement Type', 'Requestor', 'Department', 'Priority', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.campaignId} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">#{c.campaignId}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{c.requirementTypeName || '—'}</td>
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
  const { isRequestor, hasAnyRole } = useAuth()
  const toast     = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)
  const navigate  = useNavigate()
  const location  = useLocation()

  const [campaigns,       setCampaigns]       = useState([])
  const [campaignDetails, setCampaignDetails] = useState([])  // with workTasks, for requestor view
  const [loading,         setLoading]         = useState(true)
  const [loadingDetails,  setLoadingDetails]  = useState(false)
  const [refreshing,      setRefreshing]      = useState(false)
  const [successBanner,   setSuccessBanner]   = useState(
    location.state?.justSubmitted
      ? 'Your request was submitted successfully.'
      : null
  )

  const isCreator = hasAnyRole('Marketing Creator')

  const load = async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await campaignsApi.list()
      const list = res.data || []
      setCampaigns(list)

      // For requestors: batch-fetch campaign details to get work tasks
      if (isRequestor && list.length > 0) {
        setLoadingDetails(true)
        try {
          const details = await Promise.all(
            list.map(c => campaignsApi.getById(c.campaignId).then(r => r.data).catch(() => c))
          )
          setCampaignDetails(details)
        } finally {
          setLoadingDetails(false)
        }
      } else {
        setCampaignDetails(list)
      }
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

  useEffect(() => {
    const onFocus = () => load(true)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [isRequestor]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      {/* Success banner */}
      {successBanner && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <svg className="h-5 w-5 shrink-0 text-green-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          <p className="flex-1 text-sm font-medium text-green-800">{successBanner}</p>
          <button onClick={() => setSuccessBanner(null)} className="text-green-500 hover:text-green-700 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {isRequestor ? 'My Requests' : 'Marketing Requests'}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {isRequestor
              ? `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} submitted`
              : `${campaigns.length} total request${campaigns.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            title="Refresh"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition disabled:opacity-50 sm:flex-none"
          >
            <svg className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          {!isCreator && (
            <button
              onClick={() => navigate('/campaigns/new')}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition sm:flex-none"
            >
              <Icon name="plus" className="h-4 w-4" /> New Request
            </button>
          )}
        </div>
      </div>

      {/* View */}
      {loading ? (
        <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>
      ) : isRequestor ? (
        <RequestorCampaignView
          campaigns={campaignDetails}
          loadingDetails={loadingDetails}
          onRefresh={() => load(true)}
        />
      ) : (
        <CampaignTableView
          campaigns={campaigns}
          loading={loading}
          onRefresh={() => load(true)}
          refreshing={refreshing}
        />
      )}
    </div>
  )
}
