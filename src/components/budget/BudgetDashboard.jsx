import Icon from '../Icon'
import HasRight from '../HasRight'
import { Rights } from '../../constants/rights'
import { formatInr, STATUS_LABELS } from '../../utils/budgetHelpers'

function StatusBadge({ status }) {
  const meta = STATUS_LABELS[status] ?? STATUS_LABELS.DRAFT
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.cls}`}>
      {meta.label}
    </span>
  )
}

export default function BudgetDashboard({
  proposals,
  loading,
  selectedId,
  onSelect,
  onNew,
  onClone,
  cloningId,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Budget Proposals</h2>
          <p className="text-xs text-slate-500">Financial year planning and approvals</p>
        </div>
        <HasRight right={Rights.PROPOSE_BUDGET}>
          <button
            type="button"
            onClick={onNew}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm
                       font-medium text-white shadow-sm transition hover:bg-brand-700"
          >
            <Icon name="plus" className="h-4 w-4" />
            New Proposal
          </button>
        </HasRight>
      </div>

      {loading ? (
        <div className="px-5 py-10 text-center text-sm text-slate-500">Loading proposals…</div>
      ) : proposals.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-slate-500">
          No budget proposals yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">FY</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Updated</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {proposals.map(p => (
                <tr
                  key={p.id}
                  className={`cursor-pointer transition hover:bg-slate-50/80 ${
                    selectedId === p.id ? 'bg-brand-50/60' : ''
                  }`}
                  onClick={() => onSelect(p.id)}
                >
                  <td className="px-5 py-3 font-medium text-slate-800">{p.financialYear}</td>
                  <td className="px-5 py-3 text-slate-700">{formatInr(p.totalAmount)}</td>
                  <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-5 py-3 text-slate-500">
                    {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <HasRight right={Rights.PROPOSE_BUDGET}>
                      <button
                        type="button"
                        disabled={cloningId === p.id}
                        onClick={(e) => { e.stopPropagation(); onClone(p.id) }}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200
                                   bg-white px-2.5 py-1 text-xs font-medium text-slate-700
                                   transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Icon name="refresh" className="h-3.5 w-3.5" />
                        {cloningId === p.id ? 'Cloning…' : 'Clone'}
                      </button>
                    </HasRight>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
