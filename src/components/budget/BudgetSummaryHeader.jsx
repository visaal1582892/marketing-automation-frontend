import React from 'react';
import Icon from '../Icon';

export default function BudgetSummaryHeader({ totalAnnualBudget, totalAllocated }) {
  const remaining = (totalAnnualBudget || 0) - (totalAllocated || 0);
  const isOverAllocated = remaining < 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-800">Budget Tracker</h2>
          <p className="text-xs text-slate-500">Live monitoring of your allocations</p>
        </div>
      </div>
      
      <div className="flex items-center divide-x divide-slate-200">
        <div className="px-6 text-right">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Total Annual Budget</p>
          <p className="text-lg font-bold text-slate-800">₹{(totalAnnualBudget || 0).toLocaleString()}</p>
        </div>
        <div className="px-6 text-right">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Total Allocated</p>
          <p className="text-lg font-bold text-brand-600">₹{(totalAllocated || 0).toLocaleString()}</p>
        </div>
        <div className="pl-6 text-right">
          <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${isOverAllocated ? 'text-red-400' : 'text-emerald-500'}`}>
            Remaining Unallocated
          </p>
          <p className={`text-lg font-bold ${isOverAllocated ? 'text-red-600' : 'text-emerald-600'}`}>
            {isOverAllocated ? '-' : ''}₹{Math.abs(remaining).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
