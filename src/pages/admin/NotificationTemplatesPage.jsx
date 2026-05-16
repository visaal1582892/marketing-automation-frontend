import { useEffect, useState } from 'react'
import { notificationsApi } from '../../api/notifications'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'

const EVENT_LABELS = {
  TASK_ASSIGNED:          'Task Assigned',
  ADDED_TO_COLLABORATION: 'Added to Collaboration',
  NEW_TASK_MESSAGE:       'New Task Message',
  SUBMITTED_FOR_QC:       'Submitted for QC',
  MANAGER_QC_APPROVAL:    'Manager QC Approval',
  REQUESTOR_QC_APPROVAL:  'Requestor QC Approval',
}

const VARIABLE_HINTS = {
  TASK_ASSIGNED:          '{taskId}',
  ADDED_TO_COLLABORATION: '{taskId}, {inviterName}',
  NEW_TASK_MESSAGE:       '{taskId}, {senderName}',
  SUBMITTED_FOR_QC:       '{taskId}, {workerName}',
  MANAGER_QC_APPROVAL:    '{taskId}, {managerName}',
  REQUESTOR_QC_APPROVAL:  '{taskId}, {requestorName}',
}

function EditModal({ template, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({
    messageTemplate: template.messageTemplate,
    urlTemplate:     template.urlTemplate,
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const saved = await notificationsApi.updateTemplate(template.id, form)
      onSaved(saved)
      toast.success('Template updated.')
      onClose()
    } catch {
      toast.error('Failed to save template.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = `w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm
                    text-slate-800 placeholder-slate-400 shadow-sm outline-none
                    focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Edit Template</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {EVENT_LABELS[template.eventType] || template.eventType}
              {template.roleId ? ` · Role ${template.roleId}` : ' · Default'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:text-slate-600 transition">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Message Template
            </label>
            <textarea
              required
              rows={3}
              className={inputCls}
              value={form.messageTemplate}
              onChange={e => setForm(f => ({ ...f, messageTemplate: e.target.value }))}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Available variables: <code className="font-mono">{VARIABLE_HINTS[template.eventType]}</code>
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              URL Template (redirect on click)
            </label>
            <input
              required
              type="text"
              className={inputCls}
              value={form.urlTemplate}
              onChange={e => setForm(f => ({ ...f, urlTemplate: e.target.value }))}
              placeholder="/my-tasks or /collaborations?taskId={taskId}"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Use <code className="font-mono">{'{taskId}'}</code> for dynamic task IDs.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm
                         font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white
                         shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function NotificationTemplatesPage() {
  const toast = useToast()
  const [templates, setTemplates] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [editing,   setEditing]   = useState(null)

  useEffect(() => {
    notificationsApi.getTemplates()
      .then(setTemplates)
      .catch(() => toast.error('Failed to load templates.'))
      .finally(() => setLoading(false))
  }, [])

  const handleSaved = (updated) => {
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t))
  }

  // Group by event type
  const grouped = templates.reduce((acc, t) => {
    if (!acc[t.eventType]) acc[t.eventType] = []
    acc[t.eventType].push(t)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-slate-400 text-sm">
        Loading templates…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Notification Templates</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Edit the message and redirect URL for each notification event.
            Use <code className="font-mono text-xs">{'{variableName}'}</code> for dynamic values.
          </p>
        </div>
      </div>

      {Object.entries(grouped).map(([eventType, rows]) => (
        <div key={eventType} className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700">
              {EVENT_LABELS[eventType] || eventType}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Variables: <code className="font-mono">{VARIABLE_HINTS[eventType]}</code>
            </p>
          </div>

          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/50">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs font-medium text-slate-500 w-28">Applies to</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium text-slate-500">Message</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium text-slate-500">URL</th>
                <th className="px-5 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(t => (
                <tr key={t.id} className="group hover:bg-slate-50/50 transition">
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium
                                      ${t.roleId
                                        ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-100'
                                        : 'bg-slate-100 text-slate-600'}`}>
                      {t.roleId ? `Role ${t.roleId}` : 'Default'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-700 max-w-xs">
                    <span className="line-clamp-2">{t.messageTemplate}</span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500 max-w-[180px]">
                    <span className="line-clamp-1">{t.urlTemplate}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setEditing(t)}
                      className="rounded-md p-1.5 text-slate-400 opacity-0 transition
                                 hover:bg-slate-100 hover:text-brand-600
                                 group-hover:opacity-100"
                    >
                      <Icon name="pencil" className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {editing && (
        <EditModal
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
