import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import campaignsApi from '../../api/campaigns'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'
import AssetPreviewModal from '../../components/AssetPreviewModal'

/**
 * Requestor view — tasks that have been approved by the Marketing Head.
 * The requestor can review the delivered assets and optionally request rework.
 */
export default function CompletedTasksPage() {
  const location = useLocation()
  const toast    = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)

  const [tasks, setTasks]       = useState([])
  const [loading, setLoading]   = useState(true)

  // Rework modal
  const [reworkTask,    setReworkTask]    = useState(null)
  const [reworkMsg,     setReworkMsg]     = useState('')
  const [reworkSaving,  setReworkSaving]  = useState(false)

  // Asset preview modal
  const [assetTask, setAssetTask] = useState(null)

  const load = () => {
    setLoading(true)
    campaignsApi.completedTasks()
      .then(res => setTasks(res.data || []))
      .catch(() => showToast('Failed to load completed tasks', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const openRework = (task) => {
    setReworkTask(task)
    setReworkMsg('')
  }

  const submitRework = async () => {
    if (!reworkTask || !reworkMsg.trim()) return
    setReworkSaving(true)
    try {
      await campaignsApi.requestorRework(reworkTask.campaignId, reworkTask.taskId, reworkMsg.trim())
      showToast('Rework request sent to the creator.', 'success')
      setReworkTask(null)
      setReworkMsg('')
      load()
    } catch (e) {
      showToast(e?.response?.data?.message || 'Failed to request rework', 'error')
    } finally {
      setReworkSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Completed Tasks</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Deliverables approved by the Marketing Head. You can review assets and request rework if needed.
          </p>
        </div>
        {!loading && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1.5 text-sm font-semibold text-green-700">
            <Icon name="check" className="h-4 w-4" />
            {tasks.length} approved task{tasks.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="animate-spin h-6 w-6 rounded-full border-2 border-brand-300 border-t-brand-600" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <Icon name="inbox" className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">No completed tasks yet</p>
          <p className="mt-1 text-xs text-slate-400">Tasks approved by the marketing head will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(t => (
            <CompletedTaskCard
              key={t.taskId}
              task={t}
              onRework={() => openRework(t)}
              onViewAssets={() => setAssetTask(t)}
            />
          ))}
        </div>
      )}

      {/* Asset preview modal */}
      {assetTask && (
        <AssetPreviewModal
          taskId={assetTask.taskId}
          taskName={assetTask.granularTaskName || assetTask.requirementTypeName || `Task ${assetTask.taskId}`}
          onClose={() => setAssetTask(null)}
        />
      )}

      {/* Rework modal */}
      {reworkTask && (
        <ReworkModal
          task={reworkTask}
          message={reworkMsg}
          onMessageChange={setReworkMsg}
          saving={reworkSaving}
          onCancel={() => setReworkTask(null)}
          onConfirm={submitRework}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function CompletedTaskCard({ task, onRework, onViewAssets }) {
  const hasAssets = true // loaded on demand in AssetPreviewModal

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        {/* Left info */}
        <div className="flex-1 min-w-[240px] space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-500">
              <span className="font-normal text-slate-400">TASK</span>{task.taskId}
            </span>
            <span className="text-sm font-semibold text-slate-900">
              {task.granularTaskName || task.requirementTypeName || 'Task'}
            </span>
            {task.taskTypeName && (
              <span className="text-xs text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{task.taskTypeName}</span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200">
              <Icon name="check" className="h-3 w-3" /> Approved
            </span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="text-slate-700 font-medium">
              {task.requirementTypeName || `Campaign #${task.campaignId}`}
            </span>
            {task.assigneeName && (
              <span>Completed by <span className="font-medium text-slate-700">{task.assigneeName}</span></span>
            )}
            {task.completedAt && (
              <span>• {new Date(task.completedAt).toLocaleDateString()}</span>
            )}
          </div>

          {task.submissionNotes && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <span className="font-medium text-slate-400 uppercase tracking-wide text-[10px]">Submission notes · </span>
              {task.submissionNotes}
            </div>
          )}
        </div>

        {/* Right actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {/* Assets button — always shown; disabled/greyed when no assets uploaded */}
          <button
            onClick={hasAssets ? onViewAssets : undefined}
            disabled={!hasAssets}
            className="flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 cursor-pointer transition"
            title="View submitted assets"
          >
            <Icon name="fileText" className="h-3.5 w-3.5" />
            Assets
          </button>
          <button
            onClick={onRework}
            className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition"
          >
            <Icon name="refresh" className="h-3.5 w-3.5" />
            Request Rework
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function ReworkModal({ task, message, onMessageChange, saving, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Request Rework</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Task #{task.taskId} — {task.granularTaskName || task.requirementTypeName || 'Task'}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-full p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <div className="font-semibold mb-0.5">This will send the task back for rework</div>
            <div>The creator will receive your message and need to redo this deliverable.</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Message to creator <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={e => onMessageChange(e.target.value)}
              placeholder="Explain what needs to be changed or improved…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400
                         focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300 resize-none"
              autoFocus
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white transition disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving || !message.trim()}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition disabled:opacity-50"
          >
            {saving ? (
              <><span className="animate-spin h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent" /> Sending…</>
            ) : (
              <><Icon name="send" className="h-3.5 w-3.5" /> Send for Rework</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
