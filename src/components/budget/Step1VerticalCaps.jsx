import React, { useState } from 'react';

export default function Step1VerticalCaps({
  financialYear,
  setFinancialYear,
  totalAnnualBudget,
  setTotalAnnualBudget,
  verticals,
  verticalCaps,
  setVerticalCaps,
  quarterlyCaps,
  setQuarterlyCaps,
  isFrozen,
  onFreeze,
  onUnfreeze,
  freezing,
  isReadOnly
}) {
  const [isVerticalsFrozen, setIsVerticalsFrozen] = useState(false);

  const financialYears = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const startYear = currentMonth < 3 ? currentYear - 1 : currentYear;
    
    return Array.from({ length: 6 }, (_, i) => {
      const y1 = startYear + i;
      const y2 = (y1 + 1).toString().slice(-2);
      return `FY ${y1}-${y2}`;
    });
  }, []);

  const totalAllocatedCaps = Object.values(verticalCaps).reduce((sum, val) => sum + (val || 0), 0);
  const remainingUnallocated = totalAnnualBudget - totalAllocatedCaps;
  const isOverAllocated = remainingUnallocated < 0;

  const handleCapChange = (verticalId, value) => {
    setVerticalCaps(prev => ({
      ...prev,
      [verticalId]: Number(value)
    }));
  };

  const handleQuarterChange = (q, verticalId, value) => {
    setQuarterlyCaps(prev => ({
      ...prev,
      [q]: {
        ...prev[q],
        [verticalId]: Number(value)
      }
    }));
  };

  const handleSplitEvenly = (verticalId) => {
    const total = verticalCaps[verticalId] || 0;
    const split = Math.round(total / 4);
    const q4Split = total - (split * 3); // absorb remainder
    
    setQuarterlyCaps(prev => ({
      ...prev,
      Q1: { ...prev.Q1, [verticalId]: split },
      Q2: { ...prev.Q2, [verticalId]: split },
      Q3: { ...prev.Q3, [verticalId]: split },
      Q4: { ...prev.Q4, [verticalId]: q4Split }
    }));
  };

  const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 transition";
  
  return (
    <div className="space-y-6">
      
      {/* Total Budget Card */}
      <section className="rounded-xl border border-slate-200 border-l-4 border-l-brand-500 bg-brand-50/20">
        <div className="px-5 py-4 border-b border-slate-200/60 bg-white/50 rounded-t-xl flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
          <h4 className="text-sm font-semibold text-slate-800">Global Budget Setup</h4>
          
          {isFrozen && (
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Total Annual Budget</span>
                <span className="font-semibold text-slate-800">₹{totalAnnualBudget.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Allocated (Sum of Caps)</span>
                <span className="font-semibold text-slate-800">₹{totalAllocatedCaps.toLocaleString()}</span>
              </div>
              <div className={`text-right ${isOverAllocated ? 'text-red-600' : 'text-emerald-600'}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5">Remaining Unallocated</span>
                <span className="font-semibold">₹{remainingUnallocated.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-5 flex flex-col md:flex-row gap-6 md:items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
              Financial Year <span className="text-red-400 ml-0.5">*</span>
            </label>
            <select
              className={inputClass}
              value={financialYear || ''}
              onChange={(e) => setFinancialYear(e.target.value)}
              disabled={isFrozen}
            >
              <option value="" disabled>Select Financial Year</option>
              {financialYears.map(fy => (
                <option key={fy} value={fy}>{fy}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
              Total Annual Budget <span className="text-red-400 ml-0.5">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-slate-400 sm:text-sm font-medium">₹</span>
              </div>
              <input
                type="number"
                className={`${inputClass} pl-8`}
                placeholder="0.00"
                value={totalAnnualBudget || ''}
                onChange={(e) => setTotalAnnualBudget(Number(e.target.value))}
                onWheel={(e) => e.target.blur()}
                disabled={isFrozen}
              />
            </div>
          </div>
          <div>
            {!isFrozen ? (
              <button 
                onClick={onFreeze} 
                disabled={!financialYear || !totalAnnualBudget || freezing}
                className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition disabled:opacity-50 h-10 w-full md:w-auto"
              >
                {freezing ? 'Freezing...' : 'Freeze Annual Budget'}
              </button>
            ) : !isReadOnly && (
              <button 
                onClick={onUnfreeze}
                className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition h-10 w-full md:w-auto"
              >
                Edit / Unfreeze
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Vertical Caps */}
      <section className={`rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 ${!isFrozen ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Business Vertical Limits</h4>
            <p className="text-xs text-slate-500 mt-1">Set maximum annual caps for each vertical.</p>
          </div>
          {!isFrozen && (
            <span className="inline-flex items-center rounded-md bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
              Enter and freeze your annual budget to unlock vertical allocations.
            </span>
          )}
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {verticals.map(vertical => (
            <div key={vertical.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 transition hover:border-brand-300">
              <h3 className="text-sm font-semibold text-slate-800 mb-3 truncate" title={vertical.name}>
                {vertical.name}
              </h3>
              <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                Annual Cap
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-slate-400 sm:text-sm font-medium">₹</span>
                </div>
                <input
                  type="number"
                  className={`${inputClass} pl-8`}
                  placeholder="0"
                  value={verticalCaps[vertical.id] || ''}
                  onChange={(e) => handleCapChange(vertical.id, e.target.value)}
                  onWheel={(e) => e.target.blur()}
                  disabled={!isFrozen || isReadOnly || isVerticalsFrozen}
                />
              </div>
            </div>
          ))}
        </div>
        {isFrozen && !isReadOnly && (
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end">
                <button
                    onClick={() => setIsVerticalsFrozen(!isVerticalsFrozen)}
                    className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-900 transition"
                >
                    {isVerticalsFrozen ? 'Edit Annual Caps' : 'Confirm Annual Caps'}
                </button>
            </div>
        )}
      </section>

      {/* Quarterly Distribution Grid */}
      <section className={`rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 ${!isVerticalsFrozen && !isReadOnly ? 'hidden' : 'block'}`}>
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Quarterly Distribution</h4>
            <p className="text-xs text-slate-500 mt-1">Distribute the vertical caps across the 4 quarters.</p>
          </div>
        </div>
        <div className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="px-5 py-3 font-semibold text-slate-800">Vertical</th>
                        <th className="px-3 py-3 font-semibold text-slate-800 w-32">Q1</th>
                        <th className="px-3 py-3 font-semibold text-slate-800 w-32">Q2</th>
                        <th className="px-3 py-3 font-semibold text-slate-800 w-32">Q3</th>
                        <th className="px-3 py-3 font-semibold text-slate-800 w-32">Q4</th>
                        <th className="px-5 py-3 font-semibold text-slate-800 w-32">Total</th>
                        {!isReadOnly && <th className="px-5 py-3 font-semibold text-slate-800 w-32">Actions</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {verticals.map(vertical => {
                        const q1 = quarterlyCaps.Q1?.[vertical.id] || 0;
                        const q2 = quarterlyCaps.Q2?.[vertical.id] || 0;
                        const q3 = quarterlyCaps.Q3?.[vertical.id] || 0;
                        const q4 = quarterlyCaps.Q4?.[vertical.id] || 0;
                        const sum = q1 + q2 + q3 + q4;
                        const annualCap = verticalCaps[vertical.id] || 0;
                        const isValid = sum === annualCap;

                        return (
                            <tr key={vertical.id} className="hover:bg-slate-50/50 transition">
                                <td className="px-5 py-3 font-medium text-slate-800">{vertical.name}</td>
                                <td className="px-3 py-3">
                                    <input type="number" className={`${inputClass} py-1.5`} value={q1 || ''} onChange={(e) => handleQuarterChange('Q1', vertical.id, e.target.value)} disabled={isReadOnly} />
                                </td>
                                <td className="px-3 py-3">
                                    <input type="number" className={`${inputClass} py-1.5`} value={q2 || ''} onChange={(e) => handleQuarterChange('Q2', vertical.id, e.target.value)} disabled={isReadOnly} />
                                </td>
                                <td className="px-3 py-3">
                                    <input type="number" className={`${inputClass} py-1.5`} value={q3 || ''} onChange={(e) => handleQuarterChange('Q3', vertical.id, e.target.value)} disabled={isReadOnly} />
                                </td>
                                <td className="px-3 py-3">
                                    <input type="number" className={`${inputClass} py-1.5`} value={q4 || ''} onChange={(e) => handleQuarterChange('Q4', vertical.id, e.target.value)} disabled={isReadOnly} />
                                </td>
                                <td className={`px-5 py-3 font-semibold ${isValid ? 'text-emerald-600' : 'text-red-600'}`}>
                                    ₹{sum.toLocaleString()} / ₹{annualCap.toLocaleString()}
                                </td>
                                {!isReadOnly && (
                                    <td className="px-5 py-3">
                                        <button 
                                            onClick={() => handleSplitEvenly(vertical.id)}
                                            disabled={isReadOnly || annualCap === 0}
                                            className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
                                        >
                                            Split Evenly
                                        </button>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      </section>

    </div>
  );
}
