import Icon from '../Icon'
import { formatInr } from '../../utils/budgetHelpers'

export default function HeadBudgetWidget({ data, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Loading your department budget…
      </div>
    )
  }

  if (!data?.hasAllocation) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <Icon name="dollar" className="h-6 w-6 text-slate-400" />
        </div>
        <h2 className="text-base font-semibold text-slate-800">No Approved Budget Yet</h2>
        <p className="mt-2 text-sm text-slate-500">
          No approved budget allocated for your department yet.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 bg-gradient-to-r from-brand-50 to-white px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
          Approved Department Budget
        </p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">{data.departmentName}</h2>
        <p className="text-sm text-slate-500">Financial Year {data.financialYear}</p>
      </div>
      <div className="grid gap-4 p-6 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Your Allocation</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatInr(data.allocatedAmount)}</p>
          {data.percentage && data.percentageValue != null && (
            <p className="mt-1 text-xs text-slate-500">{data.percentageValue}% of total budget</p>
          )}
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Company Total (FY)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatInr(data.totalProposalAmount)}</p>
        </div>
      </div>
      {data.plannerComment && (
        <div className="border-t border-slate-100 px-6 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Planner Note</p>
          <p className="mt-1 text-sm text-slate-700">{data.plannerComment}</p>
        </div>
      )}
    </div>
  )
}
