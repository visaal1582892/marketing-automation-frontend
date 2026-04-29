import { useEffect, useMemo, useState } from 'react'
import { granularTasksApi } from '../../api/masterData'
import questionnaireApi from '../../api/questionnaire'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import { useToast } from '../../components/Toast'

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

  const [questions,     setQuestions]     = useState([])
  const [granularTasks, setGranularTasks] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [modalOpen,     setModalOpen]     = useState(false)
  const [editing,       setEditing]       = useState(null)
  const [deleting,      setDeleting]      = useState(null)
  const [saving,        setSaving]        = useState(false)

  const [fId,        setFId]        = useState('')
  const [fText,      setFText]      = useState('')
  const [fType,      setFType]      = useState('ALL')
  const [fRequired,  setFRequired]  = useState('ALL')
  const [fTask,      setFTask]      = useState('')

  const BLANK_FORM = {
    questionText:    '',
    fieldType:       'TEXT',
    options:         '',
    isRequired:      true,
    granularTaskIds: [],
  }
  const [form, setForm] = useState(BLANK_FORM)

  const loadAll = () => {
    setLoading(true)
    Promise.all([
      questionnaireApi.listAll(),
      granularTasksApi.list(false),
    ])
      .then(([qRes, gtRes]) => {
        setQuestions(qRes.data || [])
        setGranularTasks(gtRes || [])
      })
      .catch(() => toast.error('Failed to load questions'))
      .finally(() => setLoading(false))
  }

  useEffect(loadAll, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    return questions.filter(q => {
      if (fId   && !q.questionId.toLowerCase().includes(fId.toLowerCase()))   return false
      if (fText && !q.questionText.toLowerCase().includes(fText.toLowerCase())) return false
      if (fType !== 'ALL' && q.fieldType !== fType) return false
      if (fRequired !== 'ALL') {
        const want = fRequired === 'YES'
        if (q.required !== want) return false
      }
      if (fTask) {
        const taskStr = (q.mappedTasks || []).map(t => t.granularTaskName).join(' ').toLowerCase()
        if (!taskStr.includes(fTask.toLowerCase())) return false
      }
      return true
    })
  }, [questions, fId, fText, fType, fRequired, fTask])

  const counts = useMemo(() => ({
    total: questions.length,
    shown: filtered.length,
  }), [questions.length, filtered.length])

  const openCreate = () => {
    setEditing(null)
    setForm(BLANK_FORM)
    setModalOpen(true)
  }

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
      granularTaskIds: (q.mappedTasks || []).map(t => t.granularTaskId),
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
      loadAll()
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
      loadAll()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete question')
    }
  }

  const toggleTask = (taskId) =>
    setForm(f => ({
      ...f,
      granularTaskIds: f.granularTaskIds.includes(taskId)
        ? f.granularTaskIds.filter(id => id !== taskId)
        : [...f.granularTaskIds, taskId],
    }))

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
              {loading ? 'Loading…' : (
                <>
                  {counts.shown} of {counts.total} question{counts.total === 1 ? '' : 's'} shown
                  {' · '}
                  Map questions to granular tasks for request forms and worker checklists
                </>
              )}
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
                <th className="px-4 py-2">
                  <FilterInput value={fId} onChange={setFId} placeholder="QUES-…" />
                </th>
                <th className="px-4 py-2">
                  <FilterInput value={fText} onChange={setFText} placeholder="Search text" icon="search" />
                </th>
                <th className="px-4 py-2">
                  <FilterSelect
                    value={fType}
                    onChange={setFType}
                    options={[['ALL', 'All types'], ...FIELD_TYPES.map((ft) => [ft.value, ft.label])]}
                  />
                </th>
                <th className="px-4 py-2">
                  <FilterSelect
                    value={fRequired}
                    onChange={setFRequired}
                    options={[['ALL', 'All'], ['YES', 'Required'], ['NO', 'Optional']]}
                  />
                </th>
                <th className="px-4 py-2">
                  <FilterInput value={fTask} onChange={setFTask} placeholder="Task name" />
                </th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No matching questions.</td></tr>
              ) : (
                filtered.map((q) => (
                  <tr key={q.questionId} className="transition hover:bg-slate-50/60">
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
                          {q.mappedTasks.map((t) => (
                            <span
                              key={t.granularTaskId}
                              className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5
                                text-xs font-medium text-brand-700 ring-1 ring-brand-100"
                            >
                              {t.granularTaskName}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <RowActions onEdit={() => openEdit(q)} onDelete={() => setDeleting(q)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="block divide-y divide-slate-100 sm:hidden">
          <div className="space-y-2 p-3">
            <FilterInput value={fText} onChange={setFText} placeholder="Search…" icon="search" />
          </div>
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">No matching questions.</div>
          ) : (
            filtered.map((q) => (
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
              rows={3}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800
                shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Field type *</label>
              <select
                value={form.fieldType}
                onChange={(e) => setForm((f) => ({ ...f, fieldType: e.target.value, options: '' }))}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm
                  focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                {FIELD_TYPES.map((ft) => (
                  <option key={ft.value} value={ft.value}>{ft.label}</option>
                ))}
              </select>
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
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Map to granular tasks
              <span className="ml-1.5 font-normal text-slate-400">({form.granularTaskIds.length} selected)</span>
            </label>
            <div className="max-h-52 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100">
              {granularTasks.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-400">No granular tasks found.</p>
              ) : (
                granularTasks.map((gt) => {
                  const checked = form.granularTaskIds.includes(gt.taskId)
                  return (
                    <label
                      key={gt.taskId}
                      className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition
                        ${checked ? 'bg-brand-50/80' : 'hover:bg-slate-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTask(gt.taskId)}
                        className="h-3.5 w-3.5 accent-brand-600"
                      />
                      <span className={`font-mono text-xs ${checked ? 'text-brand-600' : 'text-slate-400'}`}>
                        {gt.taskId}
                      </span>
                      <span className={checked ? 'font-medium text-brand-900' : 'text-slate-700'}>{gt.taskName}</span>
                    </label>
                  )
                })
              )}
            </div>
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
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-2.5 pr-7 text-xs text-slate-700 shadow-sm
        focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  )
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
