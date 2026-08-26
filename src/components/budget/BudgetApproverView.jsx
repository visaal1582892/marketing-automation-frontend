import { useState } from 'react'
import BudgetConfirmationModal from './BudgetConfirmationModal'
import { formatInr, STATUS_LABELS } from '../../utils/budgetHelpers'
import StateMonthlyMatrix from './StateMonthlyMatrix'

export default function BudgetApproverView({
  proposal,
  saving,
  onApprove,
  onNeedsRevision,
  onTerminate,
  onBack,
  activeProposal,
}) {
  const [modal, setModal] = useState(null) // 'swap' | 'revision' | 'terminate'
  const [overallComment, setOverallComment] = useState('')

  const handleApproveClick = () => {
    if (activeProposal) {
      setModal('swap')
    } else {
      onApprove('')
    }
  }

  const openRevisionModal = () => {
    setOverallComment('')
    setModal('revision')
  }

  const handleConfirm = async () => {
    if (modal === 'swap') {
      await onApprove('')
    } else if (modal === 'revision') {
      await onNeedsRevision({ comments: overallComment.trim() })
    } else if (modal === 'terminate') {
      await onTerminate?.(overallComment)
    }
    setModal(null)
  }

  const status = proposal?.status
  const isPendingApproval = status === 'PENDING_APPROVAL' || status === 'PROPOSED'
  const isActive = status === 'ACTIVE' || status === 'APPROVED'
  const statusMeta = STATUS_LABELS[status] ?? STATUS_LABELS.PENDING_APPROVAL

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
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

        <StateMonthlyMatrix proposal={proposal} readOnly={true} />

        {isPendingApproval && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={saving}
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

      <BudgetConfirmationModal
        open={modal === 'revision'}
        onClose={() => setModal(null)}
        title="Send Back for Revision?"
        description={`The proposal will be sent back to the planner with your comments.`}
        comment={overallComment}
        onCommentChange={setOverallComment}
        commentRequired
        confirmLabel="Confirm Needs Revision"
        confirmTone="danger"
        saving={saving}
        onConfirm={handleConfirm}
      />

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
