const fs = require('fs');
const file = 'src/pages/budget/BudgetApprovalsPage.jsx';

const newCode = `import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { budgetPlanningApi } from '../../api/budgetPlanning'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import ActionMenu, { ActionMenuItem } from '../../components/ActionMenu'

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(val) || 0)

const formatDate = (dtStr) => {
  if (!dtStr) return 'N/A'
  return new Date(dtStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const getProposalTypeBadge = (type) => {
  if (type === 'TOP_UP') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200 uppercase tracking-wide">
        <Icon name="arrowUpRight" className="h-3 w-3" /> Top-Up
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wide">
      Initial Budget
    </span>
  );
};

// ─── Small info chip ─────────────────────────────────────────────────────────
const Chip = ({ label, value, variant = 'default' }) => {
  const variants = {
    default: 'bg-slate-100 text-slate-700',
    brand: 'bg-brand-50 text-brand-700',
    accent: 'bg-accent-50 text-accent-700',
    amber: 'bg-amber-50 text-amber-700',
  }
  return (
    <div className={\`rounded-lg px-3 py-2 flex flex-col gap-0.5 min-w-0 \${variants[variant]}\`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60 leading-none">{label}</span>
      <span className="text-sm font-bold truncate">{value}</span>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ icon, title, sub }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-12 sm:p-16 text-center">
      <div className="inline-flex p-4 rounded-full mb-4 bg-slate-100 text-slate-400">
        <Icon name={icon} className="h-10 w-10" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700">{title}</h3>
      <p className="text-slate-400 mt-1.5 text-sm">{sub}</p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BudgetApprovalsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)

  const [loading, setLoading] = useState(false)
  const [proposals, setProposals] = useState([])

  // Proposal modal
  const [selectedProposal, setSelectedProposal] = useState(null)
  const [proposalAction, setProposalAction] = useState(null)
  const [proposalComments, setProposalComments] = useState('')
  const [proposalCommentsError, setProposalCommentsError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const proposalsRes = await budgetPlanningApi.getProposals().catch(() => [])
      setProposals((proposalsRes || []).filter(p => p.status === 'PENDING_APPROVAL'))
    } catch {
      showToast('Failed to load approvals', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // ── Proposal modal handlers ─────────────────────────────────────────────────
  const openProposalModal = (proposal, action) => {
    setSelectedProposal(proposal)
    setProposalAction(action)
    setProposalComments('')
    setProposalCommentsError(false)
  }
  const closeProposalModal = () => {
    setSelectedProposal(null); setProposalAction(null)
    setProposalComments(''); setProposalCommentsError(false)
  }
  const handleProposalConfirm = async () => {
    if (!selectedProposal || !proposalAction) return
    if (proposalAction === 'reject' && !proposalComments.trim()) { setProposalCommentsError(true); return }
    setSubmitting(true)
    try {
      if (proposalAction === 'approve') {
        await budgetPlanningApi.approveProposal(selectedProposal.id, false)
        showToast('Budget proposal approved', 'success')
      } else {
        await budgetPlanningApi.rejectProposal(selectedProposal.id, { reason: proposalComments })
        showToast('Budget proposal rejected', 'info')
      }
      closeProposalModal(); loadData()
    } catch (err) {
      if (proposalAction === 'approve' && err.response?.status === 409 && err.response?.data?.message === 'ACTIVE_PROPOSAL_EXISTS') {
        try {
          await budgetPlanningApi.approveProposal(selectedProposal.id, true)
          showToast('Budget proposal approved (Old Active Terminated)', 'success')
          closeProposalModal(); loadData()
        } catch (ie) { showToast(ie?.response?.data?.message || 'Failed to approve with override', 'error') }
      } else {
        showToast(err?.response?.data?.message || \`Failed to \${proposalAction}\`, 'error')
      }
    } finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="p-2.5 rounded-xl bg-brand-100 text-brand-600 shrink-0 shadow-sm">
              <Icon name="briefcase" className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Budget Approvals</h1>
              <p className="mt-0.5 text-slate-500 text-xs sm:text-sm truncate">Review budget proposals and top-up requests</p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50 shrink-0"
          >
            <Icon name="refresh-cw" className={\`h-4 w-4 \${loading ? 'animate-spin' : ''}\`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-xl p-12 sm:p-16 flex flex-col items-center justify-center text-slate-400">
            <Icon name="loader" className="h-8 w-8 animate-spin text-brand-500 mb-3" />
            <div className="text-sm font-medium">Loading…</div>
          </div>
        )}

        {/* ════════════════════════════════════════
            Proposals List
        ════════════════════════════════════════ */}
        {!loading && (
          proposals.length === 0
            ? <EmptyState icon="check-circle" title="No Approvals Pending" sub="All requests have been reviewed." />
            : (
              <div>
                {/* Mobile Cards View (<640px) */}
                <div className="space-y-4 sm:hidden">
                  {proposals.map(p => (
                    <div 
                      key={p.id} 
                      className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(\`/budget-planning/wizard/\${p.id}/step1?readOnly=true&fromApprovals=true&source=approvals\`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigate(\`/budget-planning/wizard/\${p.id}/step1?readOnly=true&fromApprovals=true&source=approvals\`)
                        }
                      }}
                    >
                      {/* Card Header */}
                      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800 font-mono">{p.financialYear || '—'}</span>
                        </div>
                        {getProposalTypeBadge(p.proposalType)}
                      </div>

                      {/* Card Body */}
                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <Chip label="Total Annual Budget" value={formatCurrency(p.totalAnnualBudget)} variant="brand" />
                          <Chip label="Requested By" value={p.createdByName || '—'} />
                          <Chip label="Submitted Date" value={formatDate(p.updatedAt)} />
                          <Chip label="Type" value={p.proposalType === 'TOP_UP' ? 'Top-Up' : 'Initial Budget'} />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                          <button
                            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-1.5 text-xs font-medium text-red-700 shadow-sm hover:bg-red-100 transition"
                            onClick={(e) => { e.stopPropagation(); openProposalModal(p, 'reject'); }}
                          >
                            <Icon name="xCircle" className="h-3.5 w-3.5" /> Reject
                          </button>
                          <button
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 transition"
                            onClick={(e) => { e.stopPropagation(); openProposalModal(p, 'approve'); }}
                          >
                            <Icon name="checkCircle" className="h-3.5 w-3.5" /> Approve
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop & Tablet Table View (>=640px) */}
                <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">Period</th>
                          <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">Type</th>
                          <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">Total Annual Budget</th>
                          <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">Requested By</th>
                          <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">Submitted Date</th>
                          <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {proposals.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="px-5 py-4 text-sm font-bold text-slate-900 font-mono">{p.financialYear || '—'}</td>
                            <td className="px-5 py-4 whitespace-nowrap">{getProposalTypeBadge(p.proposalType)}</td>
                            <td className="px-5 py-4 text-sm font-bold text-brand-700">{formatCurrency(p.totalAnnualBudget)}</td>
                            <td className="px-5 py-4 text-sm font-medium text-slate-700">{p.createdByName || '—'}</td>
                            <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">{formatDate(p.updatedAt)}</td>
                            <td className="px-5 py-4 text-right whitespace-nowrap">
                              <ActionMenu align="right">
                                <ActionMenuItem icon="eye" label="View Proposal" onClick={() => navigate(\`/budget-planning/wizard/\${p.id}/step1?readOnly=true&fromApprovals=true&source=approvals\`)} />
                                <ActionMenuItem icon="checkCircle" label="Approve" variant="success" onClick={() => openProposalModal(p, 'approve')} />
                                <ActionMenuItem icon="xCircle" label="Reject" variant="danger" onClick={() => openProposalModal(p, 'reject')} />
                              </ActionMenu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
        )}
      </div>

      {/* ════════════════════════════════════════
          Proposal Modal
      ════════════════════════════════════════ */}
      <Modal
        open={!!selectedProposal && !!proposalAction}
        onClose={closeProposalModal}
        title={proposalAction === 'approve' ? 'Approve Budget Proposal' : 'Reject Budget Proposal'}
        footer={
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 w-full">
            <button onClick={closeProposalModal} disabled={submitting}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-50 text-center">
              Cancel
            </button>
            <button onClick={handleProposalConfirm} disabled={submitting}
              className={\`w-full sm:w-auto px-5 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition disabled:opacity-50 text-center \${proposalAction === 'approve' ? 'bg-accent-600 hover:bg-accent-700' : 'bg-brand-600 hover:bg-brand-700'
                }\`}>
              {submitting ? 'Processing…' : proposalAction === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
            </button>
          </div>
        }
      >
        <div className="py-2 space-y-4">
          {selectedProposal && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 text-xs space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div><span className="font-semibold text-slate-500">Period:</span> <span className="font-bold text-slate-800">{selectedProposal.financialYear || '—'}</span></div>
                <div><span className="font-semibold text-slate-500">Total Budget:</span> <span className="font-bold text-brand-700">{formatCurrency(selectedProposal.totalAnnualBudget)}</span></div>
                <div><span className="font-semibold text-slate-500">Requested by:</span> <span className="text-slate-800 font-medium">{selectedProposal.createdByName || '—'}</span></div>
              </div>
            </div>
          )}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 block text-sm">
              Remarks {proposalAction === 'reject' && <span className="text-brand-600">*</span>}
            </label>
            <textarea
              className={\`w-full p-3 border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 transition \${proposalCommentsError ? 'border-brand-400 ring-brand-200' : 'border-slate-300 focus:border-brand-400 focus:ring-brand-100'
                }\`}
              rows="3"
              placeholder={proposalAction === 'reject' ? 'Please provide a reason for rejection…' : 'Optional remarks…'}
              value={proposalComments}
              onChange={e => { setProposalComments(e.target.value); if (e.target.value.trim()) setProposalCommentsError(false) }}
            />
            {proposalCommentsError && <p className="text-xs text-brand-600">Reason is required for rejection.</p>}
          </div>
        </div>
      </Modal>

    </div>
  )
}
`;

fs.writeFileSync(file, newCode);
