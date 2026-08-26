import React from 'react'

export default function TimelineNodeFlow({ steps }) {
  return (
    <div className="overflow-x-auto pb-0.5">
      <div className="flex items-stretch min-w-max gap-0">
        {steps.map((step, i) => {
          const active = step.active !== undefined ? step.active : !!step.ts
          const isLast = i === steps.length - 1
          const s = step.done || step.styles || {}
          return (
            <div key={step.id || step.label} className="flex items-center">
              {/* Step card */}
              <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 transition ${
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
                  <div className={`text-[11px] font-medium whitespace-nowrap ${active ? 'text-slate-800' : 'text-slate-400'}`}>
                    {active ? (step.formattedTs || '—') : '—'}
                  </div>
                </div>
              </div>
              {/* Connector */}
              {!isLast && (
                <div className={`h-px w-5 shrink-0 ${active ? s.line : 'bg-slate-200'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
