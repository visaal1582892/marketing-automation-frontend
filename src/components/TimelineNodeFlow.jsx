import React from 'react'

export default function TimelineNodeFlow({ steps }) {
  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-y-3 gap-x-2">
        {steps.map((step, i) => {
          const active = step.active !== undefined ? step.active : !!step.ts
          const isLast = i === steps.length - 1
          const s = step.done || step.styles || {}
          return (
            <React.Fragment key={step.id || step.label}>
              {/* Step card */}
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 transition shadow-2xs ${
                active ? s.card : 'bg-slate-50 border-slate-100'
              }`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${
                  active ? `${s.dot} text-white` : 'bg-slate-200 text-slate-400'
                }`}>
                  <span className="scale-[0.8] flex items-center justify-center">{step.icon}</span>
                </span>
                <div className="leading-tight">
                  <div className={`text-[10px] font-bold uppercase tracking-wide ${active ? s.text : 'text-slate-400'}`}>
                    {step.label}
                  </div>
                  {step.sublabel && (
                    <div className="text-[10px] text-amber-700 font-semibold mt-0.5">{step.sublabel}</div>
                  )}
                  <div className={`text-[11px] font-medium whitespace-nowrap ${active ? 'text-slate-800' : 'text-slate-400'}`}>
                    {active ? (step.formattedTs || '—') : '—'}
                  </div>
                  {step.reviewerName && (
                    <div className="text-[10px] text-slate-500 italic mt-0.5">By: {step.reviewerName}</div>
                  )}
                  {step.comments && (
                    <div className="text-[10px] text-slate-600 italic mt-0.5 max-w-[200px] truncate" title={step.comments}>
                      "{step.comments}"
                    </div>
                  )}
                </div>
              </div>

              {/* Connector */}
              {!isLast && (
                <div className="flex items-center text-slate-300 px-0.5">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
