import Icon from '../../../components/Icon'

export default function BudgetFinancialsReport({ data, loading }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Icon name="loader" className="h-8 w-8 animate-spin text-emerald-500 mb-4" />
        <p className="text-sm text-slate-500">Loading Budget & Financials...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="bg-emerald-50 p-4 rounded-full mb-6">
        <Icon name="currencyDollar" className="h-10 w-10 text-emerald-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Budget & Financials Overview</h2>
      <p className="text-slate-500 max-w-md mx-auto leading-relaxed">
        The financial data pipeline linking marketing campaigns to budget allocations is currently under construction.
        <br /><br />
        Check back soon to monitor your department's spending, budget utilization, and financial ROI!
      </p>
    </div>
  );
}
