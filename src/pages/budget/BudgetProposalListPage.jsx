import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { budgetPlanningApi } from "../../api/budgetPlanning";
import { useAuth } from "../../auth/AuthContext";
import { Rights } from "../../constants/rights";
import Icon from "../../components/Icon";
import Modal from "../../components/Modal";
import { useToast } from "../../components/Toast";

import SingleSelectDropdown from "../../components/SingleSelectDropdown";
import { ActionMenu, ActionMenuItem } from "../../components/ActionMenu";
import Pagination from "../../components/Pagination";

export default function BudgetProposalListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { hasRight } = useAuth();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [actionDialog, setActionDialog] = useState({
    isOpen: false,
    type: null,
    proposalId: null,
  });
  const [openMenuId, setOpenMenuId] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const toggleRow = (id) =>
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleOpenTopup = (proposalId, financialYear) => {
    navigate(`/budget-planning/wizard?proposalType=TOP_UP&parentProposalId=${proposalId}&financialYear=${encodeURIComponent(financialYear)}`);
  };
  // Filters State
  const [selectedYear, setSelectedYear] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const size = 10;
  const [stats, setStats] = useState({
    ACTIVE: 0,
    PENDING_APPROVAL: 0,
    DRAFT: 0,
  });
  const [availableYears, setAvailableYears] = useState([]);
  const canPropose = hasRight(Rights.BUDGET_CREATE);
  const canEditFutureQuarters = hasRight(Rights.BUDGET_EDIT_FUTURE_QUARTERS);

  useEffect(() => {
    loadStats();
  }, []);

  // Reset page to 0 on filter change
  useEffect(() => {
    setPage(0);
  }, [selectedYear, selectedStatus]);

  useEffect(() => {
    loadProposals();
  }, [selectedYear, selectedStatus, page]);

  const loadStats = async () => {
    try {
      const summary = await budgetPlanningApi.getProposalsSummary();
      setStats(summary.stats || { ACTIVE: 0, PENDING_APPROVAL: 0, DRAFT: 0 });
      setAvailableYears(summary.years || []);
    } catch (err) {
      console.error("Failed to load stats", err);
    }
  };

  const loadProposals = async () => {
    setLoading(true);
    try {
      const params = { page, size };
      if (selectedYear !== "ALL") params.year = selectedYear;
      if (selectedStatus !== "ALL") params.status = selectedStatus;
      const data = await budgetPlanningApi.getProposals(params);
      setProposals(data.content || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
    } catch (err) {
      toast.error("Failed to load budget proposals. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  const handleAction = async (action, id, overrideActive = false) => {
    try {
      if (action === "delete") {
        setActionDialog({ isOpen: true, type: action, proposalId: id });
        return;
      } else {
        setProcessing(true);
        if (action === "submit") {
          await budgetPlanningApi.submitProposal(id);
        }
      }
      await loadProposals();
    } catch (err) {
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        "An error occurred while processing the request.";
      toast.error(`Error: ${errMsg}`);
    } finally {
      setProcessing(false);
    }
  };
  const confirmAction = async () => {
    const { type, proposalId } = actionDialog;
    if (!proposalId || !type) return;
    try {
      setProcessing(true);
      if (type === "delete") {
        await budgetPlanningApi.deleteProposal(proposalId);
        setProposals((prev) => prev.filter((p) => p.id !== proposalId));
        toast.success("Draft proposal deleted successfully.");
      }
      setActionDialog({ isOpen: false, type: null, proposalId: null });
      if (type !== "delete") {
        await loadProposals();
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        "An error occurred while processing the request.";
      toast.error(errMsg);
    } finally {
      setProcessing(false);
    }
  };
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount || 0).replace('₹', '₹ ');

  const getProposalTypeBadge = (type) => {
    if (type === "TOP_UP") {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-50 text-orange-700 border border-orange-200 uppercase tracking-wide">
          <Icon name="arrowUpRight" className="h-2.5 w-2.5" /> Top-Up
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 uppercase tracking-wide border border-blue-100">
        Initial Budget
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const map = {
      DRAFT: { color: "bg-slate-100 text-slate-700", label: "Draft" },
      PENDING_APPROVAL: {
        color: "bg-amber-100 text-amber-700",
        label: "Pending Approval",
      },
      ACTIVE: {
        color:
          "bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-200",
        label: "Active",
      },
      NEEDS_REVISION: {
        color: "bg-rose-100 text-rose-700",
        label: "Needs Revision",
      },
      TERMINATED: { color: "bg-slate-100 text-slate-400", label: "Terminated" },
    };
    const s = map[status] || {
      color: "bg-slate-100 text-slate-700",
      label: status,
    };
    return (
      <span
        className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold ${s.color}`}
      >
        {s.label}
      </span>
    );
  };
  // Stats

  const initialBudgets = proposals.filter((p) => !p.parentProposalId);
  const topUpsByParent = proposals
    .filter((p) => p.parentProposalId)
    .reduce((acc, curr) => {
      if (!acc[curr.parentProposalId]) acc[curr.parentProposalId] = [];
      acc[curr.parentProposalId].push(curr);
      return acc;
    }, {});

  const activeCount = stats.ACTIVE || 0;
  const pendingCount = stats.PENDING_APPROVAL || 0;
  const draftCount = stats.DRAFT || 0;

  const renderActions = (item, isTopUp = false) => (
    <div onClick={(e) => e.stopPropagation()}>
      <ActionMenu triggerIcon="moreVertical" align="right">
        <ActionMenuItem
          label={!canPropose || item.status !== "DRAFT" ? "View" : "Edit"}
          onClick={(e) => { e?.stopPropagation?.(); navigate(`/budget-planning/wizard/${item.id}/step1`); }}
        />
        {canPropose && item.status === "DRAFT" && (
          <ActionMenuItem
            label="Delete"
            variant="danger"
            disabled={processing}
            onClick={(e) => { e?.stopPropagation?.(); handleAction("delete", item.id); }}
          />
        )}
        {canPropose && item.status === "NEEDS_REVISION" && (
          <ActionMenuItem
            label="Resubmit"
            variant="warning"
            onClick={(e) => { e?.stopPropagation?.(); navigate(`/budget-planning/wizard/${item.id}/step1`); }}
          />
        )}
        {canPropose && item.status === "APPROVED" && (
          <ActionMenuItem
            label="Complete Planning"
            onClick={(e) => { e?.stopPropagation?.(); navigate(`/budget-planning/wizard/${item.id}/step2`); }}
          />
        )}
        {!isTopUp && item.status === "ACTIVE" && (
          <>
            {canEditFutureQuarters && (
              <ActionMenuItem
                label="Edit Future Quarters"
                variant="purple"
                onClick={(e) => { e?.stopPropagation?.(); navigate(`/budget-planning/wizard/${item.id}/step2?editFutureQuarters=true`); }}
              />
            )}
            <ActionMenuItem
              label="Request Top-Up"
              variant="success"
              disabled={processing}
              onClick={(e) => { e?.stopPropagation?.(); handleOpenTopup(item.id, item.financialYear); }}
            />
          </>
        )}
      </ActionMenu>
    </div>
  );

  if (loading && proposals.length === 0) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Icon name="loader" className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }
  return (
    <div className="max-w-7xl mx-auto pt-2 pb-4 sm:pt-3 sm:pb-6 px-1 sm:px-6 lg:px-8 flex flex-col md:h-full md:overflow-hidden gap-4 md:gap-5">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div className="w-full sm:w-auto flex items-center gap-3">
          <div className="p-1.5 sm:p-2 bg-brand-50 rounded-lg border border-brand-100 shrink-0">
            <Icon name="barChart" className="h-5 w-5 sm:h-6 sm:w-6 text-brand-600" />
          </div>
          <h1 className="truncate text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight">
            Budget Proposals
          </h1>
        </div>
        <div className="flex flex-row flex-nowrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          {canPropose && (
            <button
              onClick={() => navigate("/budget-planning/wizard")}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 sm:px-3 sm:py-1.5 rounded-lg shadow-sm transition font-medium text-xs whitespace-nowrap"
            >
              <Icon name="plus" className="h-3.5 w-3.5 shrink-0" />
              <span>Create New</span>
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-slate-700 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 sm:px-3 sm:py-1.5 rounded-lg shadow-sm transition font-medium text-xs whitespace-nowrap"
          >
            <Icon name="filter" className="h-3.5 w-3.5 shrink-0" />
            <span>Filters</span>
            <Icon
              name="chevron"
              className={`h-3 w-3 shrink-0 transition-transform duration-300 ${showFilters ? "rotate-90" : "rotate-0"}`}
            />
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div
        className={`grid transition-all duration-300 ease-in-out shrink-0 ${showFilters ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
      >
        <div className="overflow-hidden">
          <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-2 lg:flex lg:flex-row lg:items-center gap-2.5 sm:gap-4">
            {/* Year Filter (Dropdown) */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-1 sm:gap-2 lg:gap-3 w-full min-w-0 lg:w-auto">
              <span className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                Period
              </span>
              <div className="w-full min-w-0 lg:w-48">
                <SingleSelectDropdown
                  value={selectedYear}
                  onChange={(val) => setSelectedYear(val)}
                  options={[
                    { value: "ALL", label: "All Years" },
                    ...availableYears.map((year) => ({ value: year, label: year })),
                  ]}
                />
              </div>
            </div>
            {/* Status Filter */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-1 sm:gap-2 lg:gap-3 w-full min-w-0 lg:w-auto">
              <span className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                Status
              </span>
              <div className="w-full min-w-0 lg:w-48">
                <SingleSelectDropdown
                  value={selectedStatus}
                  onChange={(val) => setSelectedStatus(val)}
                  options={[
                    { value: "ALL", label: "All Statuses" },
                    { value: "ACTIVE", label: "Active" },
                    { value: "PENDING_APPROVAL", label: "Pending Approval" },
                    { value: "DRAFT", label: "Draft" },
                    { value: "NEEDS_REVISION", label: "Needs Revision" },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Table Containers */}
      <div className="flex-1 min-h-0 bg-transparent md:bg-white md:rounded-xl md:shadow-sm md:border md:border-slate-200 flex flex-col md:overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block flex-1 overflow-y-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Budget
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {initialBudgets.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-12 text-center text-slate-500 text-sm"
                  >
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                        <Icon name="inbox" className="h-6 w-6 text-slate-400" />
                      </div>
                      <p>No proposals found. Create one to get started.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                initialBudgets.map((proposal) => {
                  const hasTopUps =
                    topUpsByParent[proposal.id] &&
                    topUpsByParent[proposal.id].length > 0;
                  const isExpanded = expandedRows[proposal.id];

                  return (
                    <React.Fragment key={proposal.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-slate-900 font-semibold flex items-center gap-2">
                          {hasTopUps && (
                            <button
                              onClick={() => toggleRow(proposal.id)}
                              className="w-6 h-6 flex items-center justify-center hover:bg-slate-200 rounded text-slate-500 transition-colors"
                            >
                              <Icon
                                name="chevron"
                                className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""
                                  }`}
                              />
                            </button>
                          )}
                          {!hasTopUps && <span className="w-6"></span>}
                          {proposal.financialYear || "-"}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {getProposalTypeBadge(proposal.proposalType)}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs font-semibold text-slate-700">
                          <div className="flex flex-col">
                            <span>
                              {formatCurrency(proposal.totalAnnualBudget)}
                            </span>
                            {proposal.totalTopupAmount > 0 && (
                              <span className="text-[10px] font-medium text-emerald-600">
                                + {formatCurrency(proposal.totalTopupAmount)}{" "}
                                (Top-Ups)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {getStatusBadge(proposal.status)}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-slate-500">
                          {new Date(proposal.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-right text-xs font-medium flex justify-end gap-4 opacity-100 md:opacity-80 md:group-hover:opacity-100 transition-opacity">
                          {renderActions(proposal, false)}
                        </td>
                      </tr>
                      {/* Top-Up Rows */}
                      {hasTopUps &&
                        isExpanded &&
                        topUpsByParent[proposal.id].map((topUp) => (
                          <tr
                            key={topUp.id}
                            className="bg-slate-50/50 hover:bg-slate-50 transition-colors group"
                          >
                            <td className="px-4 py-2.5 whitespace-nowrap text-xs text-slate-500 pl-14 border-l-4 border-l-amber-200">
                              {topUp.financialYear || "-"}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap border-l border-l-transparent">
                              {getProposalTypeBadge(topUp.proposalType)}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-xs font-semibold text-slate-600 border-l border-l-transparent">
                              {formatCurrency(topUp.totalAnnualBudget)}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap border-l border-l-transparent">
                              {getStatusBadge(topUp.status)}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-xs text-slate-400 border-l border-l-transparent">
                              {new Date(topUp.updatedAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-right text-xs font-medium flex justify-end gap-4 opacity-100 md:opacity-80 md:group-hover:opacity-100 transition-opacity border-l border-l-transparent">
                              {renderActions(topUp, true)}
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Mobile Card View */}
        <div className="md:hidden flex flex-col gap-2">
          {initialBudgets.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm flex flex-col items-center justify-center space-y-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                <Icon name="inbox" className="h-5 w-5 text-slate-400" />
              </div>
              <p>No proposals found.</p>
            </div>
          ) : (
            initialBudgets.map((proposal) => {
              const hasTopUps =
                topUpsByParent[proposal.id] &&
                topUpsByParent[proposal.id].length > 0;
              const isExpanded = expandedRows[proposal.id];

              return (
                <div key={proposal.id} className="flex flex-col gap-1">
                  <div
                    className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col transition-all hover:border-slate-300 active:bg-slate-50 cursor-pointer overflow-hidden"
                    onClick={() => navigate(`/budget-planning/wizard/${proposal.id}/step1`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/budget-planning/wizard/${proposal.id}/step1`); }}
                  >
                    <div className="p-2.5 sm:p-3 flex flex-col gap-1.5">
                      {/* Top Row */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-md border border-brand-100 bg-brand-50 flex items-center justify-center shrink-0 shadow-sm">
                            <Icon name="calendar" className="h-3 w-3 text-brand-600" />
                          </div>
                          <span className="text-xs font-extrabold text-slate-900 tracking-tight">
                            {proposal.financialYear || "-"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {getStatusBadge(proposal.status)}
                        </div>
                      </div>

                      {/* Main Content */}
                      <div className="flex justify-between items-end mt-1">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[13px] font-black text-brand-700 tracking-tight leading-none">
                            {formatCurrency(proposal.totalAnnualBudget)}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          {getProposalTypeBadge(proposal.proposalType)}
                        </div>
                      </div>
                    </div>

                    {/* Top-up summary toggle */}
                    {hasTopUps && (
                      <div className="bg-slate-200/60 border-t border-slate-100 text-xs">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(proposal.id);
                          }}
                          className="w-full flex items-center justify-center gap-1 font-semibold text-slate-600 hover:bg-slate-100 active:bg-slate-200 hover:text-slate-900 py-1.5 rounded-b-lg transition-colors"
                          aria-expanded={isExpanded}
                        >
                          {topUpsByParent[proposal.id].length} Top-Up{topUpsByParent[proposal.id].length > 1 ? 's' : ''} <span className="text-emerald-600 font-bold ml-0.5">({formatCurrency(proposal.totalTopupAmount)})</span>
                          <Icon
                            name="chevron"
                            className={`h-2.5 w-2.5 transition-transform duration-200 ${isExpanded ? "-rotate-90" : "rotate-90"}`}
                          />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Mobile Top-Up Cards */}
                  {hasTopUps && isExpanded && (
                    <div className="flex flex-col gap-1.5 ml-3 pl-2.5 border-l-2 border-amber-200 mt-1 mb-1">
                      {topUpsByParent[proposal.id].map((topUp) => (
                        <div
                          key={topUp.id}
                          onClick={() => navigate(`/budget-planning/wizard/${topUp.id}/step1`)}
                          className="bg-white rounded-lg shadow-sm border border-slate-100 p-2.5 flex flex-col gap-2 transition-colors hover:border-slate-200 active:bg-slate-50 cursor-pointer"
                          role="button"
                          tabIndex={0}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] sm:text-xs font-extrabold text-slate-900 tracking-tight">
                                {topUp.financialYear || "-"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {getStatusBadge(topUp.status)}
                            </div>
                          </div>
                          <div className="flex justify-between items-end mt-1">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[13px] font-black text-brand-700 tracking-tight leading-none block">
                                {formatCurrency(topUp.totalAnnualBudget)}
                              </span>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              {getProposalTypeBadge(topUp.proposalType)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Footer */}
        <div className="md:border-t border-slate-200 bg-transparent md:bg-slate-50 px-0 md:px-3 py-2 shrink-0 rounded-b-xl">
          <Pagination
            page={page}
            pageSize={size}
            totalElements={totalElements}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      </div>
      {/* Action Dialog (Delete) */}
      <Modal
        open={actionDialog.isOpen}
        onClose={() =>
          setActionDialog({ isOpen: false, type: null, proposalId: null })
        }
        title="Delete Draft Proposal"
        footer={
          <>
            <button
              onClick={() =>
                setActionDialog({ isOpen: false, type: null, proposalId: null })
              }
              className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
              disabled={processing}
            >
              Cancel
            </button>
            <button
              onClick={confirmAction}
              className={`rounded-md px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition ${actionDialog.type === "reject"
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-slate-600 hover:bg-slate-700"
                } disabled:opacity-50`}
              disabled={processing}
            >
              {processing ? "Processing..." : "Confirm"}
            </button>
          </>
        }
      >
        <div className="py-2 text-sm text-slate-600">
          <p>
            Are you sure you want to permanently delete draft proposal{" "}
            <span className="font-bold text-slate-900">
              #{actionDialog.proposalId}
            </span>
            ? This action cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
}
