import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { budgetPlanningApi } from '../../api/budgetPlanning';
import { useAuth } from '../../auth/AuthContext';
import { Rights } from '../../constants/rights';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';

export default function BudgetProposalListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { hasRight } = useAuth();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog State
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [proposalToApprove, setProposalToApprove] = useState(null);
  const [activeProposalId, setActiveProposalId] = useState(null);
  const [processing, setProcessing] = useState(false);
  
  // Custom Action Dialog State
  const [actionDialog, setActionDialog] = useState({ isOpen: false, type: null, proposalId: null });
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  const canApprove = hasRight(Rights.APPROVE_BUDGET);
  const canPropose = hasRight(Rights.PROPOSE_BUDGET);
  const canReject = hasRight(Rights.REJECT_BUDGET);
  const canTerminate = hasRight(Rights.TERMINATE_BUDGET);

  useEffect(() => {
    loadProposals();
  }, []);

  const loadProposals = async () => {
    setLoading(true);
    try {
      const data = await budgetPlanningApi.getProposals();
      setProposals(data);
      const active = data.find(p => p.status === 'ACTIVE');
      if (active) setActiveProposalId(active.id);
      else setActiveProposalId(null);
    } catch (err) {
      console.error("Failed to load proposals", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action, id, overrideActive = false) => {
    try {
      if (action === 'reject' || action === 'inactivate' || action === 'delete') {
        setActionDialog({ isOpen: true, type: action, proposalId: id });
        setRejectReason("");
        setRejectError(false);
        return;
      } else {
        setProcessing(true);
        if (action === 'submit') {
          await budgetPlanningApi.submitProposal(id);
        } else if (action === 'approve') {
          await budgetPlanningApi.approveProposal(id, overrideActive);
          setShowApprovalDialog(false);
          setProposalToApprove(null);
        }
      }
      await loadProposals();
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.message === 'ACTIVE_PROPOSAL_EXISTS') {
        // Trigger dialog
        setProposalToApprove(id);
        setShowApprovalDialog(true);
      } else {
        console.error(err);
        const errMsg = err.response?.data?.message || err.message || "An error occurred while processing the request.";
        toast.error(`Error: ${errMsg}`);
      }
    } finally {
      setProcessing(false);
    }
  };

  const confirmAction = async () => {
    const { type, proposalId } = actionDialog;
    if (!proposalId || !type) return;

    if (type === 'reject' && !rejectReason.trim()) {
      setRejectError(true);
      return;
    }

    try {
      setProcessing(true);
      if (type === 'reject') {
        await budgetPlanningApi.rejectProposal(proposalId, { reason: rejectReason });
      } else if (type === 'inactivate') {
        await budgetPlanningApi.inactivateProposal(proposalId);
      } else if (type === 'delete') {
        await budgetPlanningApi.deleteProposal(proposalId);
        setProposals(prev => prev.filter(p => p.id !== proposalId));
        toast.success("Draft proposal deleted successfully.");
      }
      setActionDialog({ isOpen: false, type: null, proposalId: null });
      if (type !== 'delete') {
        await loadProposals();
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || err.message || "An error occurred while processing the request.";
      toast.error(`Error: ${errMsg}`);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      'DRAFT': { color: 'bg-slate-100 text-slate-700', label: 'Draft' },
      'PENDING_APPROVAL': { color: 'bg-amber-100 text-amber-700', label: 'Pending Approval' },
      'ACTIVE': { color: 'bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-200', label: 'Active' },
      'NEEDS_REVISION': { color: 'bg-rose-100 text-rose-700', label: 'Needs Revision' },
      'TERMINATED': { color: 'bg-slate-100 text-slate-400', label: 'Terminated' }
    };
    const s = map[status] || { color: 'bg-slate-100 text-slate-700', label: status };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.color}`}>
        {s.label}
      </span>
    );
  };

  // Stats
  const activeCount = proposals.filter(p => p.status === 'ACTIVE').length;
  const pendingCount = proposals.filter(p => p.status === 'PENDING_APPROVAL').length;
  const draftCount = proposals.filter(p => p.status === 'DRAFT').length;

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Icon name="loader" className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8 space-y-8">
      
      {/* Header & Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Budget Proposals</h1>
          <p className="text-slate-500 mt-1">Manage and approve annual budget plans.</p>
        </div>
        {canPropose && (
          <button 
            onClick={() => navigate('/budget-planning/wizard')}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-lg shadow-sm transition font-medium"
          >
            <Icon name="plus" className="h-5 w-5" />
            Create New Proposal
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between group hover:border-emerald-200 hover:shadow-md transition">
          <div>
            <p className="text-sm font-medium text-slate-500">Active Proposals</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">{activeCount}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Icon name="check" className="h-6 w-6 text-emerald-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between group hover:border-amber-200 hover:shadow-md transition">
          <div>
            <p className="text-sm font-medium text-slate-500">Pending Approvals</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">{pendingCount}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Icon name="clock" className="h-6 w-6 text-amber-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between group hover:border-slate-300 hover:shadow-md transition">
          <div>
            <p className="text-sm font-medium text-slate-500">Draft Proposals</p>
            <p className="text-3xl font-bold text-slate-700 mt-1">{draftCount}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Icon name="edit" className="h-6 w-6 text-slate-500" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="overflow-visible">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Financial Year</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Budget</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Updated</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {proposals.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500 text-sm">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                        <Icon name="inbox" className="h-6 w-6 text-slate-400" />
                      </div>
                      <p>No proposals found. Create one to get started.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                proposals.map(proposal => (
                  <tr key={proposal.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">#{proposal.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{proposal.financialYear || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700">
                      ₹{proposal.totalAnnualBudget ? proposal.totalAnnualBudget.toLocaleString() : '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(proposal.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(proposal.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-4 opacity-80 group-hover:opacity-100 transition-opacity">
                      
                      {/* Dropdown Menu implementation */}
                      <div className="relative inline-block text-left">
                        <button 
                          onClick={() => setOpenMenuId(openMenuId === proposal.id ? null : proposal.id)}
                          className="p-2 rounded-full hover:bg-slate-100 transition-colors focus:outline-none"
                        >
                          <Icon name="moreVertical" className="h-5 w-5 text-slate-500" />
                        </button>
                        {openMenuId === proposal.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-md shadow-lg z-50">
                              <div className="py-1 relative z-50">
                                {/* View / Edit */}
                                <button 
                                  onClick={() => { setOpenMenuId(null); navigate(`/budget-planning/wizard/${proposal.id}/step1`); }}
                                  className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition"
                                >
                                  {(!canPropose || proposal.status !== 'DRAFT') ? 'View' : 'Edit'}
                                </button>

                                {/* Creator Actions */}
                                {canPropose && proposal.status === 'DRAFT' && (
                                  <>
                                    <button 
                                      onClick={() => { setOpenMenuId(null); handleAction('delete', proposal.id); }}
                                      disabled={processing}
                                      className="block w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                                
                                {canPropose && proposal.status === 'NEEDS_REVISION' && (
                                  <button 
                                    onClick={() => { setOpenMenuId(null); navigate(`/budget-planning/wizard/${proposal.id}/step1`); }}
                                    className="block w-full text-left px-4 py-2 text-sm text-amber-600 hover:bg-amber-50 transition"
                                  >
                                    Resubmit
                                  </button>
                                )}

                                {canPropose && proposal.status === 'APPROVED' && (
                                  <button 
                                    onClick={() => { setOpenMenuId(null); navigate(`/budget-planning/wizard/${proposal.id}/step2`); }}
                                    className="block w-full text-left px-4 py-2 text-sm text-brand-600 hover:bg-brand-50 transition"
                                  >
                                    Complete Planning
                                  </button>
                                )}

                                {/* Approver Actions */}
                                {proposal.status === 'PENDING_APPROVAL' && (
                                  <>
                                    {canApprove && (
                                      <button 
                                        onClick={() => { setOpenMenuId(null); handleAction('approve', proposal.id); }}
                                        disabled={processing}
                                        className="block w-full text-left px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 transition disabled:opacity-50"
                                      >
                                        Approve
                                      </button>
                                    )}
                                    {canReject && (
                                      <button 
                                        onClick={() => { setOpenMenuId(null); handleAction('reject', proposal.id); }}
                                        disabled={processing}
                                        className="block w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                                      >
                                        Reject
                                      </button>
                                    )}
                                  </>
                                )}

                                {/* Active Inactivation */}
                                {canTerminate && proposal.status === 'ACTIVE' && (
                                  <button 
                                    onClick={() => { setOpenMenuId(null); handleAction('inactivate', proposal.id); }}
                                    disabled={processing}
                                    className="block w-full text-left px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 transition disabled:opacity-50"
                                  >
                                    Terminate
                                  </button>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Override Approval Dialog */}
      {showApprovalDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setShowApprovalDialog(false)}></div>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full relative z-[101] overflow-hidden transform transition-all p-6 ring-1 ring-slate-900/5">
            <div className="flex items-center gap-4 text-amber-600 mb-5">
              <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
                <Icon name="alertCircle" className="h-6 w-6 text-amber-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Active Proposal Exists</h3>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              Proposal <span className="font-bold text-slate-900">#{activeProposalId}</span> is currently <span className="font-semibold text-emerald-600">ACTIVE</span>. 
              Approving proposal <span className="font-bold text-slate-900">#{proposalToApprove}</span> will automatically mark the old one as <span className="font-semibold text-slate-400">TERMINATED</span>. 
              <br /><br />
              Are you sure you want to proceed?
            </p>
            <div className="flex items-center justify-end gap-3 mt-8">
              <button 
                onClick={() => {
                  setShowApprovalDialog(false);
                  setProposalToApprove(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                disabled={processing}
              >
                Cancel
              </button>
              <button 
                onClick={() => handleAction('approve', proposalToApprove, true)}
                className="px-5 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                disabled={processing}
              >
                {processing ? 'Processing...' : 'Confirm & Terminate Old'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Dialog (Reject / Terminate / Delete) */}
      <Modal 
        open={actionDialog.isOpen} 
        onClose={() => setActionDialog({ isOpen: false, type: null, proposalId: null })}
        title={
          actionDialog.type === 'reject' 
            ? "Reject Proposal" 
            : actionDialog.type === 'inactivate'
            ? "Terminate Proposal"
            : "Delete Draft Proposal"
        }
        footer={
          <>
            <button 
              onClick={() => setActionDialog({ isOpen: false, type: null, proposalId: null })} 
              className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
              disabled={processing}
            >
              Cancel
            </button>
            <button 
              onClick={confirmAction} 
              className={`rounded-md px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition ${
                actionDialog.type === 'reject' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-600 hover:bg-slate-700'
              } disabled:opacity-50`}
              disabled={processing}
            >
              {processing ? 'Processing...' : 'Confirm'}
            </button>
          </>
        }
      >
        <div className="py-2 text-sm text-slate-600">
          {actionDialog.type === 'reject' ? (
            <div className="space-y-3">
              <p>Please provide a reason for rejecting proposal <span className="font-bold text-slate-900">#{actionDialog.proposalId}</span>.</p>
              <textarea
                className={`w-full p-3 border rounded-lg focus:ring-rose-500 focus:border-rose-500 text-sm ${rejectError ? 'border-rose-500' : 'border-slate-300'}`}
                rows="3"
                placeholder="Enter rejection reason..."
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  if (e.target.value.trim()) setRejectError(false);
                }}
              />
              {rejectError && <p className="text-xs text-rose-600 font-medium">Rejection reason is required.</p>}
            </div>
          ) : actionDialog.type === 'inactivate' ? (
            <p>Are you sure you want to terminate proposal <span className="font-bold text-slate-900">#{actionDialog.proposalId}</span>? This action cannot be undone.</p>
          ) : (
            <p>Are you sure you want to permanently delete draft proposal <span className="font-bold text-slate-900">#{actionDialog.proposalId}</span>? This action cannot be undone.</p>
          )}
        </div>
      </Modal>

    </div>
  );
}
