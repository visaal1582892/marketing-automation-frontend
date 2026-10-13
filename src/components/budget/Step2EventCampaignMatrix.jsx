import React, { useEffect, useMemo, useState } from 'react'
import SingleSelectDropdown from '../SingleSelectDropdown'

export default function Step2EventCampaignMatrix({
  verticals = [],
  eventCategories = [],
  step2Matrix = {},
  setStep2Matrix,
  verticalCaps = {},
  isReadOnly = false,
  activePeriod
}) {
  // Mobile: only one vertical is displayed at a time.
  const [selectedVerticalId, setSelectedVerticalId] = useState(
    verticals.length > 0 ? String(verticals[0].id) : ''
  )

  // Keep the selected vertical valid when the vertical list changes.
  useEffect(() => {
    if (verticals.length === 0) {
      setSelectedVerticalId('')
      return
    }

    const exists = verticals.some(
      (vertical) => String(vertical.id) === String(selectedVerticalId)
    )

    if (!exists) {
      setSelectedVerticalId(String(verticals[0].id))
    }
  }, [verticals, selectedVerticalId])

  // Check whether an Event Category is mapped to a Business Vertical.
  const isMapped = (verticalId, eventCategory) => {
    if (!eventCategory || !eventCategory.businessVerticalIds) return false

    return eventCategory.businessVerticalIds.some(
      (bvid) => String(bvid) === String(verticalId)
    )
  }

  const handleCellChange = (verticalId, eventCatId, value) => {
    if (value && Number(value) > 999999999999) return

    const valNum = value === '' ? '' : Math.max(0, Number(value))

    setStep2Matrix((prev) => ({
      ...prev,
      [verticalId]: {
        ...(prev[verticalId] || {}),
        [eventCatId]: valNum
      }
    }))
  }

  // Row total for a single vertical.
  const getRowTotal = (verticalId) => {
    const vMatrix = step2Matrix[verticalId] || {}

    return Object.values(vMatrix).reduce(
      (sum, val) => sum + (Number(val) || 0),
      0
    )
  }

  // Column total for a single event category.
  const getColTotal = (eventCatId) => {
    return verticals.reduce((sum, v) => {
      const val = step2Matrix[v.id]?.[eventCatId] || 0
      return sum + (Number(val) || 0)
    }, 0)
  }

  // Grand total.
  const grandTotal = verticals.reduce(
    (sum, v) => sum + getRowTotal(v.id),
    0
  )

  const grandCap = Object.values(verticalCaps).reduce(
    (sum, cap) => sum + (Number(cap) || 0),
    0
  )

  const balance = grandCap - grandTotal
  const isGrandTotalExceeded = grandTotal > grandCap

  const selectedVertical = useMemo(
    () =>
      verticals.find(
        (vertical) => String(vertical.id) === String(selectedVerticalId)
      ),
    [verticals, selectedVerticalId]
  )

  const selectedVerticalCap = selectedVertical
    ? verticalCaps[selectedVertical.id] || 0
    : 0

  const selectedVerticalTotal = selectedVertical
    ? getRowTotal(selectedVertical.id)
    : 0

  const selectedVerticalExceeded =
    selectedVerticalTotal > selectedVerticalCap

  const selectedVerticalRemaining =
    selectedVerticalCap - selectedVerticalTotal

  const inputClass =
    'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-right text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:text-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400'

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto md:overflow-visible space-y-4 sm:space-y-6 custom-scrollbar pb-6">
      {/* =========================
          SUMMARY
          ========================= */}
      {!isReadOnly && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          {/* Cap */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-row sm:flex-col justify-between items-center sm:items-start">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Vertical Cap
            </p>
            <p className="text-sm sm:text-lg font-bold tracking-tight text-slate-800 sm:mt-1.5">
              ₹{grandCap.toLocaleString()}
            </p>
          </div>

          {/* Matrix Budget */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-row sm:flex-col justify-between items-center sm:items-start">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Matrix Budget
            </p>
            <p className={`text-sm sm:text-lg font-bold tracking-tight sm:mt-1.5 ${isGrandTotalExceeded ? 'text-red-600' : 'text-brand-600'}`}>
              ₹{grandTotal.toLocaleString()}
            </p>
          </div>

          {/* Balance */}
          <div className={`rounded-xl border p-4 shadow-sm flex flex-row sm:flex-col justify-between items-center sm:items-start ${isGrandTotalExceeded ? 'bg-red-50/50 border-red-200' : 'bg-emerald-50/50 border-emerald-200'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${isGrandTotalExceeded ? 'text-red-500' : 'text-emerald-600'}`}>
              {isGrandTotalExceeded ? 'Exceeded By' : 'Balance'}
            </p>
            <p className={`text-sm sm:text-lg font-bold tracking-tight sm:mt-1.5 ${isGrandTotalExceeded ? 'text-red-600' : 'text-emerald-600'}`}>
              ₹{Math.abs(balance).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {verticals.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 shadow-sm">
          No business verticals configured.
        </div>
      ) : (
        <>
          {/* ==========================================================
              MOBILE VIEW
              One vertical is selected from a dropdown and only that
              vertical's mapped event categories are displayed.
              ========================================================== */}
          <div className="flex flex-col space-y-3 md:hidden">
            {/* Vertical selector */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <label
                htmlFor="step2-mobile-vertical"
                className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
              >
                Select Business Vertical
              </label>

              <div className="relative z-10">
                <SingleSelectDropdown
                  value={selectedVerticalId}
                  onChange={(val) => setSelectedVerticalId(val)}
                  options={verticals.map((v) => ({
                    value: String(v.id),
                    label: v.name,
                  }))}
                />
              </div>
            </div>

            {selectedVertical && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col">
                {/* Selected vertical summary */}
                <div className="border-b border-slate-200 bg-slate-50 px-3.5 py-3 shrink-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Selected Vertical
                      </p>

                      <h3 className="mt-0.5 truncate text-sm font-bold text-slate-900">
                        {selectedVertical.name}
                      </h3>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Cap
                      </p>

                      <p className="text-sm font-bold text-slate-800">
                        ₹{selectedVerticalCap.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {!isReadOnly && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                          Allocated
                        </p>

                        <p
                          className={`mt-0.5 text-sm font-bold ${selectedVerticalExceeded
                              ? 'text-red-600'
                              : 'text-slate-800'
                            }`}
                        >
                          ₹{selectedVerticalTotal.toLocaleString()}
                        </p>
                      </div>

                      <div
                        className={`rounded-lg border px-3 py-2 ${selectedVerticalExceeded
                            ? 'border-red-100 bg-red-50'
                            : 'border-emerald-100 bg-emerald-50'
                          }`}
                      >
                        <p
                          className={`text-[9px] font-bold uppercase tracking-wide ${selectedVerticalExceeded
                              ? 'text-red-500'
                              : 'text-emerald-600'
                            }`}
                        >
                          {selectedVerticalExceeded ? 'Exceeded By' : 'Remaining'}
                        </p>

                        <p
                          className={`mt-0.5 text-sm font-bold ${selectedVerticalExceeded
                              ? 'text-red-600'
                              : 'text-emerald-600'
                            }`}
                        >
                          ₹
                          {Math.abs(
                            selectedVerticalRemaining
                          ).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Event category allocation */}
                <div className="px-3.5 py-3">
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Event Category Budget
                    </p>

                    <p className="text-[9px] text-slate-400">
                      Enter amount
                    </p>
                  </div>

                  <div className="space-y-2">
                    {eventCategories.length === 0 ? (
                      <div className="rounded-lg bg-slate-50 px-3 py-5 text-center text-xs text-slate-400">
                        No event categories configured.
                      </div>
                    ) : (
                      eventCategories.map((ec) => {
                        const mapped = isMapped(selectedVertical.id, ec)
                        const cellVal =
                          step2Matrix[selectedVertical.id]?.[ec.id]
                          
                        if (isReadOnly && (!cellVal || cellVal === 0)) {
                          return null;
                        }

                        return (
                          <div
                            key={ec.id}
                            className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 ${mapped
                                ? 'border-slate-200 bg-white'
                                : 'border-slate-100 bg-slate-50'
                              }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-[11px] font-semibold leading-tight ${mapped
                                    ? 'text-slate-700'
                                    : 'text-slate-400'
                                  }`}
                                title={ec.name}
                              >
                                {ec.name}
                              </p>

                              {!mapped && (
                                <p className="mt-1 text-[9px] text-slate-400">
                                  Not mapped
                                </p>
                              )}
                            </div>

                            <div className="w-[90px] shrink-0">
                              {mapped ? (
                                <input
                                  type="number"
                                  min="0"
                                  className={`${inputClass} !h-8 !px-2 !text-xs`}
                                  placeholder="0"
                                  value={
                                    cellVal !== undefined ? cellVal : ''
                                  }
                                  onChange={(e) =>
                                    handleCellChange(
                                      selectedVertical.id,
                                      ec.id,
                                      e.target.value
                                    )
                                  }
                                  onWheel={(e) => e.target.blur()}
                                  disabled={isReadOnly}
                                  aria-label={`${selectedVertical.name} - ${ec.name}`}
                                />
                              ) : (
                                <div
                                  className="flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-xs font-medium text-slate-400"
                                  title="Not Mapped in Vertical-Event Category Mapping"
                                >
                                  —
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Selected vertical total */}
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3.5 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Vertical Total
                  </span>

                  <span
                    className={`text-sm font-bold ${selectedVerticalExceeded
                        ? 'text-red-600'
                        : 'text-slate-800'
                      }`}
                  >
                    ₹{selectedVerticalTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ==========================================================
              DESKTOP / TABLET VIEW
              Full matrix remains available from md breakpoint.
              ========================================================== */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:flex md:flex-col md:flex-1 md:min-h-0">
            <div className="custom-scrollbar flex-1 overflow-auto overscroll-contain">
              <table className="w-max min-w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-20 bg-slate-50">
                  <tr>
                    <th className="sticky left-0 z-30 min-w-[220px] bg-slate-50 px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-600 shadow-[1px_0_0_#e2e8f0,0_1px_0_#e2e8f0]">
                      Business Vertical
                    </th>

                    {eventCategories.map((ec) => (
                      <th
                        key={ec.id}
                        className="min-w-[140px] px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-600 shadow-[0_1px_0_#e2e8f0]"
                      >
                        <span className="block whitespace-normal leading-tight">
                          {ec.name}
                        </span>
                      </th>
                    ))}

                    <th className="sticky right-0 z-30 min-w-[160px] bg-slate-100 px-6 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-700 shadow-[-1px_0_0_#e2e8f0,0_1px_0_#e2e8f0]">
                      Total Budget
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {verticals.map((v) => {
                    const cap = verticalCaps[v.id] || 0
                    const rowTotal = getRowTotal(v.id)
                    const isExceeded = rowTotal > cap

                    return (
                      <tr
                        key={v.id}
                        className="group transition-colors hover:bg-slate-50/50"
                      >
                        <td className="sticky left-0 z-10 min-w-[220px] whitespace-nowrap bg-white px-6 py-4 shadow-[1px_0_0_#e2e8f0] group-hover:bg-slate-50/95">
                          <div className="text-sm font-semibold text-slate-900">
                            {v.name}
                          </div>

                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[11px] text-slate-400">
                              Cap: ₹{cap.toLocaleString()}
                            </span>

                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${isExceeded
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-100 text-emerald-700'
                                }`}
                            >
                              Sum: ₹{rowTotal.toLocaleString()}
                            </span>
                          </div>
                        </td>

                        {eventCategories.map((ec) => {
                          const mapped = isMapped(v.id, ec)
                          const cellVal = step2Matrix[v.id]?.[ec.id]

                          return (
                            <td
                              key={ec.id}
                              className="min-w-[140px] px-3 py-3 text-center"
                            >
                              {mapped ? (
                                <input
                                  type="number"
                                  min="0"
                                  className={`${inputClass} mx-auto max-w-[112px]`}
                                  placeholder="0"
                                  value={
                                    cellVal !== undefined ? cellVal : ''
                                  }
                                  onChange={(e) =>
                                    handleCellChange(
                                      v.id,
                                      ec.id,
                                      e.target.value
                                    )
                                  }
                                  onWheel={(e) => e.target.blur()}
                                  disabled={isReadOnly}
                                  aria-label={`${v.name} - ${ec.name}`}
                                />
                              ) : (
                                <div
                                  className="mx-auto flex w-28 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-100 py-2 text-xs font-mono text-slate-400"
                                  title="Not Mapped in Vertical-Event Category Mapping"
                                >
                                  0
                                </div>
                              )}
                            </td>
                          )
                        })}

                        <td className="sticky right-0 z-10 min-w-[160px] whitespace-nowrap bg-slate-50/95 px-6 py-4 text-right text-sm font-bold text-slate-800 shadow-[-1px_0_0_#e2e8f0] group-hover:bg-slate-100/95">
                          ₹{rowTotal.toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>

                <tfoot className="sticky bottom-0 z-20 bg-slate-50 font-bold shadow-[0_-1px_0_#e2e8f0]">
                  <tr>
                    <td className="sticky left-0 z-30 min-w-[220px] bg-slate-50 px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-600 shadow-[1px_0_0_#e2e8f0]">
                      Category Totals
                    </td>

                    {eventCategories.map((ec) => (
                      <td
                        key={ec.id}
                        className="min-w-[140px] px-4 py-4 text-center text-sm font-semibold text-slate-700"
                      >
                        ₹{getColTotal(ec.id).toLocaleString()}
                      </td>
                    ))}

                    <td className="sticky right-0 z-30 min-w-[160px] bg-brand-50 px-6 py-4 text-right text-base text-brand-700 shadow-[-1px_0_0_#e2e8f0]">
                      ₹{grandTotal.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}