import { Fragment, useMemo, useState } from 'react'
import BudgetConfirmationModal from './BudgetConfirmationModal'
import { formatInr, STATUS_LABELS } from '../../utils/budgetHelpers'

export default function BudgetApproverView({
  proposal,
  saving,
  onApprove,
  onNeedsRevision,
  onTerminate,
  onBack,
  /** Pass the currently ACTIVE proposal (if any) for the atomic-swap warning */
  activeProposal,
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

  const [selected, setSelected]       = useState({})
  const [rowComments, setRowComments] = useState({})
  const [modal, setModal]             = useState(null) // 'swap' | 'revision' | 'terminate'
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

  // ── Approve flow: if an ACTIVE proposal exists, show swap confirmation modal ──
  // If no ACTIVE proposal exists, approve directly without asking for reason!
  const handleApproveClick = () => {
    if (activeProposal) {
      setModal('swap')
    } else {
      onApprove('')
    }
  }

  const openRevisionModal = () => {
    const missing = Object.keys(selected).filter(id => selected[id] && !rowComments[id]?.trim())
    if (missing.length) return
    setOverallComment('')
    setModal('revision')
  }

  const handleConfirm = async () => {
    if (modal === 'swap') {
      await onApprove('')
    } else if (modal === 'revision') {
      const rowRevisions = Object.keys(selected)
        .filter(id => selected[id])
        .map(id => ({
          departmentBudgetId: Number(id),
          comment: rowComments[id].trim(),
        }))
      await onNeedsRevision({ comments: overallComment.trim(), rowRevisions })
    } else if (modal === 'terminate') {
      await onTerminate?.(overallComment)
    }
    setModal(null)
  }

  const rowCommentsComplete = Object.keys(selected)
    .filter(id => selected[id])
    .every(id => rowComments[id]?.trim())

  const status = proposal?.status
  const isPendingApproval = status === 'PENDING_APPROVAL' || status === 'PROPOSED'
  const isActive          = status === 'ACTIVE' || status === 'APPROVED'
  const statusMeta        = STATUS_LABELS[status] ?? STATUS_LABELS.PENDING_APPROVAL

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <button type="button" onClick={onBack} className="text-xs font-medium text-brand-600 hover:text-brand-700">
            ← Back to list
          </button>
          <h2 className="mt-1 text-base font-semibold text-slate-900">
            {isPendingApproval ? 'Review' : 'View'} — FY {proposal.financialYear}
          </h2>
          <p className="text-sm text-slate-500">Total: {formatInr(proposal.totalAmount)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusMeta.cls}`}>
            {statusMeta.label}
          </span>
          {/* Manual Terminate button — only for ACTIVE proposals */}
          {isActive && onTerminate && (
            <button
              type="button"
              disabled={saving}
              onClick={() => { setOverallComment(''); setModal('terminate') }}
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium
                         text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            >
              Terminate Agreement
            </button>
          )}
        </div>
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
                {isPendingApproval && <th className="w-10 px-4 py-3" />}
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Allocation</th>
                <th className="px-4 py-3 font-medium">Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(row => (
                <Fragment key={row.key}>
                  <tr className="bg-white">
                    {isPendingApproval && (
                      <td className="px-4 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={!!selected[row.id]}
                          onChange={() => toggleRow(row.id)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-slate-800">{row.departmentName}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>
                        <span>{formatInr(row.allocatedAmount)}</span>
                        {row.isPercentage && row.percentageValue != null && (
                          <span className="ml-1 text-xs text-slate-500">({row.percentageValue}%)</span>
                        )}
                      </div>
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

        {/* Approver action bar — only when PENDING_APPROVAL */}
        {isPendingApproval && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={selectedCount === 0 || !rowCommentsComplete || saving}
              onClick={openRevisionModal}
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium
                         text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
            >
              Needs Revision
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleApproveClick}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white
                         shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              Approve All
            </button>
          </div>
        )}
      </div>

      {/* ── Atomic-swap confirmation modal (only shown if an ACTIVE proposal already exists) ── */}
      <BudgetConfirmationModal
        open={modal === 'swap'}
        onClose={() => setModal(null)}
        title="Active Budget Agreement Exists"
        description={
          `A proposal is already active` +
          (activeProposal?.financialYear ? ` for FY ${activeProposal.financialYear}` : '') +
          `. Approving this new proposal will automatically terminate the existing active agreement. Do you want to proceed?`
        }
        hideCommentField
        confirmLabel="Terminate Old & Activate New"
        confirmTone="danger"
        saving={saving}
        onConfirm={handleConfirm}
      />

      {/* ── Needs revision modal ── */}
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

      {/* ── Terminate modal (for ACTIVE proposals) ── */}
      <BudgetConfirmationModal
        open={modal === 'terminate'}
        onClose={() => setModal(null)}
        title="Terminate Active Budget Agreement?"
        description="This will immediately terminate the active budget agreement. This action cannot be undone."
        comment={overallComment}
        onCommentChange={setOverallComment}
        confirmLabel="Terminate Agreement"
        confirmTone="danger"
        saving={saving}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
