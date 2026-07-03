import Modal from '../Modal'

export default function BudgetConfirmationModal({
  open,
  onClose,
  title,
  description,
  comment,
  onCommentChange,
  commentRequired = false,
  confirmLabel,
  confirmTone = 'primary',
  saving,
  onConfirm,
}) {
  const confirmCls = confirmTone === 'danger'
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-brand-600 hover:bg-brand-700'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={(
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm
                       font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || (commentRequired && !comment?.trim())}
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm
                        transition disabled:opacity-50 ${confirmCls}`}
          >
            {saving ? 'Submitting…' : confirmLabel}
          </button>
        </>
      )}
    >
      {description && <p className="mb-4 text-sm text-slate-600">{description}</p>}
      <label className="block text-xs font-medium text-slate-600">
        Overall Comment {commentRequired ? '(required)' : '(optional)'}
      </label>
      <textarea
        rows={4}
        value={comment ?? ''}
        onChange={(e) => onCommentChange(e.target.value)}
        placeholder="Add your overall comment…"
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                   text-slate-800 shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />
    </Modal>
  )
}
