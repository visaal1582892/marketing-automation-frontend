import { useCallback, useEffect, memo, useState } from 'react'
import { granularTasksApi, questionApi } from '../../api/masterData'
import questionnaireApi from '../../api/questionnaire'
import useDebounce from '../../hooks/useDebounce'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import { useToast } from '../../components/Toast'
import AppSelect from '../../components/AppSelect'

const FIELD_TYPES = [
  { value: 'TEXT',        label: 'Short Text' },
  { value: 'NUMBER',      label: 'Number' },
  { value: 'TEXTAREA',    label: 'Long Text' },
  { value: 'DROPDOWN',    label: 'Single Select' },
  { value: 'MULTISELECT', label: 'Multi Select' },
  { value: 'DATE',        label: 'Date' },
]

const FIELD_TYPE_LABELS = Object.fromEntries(FIELD_TYPES.map(f => [f.value, f.label]))

export default function QuestionMasterPage() {
  const toast = useToast()
  const PAGE_SIZE = 20

  const [rows,          setRows]          = useState([])
  const [total,         setTotal]         = useState(0)
  const [totalPages,    setTotalPages]    = useState(0)
  const [granularTasks, setGranularTasks] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [modalOpen,     setModalOpen]     = useState(false)
  const [editing,       setEditing]       = useState(null)
  const [deleting,      setDeleting]      = useState(null)
  const [saving,        setSaving]        = useState(false)
  const [page,          setPage]          = useState(0)
  const [refreshSeed,   setRefreshSeed]   = useState(0)

  const [fText, setFText] = useState('')

  const dText = useDebounce(fText, 400)

  // Reset page on filter change
  useEffect(() => { setPage(0) }, [dText]) // eslint-disable-line react-hooks/exhaustive-deps

  const BLANK_FORM = {
    questionText:    '',
    fieldType:       'TEXT',
    options:         '',
    isRequired:      true,
    granularTaskIds: [],
  }
  const [form, setForm] = useState(BLANK_FORM)

  const refresh = () => setRefreshSeed((s) => s + 1)

  // Load granular tasks for modal dropdown
  useEffect(() => {
    granularTasksApi.list(false)
      .then((data) => setGranularTasks(data || []))
      .catch(() => {})
  }, [])

  // Server-side fetch
  useEffect(() => {
    let alive = true
    setLoading(true)
    questionApi.listPaged({ questionText: dText || undefined, page, size: PAGE_SIZE })
      .then((res) => {
        if (!alive) return
        setRows(res.content ?? [])
        setTotal(res.totalElements ?? 0)
        setTotalPages(res.totalPages ?? 0)
      })
      .catch(() => { if (alive) toast.error('Failed to load questions') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dText, page, refreshSeed])

  const openCreate = () => { setEditing(null); setForm(BLANK_FORM); setModalOpen(true) }

  const openEdit = (q) => {
    setEditing(q)
    let optionsStr = ''
    if (q.options) {
      try { optionsStr = JSON.parse(q.options).join(', ') } catch { optionsStr = q.options }
    }
    setForm({
      questionText:    q.questionText,
      fieldType:       q.fieldType,
      options:         optionsStr,
      isRequired:      q.required,
      granularTaskIds: (q.mappedTasks || []).map(t => String(t.granularTaskId)),
    })
    setModalOpen(true)
  }

  const closeModal = () => { setModalOpen(false); setEditing(null) }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.questionText.trim()) { toast.error('Question text is required'); return }

    let optionsJson = null
    if (form.fieldType === 'DROPDOWN' || form.fieldType === 'MULTISELECT') {
      const opts = form.options.split(',').map(s => s.trim()).filter(Boolean)
      optionsJson = opts.length ? JSON.stringify(opts) : null
    }

    const payload = {
      questionText:    form.questionText.trim(),
      fieldType:       form.fieldType,
      options:         optionsJson,
      isRequired:      form.isRequired,
      granularTaskIds: form.granularTaskIds,
    }

    setSaving(true)
    try {
      if (editing) {
        await questionnaireApi.update(editing.questionId, payload)
        toast.success('Question updated.')
      } else {
        await questionnaireApi.create(payload)
        toast.success('Question created.')
      }
      closeModal()
      refresh()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save question')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await questionnaireApi.remove(deleting.questionId)
      toast.success(`Question ${deleting.questionId} deleted.`)
      setDeleting(null)
      refresh()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete question')
    }
  }

  const handleEditRow   = useCallback((q) => openEdit(q), []) // eslint-disable-line react-hooks/exhaustive-deps
  const handleDeleteRow = useCallback((q) => setDeleting(q), [])

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg
                           bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Icon name="clipboard" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-900">
              Question Library
            </h1>
            <p className="text-xs text-slate-500">
              {loading ? 'Loading…' : `${total} question${total === 1 ? '' : 's'} total`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3.5 py-2
                     text-sm font-semibold text-white shadow-sm transition
                     hover:bg-brand-700 active:scale-[0.98]"
        >
          <Icon name="plus" className="h-4 w-4" />
          Add question
        </button>
      </header>

      <section className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200/70">
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/70 text-left text-xs font-semibold uppercase
                              tracking-wider text-slate-500">
                <th className="w-36 px-4 py-2.5">Question ID</th>
                <th className="px-4 py-2.5">Question</th>
                <th className="w-32 px-4 py-2.5">Field type</th>
                <th className="w-28 px-4 py-2.5">Required</th>
                <th className="min-w-[180px] px-4 py-2.5">Mapped tasks</th>
                <th className="w-24 px-4 py-2.5 text-right">Actions</th>
              </tr>
              <tr className="border-y border-slate-100 bg-slate-50/40">
                <th className="px-4 py-2" colSpan={2}>
                  <FilterInput value={fText} onChange={setFText} placeholder="Search question text…" icon="search" />
                </th>
                <th colSpan={4} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No matching questions.</td></tr>
              ) : (
                rows.map((q) => (
                  <QuestionRow key={q.questionId} question={q} onEdit={handleEditRow} onDelete={handleDeleteRow} />
                ))
              )}
            </tbody>
          </table>
          <div className="border-t border-slate-100 px-4 py-1">
            <Pagination page={page} totalPages={totalPages} totalElements={total}
              pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </div>

        <div className="block divide-y divide-slate-100 sm:hidden">
          <div className="space-y-2 p-3">
            <FilterInput value={fText} onChange={setFText} placeholder="Search…" icon="search" />
          </div>
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">No matching questions.</div>
          ) : (
            rows.map((q) => (
              <div key={q.questionId} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-slate-500">{q.questionId}</div>
                  <div className="mt-0.5 font-medium text-slate-800">{q.questionText}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <FieldTypeBadge type={q.fieldType} />
                    {q.required ? (
                      <span className="text-xs text-accent-700">Required</span>
                    ) : (
                      <span className="text-xs text-slate-500">Optional</span>
                    )}
                  </div>
                </div>
                <RowActions onEdit={() => openEdit(q)} onDelete={() => setDeleting(q)} />
              </div>
            ))
          )}
          <div className="px-4 py-1">
            <Pagination page={page} totalPages={totalPages} totalElements={total}
              pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </div>
      </section>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        size="lg"
        title={editing ? `Edit ${editing.questionId}` : 'New question'}
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="question-form"
              disabled={saving}
              className="rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm
                         transition hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : (editing ? 'Save changes' : 'Create')}
            </button>
          </>
        }
      >
        <form id="question-form" onSubmit={handleSave} className="space-y-3.5">
          {editing && (
            <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
              ID: <span className="font-mono text-slate-700">{editing.questionId}</span>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Question text *</label>
            <textarea
              value={form.questionText}
              onChange={(e) => setForm((f) => ({ ...f, questionText: e.target.value }))}
              rows={2}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800
                shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Field type *</label>
              <AppSelect
                value={form.fieldType}
                onChange={v => setForm(f => ({ ...f, fieldType: v, options: '' }))}
                options={FIELD_TYPES}
                placeholder="Select field type…"
                isClearable={false}
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex cursor-pointer items-center gap-2.5 select-none">
                <input
                  type="checkbox"
                  checked={form.isRequired}
                  onChange={(e) => setForm((f) => ({ ...f, isRequired: e.target.checked }))}
                  className="h-4 w-4 accent-brand-600"
                />
                <span className="text-sm text-slate-700">Required on form</span>
              </label>
            </div>
          </div>
          {(form.fieldType === 'DROPDOWN' || form.fieldType === 'MULTISELECT') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Options <span className="font-normal text-slate-400">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={form.options}
                onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
                placeholder="Option A, Option B"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm
                  focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Map to granular tasks
              {form.granularTaskIds.length > 0 && (
                <span className="ml-1.5 font-normal text-slate-400">({form.granularTaskIds.length} selected)</span>
              )}
            </label>
            <AppSelect
              isMulti
              isSearchable
              menuPortal
              value={granularTasks
                .filter(t => form.granularTaskIds.includes(String(t.taskId)))
                .map(t => ({ value: String(t.taskId), label: t.taskName }))}
              onChange={(selected) =>
                setForm(f => ({ ...f, granularTaskIds: (selected || []).map(s => s.value) }))
              }
              options={granularTasks.map(t => ({ value: String(t.taskId), label: t.taskName }))}
              placeholder="Search and select tasks…"
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={deleting != null}
        onClose={() => setDeleting(null)}
        title="Delete question?"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleting(null)}
              className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-md bg-red-600 px-3.5 py-2 text-sm font-semibold text-white
                         shadow-sm transition hover:bg-red-700"
            >
              Delete
            </button>
          </>
        }
      >
        {deleting && (
          <p className="text-sm text-slate-600">
            This removes <span className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-800">{deleting.questionId}</span>
            {' '}and all task links and saved answers for it.
          </p>
        )}
      </Modal>
    </div>
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
        className={`w-full rounded-md border border-slate-200 bg-white py-1.5 text-xs text-slate-700 shadow-sm
          placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100
          ${icon ? 'pl-8 pr-2.5' : 'px-2.5'}`}
      />
    </div>
  )
}

