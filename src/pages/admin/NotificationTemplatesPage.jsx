import { useEffect, useState } from 'react'
import { notificationsApi } from '../../api/notifications'
import useDebounce from '../../hooks/useDebounce'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import AppSelect from '../../components/AppSelect'
import BackToMaster from '../../components/admin/BackToMaster'
import { TableStatusRow } from '../../components/dataTable'

const PAGE_SIZE = 20

const EVENT_LABELS = {
  TASK_ASSIGNED:          'Task Assigned',
  ADDED_TO_COLLABORATION: 'Added to Collaboration',
  NEW_TASK_MESSAGE:       'New Task Message',
  SUBMITTED_FOR_QC:       'Submitted for QC',
  MANAGER_QC_APPROVAL:    'Manager QC Approval',
  REQUESTOR_QC_APPROVAL:  'Requestor QC Approval',
}

const EVENT_OPTIONS = [
  { value: '', label: 'All events' },
  ...Object.entries(EVENT_LABELS).map(([value, label]) => ({ value, label })),
]

const VARIABLE_HINTS = {
  TASK_ASSIGNED:          '{taskId}',
  ADDED_TO_COLLABORATION: '{taskId}, {inviterName}',
  NEW_TASK_MESSAGE:       '{taskId}, {senderName}',
  SUBMITTED_FOR_QC:       '{taskId}, {workerName}',
  MANAGER_QC_APPROVAL:    '{taskId}, {managerName}',
  REQUESTOR_QC_APPROVAL:  '{taskId}, {requestorName}',
}

const APPLIES_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'default', label: 'Default' },
  { value: 'role', label: 'Role-specific' },
]

