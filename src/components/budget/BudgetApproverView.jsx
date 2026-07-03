import { Fragment, useMemo, useState } from 'react'
import BudgetConfirmationModal from './BudgetConfirmationModal'
import { formatInr } from '../../utils/budgetHelpers'

export default function BudgetApproverView({
  proposal,
  saving,
  onApprove,
  onNeedsRevision,
  onBack,
}) {
  const rows = useMemo(
    () => (proposal?.departmentBudgets ?? []).map(r => ({
      key: `ro-${r.id}`,
      id: r.id,
      departmentId: r.departmentId,
      departmentName: r.departmentName,
      isPercentage: r.percentage,
      percentageValue: r.percentageValue,
      allocatedAmount: r.allocatedAmount,
      plannerComment: r.plannerComment,
      markedForRevision: false,
      revisionDismissed: false,
      inputValue: '',
    })),
    [proposal],
  )

  const [selected, setSelected] = useState({})
  const [rowComments, setRowComments] = useState({})
  const [modal, setModal] = useState(null)
  const [overallComment, setOverallComment] = useState('')

  const selectedCount = Object.values(selected).filter(Boolean).length

  const toggleRow = (id) => {
    setSelected(prev => {
      const next = { ...prev, [id]: !prev[id] }
      if (!next[id]) {
        setRowComments(c => {
          const copy = { ...c }
          delete copy[id]
          return copy
        })
      }
      return next
    })
  }

  const openApproveModal = () => {
    setOverallComment('')
    setModal('approve')
  }

  const openRevisionModal = () => {
    const missing = Object.keys(selected).filter(id => selected[id] && !rowComments[id]?.trim())
    if (missing.length) return
    setOverallComment('')
    setModal('revision')
  }

  const handleConfirm = async () => {
    if (modal === 'approve') {
      await onApprove(overallComment)
    } else if (modal === 'revision') {
      const rowRevisions = Object.keys(selected)
        .filter(id => selected[id])
        .map(id => ({
          departmentBudgetId: Number(id),
          comment: rowComments[id].trim(),
        }))
      await onNeedsRevision({ comments: overallComment.trim(), rowRevisions })
    }
    setModal(null)
  }

  const rowCommentsComplete = Object.keys(selected)
    .filter(id => selected[id])
    .every(id => rowComments[id]?.trim())

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <button type="button" onClick={onBack} className="text-xs font-medium text-brand-600 hover:text-brand-700">
            ← Back to list
          </button>
          <h2 className="mt-1 text-base font-semibold text-slate-900">
            Review — FY {proposal.financialYear}
          </h2>
          <p className="text-sm text-slate-500">Total: {formatInr(proposal.totalAmount)}</p>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
          Proposed
        </span>
      </div>

      <div className="space-y-4 p-5">
        {proposal.plannerComment && (
          <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
            <span className="font-medium text-slate-600">Planner note: </span>
            {proposal.plannerComment}
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="w-10 px-4 py-3" />
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Allocation</th>
                <th className="px-4 py-3 font-medium">Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(row => (
                <Fragment key={row.key}>
                  <tr className="bg-white">
                    <td className="px-4 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={!!selected[row.id]}
                        onChange={() => toggleRow(row.id)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{row.departmentName}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatInr(row.allocatedAmount)}
                      {row.isPercentage && row.percentageValue != null && (
                        <span className="ml-1 text-xs text-slate-500">({row.percentageValue}%)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.plannerComment || '—'}</td>
                  </tr>
                  {selected[row.id] && (
                    <tr className="bg-amber-50/50">
                      <td />
                      <td colSpan={3} className="px-4 pb-3">
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Revision comment for {row.departmentName} (required)
                        </label>
                        <input
                          type="text"
                          value={rowComments[row.id] ?? ''}
                          onChange={(e) => setRowComments(c => ({ ...c, [row.id]: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                                     shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                          placeholder="Explain what needs to change…"
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={selectedCount === 0 || !rowCommentsComplete || saving}
            onClick={openRevisionModal}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium
                       text-red-700 transition hover:bg-red-100 disabled:opacity-50"
          >
            Needs Revision
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={openApproveModal}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white
                       shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            Approve All
          </button>
        </div>
      </div>

      <BudgetConfirmationModal
        open={modal === 'approve'}
        onClose={() => setModal(null)}
        title="Approve Entire Budget?"
        description="This will approve the full proposal for the financial year. This action cannot be undone easily."
        comment={overallComment}
        onCommentChange={setOverallComment}
        confirmLabel="Approve All"
        saving={saving}
        onConfirm={handleConfirm}
      />

      <BudgetConfirmationModal
        open={modal === 'revision'}
        onClose={() => setModal(null)}
        title="Send Back for Revision?"
        description={`${selectedCount} department row(s) will be flagged for the planner to fix.`}
        comment={overallComment}
        onCommentChange={setOverallComment}
        commentRequired
        confirmLabel="Confirm Needs Revision"
        confirmTone="danger"
        saving={saving}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
