import React from 'react'

export default function Step2EventCampaignMatrix({
  verticals = [],
  eventCategories = [],
  step2Matrix = {},
  setStep2Matrix,
  verticalCaps = {},
  isReadOnly = false,
  activePeriod
}) {

  // Helper to check if an Event Category is mapped to a Business Vertical
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

  // Row total for a single vertical
  const getRowTotal = (verticalId) => {
    const vMatrix = step2Matrix[verticalId] || {}
    return Object.values(vMatrix).reduce((sum, val) => sum + (Number(val) || 0), 0)
  }

  // Column total for a single event category
  const getColTotal = (eventCatId) => {
    return verticals.reduce((sum, v) => {
      const val = step2Matrix[v.id]?.[eventCatId] || 0
      return sum + (Number(val) || 0)
    }, 0)
  }

  // Grand total across all verticals & event categories
  const grandTotal = verticals.reduce((sum, v) => sum + getRowTotal(v.id), 0)
  const grandCap = Object.values(verticalCaps).reduce((sum, cap) => sum + (Number(cap) || 0), 0)

  const inputClass =
    'w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-right font-medium text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition shadow-sm'

  return (
    <div className="space-y-6">
      {isReadOnly && (
        <div className="flex justify-end -mb-2">
          <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md text-sm font-medium border border-blue-100 shadow-sm">
            Currently viewing <span className="font-bold">{activePeriod}</span> targets
          </div>
        </div>
      )}

      {/* Summary Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-sm">
        <div>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Total Vertical Cap (Step 1)
          </span>
          <p className="text-xl font-bold text-slate-800">
            ₹{grandCap.toLocaleString()}
          </p>
        </div>
        <div className="text-left md:text-center">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Total Matrix Budget
          </span>
          <p className="text-xl font-bold text-brand-600">
            ₹{grandTotal.toLocaleString()}
          </p>
        </div>
        <div className={`text-left md:text-right ${grandTotal > grandCap ? 'text-red-600' : 'text-emerald-600'}`}>
          <span className="text-[11px] font-bold uppercase tracking-wider block mb-1">
            Unallocated / Balance
          </span>
          <p className="text-xl font-bold">
            ₹{(grandCap - grandTotal).toLocaleString()}
          </p>
        </div>
      </div>

      {/* 2D Matrix Grid: Rows = Business Verticals, Columns = Event Categories */}
      <div className="rounded-xl border border-slate-200 shadow-sm bg-white overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[65vh] custom-scrollbar">
          <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
            <thead className="bg-slate-50 sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 bg-slate-50 z-30 px-6 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider min-w-[220px] shadow-[1px_0_0_#e2e8f0,0_1px_0_#e2e8f0]">
                  Business Vertical
                </th>
                {eventCategories.map((ec) => (
                  <th
                    key={ec.id}
                    className="px-4 py-3.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider min-w-[140px] shadow-[0_1px_0_#e2e8f0]"
                  >
                    {ec.name}
                  </th>
                ))}
                <th className="sticky right-0 bg-slate-100 z-30 px-6 py-3.5 text-right text-xs font-bold text-slate-700 uppercase tracking-wider min-w-[160px] shadow-[-1px_0_0_#e2e8f0,0_1px_0_#e2e8f0]">
                  Total Budget
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {verticals.length === 0 ? (
                <tr>
                  <td
                    colSpan={eventCategories.length + 2}
                    className="px-6 py-12 text-center text-slate-500 bg-slate-50/50"
                  >
                    No business verticals configured.
                  </td>
                </tr>
              ) : (
                verticals.map((v) => {
                  const cap = verticalCaps[v.id] || 0
                  const rowTotal = getRowTotal(v.id)
                  const isExceeded = rowTotal > cap

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors group">
                      {/* Vertical Row Header with Real-time Total */}
                      <td className="sticky left-0 bg-white group-hover:bg-slate-50/95 z-10 px-6 py-4 whitespace-nowrap shadow-[1px_0_0_#e2e8f0]">
                        <div className="font-semibold text-slate-900 text-sm">{v.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-slate-400">Cap: ₹{cap.toLocaleString()}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isExceeded ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            Sum: ₹{rowTotal.toLocaleString()}
                          </span>
                        </div>
                      </td>

                      {/* Event Category Cells */}
                      {eventCategories.map((ec) => {
                        const mapped = isMapped(v.id, ec)
                        const cellVal = step2Matrix[v.id]?.[ec.id]

                        return (
                          <td key={ec.id} className="px-3 py-3 text-center whitespace-nowrap">
                            {mapped ? (
                              <input
                                type="number"
                                min="0"
                                className={inputClass}
                                placeholder="0"
                                value={cellVal !== undefined ? cellVal : ''}
                                onChange={(e) => handleCellChange(v.id, ec.id, e.target.value)}
                                onWheel={(e) => e.target.blur()}
                                disabled={isReadOnly}
                              />
                            ) : (
                              <div
                                className="inline-flex items-center justify-center w-28 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-xs font-mono border border-slate-200/80 cursor-not-allowed select-none"
                                title="Not Mapped in Vertical-Event Category Mapping"
                              >
                                0
                              </div>
                            )}
                          </td>
                        )
                      })}

                      {/* Row Total Summary Column */}
                      <td className="sticky right-0 bg-slate-50/95 group-hover:bg-slate-100/95 z-10 px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800 text-right shadow-[-1px_0_0_#e2e8f0]">
                        ₹{rowTotal.toLocaleString()}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>

            {/* Footer Row for Column Totals and Grand Total */}
            <tfoot className="bg-slate-50 font-bold sticky bottom-0 z-20 shadow-[0_-1px_0_#e2e8f0]">
              <tr>
                <td className="sticky left-0 bg-slate-50 z-30 px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-600 shadow-[1px_0_0_#e2e8f0]">
                  Category Totals
                </td>
                {eventCategories.map((ec) => (
                  <td key={ec.id} className="px-4 py-4 text-center text-sm font-semibold text-slate-700">
                    ₹{getColTotal(ec.id).toLocaleString()}
                  </td>
                ))}
                <td className="sticky right-0 bg-brand-50 z-30 px-6 py-4 text-right text-base text-brand-700 shadow-[-1px_0_0_#e2e8f0]">
                  ₹{grandTotal.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
