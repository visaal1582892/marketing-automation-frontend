import React, { useState, useEffect } from 'react';
import SearchableSelect from '../common/SearchableSelect';

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
  isReadOnly,
  proposalType,
  urlFinancialYear
}) {
  const [isVerticalsFrozen, setIsVerticalsFrozen] = useState(false);
  const [activeMobileVerticalId, setActiveMobileVerticalId] = useState(verticals && verticals.length > 0 ? verticals[0].id : null);

  useEffect(() => {
    if (verticals.length > 0 && !activeMobileVerticalId) {
      setActiveMobileVerticalId(verticals[0].id);
    }
  }, [verticals, activeMobileVerticalId]);

  useEffect(() => {
    if (proposalType === 'TOP_UP' && urlFinancialYear && !financialYear) {
      setFinancialYear(urlFinancialYear);
    }
  }, [proposalType, urlFinancialYear, financialYear, setFinancialYear]);

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
    if (value && Number(value) > 999999999999) return;
    setVerticalCaps(prev => ({
      ...prev,
      [verticalId]: Number(value)
    }));
  };

  const handleQuarterChange = (q, verticalId, value) => {
    if (value && Number(value) > 999999999999) return;
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

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

  return (
    <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar space-y-6 pb-8">

      {/* =========================================================
        1. GLOBAL BUDGET SETUP
       ========================================================= */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        {/* Header */}
        <div className="border-b border-slate-100 bg-gradient-to-r from-brand-50/70 via-white to-white px-3 py-3.5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                  <span className="text-sm font-bold">₹</span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-800 sm:text-base">
                    Global Budget Setup
                  </h4>
                </div>
              </div>
            </div>

            {/* Frozen indicator */}
            {isFrozen && (
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Budget Frozen
              </div>
            )}
          </div>
        </div>


        {/* Summary cards when frozen */}
        {isFrozen && !isReadOnly && (
          <div className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-slate-50/50 px-3 py-3.5 sm:grid-cols-3 sm:px-6">

            {/* Annual Budget */}
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3.5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Annual Budget
              </p>

              <p className="mt-1.5 text-lg font-bold tracking-tight text-slate-800">
                ₹{totalAnnualBudget.toLocaleString()}
              </p>
            </div>

            {/* Allocated */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Allocated
              </p>

              <p className="mt-1.5 text-lg font-bold tracking-tight text-slate-800">
                ₹{totalAllocatedCaps.toLocaleString()}
              </p>
            </div>

            {/* Remaining */}
            <div
              className={`rounded-xl border px-3 py-3.5 shadow-sm ${isOverAllocated
                ? "border-red-200 bg-red-50/50"
                : "border-emerald-200 bg-emerald-50/50"
                }`}
            >
              <p
                className={`text-[10px] font-bold uppercase tracking-wider ${isOverAllocated ? "text-red-500" : "text-emerald-600"
                  }`}
              >
                Remaining
              </p>

              <p
                className={`mt-1.5 text-lg font-bold tracking-tight ${isOverAllocated ? "text-red-600" : "text-emerald-600"
                  }`}
              >
                ₹{remainingUnallocated.toLocaleString()}
              </p>
            </div>

          </div>
        )}


        {/* Form */}
        <div className="p-4 sm:p-6">

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">

            {/* Financial Year */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Financial Year
                <span className="ml-1 text-red-500">*</span>
              </label>

              <select
                className={inputClass}
                value={financialYear || ""}
                onChange={(e) => setFinancialYear(e.target.value)}
                disabled={isFrozen || proposalType === 'TOP_UP'}
              >
                <option value="" disabled>
                  Select Financial Year
                </option>

                {proposalType === 'TOP_UP' && urlFinancialYear && !financialYears.includes(urlFinancialYear) && (
                  <option key={urlFinancialYear} value={urlFinancialYear}>
                    {urlFinancialYear}
                  </option>
                )}

                {financialYears.map((fy) => (
                  <option key={fy} value={fy}>
                    {fy}
                  </option>
                ))}
              </select>
            </div>


            {/* Annual Budget */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Annual Budget
                <span className="ml-1 text-red-500">*</span>
              </label>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <span className="font-semibold text-slate-400">₹</span>
                </div>

                <input
                  type="number"
                  className={`${inputClass} pl-9`}
                  placeholder="Enter annual budget"
                  value={totalAnnualBudget || ""}
                  onChange={(e) => {
                    if (
                      e.target.value &&
                      Number(e.target.value) > 999999999999
                    )
                      return;

                    setTotalAnnualBudget(Number(e.target.value));
                  }}
                  onWheel={(e) => e.target.blur()}
                  disabled={isFrozen || isReadOnly}
                />
              </div>
            </div>


            {/* Freeze / Edit */}
            <div className="w-full lg:w-auto">

              {!isFrozen ? (
                <button
                  onClick={onFreeze}
                  disabled={!financialYear || !totalAnnualBudget || freezing}
                  className="
                  flex h-[43px] w-full items-center justify-center
                  rounded-xl bg-brand-600 px-5
                  text-sm font-semibold text-white
                  shadow-sm transition-all
                  hover:bg-brand-700 hover:shadow-md
                  active:scale-[0.98]
                  disabled:cursor-not-allowed disabled:opacity-50
                  lg:w-auto
                "
                >
                  {freezing ? "Freezing..." : "Freeze Annual Budget"}
                </button>
              ) : (
                !isReadOnly && (
                  <button
                    onClick={onUnfreeze}
                    className="
                    flex h-[43px] w-full items-center justify-center
                    rounded-xl border border-slate-200
                    bg-white px-5
                    text-sm font-semibold text-slate-700
                    shadow-sm transition-all
                    hover:border-slate-300 hover:bg-slate-50
                    active:scale-[0.98]
                    lg:w-auto
                  "
                  >
                    Edit / Unfreeze
                  </button>
                )
              )}

            </div>

          </div>

        </div>
      </section>


      {/* =========================================================
        2. BUSINESS VERTICAL CAPS
       ========================================================= */}
      {!isReadOnly && (
        <section
          className={`
        overflow-hidden rounded-2xl border border-slate-200
        bg-white shadow-sm transition-all duration-300
        ${!isFrozen ? "opacity-60" : ""}
      `}
        >

          {/* Section Header */}
          <div className="border-b border-slate-100 px-3 py-3.5 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-800 sm:text-base">
                    Business Vertical Limits
                  </h4>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  Set the maximum annual budget for each business vertical.
                </p>
              </div>


              {!isFrozen && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-700">
                  <span className="mt-0.5">⚠</span>

                  <span>
                    Freeze the annual budget to unlock vertical allocations.
                  </span>
                </div>
              )}

            </div>
          </div>


          {/* Vertical Cards */}
          <div className="grid grid-cols-1 gap-3 px-3 py-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">

            {verticals.map((vertical) => (
              <div
                key={vertical.id}
                className="
              group rounded-2xl
              border border-slate-200
              bg-slate-50/50
              px-3 py-4 sm:p-5
              transition-all
              hover:-translate-y-0.5
              hover:border-brand-200
              hover:bg-white
              hover:shadow-md
            "
              >

                {/* Vertical name */}
                <div className="mb-4 flex items-center justify-between gap-3">

                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Business Vertical
                    </p>

                    <h3
                      className="mt-1 truncate text-sm font-bold text-slate-800"
                      title={vertical.name}
                    >
                      {vertical.name}
                    </h3>
                  </div>

                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-brand-600 shadow-sm ring-1 ring-slate-100">
                    ₹
                  </div>

                </div>


                {/* Annual cap */}
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Annual Cap
                </label>

                <div className="relative">

                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <span className="font-semibold text-slate-400">₹</span>
                  </div>

                  <input
                    type="number"
                    className={`${inputClass} pl-9`}
                    placeholder="0"
                    value={verticalCaps[vertical.id] || ""}
                    onChange={(e) =>
                      handleCapChange(vertical.id, e.target.value)
                    }
                    onWheel={(e) => e.target.blur()}
                    disabled={
                      !isFrozen ||
                      isReadOnly ||
                      isVerticalsFrozen
                    }
                  />

                </div>

              </div>
            ))}

          </div>


          {/* Confirm Caps */}
          {isFrozen && !isReadOnly && (
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/50 px-3 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">

              <p className="text-xs text-slate-500">
                {isVerticalsFrozen
                  ? "Annual caps are confirmed. Continue to quarterly distribution."
                  : "Review the annual caps before confirming them."}
              </p>

              <button
                onClick={() =>
                  setIsVerticalsFrozen(!isVerticalsFrozen)
                }
                className={`
              h-10 rounded-xl px-5 text-sm font-semibold
              shadow-sm transition-all active:scale-[0.98]
              ${isVerticalsFrozen
                    ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    : "bg-slate-800 text-white hover:bg-slate-900"
                  }
            `}
              >
                {isVerticalsFrozen
                  ? "Edit Annual Caps"
                  : "Confirm Annual Caps"}
              </button>

            </div>
          )}

        </section>
      )}


      {/* =========================================================
        3. QUARTERLY DISTRIBUTION
       ========================================================= */}
      <section
        className={`
        overflow-hidden rounded-2xl border border-slate-200
        bg-white shadow-sm
        ${!isVerticalsFrozen && !isReadOnly
            ? "hidden"
            : "block"
          }
      `}
      >

        {/* Header */}
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-3 py-3.5 sm:px-6">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-800 sm:text-base">
                  Quarterly Distribution
                </h4>
              </div>

            </div>

          </div>
        </div>


        {/* ================= DESKTOP TABLE ================= */}
        <div className="hidden overflow-x-auto md:block">

          <table className="w-full min-w-[900px] border-collapse text-left text-sm">

            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">

                <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Business Vertical
                </th>

                <th className="px-3 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                  Q1
                </th>

                <th className="px-3 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                  Q2
                </th>

                <th className="px-3 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                  Q3
                </th>

                <th className="px-3 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                  Q4
                </th>

                {!isReadOnly && (
                  <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                    Allocation
                  </th>
                )}

                {!isReadOnly && (
                  <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                    Action
                  </th>
                )}

              </tr>
            </thead>


            <tbody className="divide-y divide-slate-100">

              {verticals.map((vertical) => {

                const q1 =
                  quarterlyCaps.Q1?.[vertical.id] || 0;

                const q2 =
                  quarterlyCaps.Q2?.[vertical.id] || 0;

                const q3 =
                  quarterlyCaps.Q3?.[vertical.id] || 0;

                const q4 =
                  quarterlyCaps.Q4?.[vertical.id] || 0;

                const sum = q1 + q2 + q3 + q4;

                const annualCap =
                  verticalCaps[vertical.id] || 0;

                const isValid = sum === annualCap;

                return (
                  <tr
                    key={vertical.id}
                    className="group transition-colors hover:bg-slate-50/70"
                  >

                    {/* Vertical */}
                    <td className="px-5 py-4">

                      <div className="max-w-[180px]">
                        <p
                          className="truncate font-semibold text-slate-800"
                          title={vertical.name}
                        >
                          {vertical.name}
                        </p>

                        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                          Annual cap: ₹{annualCap.toLocaleString()}
                        </p>
                      </div>

                    </td>


                    {/* Q1 */}
                    <td className="px-3 py-4">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                          ₹
                        </span>

                        <input
                          type="number"
                          className={`${inputClass} h-10 min-w-[115px] pl-7 text-right`}
                          value={q1 || ""}
                          onChange={(e) =>
                            handleQuarterChange(
                              "Q1",
                              vertical.id,
                              e.target.value
                            )
                          }
                          disabled={isReadOnly}
                        />
                      </div>
                    </td>


                    {/* Q2 */}
                    <td className="px-3 py-4">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                          ₹
                        </span>

                        <input
                          type="number"
                          className={`${inputClass} h-10 min-w-[115px] pl-7 text-right`}
                          value={q2 || ""}
                          onChange={(e) =>
                            handleQuarterChange(
                              "Q2",
                              vertical.id,
                              e.target.value
                            )
                          }
                          disabled={isReadOnly}
                        />
                      </div>
                    </td>


                    {/* Q3 */}
                    <td className="px-3 py-4">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                          ₹
                        </span>

                        <input
                          type="number"
                          className={`${inputClass} h-10 min-w-[115px] pl-7 text-right`}
                          value={q3 || ""}
                          onChange={(e) =>
                            handleQuarterChange(
                              "Q3",
                              vertical.id,
                              e.target.value
                            )
                          }
                          disabled={isReadOnly}
                        />
                      </div>
                    </td>


                    {/* Q4 */}
                    <td className="px-3 py-4">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                          ₹
                        </span>

                        <input
                          type="number"
                          className={`${inputClass} h-10 min-w-[115px] pl-7 text-right`}
                          value={q4 || ""}
                          onChange={(e) =>
                            handleQuarterChange(
                              "Q4",
                              vertical.id,
                              e.target.value
                            )
                          }
                          disabled={isReadOnly}
                        />
                      </div>
                    </td>


                    {/* Total */}
                    {!isReadOnly && (
                      <td className="px-5 py-4">

                        <div
                          className={`
                          rounded-xl border px-3 py-2 text-center
                          ${isValid
                              ? "border-emerald-100 bg-emerald-50"
                              : "border-red-100 bg-red-50"
                            }
                        `}
                        >
                          <p
                            className={`text-xs font-bold ${isValid
                              ? "text-emerald-700"
                              : "text-red-700"
                              }`}
                          >
                            ₹{sum.toLocaleString()}
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-400">
                            of ₹{annualCap.toLocaleString()}
                          </p>
                        </div>

                      </td>
                    )}


                    {/* Action */}
                    {!isReadOnly && (
                      <td className="px-5 py-4 text-right">

                        <button
                          onClick={() =>
                            handleSplitEvenly(vertical.id)
                          }
                          disabled={
                            isReadOnly || annualCap === 0
                          }
                          className="
                          rounded-lg border border-brand-100
                          bg-brand-50 px-3 py-2
                          text-xs font-semibold text-brand-600
                          transition-all
                          hover:border-brand-200
                          hover:bg-brand-100
                          disabled:cursor-not-allowed
                          disabled:opacity-40
                        "
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


        {/* ================= MOBILE ================= */}
        <div className="md:hidden flex flex-col px-2 py-4 sm:p-5">
          <div className="mb-4 space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Select Business Vertical
            </label>
            <SearchableSelect
              options={verticals.map(v => ({ value: v.id, label: v.name }))}
              value={activeMobileVerticalId || ''}
              onChange={setActiveMobileVerticalId}
              placeholder="Select a vertical..."
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            {verticals.filter(v => String(v.id) === String(activeMobileVerticalId)).map((vertical) => {

              const q1 = quarterlyCaps.Q1?.[vertical.id] || 0;
              const q2 = quarterlyCaps.Q2?.[vertical.id] || 0;
              const q3 = quarterlyCaps.Q3?.[vertical.id] || 0;
              const q4 = quarterlyCaps.Q4?.[vertical.id] || 0;
              const sum = q1 + q2 + q3 + q4;
              const annualCap = verticalCaps[vertical.id] || 0;
              const isValid = sum === annualCap;

              return (
                <div key={vertical.id} className="space-y-4 px-3.5 py-4 sm:p-5">

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Annual Cap
                      </p>
                      <p className="mt-0.5 text-lg font-bold text-slate-800">
                        ₹{annualCap.toLocaleString()}
                      </p>
                    </div>

                    {!isReadOnly && (
                      <button
                        onClick={() => handleSplitEvenly(vertical.id)}
                        disabled={isReadOnly || annualCap === 0}
                        className="shrink-0 rounded-lg border border-brand-100 bg-brand-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-600 transition hover:bg-brand-100 disabled:opacity-40"
                      >
                        Split Evenly
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {[["Q1", q1], ["Q2", q2], ["Q3", q3], ["Q4", q4]].map(([quarter, value]) => (
                      <div key={quarter}>
                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {quarter}
                        </label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                            ₹
                          </span>
                          <input
                            type="number"
                            className={`${inputClass} h-11 pl-7 text-sm font-semibold`}
                            value={value || ""}
                            onChange={(e) => handleQuarterChange(quarter, vertical.id, e.target.value)}
                            disabled={isReadOnly}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {!isReadOnly && (
                    <div className={`mt-2 rounded-xl border p-3.5 ${isValid ? "border-emerald-100 bg-emerald-50" : "border-red-100 bg-red-50"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${isValid ? "text-emerald-600" : "text-red-600"}`}>
                            Allocation
                          </p>
                          <p className={`mt-0.5 text-base font-bold ${isValid ? "text-emerald-700" : "text-red-700"}`}>
                            ₹{sum.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                            Annual Cap
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-slate-700">
                            ₹{annualCap.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/80">
                        <div
                          className={`h-full rounded-full transition-all ${isValid ? "bg-emerald-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(annualCap > 0 ? (sum / annualCap) * 100 : 0, 100)}%` }}
                        />
                      </div>

                      <p className={`mt-2.5 text-[10px] font-semibold ${isValid ? "text-emerald-600" : "text-red-600"}`}>
                        {isValid ? "✓ Quarterly allocation matches annual cap." : `! Difference: ₹${Math.abs(annualCap - sum).toLocaleString()}`}
                      </p>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </div>

      </section>

    </div>
  );
}
