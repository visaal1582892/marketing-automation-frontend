import React, { useState } from 'react';

export default function Step2EventCampaignMatrix({
  verticals,
  eventCategories,
  campaignTypes,
  step2Matrix,
  setStep2Matrix,
  verticalCaps,
  isReadOnly,
  activePeriod
}) {
  const [activeVertical, setActiveVertical] = useState(verticals[0]?.id);

  const handleCellChange = (verticalId, eventCatId, campTypeId, value) => {
    setStep2Matrix(prev => ({
      ...prev,
      [verticalId]: {
        ...(prev[verticalId] || {}),
        [`${eventCatId}_${campTypeId}`]: Number(value)
      }
    }));
  };

  const currentVerticalMatrix = step2Matrix[activeVertical] || {};
  
  const visibleEventCategories = eventCategories.filter(category => category.businessVerticalIds?.includes(activeVertical));
  const visibleCampaignTypes = campaignTypes.filter(campaign => 
    campaign.status === 'ACTIVE' && 
    campaign.eventCategoryIds?.some(ct_ecId => 
      visibleEventCategories.some(ec => Number(ec.id) === Number(ct_ecId))
    )
  );

  // Calculate Totals
  const calculateRowTotal = (eventCatId) => {
    return visibleCampaignTypes.reduce((sum, ct) => sum + (currentVerticalMatrix[`${eventCatId}_${ct.id}`] || 0), 0);
  };
  
  const calculateColTotal = (campTypeId) => {
    return visibleEventCategories.reduce((sum, ec) => sum + (currentVerticalMatrix[`${ec.id}_${campTypeId}`] || 0), 0);
  };

  const grandTotal = visibleEventCategories.reduce((sum, ec) => sum + calculateRowTotal(ec.id), 0);
  const verticalCap = verticalCaps[activeVertical] || 0;

  const inputClass = "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-right focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition";

  return (
    <div className="space-y-5">
      {isReadOnly && (
        <div className="flex justify-end -mb-2">
          <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md text-sm font-medium border border-blue-100 shadow-sm">
            Currently viewing <span className="font-bold">{activePeriod}</span> targets
          </div>
        </div>
      )}
      
      {/* Vertical Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {verticals.map(v => (
            <button
              key={v.id}
              onClick={() => setActiveVertical(v.id)}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeVertical === v.id
                  ? 'border-brand-500 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {v.name}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex justify-between items-center bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-sm sticky top-0 z-10 backdrop-blur-sm">
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Vertical Cap (from Step 1)</span>
          <p className="text-xl font-bold text-slate-800">₹{verticalCap.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">Allocated in Matrix</span>
          <p className="text-xl font-bold text-slate-800">₹{grandTotal.toLocaleString()}</p>
        </div>
        <div className={`text-right ${grandTotal > verticalCap ? 'text-red-600' : 'text-emerald-600'}`}>
          <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">Remaining</span>
          <p className="text-xl font-bold">₹{(verticalCap - grandTotal).toLocaleString()}</p>
        </div>
      </div>

      {/* Matrix Grid */}
      <div className="rounded-xl border border-slate-200 shadow-sm bg-white">
        <div className="overflow-x-auto overflow-y-auto max-h-[60vh] custom-scrollbar">
          <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
            <thead className="bg-slate-50 sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 bg-slate-50 z-30 px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-48 shadow-[1px_0_0_#e2e8f0,0_1px_0_#e2e8f0]">Event Category</th>
                {visibleCampaignTypes.map(ct => (
                  <th key={ct.id} className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider shadow-[0_1px_0_#e2e8f0]">
                    {ct.name}
                  </th>
                ))}
                <th className="sticky right-0 bg-slate-100 z-30 px-6 py-3 text-right text-xs font-bold text-slate-700 uppercase tracking-wider shadow-[-1px_0_0_#e2e8f0,0_1px_0_#e2e8f0]">Row Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleEventCategories.length === 0 ? (
                <tr>
                  <td colSpan={visibleCampaignTypes.length + 2} className="px-6 py-12 text-center text-slate-500 bg-slate-50/50">
                    No event categories are mapped to this vertical.
                  </td>
                </tr>
              ) : (
                visibleEventCategories.map(ec => {
                  return (
                    <tr key={ec.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="sticky left-0 bg-white/95 group-hover:bg-slate-50/95 z-10 px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800 shadow-[1px_0_0_#e2e8f0] backdrop-blur-sm transition-colors">{ec.name}</td>
                      {visibleCampaignTypes.map(ct => {
                        const isMapped = ct.eventCategoryIds?.some(id => Number(id) === Number(ec.id));
                      return (
                        <td key={ct.id} className="px-4 py-3 whitespace-nowrap">
                          {isMapped ? (
                            <input
                              type="number"
                              className={inputClass}
                              value={currentVerticalMatrix[`${ec.id}_${ct.id}`] || ''}
                              onChange={(e) => handleCellChange(activeVertical, ec.id, ct.id, e.target.value)}
                              onWheel={(e) => e.target.blur()}
                              disabled={isReadOnly}
                            />
                          ) : (
                            <div className="bg-gray-100 w-full h-[34px] rounded-md cursor-not-allowed border border-gray-200" title="Not Applicable"></div>
                          )}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 bg-slate-50/95 group-hover:bg-slate-100/95 z-10 px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700 text-right shadow-[-1px_0_0_#e2e8f0] backdrop-blur-sm transition-colors">
                      ₹{calculateRowTotal(ec.id).toLocaleString()}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="bg-slate-50 font-bold sticky bottom-0 z-20 shadow-[0_-1px_0_#e2e8f0]">
              <tr>
                <td className="sticky left-0 bg-slate-50 z-30 px-6 py-4 text-right text-xs uppercase tracking-wider text-slate-500 shadow-[1px_0_0_#e2e8f0]">Column Total</td>
                {visibleCampaignTypes.map(ct => (
                  <td key={ct.id} className="px-6 py-4 text-right text-sm text-slate-700">
                    ₹{calculateColTotal(ct.id).toLocaleString()}
                  </td>
                ))}
                <td className="sticky right-0 bg-brand-50/95 z-30 px-6 py-4 text-right text-sm text-brand-700 shadow-[-1px_0_0_#e2e8f0] backdrop-blur-sm">
                  ₹{grandTotal.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
