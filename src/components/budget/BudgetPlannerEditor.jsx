import { useEffect, useState } from 'react'
import { defaultFinancialYear } from '../../utils/budgetHelpers'
import StateMonthlyMatrix from './StateMonthlyMatrix'

export default function BudgetPlannerEditor({
  proposal,
  saving,
  submitting,
  hasPendingProposal = false,
  onSave,
  onSubmit,
  onBack,
}) {
  const isNew = !proposal?.id
  const editable = proposal?.status === 'DRAFT' || proposal?.status === 'NEEDS_REVISION' || isNew
  const isPendingBlocked = hasPendingProposal && proposal?.status !== 'PENDING_APPROVAL' && proposal?.status !== 'PROPOSED'

  const [financialYear, setFinancialYear] = useState(proposal?.financialYear ?? defaultFinancialYear())
  const [totalAmount, setTotalAmount] = useState(String(proposal?.totalAmount ?? ''))
  const [plannerComment, setPlannerComment] = useState(proposal?.plannerComment ?? '')
  
  // phase can be setup (defining the proposal) or allocation (defining the matrix)
  // If it's a new proposal, we MUST save the setup first to get an ID.
  const [phase, setPhase] = useState(() => isNew ? 'setup' : 'allocation')

  useEffect(() => {
    if (!proposal?.id) return
    setFinancialYear(proposal.financialYear ?? defaultFinancialYear())
    setTotalAmount(String(proposal.totalAmount ?? ''))
    setPlannerComment(proposal.plannerComment ?? '')
    setPhase('allocation')
  }, [proposal?.id, proposal?.updatedAt])

  const handleStartPlanning = () => {
    if (!financialYear.trim()) return
    if (!totalAmount || Number(totalAmount) <= 0) return
    if (isNew) {
      // Must save the proposal to get an ID before rendering the matrix
      onSave({
        financialYear,
        totalAmount: Number(totalAmount),
        plannerComment: plannerComment || null
      })
    } else {
      setPhase('allocation')
    }
  }

  const payload = () => ({
    financialYear,
    totalAmount: Number(totalAmount),
    plannerComment: plannerComment || null
  })

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <button type="button" onClick={onBack} className="text-xs font-medium text-brand-600 hover:text-brand-700">
            ← Back to list
          </button>
          <h2 className="mt-1 text-base font-semibold text-slate-900">
            {isNew ? 'New Budget Proposal' : `Budget FY ${proposal.financialYear}`}
          </h2>
        </div>
        {proposal?.status && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            {proposal.status.replace('_', ' ')}
          </span>
        )}
      </div>

      <div className="space-y-6 p-5">
        {phase === 'setup' ? (
          <div className="mx-auto max-w-lg space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Financial Year</label>
              <input
                type="text"
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                placeholder="2026-27"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm
                           outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Total Budget per Year (₹)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm
                           outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Planner Comment (optional)</label>
              <textarea
                rows={3}
                value={plannerComment}
                onChange={(e) => setPlannerComment(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm
                           outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <button
              type="button"
              disabled={!financialYear.trim() || !totalAmount || Number(totalAmount) <= 0 || saving}
              onClick={handleStartPlanning}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white
                         shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Start Planning'}
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <div>
                <p className="text-xs font-medium text-slate-500">Financial Year</p>
                <p className="font-semibold text-slate-800">{financialYear}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Total Budget</p>
                <p className="font-semibold text-slate-800">₹{Number(totalAmount).toLocaleString('en-IN')}</p>
              </div>
              {plannerComment && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-500">Comment</p>
                  <p className="truncate text-sm text-slate-700">{plannerComment}</p>
                </div>
              )}
              {editable && (
                <button
                  type="button"
                  onClick={() => setPhase('setup')}
                  className="text-xs font-medium text-brand-600 hover:text-brand-800 underline"
                >
                  Edit Setup
                </button>
              )}
            </div>

            <StateMonthlyMatrix 
              proposal={proposal} 
              readOnly={!editable} 
            />

            {editable && (
              <div className="space-y-2 border-t border-slate-100 pt-4">
                {isPendingBlocked && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
                    A budget proposal is currently pending approval. You cannot submit another proposal until the pending one is reviewed.
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => onSave(payload())}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm
                               font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save Proposal Setup'}
                  </button>
                  <button
                    type="button"
                    disabled={submitting || isPendingBlocked}
                    onClick={() => onSubmit(payload())}
                    title={isPendingBlocked ? 'A budget proposal is already pending approval' : ''}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white
                               shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
                  >
                    {submitting ? 'Submitting…' : 'Send for Approval'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
