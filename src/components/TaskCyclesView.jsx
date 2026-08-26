import React, { useEffect, useState } from 'react'
import tasksApi from '../api/tasks'
import Icon from './Icon'
import CycleFlowTracker from './CycleFlowTracker'

function formatTime(minutes) {
  if (!minutes || minutes <= 0) return '0 hrs 0 mins'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0) return `${h} hrs ${m} mins`
  return `${m} mins`
}

export default function TaskCyclesView({ taskId, currentAssigneeId }) {
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!taskId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    
    tasksApi.getAssignmentHistory(taskId)
      .then(res => {
        if (!cancelled) setHistory(res.data || [])
      })
      .catch((err) => {
        if (!cancelled) setError('Failed to load assignment history.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
      
    return () => { cancelled = true }
  }, [taskId])

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 animate-pulse mt-4">
        <div className="h-4 w-48 rounded bg-slate-200 mb-4" />
        <div className="h-20 rounded-lg bg-slate-200" />
      </div>
    )
  }

  if (error || !history || history.length === 0) {
    return (
      <div className="mt-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
        <p className="text-xs text-slate-400 italic">{error || 'No assignment cycles found.'}</p>
      </div>
    )
  }

  const activeCycle = history.find(h => h.status === 'ACTIVE')
  // Depending on how backend orders, typically active is the latest. 
  // Let's filter out active from historical and reverse the rest for descending chronological display if needed,
  // or just filter it.
  const historicalCycles = history.filter(h => h.status !== 'ACTIVE')
  
  // Calculate total active time
  const totalActiveTimeMinutes = history.reduce((acc, curr) => acc + (curr.activeTimeMinutes || 0), 0)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm mt-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 bg-slate-50/50">
        <Icon name="git-merge" className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-bold text-slate-800">Assignment Cycles</h3>
      </div>

      <div className="px-5 py-4 space-y-6">
        {/* Active Cycle */}
        {activeCycle && (
          <div>
            <div className="mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Current Active Cycle
              </span>
            </div>
            <CycleFlowTracker cycle={activeCycle} isHistorical={false} />
          </div>
        )}

        {/* Expander for Historical Cycles */}
        {historicalCycles.length > 0 && (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left"
            >
              <div className="flex items-center gap-2">
                <Icon name="history" className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">
                  View Previous Cycles ({historicalCycles.length})
                </span>
              </div>
              <Icon 
                name="chevron-down" 
                className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} 
              />
            </button>

            {expanded && (
              <div className="p-4 bg-slate-50/50 border-t border-slate-200 space-y-6">
                {historicalCycles.map((cycle, idx) => (
                  <div key={cycle.assignmentId || idx} className="border-b border-slate-200/60 pb-6 last:border-0 last:pb-0">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Cycle {historicalCycles.length - idx}
                      </span>
                    </div>
                    <CycleFlowTracker cycle={cycle} isHistorical={true} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Grand Total */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-end">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-white shadow-sm">
              <Icon name="clock" className="h-4 w-4 text-slate-300" />
              <span className="text-sm font-bold">Total Active Time on Task: {formatTime(totalActiveTimeMinutes)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