export default function NotificationTemplatesPage() {
  const toast = useToast()

  const [rows, setRows]               = useState([])
  const [total, setTotal]             = useState(0)
  const [totalPages, setTotalPages]   = useState(0)
  const [loading, setLoading]         = useState(true)
  const [editing, setEditing]         = useState(null)
  const [page, setPage]               = useState(0)
  const [refreshSeed, setRefreshSeed] = useState(0)

  const [fId, setFId]           = useState('')
  const [fEvent, setFEvent]     = useState('')
  const [fApplies, setFApplies] = useState('')
  const [fMessage, setFMessage] = useState('')
  const [fUrl, setFUrl]         = useState('')

  const dId      = useDebounce(fId, 400)
  const dMessage = useDebounce(fMessage, 400)
  const dUrl     = useDebounce(fUrl, 400)

  useEffect(() => {
    setPage(0)
  }, [dId, fEvent, fApplies, dMessage, dUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true
    setLoading(true)
    notificationsApi.listTemplatesPaged({
      id:         dId || undefined,
      eventType:  fEvent || undefined,
      appliesTo:  fApplies || undefined,
      message:    dMessage || undefined,
      url:        dUrl || undefined,
      page,
      size: PAGE_SIZE,
    })
      .then((res) => {
        if (!alive) return
        setRows(res.content ?? [])
        setTotal(res.totalElements ?? 0)
        setTotalPages(res.totalPages ?? 0)
      })
      .catch(() => { if (alive) toast.error('Failed to load templates.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dId, fEvent, fApplies, dMessage, dUrl, page, refreshSeed])

  const refresh = () => setRefreshSeed((s) => s + 1)

  const handleSaved = () => {
    setEditing(null)
    refresh()
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <BackToMaster />

      <header className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg
                         bg-brand-50 text-brand-600 ring-1 ring-brand-100">
          <Icon name="bell" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-slate-900">Notification Templates</h1>
          <p className="text-xs text-slate-500">
            {loading
              ? 'Loading…'
              : `${total} template${total === 1 ? '' : 's'} total`}
            {' · '}
            Edit message and redirect URL per event. Use{' '}
            <code className="font-mono text-[11px]">{'{variableName}'}</code> for dynamic values.
          </p>
        </div>
      </header>

      <section className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200/70">
        <div className="hidden w-full overflow-x-auto sm:block">
          <table className="w-full min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="bg-slate-50/70 text-left text-xs font-semibold uppercase
                              tracking-wider text-slate-500">
                <th className="w-20 px-4 py-2.5">ID</th>
                <th className="w-44 px-4 py-2.5">Event</th>
                <th className="w-36 px-4 py-2.5">Applies to</th>
                <th className="min-w-[200px] px-4 py-2.5">Message</th>
                <th className="min-w-[160px] px-4 py-2.5">URL</th>
                <th className="w-20 px-4 py-2.5 text-right">Actions</th>
              </tr>
              <tr className="border-y border-slate-100 bg-slate-50/40">
                <th className="px-4 py-2">
                  <FilterInput value={fId} onChange={setFId} placeholder="Filter ID…" />
                </th>
                <th className="px-4 py-2">
                  <FilterSelect value={fEvent} onChange={setFEvent} options={EVENT_OPTIONS} />
                </th>
                <th className="px-4 py-2">
                  <FilterSelect value={fApplies} onChange={setFApplies} options={APPLIES_OPTIONS} />
                </th>
                <th className="px-4 py-2">
                  <FilterInput value={fMessage} onChange={setFMessage} placeholder="Search message…" icon="search" />
                </th>
                <th className="px-4 py-2">
                  <FilterInput value={fUrl} onChange={setFUrl} placeholder="Search URL…" icon="search" />
                </th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <TableStatusRow colSpan={6} className="py-12">Loading…</TableStatusRow>
              ) : rows.length === 0 ? (
                <TableStatusRow colSpan={6} className="py-12">No matching templates.</TableStatusRow>
              ) : (
                rows.map((t) => (
                  <tr key={t.id} className="transition hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{t.id}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">
                        {EVENT_LABELS[t.eventType] || t.eventType}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-slate-400">{t.eventType}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <AppliesBadge roleId={t.roleId} />
                    </td>
                    <td className="max-w-xs px-4 py-2.5 text-slate-700">
                      <span className="line-clamp-2">{t.messageTemplate}</span>
                    </td>
                    <td className="max-w-[220px] px-4 py-2.5 font-mono text-xs text-slate-500">
                      <span className="line-clamp-1">{t.urlTemplate}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        title="Edit"
                        aria-label="Edit template"
                        onClick={() => setEditing(t)}
                        className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600"
                      >
                        <Icon name="pencil" className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="border-t border-slate-100 px-4 py-1">
            <Pagination
              page={page}
              totalPages={totalPages}
              totalElements={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        </div>

        <div className="block divide-y divide-slate-100 sm:hidden">
          <div className="grid gap-2 p-3">
            <FilterInput value={fId} onChange={setFId} placeholder="Filter ID…" />
            <FilterSelect value={fEvent} onChange={setFEvent} options={EVENT_OPTIONS} />
            <FilterSelect value={fApplies} onChange={setFApplies} options={APPLIES_OPTIONS} />
            <FilterInput value={fMessage} onChange={setFMessage} placeholder="Search message…" icon="search" />
            <FilterInput value={fUrl} onChange={setFUrl} placeholder="Search URL…" icon="search" />
          </div>
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">No matching templates.</div>
          ) : (
            rows.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-slate-500">{t.id}</div>
                  <div className="mt-0.5 font-medium text-slate-800">
                    {EVENT_LABELS[t.eventType] || t.eventType}
                  </div>
                  <div className="mt-1.5">
                    <AppliesBadge roleId={t.roleId} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{t.messageTemplate}</p>
                  <p className="mt-0.5 truncate font-mono text-xs text-slate-400">{t.urlTemplate}</p>
                </div>
                <button
                  type="button"
                  title="Edit"
                  onClick={() => setEditing(t)}
                  className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                >
                  <Icon name="pencil" className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
          <div className="px-4 py-1">
            <Pagination
              page={page}
              totalPages={totalPages}
              totalElements={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        </div>
      </section>

      <TemplateEditModal
        open={Boolean(editing)}
        template={editing}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />
    </div>
  )
}

function TemplateEditModal({ open, template, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ messageTemplate: '', urlTemplate: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && template) {
      setForm({
        messageTemplate: template.messageTemplate ?? '',
        urlTemplate: template.urlTemplate ?? '',
      })
      setSaving(false)
    }
  }, [open, template])

  if (!open || !template) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await notificationsApi.updateTemplate(template.id, form)
      onSaved()
      toast.success('Template updated.')
    } catch {
      toast.error('Failed to save template.')
    } finally {
      setSaving(false)
    }
  }

  const eventLabel = EVENT_LABELS[template.eventType] || template.eventType
  const appliesLabel = template.roleId ? `Role ${template.roleId}` : 'Default'

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Edit template"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="template-edit-form"
            disabled={saving}
            className="rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white
                       hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <p className="mb-4 text-xs text-slate-500">
        {eventLabel} · {appliesLabel}
      </p>
      <form id="template-edit-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Message template</label>
          <textarea
            required
            rows={3}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800
                       shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            value={form.messageTemplate}
            onChange={(e) => setForm((f) => ({ ...f, messageTemplate: e.target.value }))}
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Variables:{' '}
            <code className="font-mono">{VARIABLE_HINTS[template.eventType] || '—'}</code>
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">URL template</label>
          <input
            required
            type="text"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800
                       shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            value={form.urlTemplate}
            onChange={(e) => setForm((f) => ({ ...f, urlTemplate: e.target.value }))}
            placeholder="/my-tasks or /collaborations?taskId={taskId}"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Use <code className="font-mono">{'{taskId}'}</code> for dynamic task IDs.
          </p>
        </div>
      </form>
    </Modal>
  )
}

function AppliesBadge({ roleId }) {
  if (roleId) {
    return (
      <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5
                       text-[11px] font-medium text-purple-700 ring-1 ring-purple-100">
        Role {roleId}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5
                     text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
      Default
    </span>
  )
}

function FilterInput({ value, onChange, placeholder, icon }) {
  return (
    <div className="relative">
      {icon && (
        <Icon
          name={icon}
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-md border border-slate-200 bg-white py-1.5
                    text-xs text-slate-700 shadow-sm placeholder:text-slate-400
                    focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100
                    ${icon ? 'pl-8 pr-2.5' : 'px-2.5'}`}
      />
    </div>
  )
}

function FilterSelect({ value, onChange, options }) {
  return (
    <AppSelect
      value={value}
      onChange={onChange}
      options={options}
      size="sm"
      isClearable={false}
      isSearchable
      menuPortal
    />
  )
}
