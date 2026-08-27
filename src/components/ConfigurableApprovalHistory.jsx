import React, { useState, useEffect } from 'react'
import managerApi from '../api/manager'

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function ConfigurableApprovalHistory({ taskId }) {
  const [history, setHistory] = useState(null)
  
  useEffect(() => {
    managerApi.getConfigurableApprovalHistory(taskId)
      .then(res => setHistory(res.data))
      .catch(() => {})
  }, [taskId])

  if (!history || !history.levels || history.levels.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm mt-4 mb-4">
      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Configurable Approval Routing</h4>
      </div>
      <div className="p-4 space-y-4">
        {history.levels.map((lvl, idx) => (
          <div key={idx} className="flex flex-col border-l-2 border-slate-200 pl-4 relative">
            <div className={`absolute -left-[5px] top-1 h-2 w-2 rounded-full ${
              lvl.status === 'APPROVED' ? 'bg-emerald-400' :
              lvl.status === 'REJECTED' ? 'bg-rose-400' :
              lvl.status === 'SKIPPED' ? 'bg-slate-300' :
              'bg-blue-400'
            }`} />
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-700">Level {lvl.levelNumber} - {lvl.status}</p>
                {lvl.approverName && <p className="text-xs text-slate-500 mt-0.5">Approver: {lvl.approverName}</p>}
                {lvl.comments && <p className="text-xs text-slate-600 mt-1 italic">"{lvl.comments}"</p>}
              </div>
              {lvl.actionAt && (
                <span className="text-[10px] text-slate-400">{fmtDate(lvl.actionAt)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