function FilterSelect({ value, onChange, options }) {
  return <AppSelect value={value} onChange={onChange} options={options} size="sm" isClearable={false} isSearchable menuPortal />
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <button
        type="button"
        title="Edit"
        onClick={onEdit}
        className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <Icon name="pencil" className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Delete"
        onClick={onDelete}
        className="rounded-md p-1.5 text-slate-400 transition hover:bg-brand-50 hover:text-brand-700"
      >
        <Icon name="trash" className="h-4 w-4" />
      </button>
    </div>
  )
}

const FIELD_TYPE_STYLES = {
  TEXT:        'bg-slate-100 text-slate-600',
  NUMBER:      'bg-sky-50 text-sky-700',
  TEXTAREA:    'bg-amber-50 text-amber-700',
  DROPDOWN:    'bg-emerald-50 text-emerald-700',
  MULTISELECT: 'bg-violet-50 text-violet-700',
  DATE:        'bg-rose-50 text-rose-700',
}

function FieldTypeBadge({ type }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset
      ${FIELD_TYPE_STYLES[type] || 'bg-slate-100 text-slate-600'}
      ring-current/20`}
    >
      {FIELD_TYPE_LABELS[type] || type}
    </span>
  )
}

const QuestionRow = memo(function QuestionRow({ question: q, onEdit, onDelete }) {
  return (
    <tr className="transition hover:bg-slate-50/60">
      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{q.questionId}</td>
      <td className="px-4 py-2.5 font-medium text-slate-800 max-w-md">
        <p className="line-clamp-2">{q.questionText}</p>
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <FieldTypeBadge type={q.fieldType} />
      </td>
      <td className="px-4 py-2.5">
        {q.required ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5
            text-xs font-medium text-accent-700 ring-1 ring-accent-200">
            Required
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5
            text-xs font-medium text-slate-500 ring-1 ring-slate-200">
            Optional
          </span>
        )}
      </td>
      <td className="px-4 py-2.5">
        {(q.mappedTasks || []).length === 0 ? (
          <span className="text-slate-400 text-xs">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {q.mappedTasks.slice(0, 3).map((t) => (
              <span
                key={t.granularTaskId}
                className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5
                  text-xs font-medium text-brand-700 ring-1 ring-brand-100"
              >
                {t.granularTaskName}
              </span>
            ))}
            {q.mappedTasks.length > 3 && (
              <span
                title={q.mappedTasks.slice(3).map(t => t.granularTaskName).join(', ')}
                className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5
                  text-xs font-medium text-slate-600 ring-1 ring-slate-200 cursor-default"
              >
                +{q.mappedTasks.length - 3}
              </span>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-2.5">
        <RowActions onEdit={() => onEdit(q)} onDelete={() => onDelete(q)} />
      </td>
    </tr>
  )
})
