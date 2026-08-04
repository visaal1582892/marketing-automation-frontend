import { useMemo } from 'react'
import AppSelect from '../AppSelect'
import Icon from '../Icon'
import {
  amountsEqual,
  formatInr,
  parseAmount,
} from '../../utils/budgetHelpers'

// ─── Global Mode Toggle ─────────────────────────────────────────────────────
function ModeToggle({ inputMode, onChange }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
      <button
        type="button"
        onClick={() => onChange('ABSOLUTE')}
        className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-all duration-150 ${inputMode === 'ABSOLUTE'
          ? 'bg-white text-brand-700 shadow-sm ring-1 ring-slate-200'
          : 'text-slate-500 hover:text-slate-700'
          }`}
      >
        <span>₹</span>
        <span>Absolute</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('PERCENTAGE')}
        className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-all duration-150 ${inputMode === 'PERCENTAGE'
          ? 'bg-white text-brand-700 shadow-sm ring-1 ring-slate-200'
          : 'text-slate-500 hover:text-slate-700'
          }`}
      >
        <span>%</span>
        <span>Percentage</span>
      </button>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function BudgetPlannerGrid({
  totalBudget,
  rows,
  departments,
  onRowChange,
  onAddRow,
  onRemoveRow,
  readOnly = false,
  // new props from editor (not required when readOnly)
  inputMode = 'ABSOLUTE',
  onInputModeChange,
  allocatedSum: allocatedSumProp,
  remaining: remainingProp,
  remainingOk: remainingOkProp,
}) {
  const totalBudgetNum = parseAmount(totalBudget)

  // When readOnly the editor doesn't pass pre-computed totals — compute locally
  const { allocatedSum, remaining, remainingOk } = useMemo(() => {
    if (!readOnly && allocatedSumProp !== undefined) {
      return {
        allocatedSum: allocatedSumProp,
        remaining: remainingProp,
        remainingOk: remainingOkProp,
      }
    }
    // readonly: absoluteValue = row.allocatedAmount
    const sum = rows.reduce((acc, r) => acc + (r.allocatedAmount ?? r.absoluteValue ?? 0), 0)
    const rem = totalBudgetNum - sum
    return { allocatedSum: sum, remaining: rem, remainingOk: amountsEqual(rem, 0) }
  }, [readOnly, allocatedSumProp, remainingProp, remainingOkProp, rows, totalBudgetNum])

  const remainingNegative = remaining < -0.005

  const usedDepartments = useMemo(
    () => new Set(rows.map(r => r.departmentId).filter(Boolean)),
    [rows],
  )

  // Derive the display value for an input cell
  function displayValue(row) {
    const abs = row.absoluteValue ?? 0
    if (inputMode === 'PERCENTAGE') {
      if (totalBudgetNum <= 0) return ''
      return Number(((abs / totalBudgetNum) * 100).toFixed(2))
    }
    return abs === 0 ? '' : abs
  }

  // Handle user typing in an input
  function handleInput(idx, rawValue) {
    const parsed = rawValue === '' ? '' : Number(rawValue)
    let absoluteValue

    if (inputMode === 'PERCENTAGE') {
      const pct = parsed === '' ? 0 : Math.max(0, parsed)
      // Convert % → integer absolute; clamp to totalBudget
      absoluteValue = Math.round((pct / 100) * totalBudgetNum)
    } else {
      // ABSOLUTE: integers only
      absoluteValue = parsed === '' ? 0 : Math.round(Math.max(0, parsed))
    }

    onRowChange(idx, { absoluteValue, revisionDismissed: true })
  }

  return (
    <div className="space-y-4">
      {/* ── Summary bar ── */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Budget</p>
          <p className="text-lg font-bold text-slate-900">{formatInr(totalBudget)}</p>
        </div>
        <div className="h-8 w-px bg-slate-200" />
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Remaining Unallocated</p>
          <p className={`text-lg font-bold ${remainingOk ? 'text-emerald-700' : remainingNegative ? 'text-red-600' : 'text-amber-700'
            }`}>
            {formatInr(remaining)}
          </p>
        </div>
        <div className="ml-auto text-xs text-slate-500">
          Allocated: {formatInr(allocatedSum)}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">
                <div className="flex items-center gap-3">
                  <span>Budget</span>
                  {!readOnly && onInputModeChange && (
                    <ModeToggle inputMode={inputMode} onChange={onInputModeChange} />
                  )}
                </div>
              </th>
              <th className="px-4 py-3 font-medium">Comment</th>
              {!readOnly && <th className="w-12 px-4 py-3 font-medium" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, idx) => {
              const showRevision = row.markedForRevision && !row.revisionDismissed
              const absVal = row.absoluteValue ?? 0

              return (
                <tr key={row.key} className={showRevision ? 'bg-red-50' : 'bg-white'}>
                  {/* Department cell */}
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

                  {/* Budget cell */}
                  <td className="px-4 py-3 align-top">
                    {readOnly ? (
                      <div>
                        <span className="font-medium text-slate-800">
                          {formatInr(row.allocatedAmount ?? row.absoluteValue)}
                        </span>
                        {totalBudgetNum > 0 && (
                          <p className="mt-0.5 text-xs text-slate-400">
                            {Number((((row.allocatedAmount ?? row.absoluteValue ?? 0) / totalBudgetNum) * 100).toFixed(2))}%
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400">
                            {inputMode === 'PERCENTAGE' ? '%' : '₹'}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step={inputMode === 'PERCENTAGE' ? '0.01' : '1'}
                            value={displayValue(row)}
                            onChange={(e) => handleInput(idx, e.target.value)}
                            className="w-32 rounded-lg border border-slate-200 px-3 py-1.5 text-sm
                                       shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                            placeholder={inputMode === 'PERCENTAGE' ? '0.00' : '0'}
                          />
                        </div>
                        {/* Always show the absolute equivalent as hint */}
                        <p className="mt-1 text-xs text-slate-400">
                          {inputMode === 'PERCENTAGE'
                            ? `= ${formatInr(absVal)}`
                            : totalBudgetNum > 0
                              ? `${Number(((absVal / totalBudgetNum) * 100).toFixed(2))}%`
                              : null}
                        </p>
                      </div>
                    )}
                  </td>

                  {/* Comment cell */}
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

                  {/* Remove button */}
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
    </div>
  )
}

// ─── Legacy hook (still exported so BudgetPlanningPage readonly view compiles) ─
export function useBudgetTotals(totalBudget, rows) {
  return useMemo(() => {
    const total = parseAmount(totalBudget)
    const allocatedSum = rows.reduce((acc, r) => acc + (r.allocatedAmount ?? r.absoluteValue ?? 0), 0)
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
