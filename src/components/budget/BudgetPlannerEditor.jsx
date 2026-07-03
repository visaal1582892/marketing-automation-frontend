import { useEffect, useMemo, useState } from 'react'
import BudgetPlannerGrid, { useBudgetTotals } from './BudgetPlannerGrid'
import { defaultFinancialYear } from '../../utils/budgetHelpers'

let rowKeySeq = 0
function nextRowKey() {
  rowKeySeq += 1
  return `row-${rowKeySeq}`
}

export function mapProposalToRows(proposal) {
  return (proposal?.departmentBudgets ?? []).map(r => ({
    key: nextRowKey(),
    id: r.id,
    departmentId: r.departmentId,
    departmentName: r.departmentName,
    isPercentage: r.percentage,
    inputValue: r.percentage
      ? String(r.percentageValue ?? '')
      : String(r.allocatedAmount ?? ''),
    plannerComment: r.plannerComment ?? '',
    markedForRevision: r.markedForRevision,
    revisionComment: r.revisionComment ?? '',
    revisionDismissed: false,
    allocatedAmount: r.allocatedAmount,
  }))
}

export function emptyRow() {
  return {
    key: nextRowKey(),
    id: null,
    departmentId: '',
    departmentName: '',
    isPercentage: false,
    inputValue: '',
    plannerComment: '',
    markedForRevision: false,
    revisionComment: '',
    revisionDismissed: false,
  }
}

export function buildPayload(financialYear, totalAmount, plannerComment, rows) {
  return {
    financialYear,
    totalAmount: Number(totalAmount),
    plannerComment: plannerComment || null,
    departmentBudgets: rows
      .filter(r => r.departmentId)
      .map(r => ({
        id: r.id ?? undefined,
        departmentId: r.departmentId,
        allocatedAmount: r.isPercentage ? null : Number(r.inputValue || 0),
        percentage: r.isPercentage,
        percentageValue: r.isPercentage ? Number(r.inputValue || 0) : null,
        plannerComment: r.plannerComment || null,
      })),
  }
}

export default function BudgetPlannerEditor({
  proposal,
  departments,
  saving,
  submitting,
  onSave,
  onSubmit,
  onBack,
}) {
  const isNew = !proposal?.id
  const editable = proposal?.status === 'DRAFT' || proposal?.status === 'NEEDS_REVISION' || isNew

  const [financialYear, setFinancialYear] = useState(proposal?.financialYear ?? defaultFinancialYear())
  const [totalAmount, setTotalAmount] = useState(String(proposal?.totalAmount ?? ''))
  const [plannerComment, setPlannerComment] = useState(proposal?.plannerComment ?? '')
  const [phase, setPhase] = useState(
    () => (proposal?.departmentBudgets?.length > 0 || !isNew ? 'allocation' : 'setup'),
  )
  const [rows, setRows] = useState(() =>
    proposal?.departmentBudgets?.length ? mapProposalToRows(proposal) : [emptyRow()],
  )

  useEffect(() => {
    if (!proposal?.id) return
    setFinancialYear(proposal.financialYear ?? defaultFinancialYear())
    setTotalAmount(String(proposal.totalAmount ?? ''))
    setPlannerComment(proposal.plannerComment ?? '')
    setPhase(proposal.departmentBudgets?.length ? 'allocation' : 'setup')
    setRows(proposal.departmentBudgets?.length ? mapProposalToRows(proposal) : [emptyRow()])
  }, [proposal?.id, proposal?.updatedAt])

  const totals = useBudgetTotals(totalAmount, rows)

  const canSubmit = useMemo(() => {
    if (!editable) return false
    if (!totals.remainingOk) return false
    if (totals.hasServerFlags) return false
    if (rows.filter(r => r.departmentId).length === 0) return false
    return true
  }, [editable, totals, rows])

  const handleRowChange = (idx, patch) => {
    setRows(prev => prev.map((row, i) => {
      if (i !== idx) return row
      const next = { ...row, ...patch }
      if (patch.inputValue !== undefined || patch.isPercentage !== undefined) {
        next.revisionDismissed = true
      }
      return next
    }))
  }

  const handleStartPlanning = () => {
    if (!financialYear.trim()) return
    if (!totalAmount || Number(totalAmount) <= 0) return
    setPhase('allocation')
  }

  const payload = () => buildPayload(financialYear, totalAmount, plannerComment, rows)

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
              onClick={handleStartPlanning}
              disabled={!financialYear.trim() || !totalAmount || Number(totalAmount) <= 0}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white
                         shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
            >
              Start Planning
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
                <p className="text-xs font-medium text-slate-500">Total Budget (locked)</p>
                <p className="font-semibold text-slate-800">₹{Number(totalAmount).toLocaleString('en-IN')}</p>
              </div>
              {plannerComment && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-500">Comment</p>
                  <p className="truncate text-sm text-slate-700">{plannerComment}</p>
                </div>
              )}
            </div>

            <BudgetPlannerGrid
              totalBudget={totalAmount}
              rows={rows}
              departments={departments}
              onRowChange={handleRowChange}
              onAddRow={() => setRows(prev => [...prev, emptyRow()])}
              onRemoveRow={(idx) => setRows(prev => prev.filter((_, i) => i !== idx))}
              readOnly={!editable}
            />

            {editable && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onSave(payload())}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm
                             font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Draft'}
                </button>
                <button
                  type="button"
                  disabled={!canSubmit || submitting}
                  onClick={() => onSubmit(payload())}
                  title={
                    totals.hasServerFlags
                      ? 'Save all flagged rows before submitting'
                      : !totals.remainingOk
                        ? 'Remaining budget must be exactly ₹0'
                        : ''
                  }
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white
                             shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Send for Approval'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
