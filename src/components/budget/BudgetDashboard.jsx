import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../Icon'
import HasRight from '../HasRight'
import { Rights } from '../../constants/rights'
import { formatInr, STATUS_LABELS } from '../../utils/budgetHelpers'

function StatusBadge({ status }) {
  const meta = STATUS_LABELS[status] ?? STATUS_LABELS.DRAFT
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.cls}`}>
      {meta.label}
    </span>
  )
}

// ─── Per-row kebab menu (portal so it escapes overflow-x-auto clip) ───────
function RowMenu({ proposal, onClone, cloningId, onDelete }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const isDraft = proposal.status === 'DRAFT'

  function openMenu(e) {
    e.stopPropagation()
    const rect = btnRef.current.getBoundingClientRect()
    // Anchor below-right of the button
    setCoords({ top: rect.bottom + 4, left: rect.right - 150 })
    setOpen(v => !v)
  }

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return
    function close() { setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [open])

  const menu = open && (
    <div
      style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 9999 }}
      className="min-w-[150px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Clone */}
      <button
        type="button"
        disabled={cloningId === proposal.id}
        onClick={() => { setOpen(false); onClone(proposal.id) }}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700
                   transition hover:bg-slate-50 disabled:opacity-50"
      >
        <Icon name="refresh" className="h-3.5 w-3.5 text-slate-400" />
        {cloningId === proposal.id ? 'Cloning…' : 'Clone'}
      </button>

      {/* Delete — only for DRAFT */}
      {isDraft && (
        <>
          <div className="mx-3 border-t border-slate-100" />
          <button
            type="button"
            onClick={() => { setOpen(false); onDelete(proposal.id) }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-600
                       transition hover:bg-red-50"
          >
            <Icon name="trash" className="h-3.5 w-3.5" />
            Delete
          </button>
        </>
      )}
    </div>
  )

  return (
    <div className="flex justify-end">
      <button
        ref={btnRef}
        type="button"
        onClick={openMenu}
        className={`rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${
          open ? 'bg-slate-100 text-slate-700' : ''
        }`}
        aria-label="Row actions"
      >
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="8" cy="13" r="1.4" />
        </svg>
      </button>

      {createPortal(menu, document.body)}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function BudgetDashboard({
  proposals,
  loading,
  selectedId,
  onSelect,
  onNew,
  onClone,
  cloningId,
  onDelete,
  isCollapsed = false,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${!isCollapsed ? 'border-b border-slate-100' : ''}`}>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Budget Proposals</h2>
          <p className="text-xs text-slate-500">Financial year planning and approvals</p>
        </div>
        <HasRight right={Rights.PROPOSE_BUDGET}>
          <button
            type="button"
            onClick={onNew}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm
                       font-medium text-white shadow-sm transition hover:bg-brand-700"
          >
            <Icon name="plus" className="h-4 w-4" />
            New Proposal
          </button>
        </HasRight>
      </div>

      {!isCollapsed && (
        loading ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">Loading proposals…</div>
        ) : proposals.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            No budget proposals yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">FY</th>
                  <th className="px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                  <th className="w-10 px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {proposals.map(p => (
                  <tr
                    key={p.id}
                    className={`cursor-pointer transition hover:bg-slate-50/80 ${
                      selectedId === p.id ? 'bg-brand-50/60' : ''
                    }`}
                    onClick={() => onSelect(p.id)}
                  >
                    <td className="px-5 py-3 font-medium text-slate-800">{p.financialYear}</td>
                    <td className="px-5 py-3 text-slate-700">{formatInr(p.totalAmount)}</td>
                    <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-5 py-3 text-slate-500">
                      {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <HasRight right={Rights.PROPOSE_BUDGET}>
                        <RowMenu
                          proposal={p}
                          onClone={onClone}
                          cloningId={cloningId}
                          onDelete={onDelete}
                        />
                      </HasRight>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
