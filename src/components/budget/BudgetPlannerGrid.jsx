import { useMemo } from 'react'
import AppSelect from '../AppSelect'
import Icon from '../Icon'
import {
  amountsEqual,
  computeRowAmount,
  formatInr,
  parseAmount,
} from '../../utils/budgetHelpers'

export default function BudgetPlannerGrid({
  totalBudget,
  rows,
  departments,
  onRowChange,
  onAddRow,
  onRemoveRow,
  readOnly = false,
}) {
  const { allocatedSum, remaining } = useMemo(() => {
    const total = parseAmount(totalBudget)
    const sum = rows.reduce((acc, row) => acc + computeRowAmount(total, row), 0)
    return { allocatedSum: sum, remaining: total - sum }
  }, [rows, totalBudget])

  const remainingOk = amountsEqual(remaining, 0)
  const remainingNegative = remaining < -0.005

  const usedDepartments = useMemo(
    () => new Set(rows.map(r => r.departmentId).filter(Boolean)),
    [rows],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Budget</p>
          <p className="text-lg font-bold text-slate-900">{formatInr(totalBudget)}</p>
        </div>
        <div className="h-8 w-px bg-slate-200" />
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Remaining Unallocated</p>
          <p className={`text-lg font-bold ${
            remainingOk ? 'text-emerald-700' : remainingNegative ? 'text-red-600' : 'text-amber-700'
          }`}>
            {formatInr(remaining)}
          </p>
        </div>
        <div className="ml-auto text-xs text-slate-500">
          Allocated: {formatInr(allocatedSum)}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Budget</th>
              <th className="px-4 py-3 font-medium">Comment</th>
              {!readOnly && <th className="px-4 py-3 font-medium w-12" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, idx) => {
              const absolute = computeRowAmount(totalBudget, row)
              const showRevision = row.markedForRevision && !row.revisionDismissed
              return (
                <tr
                  key={row.key}
                  className={showRevision ? 'bg-red-50' : 'bg-white'}
                >
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-start gap-2">
                      {showRevision && (
                        <Icon name="alertCircle" className="mt-2 h-4 w-4 shrink-0 text-red-500" title="Needs revision" />
                      )}
                      {readOnly ? (
                        <span className="font-medium text-slate-800">{row.departmentName || row.departmentId}</span>
                      ) : (
                        <div className="min-w-[180px]">
                          <AppSelect
                            value={row.departmentId}
                            onChange={(v) => onRowChange(idx, { departmentId: v })}
                            options={departments
                              .filter(d => d.value === row.departmentId || !usedDepartments.has(d.value))
                              .map(d => ({ value: d.value, label: d.label }))}
                            placeholder="Select department"
                            menuPortal
                          />
                        </div>
                      )}
                    </div>
                    {showRevision && row.revisionComment && (
                      <p className="mt-1 text-xs text-red-700">
                        Approver: {row.revisionComment}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap items-center gap-2">
                      {!readOnly && (
                        <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
                          <button
                            type="button"
                            onClick={() => onRowChange(idx, { isPercentage: false })}
                            className={`rounded px-2 py-1 font-medium transition ${
                              !row.isPercentage ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            ₹
                          </button>
                          <button
                            type="button"
                            onClick={() => onRowChange(idx, { isPercentage: true })}
                            className={`rounded px-2 py-1 font-medium transition ${
                              row.isPercentage ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            %
                          </button>
                        </div>
                      )}
                      {readOnly ? (
                        <div>
                          <span className="font-medium text-slate-800">{formatInr(row.allocatedAmount)}</span>
                          {row.isPercentage && row.percentageValue != null && (
                            <span className="ml-2 text-xs text-slate-500">({row.percentageValue}%)</span>
                          )}
                        </div>
                      ) : (
                        <div>
                          <input
                            type="number"
                            min="0"
                            step={row.isPercentage ? '0.01' : '1'}
                            value={row.inputValue}
                            onChange={(e) => onRowChange(idx, { inputValue: e.target.value, revisionDismissed: true })}
                            className="w-32 rounded-lg border border-slate-200 px-3 py-1.5 text-sm
                                       shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                            placeholder={row.isPercentage ? '0.00' : '0'}
                          />
                          {row.isPercentage && (
                            <p className="mt-1 text-xs text-slate-500">= {formatInr(absolute)}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {readOnly ? (
                      <span className="text-slate-600">{row.plannerComment || '—'}</span>
                    ) : (
                      <input
                        type="text"
                        value={row.plannerComment ?? ''}
                        onChange={(e) => onRowChange(idx, { plannerComment: e.target.value })}
                        placeholder="Optional comment"
                        className="w-full min-w-[140px] rounded-lg border border-slate-200 px-3 py-1.5 text-sm
                                   shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                      />
                    )}
                  </td>
                  {!readOnly && (
                    <td className="px-4 py-3 align-top">
                      <button
                        type="button"
                        onClick={() => onRemoveRow(idx)}
                        className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove row"
                      >
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={onAddRow}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300
                     px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
        >
          <Icon name="plus" className="h-4 w-4" />
          Add Department Row
        </button>
      )}

      {/* expose computed values to parent via data attributes is hacky — parent recomputes same logic */}
    </div>
  )
}

export function useBudgetTotals(totalBudget, rows) {
  return useMemo(() => {
    const total = parseAmount(totalBudget)
    const allocatedSum = rows.reduce((acc, row) => acc + computeRowAmount(total, row), 0)
    const remaining = total - allocatedSum
    return {
      allocatedSum,
      remaining,
      remainingOk: amountsEqual(remaining, 0),
      hasUnresolvedFlags: rows.some(r => r.markedForRevision && !r.revisionDismissed),
      hasServerFlags: rows.some(r => r.markedForRevision),
    }
  }, [totalBudget, rows])
}
