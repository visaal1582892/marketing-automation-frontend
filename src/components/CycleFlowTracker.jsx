import React from 'react'
import Icon from './Icon'
import { fmtDateTime } from '../utils/taskAssignment'
import TimelineNodeFlow from './TimelineNodeFlow'

function formatTime(minutes) {
  if (!minutes || minutes < 0) return '0 hrs 0 mins'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0) return `${h} hrs ${m} mins`
  return `${m} mins`
}

export default function CycleFlowTracker({ cycle, isHistorical = false }) {
  if (!cycle) return null

  // Define nodes
  const steps = []

  // 1. Assigned Node (always)
  steps.push({
    id: 'assigned',
    label: 'ASSIGNED',
    ts: cycle.assignedAt,
    formattedTs: cycle.assignedAt ? fmtDateTime(cycle.assignedAt) : null,
    icon: <Icon name="user" className="h-4 w-4" />,
    styles: { dot: 'bg-slate-500', line: 'bg-slate-300', text: 'text-slate-700', card: 'bg-slate-50 border-slate-200' }
  })

  // 2. Started Node
  if (cycle.acceptedAt || cycle.startedAt) {
    const ts = cycle.acceptedAt || cycle.startedAt
    steps.push({
      id: 'started',
      label: 'STARTED',
      ts: ts,
      formattedTs: ts ? fmtDateTime(ts) : null,
      icon: <Icon name="play" className="h-4 w-4" />,
      styles: { dot: 'bg-cyan-500', line: 'bg-cyan-200', text: 'text-cyan-700', card: 'bg-cyan-50 border-cyan-200' }
    })
  }

  // 3. Submitted Node
  if (cycle.submittedAt) {
    steps.push({
      id: 'submitted',
      label: 'SUBMITTED',
      ts: cycle.submittedAt,
      formattedTs: cycle.submittedAt ? fmtDateTime(cycle.submittedAt) : null,
      icon: <Icon name="upload" className="h-4 w-4" />,
      styles: { dot: 'bg-blue-500', line: 'bg-blue-200', text: 'text-blue-700', card: 'bg-blue-50 border-blue-200' }
    })
  }

  // 4. Outcome Nodes
  let hasOutcome = false
  if (cycle.managerApprovedAt) {
    steps.push({
      id: 'manager_approved',
      label: 'MARKETING APPROVED',
      ts: cycle.managerApprovedAt,
      formattedTs: cycle.managerApprovedAt ? fmtDateTime(cycle.managerApprovedAt) : null,
      icon: <Icon name="check" className="h-4 w-4" />,
      styles: { dot: 'bg-emerald-500', line: 'bg-emerald-200', text: 'text-emerald-700', card: 'bg-emerald-50 border-emerald-200' }
    })
    hasOutcome = true
  }

  if (cycle.requestorApprovedAt) {
    steps.push({
      id: 'requestor_approved',
      label: 'REQUESTOR APPROVED',
      ts: cycle.requestorApprovedAt,
      formattedTs: cycle.requestorApprovedAt ? fmtDateTime(cycle.requestorApprovedAt) : null,
      icon: <Icon name="check" className="h-4 w-4" />,
      styles: { dot: 'bg-emerald-500', line: 'bg-emerald-200', text: 'text-emerald-700', card: 'bg-emerald-50 border-emerald-200' }
    })
    hasOutcome = true
  }
  
  if (!hasOutcome) {
    if (cycle.lastReworkAction === 'MARKETING_REWORK' || cycle.lastReworkAction === 'REQUESTOR_REWORK') {
      steps.push({
        id: 'rework',
        label: cycle.lastReworkAction === 'MARKETING_REWORK' ? 'MANAGER REWORK' : 'REQUESTOR REWORK',
        ts: cycle.submittedAt,
        formattedTs: cycle.submittedAt ? fmtDateTime(cycle.submittedAt) : null,
        icon: <Icon name="refresh" className="h-4 w-4" />,
        styles: { dot: 'bg-amber-500', line: 'bg-amber-200', text: 'text-amber-700', card: 'bg-amber-50 border-amber-200' }
      })
    } else if (cycle.status === 'REJECTED') {
       steps.push({
        id: 'rejected',
        label: 'REJECTED',
        ts: cycle.submittedAt,
        formattedTs: cycle.submittedAt ? fmtDateTime(cycle.submittedAt) : null,
        icon: <Icon name="x" className="h-4 w-4" />,
        styles: { dot: 'bg-rose-500', line: 'bg-rose-200', text: 'text-rose-700', card: 'bg-rose-50 border-rose-200' }
      })
    }
  }

  const dimClass = isHistorical ? 'opacity-60' : 'opacity-100'

  return (
    <div className={`flex flex-col gap-3 py-2 ${dimClass}`}>
      {/* Header for the cycle (Assignee Info) */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-bold text-slate-800">{cycle.assigneeName || 'Unknown User'}</span>
        {cycle.roleName && (
          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-medium">
            {cycle.roleName}
          </span>
        )}
      </div>

      {/* Node Flow */}
      <TimelineNodeFlow steps={steps} />

      {/* Metrics Badges */}
      <div className="flex items-center gap-2 mt-1">
        {cycle.activeTimeMinutes != null && (
          <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs bg-slate-100 text-slate-800 font-medium border border-slate-200/60 shadow-sm">
            <Icon name="clock" className="h-3.5 w-3.5 text-slate-500" />
            Active Time: {formatTime(cycle.activeTimeMinutes)}
          </div>
        )}
        
        {cycle.holdDurationMinutes != null && cycle.holdDurationMinutes > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs bg-amber-50 text-amber-800 font-medium border border-amber-200 shadow-sm">
            <Icon name="pause" className="h-3.5 w-3.5 text-amber-500" />
            (Paused for {formatTime(cycle.holdDurationMinutes)})
          </div>
        )}
      </div>
    </div>
  )
}
