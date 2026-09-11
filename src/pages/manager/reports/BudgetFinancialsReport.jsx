import React, { useEffect, useState } from 'react'
import Icon from '../../../components/Icon'
import { analyticsApi } from '../../../api/analytics'

export default function BudgetFinancialsReport() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    analyticsApi.getBudgetFinancials()
      .then(res => setData(res))
      .catch(err => setError('Failed to load budget financials'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Icon name="loader" className="h-8 w-8 animate-spin text-emerald-500 mb-4" />
        <p className="text-sm text-slate-500">Loading Budget & Financials...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center text-red-500 py-10">{error || 'No data found.'}</div>
    )
  }

  const { verticals, stateBreakdown, overrunHistory, topupLog } = data

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div className="bg-emerald-50 p-3 rounded-xl">
          <Icon name="currencyDollar" className="h-6 w-6 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Budget & Financials Overview</h2>
          <p className="text-sm text-slate-500">Track quarterly spending, overruns, and top-ups</p>
        </div>
      </div>

      {/* Vertical Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-800">Vertical Spending Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-3 border-b border-slate-200">Business Vertical</th>
                <th className="px-6 py-3 border-b border-slate-200">Allocated</th>
                <th className="px-6 py-3 border-b border-slate-200">Spent</th>
                <th className="px-6 py-3 border-b border-slate-200">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {verticals && verticals.length > 0 ? verticals.map((v, i) => {
                const isOverrun = v.spent > v.allocated;
                return (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-700">{v.vertical_name}</td>
                    <td className="px-6 py-3">₹{v.allocated?.toLocaleString() || 0}</td>
                    <td className="px-6 py-3">₹{v.spent?.toLocaleString() || 0}</td>
                    <td className="px-6 py-3">
                      {isOverrun ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
                          Overrun by ₹{(v.spent - v.allocated).toLocaleString()}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          Healthy
                        </span>
                      )}
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan="4" className="px-6 py-4 text-center text-slate-500">No data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* State Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-semibold text-slate-800">State Breakdown</h3>
          </div>
          <div className="overflow-y-auto max-h-96">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0">
                  <th className="px-6 py-3 border-b border-slate-200">State</th>
                  <th className="px-6 py-3 border-b border-slate-200 text-right">Spent</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {stateBreakdown && stateBreakdown.length > 0 ? stateBreakdown.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-700">{s.state_name}</td>
                    <td className="px-6 py-3 text-right font-medium">₹{s.amount?.toLocaleString() || 0}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="2" className="px-6 py-4 text-center text-slate-500">No data available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top-Up Log */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-semibold text-slate-800">Top-Up Requests History</h3>
          </div>
          <div className="overflow-y-auto max-h-96">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0">
                  <th className="px-6 py-3 border-b border-slate-200">Vertical/State</th>
                  <th className="px-6 py-3 border-b border-slate-200">Amount</th>
                  <th className="px-6 py-3 border-b border-slate-200">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {topupLog && topupLog.length > 0 ? topupLog.map((t, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-800">{t.vertical_name}</div>
                      <div className="text-xs text-slate-500">{t.state_code}</div>
                    </td>
                    <td className="px-6 py-3 font-medium">₹{t.topup_amount?.toLocaleString() || 0}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                        t.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        t.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="3" className="px-6 py-4 text-center text-slate-500">No top-ups found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
