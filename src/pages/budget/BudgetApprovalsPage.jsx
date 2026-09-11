import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { budgetApprovalsApi } from '../../api/budgetApprovals'
import { budgetTopupApi } from '../../api/budgetTopup'
import { budgetPlanningApi } from '../../api/budgetPlanning'
import { useToast } from '../../components/Toast'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import { formatTaskId } from '../../utils/formatters'

export default function BudgetApprovalsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const showToast = (msg, type = 'info') => toast[type]?.(msg)

  const [activeTab, setActiveTab] = useState('proposals') // 'proposals', 'topups', 'overruns'

  const [loading, setLoading] = useState(true)
  const [proposals, setProposals] = useState([])
  const [topups, setTopups] = useState([])
  const [overruns, setOverruns] = useState([])

  // Modal State
  const [selectedItem, setSelectedItem] = useState(null)
  const [actionType, setActionType] = useState(null) // 'approve' | 'reject'
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [commentsError, setCommentsError] = useState(false)

  // Group overruns by Vertical + State
  const groupedOverruns = useMemo(() => {
    const groups = {}
    overruns.forEach(task => {
      if (!task.stateOverruns || task.stateOverruns.length === 0) return;
      task.stateOverruns.forEach(sod => {
        const groupId = `${task.verticalId}-${sod.stateCode}`;
        if (!groups[groupId]) {
          groups[groupId] = {
            id: groupId,
            verticalId: task.verticalId,
            verticalName: task.verticalName,
            stateCode: sod.stateCode,
            stateName: sod.stateName,
            allocated: sod.allocated,
            spent: sod.spent,
            overrun: sod.overrun,
            tasks: []
          };
        }
        groups[groupId].tasks.push(task);
      });
    });
    return Object.values(groups);
  }, [overruns]);

  const loadData = async () => {
    setLoading(true)
    try {
      const [overrunsRes, topupsRes, proposalsRes] = await Promise.all([
        budgetApprovalsApi.getPendingOverruns(),
        budgetTopupApi.getPendingTopUps().catch(() => []),
        budgetPlanningApi.getProposals().catch(() => [])
      ])
      setOverruns(overrunsRes?.data || [])
      setTopups(topupsRes || [])
      setProposals(proposalsRes.filter(p => p.status === 'PENDING_APPROVAL') || [])
    } catch (err) {
      showToast('Failed to load budget tasks', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openActionModal = (item, type) => {
    setSelectedItem(item)
    setActionType(type)
    setComments('')
    setCommentsError(false)
  }

  const closeModal = () => {
    setSelectedItem(null)
    setActionType(null)
    setComments('')
    setCommentsError(false)
  }

  const handleConfirmAction = async () => {
    if (!selectedItem || !actionType) return
    
    if (actionType === 'reject' && !comments.trim()) {
      setCommentsError(true)
      return
    }

    setSubmitting(true)
    try {
      if (activeTab === 'overruns') {
        if (actionType === 'approve') {
          await budgetApprovalsApi.approveOverrun(selectedItem.taskId, comments)
          showToast(`Budget overrun approved for task ${formatTaskId(selectedItem.taskId)}`, 'success')
        } else {
          await budgetApprovalsApi.rejectOverrun(selectedItem.taskId, comments)
          showToast(`Budget overrun rejected for task ${formatTaskId(selectedItem.taskId)}`, 'info')
        }
      } else if (activeTab === 'topups') {
        if (actionType === 'approve') {
          await budgetTopupApi.approveTopUp(selectedItem.id, comments)
          showToast(`Budget top-up approved`, 'success')
        } else {
          await budgetTopupApi.rejectTopUp(selectedItem.id, comments)
          showToast(`Budget top-up rejected`, 'info')
        }
      } else if (activeTab === 'proposals') {
        if (actionType === 'approve') {
          await budgetPlanningApi.approveProposal(selectedItem.id, false)
          showToast(`Budget proposal approved`, 'success')
        } else {
          await budgetPlanningApi.rejectProposal(selectedItem.id, { reason: comments })
          showToast(`Budget proposal rejected`, 'info')
        }
      }
      closeModal()
      loadData()
    } catch (err) {
      // Handle the override active scenario for proposals
      if (activeTab === 'proposals' && actionType === 'approve' && err.response?.status === 409 && err.response?.data?.message === 'ACTIVE_PROPOSAL_EXISTS') {
        try {
          await budgetPlanningApi.approveProposal(selectedItem.id, true)
          showToast(`Budget proposal approved (Old Active Terminated)`, 'success')
          closeModal()
          loadData()
        } catch (innerErr) {
          showToast(innerErr?.response?.data?.message || 'Failed to approve with override', 'error')
        }
      } else {
        showToast(err?.response?.data?.message || `Failed to ${actionType}`, 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (val) => {
    const num = Number(val) || 0
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(num)
  }

  const formatDate = (dtStr) => {
    if (!dtStr) return 'N/A'
    return new Date(dtStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Icon name="briefcase" className="h-6 w-6" />
            </span>
            Budget Approvals
          </h1>
          <p className="mt-1 text-slate-500 text-sm">
            Review Budget Proposals, Top-Ups, and Budget Overruns
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Icon name="refresh-cw" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-8">
        <button
          onClick={() => setActiveTab('proposals')}
          className={`pb-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'proposals' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Budget Proposals
          {proposals.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">
              {proposals.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('topups')}
          className={`pb-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'topups' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Top-Up Approvals
          {topups.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">
              {topups.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('overruns')}
          className={`pb-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'overruns' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Overrun Approvals
          {groupedOverruns.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">
              {groupedOverruns.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 flex flex-col items-center justify-center text-slate-500">
          <Icon name="refresh-cw" className="h-8 w-8 animate-spin text-emerald-500 mb-3" />
          <div>Loading queue...</div>
        </div>
      ) : activeTab === 'proposals' ? (
        /* Proposals Tab */
        proposals.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
            <div className="inline-flex p-4 rounded-full bg-emerald-50 text-emerald-500 mb-4">
              <Icon name="check-circle" className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No Proposals Pending</h3>
            <p className="text-slate-500 mt-2 text-sm">All budget proposals have been reviewed.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">FY</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Total Amount</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Requested By</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Requested On</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Remarks</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {proposals.map(proposal => (
                  <tr key={proposal.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{proposal.financialYear || '-'}</td>
                    <td className="px-6 py-4 text-sm font-bold text-emerald-600">{formatCurrency(proposal.totalAnnualBudget)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{proposal.createdByName || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{formatDate(proposal.updatedAt)}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate">Initial Budget Proposal</td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button 
                        onClick={() => navigate(`/budget-planning/wizard/${proposal.id}/step1?readOnly=true`)} 
                        className="px-3 py-1.5 rounded bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200"
                      >
                        View
                      </button>
                      <button 
                        onClick={() => openActionModal(proposal, 'approve')} 
                        className="px-3 py-1.5 rounded bg-emerald-100 text-emerald-700 font-semibold text-xs hover:bg-emerald-200"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => openActionModal(proposal, 'reject')} 
                        className="px-3 py-1.5 rounded bg-red-100 text-red-700 font-semibold text-xs hover:bg-red-200"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : activeTab === 'topups' ? (
        /* TopUps Tab */
        topups.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
            <div className="inline-flex p-4 rounded-full bg-emerald-50 text-emerald-500 mb-4">
              <Icon name="check-circle" className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No Top-Ups Pending</h3>
            <p className="text-slate-500 mt-2 text-sm">All budget top-up requests have been reviewed.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">FY</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Time Period</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Vertical</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">State</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Amount</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Requested By</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Requested On</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Remarks</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {topups.map(topup => (
                  <tr key={topup.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{topup.financialYear || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{topup.periodName || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800">{topup.verticalName || topup.verticalId}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{topup.stateCode}</td>
                    <td className="px-6 py-4 text-sm font-bold text-emerald-600">{formatCurrency(topup.topupAmount)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{topup.requestedByName || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{formatDate(topup.requestedAt)}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 max-w-[150px] truncate" title={topup.remarks}>{topup.remarks || '-'}</td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button 
                        onClick={() => openActionModal(topup, 'approve')} 
                        className="px-3 py-1.5 rounded bg-emerald-100 text-emerald-700 font-semibold text-xs hover:bg-emerald-200"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => openActionModal(topup, 'reject')} 
                        className="px-3 py-1.5 rounded bg-red-100 text-red-700 font-semibold text-xs hover:bg-red-200"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Overruns Tab */
        groupedOverruns.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
            <div className="inline-flex p-4 rounded-full bg-emerald-50 text-emerald-500 mb-4">
              <Icon name="check-circle" className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">All Clear!</h3>
            <p className="text-slate-500 mt-2 text-sm">All Business Verticals are operating within budget.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {groupedOverruns.map(group => (
                <div key={group.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Icon name="alert-triangle" className="h-5 w-5 text-amber-600" />
                      <h3 className="text-base font-bold text-slate-800">{group.verticalName || 'General Vertical'} <span className="text-slate-400 mx-1">&bull;</span> {group.stateName}</h3>
                    </div>
                    <span className="font-mono font-bold bg-amber-100 text-amber-800 px-2.5 py-1 rounded text-xs border border-amber-200">
                      State Budget Exhausted
                    </span>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
                      <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Allocated (QTR)</div>
                        <div className="text-lg font-bold text-slate-700 mt-1">{formatCurrency(group.allocated)}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Spent</div>
                        <div className="text-lg font-bold text-red-600 mt-1">{formatCurrency(group.spent)}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">State Overrun</div>
                        <div className="text-lg font-extrabold text-red-600 mt-1">+{formatCurrency(group.overrun)}</div>
                      </div>
                    </div>

                    <div className="mb-2">
                      <h4 className="text-sm font-bold text-slate-700 mb-3">Pending Tasks for Approval:</h4>
                      <div className="space-y-3">
                        {group.tasks.map(task => (
                          <div key={task.taskId} className="flex justify-between items-center bg-white border border-slate-200 rounded-lg p-4 hover:border-emerald-200 transition-colors">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">
                                  Task {formatTaskId(task.taskId)}
                                </span>
                                <span className="text-sm font-bold text-slate-800">
                                  {formatCurrency(task.expenseAmount)}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 mt-1">Requested by {task.requestedByName || '-'} &bull; {formatDate(task.createdAt)}</div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => openActionModal(task, 'reject')} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 font-semibold text-xs hover:bg-red-50 flex items-center gap-1.5 transition-colors">
                                <Icon name="x-circle" className="h-3.5 w-3.5" /> Reject
                              </button>
                              <button onClick={() => openActionModal(task, 'approve')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-sm hover:bg-emerald-700 flex items-center gap-1.5 transition-colors">
                                <Icon name="check-circle" className="h-3.5 w-3.5" /> Approve
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )
      )}

      {/* Unified Action Modal */}
      <Modal 
        open={!!selectedItem && !!actionType} 
        onClose={closeModal}
        title={actionType === 'approve' ? 'Approve Request' : 'Reject Request'}
        footer={
          <>
            <button 
              onClick={closeModal} 
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
              disabled={submitting}
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirmAction} 
              className={`rounded-md px-5 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 ${
                actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
              disabled={submitting}
            >
              {submitting ? 'Processing...' : 'Confirm'}
            </button>
          </>
        }
      >
        <div className="py-3 text-sm text-slate-600">
          <p className="mb-4">
            You are about to {actionType} a {activeTab === 'proposals' ? 'Budget Proposal' : activeTab === 'topups' ? 'Top-Up Request' : 'Budget Overrun'}.
          </p>
          <div className="space-y-1 mb-4">
            <label className="font-semibold text-slate-700 block">Remarks {actionType === 'reject' && <span className="text-red-500">*</span>}</label>
            <textarea
              className={`w-full p-3 border rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-sm ${commentsError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'}`}
              rows="3"
              placeholder={actionType === 'reject' ? "Please provide a reason for rejection..." : "Optional remarks..."}
              value={comments}
              onChange={(e) => {
                setComments(e.target.value)
                if (e.target.value.trim()) setCommentsError(false)
              }}
            />
            {commentsError && <p className="text-xs text-red-600 mt-1">Remarks are required for rejection.</p>}
          </div>
        </div>
      </Modal>
    </div>
  )
}
