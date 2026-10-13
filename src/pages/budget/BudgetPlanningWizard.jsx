import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  budgetMasterDataApi,
  masterApi,
  eventCategoryApi,
} from "../../api/masterData";
import { posDataApi } from "../../api/posData";
import { budgetPlanningApi } from "../../api/budgetPlanning";
import Icon from "../../components/Icon";
import { useToast } from "../../components/Toast";
import { useAuth } from "../../auth/AuthContext";
import { Rights } from "../../constants/rights";

import Step1VerticalCaps from "../../components/budget/Step1VerticalCaps";
import Step2EventCampaignMatrix from "../../components/budget/Step2EventCampaignMatrix";
import Step3TaskStateMatrix from "../../components/budget/Step3TaskStateMatrix";
import Modal from "../../components/Modal";
import SingleSelectDropdown from "../../components/SingleSelectDropdown";

export default function BudgetPlanningWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const proposalType = searchParams.get("proposalType") || "INITIAL_BUDGET";
  const parentProposalId = searchParams.get("parentProposalId") || null;
  const urlFinancialYear = searchParams.get("financialYear") || null;

  // Helper to preserve query params during navigation
  const navigateWithParams = (path, options) => {
    const qs = searchParams.toString();
    const finalPath = qs ? (path.includes('?') ? `${path}&${qs}` : `${path}?${qs}`) : path;
    navigate(finalPath, options);
  };

  const toast = useToast();
  const { hasRight } = useAuth();
  const canPropose = hasRight(Rights.BUDGET_CREATE);
  const canEditFutureQuarters = hasRight(Rights.BUDGET_EDIT_FUTURE_QUARTERS);
  const { proposalId: urlProposalId, stepId } = useParams();
  const [proposalId, setProposalId] = useState(urlProposalId || null);
  const currentStep = stepId === "step2" ? 2 : stepId === "step3" ? 3 : 1;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const [proposalStatus, setProposalStatus] = useState(null);


  const [isFutureQuartersEditMode, setIsFutureQuartersEditMode] = useState(false);

  const urlReadOnly = searchParams.get("readOnly") === "true";
  const editFutureQuarters = searchParams.get("editFutureQuarters") === "true";
  const fromApprovals = searchParams.get("fromApprovals") === "true" || searchParams.get("source") === "approvals";


  // Master Data State
  const [verticals, setVerticals] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [eventCategories, setEventCategories] = useState([]);
  const [states, setStates] = useState([]);

  // Budget State
  const [financialYear, setFinancialYear] = useState("");
  const [periodId, setPeriodId] = useState(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const [totalAnnualBudget, setTotalAnnualBudget] = useState(0);
  const [savedTotalAnnualBudget, setSavedTotalAnnualBudget] = useState(0);
  const [verticalCaps, setVerticalCaps] = useState({}); // { verticalId: capAmount }
  const [savedVerticalCaps, setSavedVerticalCaps] = useState({});
  const [quarterlyCaps, setQuarterlyCaps] = useState({
    Q1: {},
    Q2: {},
    Q3: {},
    Q4: {},
  });
  const [savedQuarterlyCaps, setSavedQuarterlyCaps] = useState({
    Q1: {},
    Q2: {},
    Q3: {},
    Q4: {},
  });
  const [step2Matrix, setStep2Matrix] = useState({}); // { verticalId: { ecId_ctId: targetAmount } }
  const [savedStep2Matrix, setSavedStep2Matrix] = useState({});
  const [savedQuarterlyStep2Matrix, setSavedQuarterlyStep2Matrix] = useState({
    Q1: {},
    Q2: {},
    Q3: {},
    Q4: {},
  });
  const [allocations, setAllocations] = useState({}); // { comboId: { taskTypeId_stateCode: allocatedAmount } }

  // Quarterly state for Step 2 & 3
  const [activePeriod, setActivePeriod] = useState("Annual");
  const [hasGeneratedQuarters, setHasGeneratedQuarters] = useState(false);
  const [quarterlyPeriods, setQuarterlyPeriods] = useState({ Q1: null, Q2: null, Q3: null, Q4: null });
  const [quarterlyStep2Matrix, setQuarterlyStep2Matrix] = useState({
    Q1: {},
    Q2: {},
    Q3: {},
    Q4: {},
  });
  const [quarterlyAllocations, setQuarterlyAllocations] = useState({
    Q1: [],
    Q2: [],
    Q3: [],
    Q4: [],
  });

  let isActivePeriodLocked = false;
  if (isFutureQuartersEditMode) {
    if (activePeriod === "Annual") {
      isActivePeriodLocked = true;
    } else {
      const qPeriod = quarterlyPeriods[activePeriod];
      if (qPeriod) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const parts = qPeriod.startDate.split("-");
        const start = new Date(parts[0], parts[1] - 1, parts[2]);
        start.setHours(0, 0, 0, 0);
        const daysUntil = (start - today) / (1000 * 60 * 60 * 24);
        if (daysUntil < 0) {
          isActivePeriodLocked = true;
        }
      }
    }
  }

  const isReadOnly =
    urlReadOnly
      ? true
      : !canPropose
        ? true
        : proposalStatus === "ACTIVE"
          ? (isFutureQuartersEditMode ? isActivePeriodLocked : true)
          : currentStep === 1
            ? proposalStatus &&
            proposalStatus !== "DRAFT" &&
            proposalStatus !== "NEEDS_REVISION" &&
            proposalStatus !== "REJECTED"
            : proposalStatus &&
            proposalStatus !== "APPROVED" &&
            proposalStatus !== "DRAFT" &&
            proposalStatus !== "NEEDS_REVISION" &&
            proposalStatus !== "REJECTED";



  // Auto-activate future quarters edit mode when navigated via URL param
  useEffect(() => {
    if (editFutureQuarters) {
      setIsFutureQuartersEditMode(true);
    }
  }, [editFutureQuarters]);

  // Approve/Reject modal state (for viewing from approvals page)
  const [approveRejectModal, setApproveRejectModal] = useState({
    isOpen: false,
    action: null, // 'approve' | 'reject'
    comments: '',
    commentsError: false,
  });

  const openApproveRejectModal = (action) => {
    setApproveRejectModal({ isOpen: true, action, comments: '', commentsError: false });
  };

  const handleApproveReject = async () => {
    if (approveRejectModal.action === 'reject' && !approveRejectModal.comments.trim()) {
      setApproveRejectModal(prev => ({ ...prev, commentsError: true }));
      return;
    }
    setSubmitting(true);
    try {
      if (approveRejectModal.action === 'approve') {
        await budgetPlanningApi.approveProposal(proposalId, false);
        toast.success('Budget proposal approved successfully');
      } else {
        await budgetPlanningApi.rejectProposal(proposalId, { reason: approveRejectModal.comments });
        toast.success('Budget proposal rejected');
      }
      setApproveRejectModal({ isOpen: false, action: null, comments: '', commentsError: false });
      navigateWithParams(fromApprovals ? '/budget/approvals' : '/budget-planning');
    } catch (err) {
      // Handle override active scenario
      if (approveRejectModal.action === 'approve' && err.response?.status === 409 && err.response?.data?.message === 'ACTIVE_PROPOSAL_EXISTS') {
        try {
          await budgetPlanningApi.approveProposal(proposalId, true);
          toast.success('Budget proposal approved (Old Active Terminated)');
          setApproveRejectModal({ isOpen: false, action: null, comments: '', commentsError: false });
          navigateWithParams(fromApprovals ? '/budget/approvals' : '/budget-planning');
        } catch (innerErr) {
          toast.error(innerErr?.response?.data?.message || 'Failed to approve with override');
        }
      } else {
        toast.error(err?.response?.data?.message || err?.message || `Failed to ${approveRejectModal.action}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
    onCancel: null,
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [vData, ttData, ecData, stData] = await Promise.all([
          masterApi.list("business-verticals"),
          masterApi.list("task-types"),
          eventCategoryApi.list(),
          posDataApi.getStates("1"),
        ]);
        setVerticals(vData || []);
        setTaskTypes(ttData || []);
        setEventCategories(ecData || []);
        setStates(stData || []);

        // Load existing proposal if URL has proposalId
        if (urlProposalId) {
          await fetchProposalData(urlProposalId);
        }
      } catch (err) {
        toast.error(err?.response?.data?.message || "Failed to load required data. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [urlProposalId]);

  const fetchProposalData = async (idToFetch) => {
    try {
      const proposal = await budgetPlanningApi.getProposalById(idToFetch);
      if (proposal) {
        setFinancialYear(proposal.financialYear || "");
        setPeriodId(proposal.periodId || null);
        setTotalAnnualBudget(proposal.totalAnnualBudget || 0);
        setSavedTotalAnnualBudget(proposal.totalAnnualBudget || 0);
        setIsFrozen(true);
        setProposalStatus(proposal.status);

        // Reconstruct vertical caps
        const loadedCaps = {};
        if (proposal.verticalCaps) {
          proposal.verticalCaps.forEach((cap) => {
            loadedCaps[cap.verticalId] = cap.allocatedCap;
          });
        }
        setVerticalCaps(loadedCaps);
        setSavedVerticalCaps(loadedCaps);

        const loadedQCaps = { Q1: {}, Q2: {}, Q3: {}, Q4: {} };
        if (proposal.quarterlyCaps) {
          Object.keys(proposal.quarterlyCaps).forEach((q) => {
            proposal.quarterlyCaps[q].forEach((cap) => {
              loadedQCaps[q][cap.verticalId] = cap.allocatedCap;
            });
          });
        }
        setQuarterlyCaps(loadedQCaps);
        setSavedQuarterlyCaps(loadedQCaps);

        setQuarterlyPeriods(proposal.quarterlyPeriods || { Q1: null, Q2: null, Q3: null, Q4: null });

        // Check if quarters have been generated by checking quarterlyTargetCaps
        const isGenerated =
          proposal.quarterlyTargetCaps &&
          Object.keys(proposal.quarterlyTargetCaps).some(
            (q) => proposal.quarterlyTargetCaps[q].length > 0,
          );
        setHasGeneratedQuarters(isGenerated);

        // Reconstruct step2Matrix
        const loadedStep2 = {};

        if (proposal.targetCaps) {
          proposal.targetCaps.forEach((cap) => {
            if (!loadedStep2[cap.verticalId]) loadedStep2[cap.verticalId] = {};
            loadedStep2[cap.verticalId][cap.eventCategoryId] = cap.allocatedCap;
          });
        }

        setStep2Matrix(loadedStep2);
        setSavedStep2Matrix(loadedStep2);

        const loadedQStep2 = { Q1: {}, Q2: {}, Q3: {}, Q4: {} };
        if (proposal.quarterlyTargetCaps) {
          Object.keys(proposal.quarterlyTargetCaps).forEach((q) => {
            proposal.quarterlyTargetCaps[q].forEach((cap) => {
              if (!loadedQStep2[q][cap.verticalId])
                loadedQStep2[q][cap.verticalId] = {};
              loadedQStep2[q][cap.verticalId][cap.eventCategoryId] = cap.allocatedCap;
            });
          });
        }
        setQuarterlyStep2Matrix(loadedQStep2);
        setSavedQuarterlyStep2Matrix(loadedQStep2);

        // Hydrate allocations from groupedAllocations
        setAllocations(proposal.groupedAllocations || []);
        setQuarterlyAllocations(
          proposal.quarterlyGroupedAllocations || {
            Q1: [],
            Q2: [],
            Q3: [],
            Q4: [],
          },
        );

        if (!stepId) {
          const hasCaps =
            proposal.verticalCaps && proposal.verticalCaps.length > 0;
          const hasAllocations =
            proposal.allocations && proposal.allocations.length > 0;

          let targetStep = "step1";
          if (hasCaps && !hasAllocations) {
            // Caps are there, but no allocations means step 2 or 3 is incomplete.
            // We'll direct them to step 2 by default so they can continue the matrix flow.
            targetStep = "step2";
          } else if (hasCaps && hasAllocations) {
            // If they have allocations too, maybe they are just editing step 3
            targetStep = "step3";
          }
          navigateWithParams(`/budget-planning/wizard/${urlProposalId}/${targetStep}`, {
            replace: true,
          });
        }
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load proposal. Please try again.");
    }
  };

  // Compute total allocated vertical caps (step 1)
  const totalAllocatedCaps = Object.values(verticalCaps).reduce(
    (sum, val) => sum + (val || 0),
    0,
  );

  // Compute total allocated step 2 matrix
  const totalAllocatedStep2 = Object.values(step2Matrix).reduce(
    (sum, matrix) => {
      return (
        sum + Object.values(matrix).reduce((mSum, val) => mSum + (val || 0), 0)
      );
    },
    0,
  );

  // Route Guard & Locks
  useEffect(() => {
    if (loading) return;

    // Check Status Locks
    if (currentStep > 1) {
      if (!canPropose && proposalStatus !== "ACTIVE") {
        toast.error("Steps 2 and 3 are locked until the planner completes them.");
        navigateWithParams(`/budget-planning/wizard/${proposalId || ""}/step1`, { replace: true });
        return;
      }
      if (canPropose && proposalStatus !== "APPROVED" && proposalStatus !== "ACTIVE") {
        toast.error("Steps 2 and 3 are locked until Step 1 is approved by the approver.");
        navigateWithParams(`/budget-planning/wizard/${proposalId || ""}/step1`, { replace: true });
        return;
      }
    }

    if (
      (currentStep === 2 || currentStep === 3) &&
      (!isFrozen || totalAnnualBudget <= 0)
    ) {
      toast.error(
        "Please freeze the annual budget and set vertical caps first.",
      );
      navigateWithParams(`/budget-planning/wizard/${proposalId || ""}/step1`, {
        replace: true,
      });
      return;
    }
    if (currentStep === 3) {
      if (
        Math.round(totalAllocatedStep2 * 100) !== Math.round(totalAllocatedCaps * 100) ||
        (proposalType !== "TOP_UP" && totalAllocatedCaps === 0)
      ) {
        navigateWithParams(`/budget-planning/wizard/${proposalId || ""}/step2`, {
          replace: true,
        });
        return;
      }
    }
  }, [
    currentStep,
    isFrozen,
    totalAnnualBudget,
    totalAllocatedStep2,
    totalAllocatedCaps,
    loading,
    navigate,
    proposalId,
    toast,
    proposalStatus,
  ]);

  const handleFreeze = async () => {
    // Level 1 Cascade Reset
    if (
      savedTotalAnnualBudget > 0 &&
      savedTotalAnnualBudget !== totalAnnualBudget
    ) {
      setConfirmDialog({
        isOpen: true,
        title: "Confirm Reset",
        message:
          "Changing the Total Annual Budget will reset your Vertical Caps. Do you want to continue?",
        onConfirm: () => {
          setVerticalCaps({});
          setStep2Matrix({});
          setAllocations([]);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          executeFreeze();
        },
        onCancel: () => {
          setTotalAnnualBudget(savedTotalAnnualBudget);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        },
      });
      return;
    }
    executeFreeze();
  };

  const executeFreeze = async () => {
    setFreezing(true);
    try {
      const proposal = await budgetPlanningApi.freezeAnnualBudget({
        proposalId,
        financialYear,
        totalAnnualBudget,
        proposalType,
        parentProposalId
      });
      const newProposalId = proposal.proposalId || proposal.id;
      setProposalId(newProposalId);
      setPeriodId(proposal.periodId);
      setIsFrozen(true);
      setSavedTotalAnnualBudget(totalAnnualBudget);
      navigateWithParams(`/budget-planning/wizard/${newProposalId}/step1`, {
        replace: true,
      });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to freeze annual budget. Please try again.");
    } finally {
      setFreezing(false);
    }
  };

  const handleUnfreeze = () => {
    setIsFrozen(false);
  };

  const handleSubmit = async () => {
    if (!proposalId) return;

    // Check if all combinations are allocated and saved
    const activeComboCount = Object.values(step2Matrix).reduce(
      (count, matrix) => {
        return count + Object.values(matrix).filter((val) => val > 0).length;
      },
      0,
    );

    const savedComboCount = allocations.filter(
      (a) => a.taskAllocations && a.taskAllocations.length > 0,
    ).length;

    if (savedComboCount < activeComboCount) {
      toast.error(
        "Please save and freeze all active combinations before submitting.",
      );
      return;
    }

    setSubmitting(true);
    try {
      if (proposalStatus === "APPROVED") {
        await budgetPlanningApi.submitOperationalPlan(proposalId);
        toast.success("Operational Plan Activated Successfully!");
      } else {
        await budgetPlanningApi.submitProposal(proposalId);
        toast.success("Budget Proposal Submitted Successfully!");
      }

      navigateWithParams("/budget-planning");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to submit budget. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      if (isReadOnly) {
        navigateWithParams(`/budget-planning/wizard/${proposalId}/step2`);
        return;
      }

      const sumOfCaps = Object.values(verticalCaps).reduce(
        (sum, cap) => sum + Number(cap || 0),
        0,
      );

      if (sumOfCaps > Number(totalAnnualBudget)) {
        toast.error(
          `Vertical caps sum (${sumOfCaps}) exceeds total annual budget (${totalAnnualBudget})`,
        );
        return;
      }

      if (!isFrozen) {
        toast.error("Please freeze the annual budget before proceeding.");
        return;
      }

      // Deep compare caps to avoid destructive reset if not changed
      const isCapsChanged =
        JSON.stringify(verticalCaps) !== JSON.stringify(savedVerticalCaps);

      if (!isCapsChanged) {
        navigateWithParams(`/budget-planning/wizard/${proposalId}/step2`);
        return;
      }

      try {
        const capsArray = Object.entries(verticalCaps).map(([vId, cap]) => ({
          verticalId: vId,
          allocatedCap: cap,
        }));

        // Format quarterly caps payload
        const quarterlyCapsPayload = {};
        ["Q1", "Q2", "Q3", "Q4"].forEach((q) => {
          quarterlyCapsPayload[q] = [];
          if (quarterlyCaps[q]) {
            Object.entries(quarterlyCaps[q]).forEach(([vId, cap]) => {
              quarterlyCapsPayload[q].push({
                verticalId: vId,
                allocatedCap: cap,
              });
            });
          }
        });

        const payload = {
          periodId: periodId,
          caps: capsArray,
          quarterlyCaps: quarterlyCapsPayload,
        };

        await budgetPlanningApi.saveVerticalCaps(proposalId, payload);

        // Level 2 Cascade Reset
        setSavedVerticalCaps(verticalCaps);
        setSavedQuarterlyCaps(quarterlyCaps);
        setStep2Matrix({});
        setSavedStep2Matrix({});
        setAllocations({});

        if (!proposalStatus || proposalStatus === "DRAFT" || proposalStatus === "REJECTED") {
          await budgetPlanningApi.submitProposal(proposalId);
          toast.success("Budget Submitted for Approval!");
          navigateWithParams("/budget-planning");
        } else {
          toast.success("Vertical Caps Saved!");
          navigateWithParams(`/budget-planning/wizard/${proposalId}/step2`);
        }
      } catch (err) {
        const errMsg =
          err.response?.data?.message ||
          err.message ||
          "Failed to save vertical caps. Please try again.";
        toast.error(errMsg);
      }
    } else if (currentStep === 2) {
      if (isReadOnly) {
        navigateWithParams(`/budget-planning/wizard/${proposalId}/step3`);
        return;
      }

      // Determine which matrix and caps to use based on active period
      const currentMatrix = activePeriod === "Annual" ? step2Matrix : quarterlyStep2Matrix[activePeriod];
      const currentCaps = activePeriod === "Annual" ? verticalCaps : quarterlyCaps[activePeriod];
      const currentSavedMatrix = activePeriod === "Annual" ? savedStep2Matrix : savedQuarterlyStep2Matrix[activePeriod];

      // Compute totals for the current period
      const currentTotalAllocated = Object.values(currentMatrix).reduce(
        (sum, matrix) => sum + Object.values(matrix).reduce((mSum, val) => mSum + (val || 0), 0), 0
      );
      const currentTotalCaps = Object.values(currentCaps).reduce((sum, cap) => sum + (Number(cap) || 0), 0);

      if (Math.round(currentTotalAllocated * 100) !== Math.round(currentTotalCaps * 100)) {
        toast.error(
          `Please allocate the full vertical caps amount (₹${currentTotalCaps.toLocaleString()}) in the matrix.`,
        );
        return;
      }

      const isMatrixChanged = JSON.stringify(currentMatrix) !== JSON.stringify(currentSavedMatrix);
      const isFirstTimeEntry = Object.keys(currentSavedMatrix).length === 0;

      if (!isMatrixChanged) {
        navigateWithParams(`/budget-planning/wizard/${proposalId}/step3`);
        return;
      }

      // Determine if editing a specific quarter (either via unlock or future quarters mode)
      const isQuarterEdit = proposalStatus === "ACTIVE" && isFutureQuartersEditMode && activePeriod !== "Annual";
      const isFutureQuartersEdit = isQuarterEdit && isFutureQuartersEditMode;

      const saveTargetsAndProceed = async () => {
        try {
          const targetCapsArray = [];
          Object.entries(currentMatrix).forEach(([vId, ecMap]) => {
            Object.entries(ecMap).forEach(([ecId, cap]) => {
              if (cap > 0) {
                targetCapsArray.push({
                  verticalId: vId,
                  eventCategoryId: Number(ecId),
                  allocatedCap: cap,
                });
              }
            });
          });

          const payloadPeriodId = isQuarterEdit ? quarterlyPeriods[activePeriod].periodId : periodId;
          const payload = {
            periodId: payloadPeriodId,
            targetCaps: targetCapsArray,
          };

          // Route to the correct API based on mode
          if (isFutureQuartersEdit) {
            await budgetPlanningApi.updateFutureQuartersTargets(proposalId, payload);
          } else {
            await budgetPlanningApi.saveTargetCaps(proposalId, payload);
          }

          // Refetch to sync
          const updatedProposal = await budgetPlanningApi.getProposalById(proposalId);
          if (updatedProposal) {
            const isGenerated =
              updatedProposal.quarterlyTargetCaps &&
              Object.keys(updatedProposal.quarterlyTargetCaps).some(
                (q) => updatedProposal.quarterlyTargetCaps[q].length > 0,
              );
            setHasGeneratedQuarters(isGenerated);

            const loadedQStep2 = { Q1: {}, Q2: {}, Q3: {}, Q4: {} };
            if (updatedProposal.quarterlyTargetCaps) {
              Object.keys(updatedProposal.quarterlyTargetCaps).forEach((q) => {
                updatedProposal.quarterlyTargetCaps[q].forEach((cap) => {
                  if (!loadedQStep2[q][cap.verticalId])
                    loadedQStep2[q][cap.verticalId] = {};
                  loadedQStep2[q][cap.verticalId][cap.eventCategoryId] = cap.allocatedCap;
                });
              });
            }
            setQuarterlyStep2Matrix(loadedQStep2);
            setSavedQuarterlyStep2Matrix(loadedQStep2);
          }

          // Cascade Reset: clear Step 3 allocations affected by this change
          if (isQuarterEdit) {
            // For quarter edits, clear ALL allocations for that quarter (backend already does this)
            setQuarterlyAllocations(prev => ({
              ...prev,
              [activePeriod]: []
            }));
          } else {
            // For annual edits, reset allocations for changed combinations
            const updatedAllocations = allocations.filter((alloc) => {
              const oldAmount = savedStep2Matrix[alloc.verticalId]?.[alloc.eventCategoryId];
              const newAmount = step2Matrix[alloc.verticalId]?.[alloc.eventCategoryId] || 0;
              return oldAmount === newAmount;
            });
            setAllocations(updatedAllocations);
          }

          // Update saved state
          if (isQuarterEdit) {
            const qMatrix = quarterlyStep2Matrix[activePeriod];
            setSavedQuarterlyStep2Matrix(prev => ({
              ...prev,
              [activePeriod]: qMatrix
            }));
          } else {
            setSavedStep2Matrix(step2Matrix);
          }

          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          navigateWithParams(`/budget-planning/wizard/${proposalId}/step3`);
        } catch (err) {
          const errMsg =
            err.response?.data?.message ||
            err.message ||
            "Failed to save target caps. Please try again.";
          toast.error(errMsg);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      };

      if (isQuarterEdit && !isFirstTimeEntry) {
        setConfirmDialog({
          isOpen: true,
          title: "Warning: Destructive Action",
          message: "Step 3 data will be cleared. If you click Continue, Step 3 details will be cleared and you will need to fill them again. Do you wish to proceed?",
          onConfirm: saveTargetsAndProceed,
          onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        });
        return;
      }

      if (isFirstTimeEntry) {
        saveTargetsAndProceed();
      } else {
        setConfirmDialog({
          isOpen: true,
          title: "Confirm Matrix Modification",
          message:
            "Step 3 data will be cleared for the modified combinations. If you click Continue, those Step 3 details will be cleared and you will need to fill them again.",
          onConfirm: saveTargetsAndProceed,
          onCancel: () => {
            setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          },
        });
      }
    } else {
      navigateWithParams(
        `/budget-planning/wizard/${proposalId}/step${Math.min(3, currentStep + 1)}`,
      );
    }
  };

  // Determine if next is enabled
  const canProceedFromStep1 =
    isFrozen && totalAllocatedCaps === totalAnnualBudget; // Kept for other references if needed

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center">
        <Icon name="loader" className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateWithParams(fromApprovals ? "/budget/approvals" : "/budget-planning")}
            className="flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-brand-600 hover:border-brand-200 shadow-sm transition-all"
            title={fromApprovals ? "Back to Budget Approvals" : "Back to Budget Planning"}
          >
            <Icon name="arrowLeft" className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight">
            Budget Planning
          </h1>
        </div>
        {proposalStatus === "ACTIVE" &&
          (currentStep === 2 || currentStep === 3) && (
            <div className={`flex items-center gap-2 sm:gap-3 px-3 py-2 rounded-lg shadow-sm border ${isFutureQuartersEditMode ? 'bg-violet-50 border-violet-200' : 'bg-white border-slate-200'} w-full md:w-auto`}>

              <div className="flex items-center gap-2 px-1 shrink-0">
                {isFutureQuartersEditMode ? (
                  <>
                    <Icon name="pencil" className="h-5 w-5 text-violet-600 shrink-0" />
                    <span className="text-sm font-semibold text-violet-800 shrink-0">Edit Mode</span>
                  </>
                ) : null}

                {isFutureQuartersEditMode && <div className="h-5 w-px bg-slate-200 mx-1"></div>}

                <label className={`text-sm font-semibold shrink-0 ${isFutureQuartersEditMode ? 'text-violet-800' : 'text-slate-700'}`}>
                  Period:
                </label>
              </div>

              <div className="w-full sm:w-48 z-10 flex-1">
                <SingleSelectDropdown
                  value={activePeriod}
                  onChange={(val) => setActivePeriod(val)}
                  options={[
                    { value: "Annual", label: "Annual" },
                    ...["Q1", "Q2", "Q3", "Q4"].map((q) => {
                      const qPeriod = quarterlyPeriods[q];
                      let lockIcon = "";
                      if (qPeriod && isFutureQuartersEditMode) {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const parts = qPeriod.startDate.split("-");
                        const start = new Date(parts[0], parts[1] - 1, parts[2]);
                        start.setHours(0, 0, 0, 0);
                        const daysUntil = (start - today) / (1000 * 60 * 60 * 24);
                        lockIcon = daysUntil < 0 ? " 🔒" : "";
                      }
                      return { value: q, label: `${q}${lockIcon}` };
                    })
                  ]}
                />
              </div>
              {activePeriod !== "Annual" && (
                (() => {
                  const qPeriod = quarterlyPeriods[activePeriod];
                  if (!qPeriod) return null;

                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const startDateParts = qPeriod.startDate.split("-");
                  const startDate = new Date(startDateParts[0], startDateParts[1] - 1, startDateParts[2]);
                  startDate.setHours(0, 0, 0, 0);

                  const daysUntil = (startDate - today) / (1000 * 60 * 60 * 24);

                  if (isFutureQuartersEditMode) {
                    if (daysUntil < 0) {
                      return (
                        <span className="ml-2 flex items-center gap-1 text-xs font-medium text-slate-500">
                          <Icon name="lock" className="h-3.5 w-3.5" />
                          Past quarter — locked
                        </span>
                      );
                    }
                    return (
                      <span className="ml-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <Icon name="check" className="h-3.5 w-3.5" />
                        Editable
                      </span>
                    );
                  }

                  return null;
                })()
              )}
            </div>
          )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="border-b border-slate-200 bg-slate-50/50 shrink-0">
          <nav aria-label="Progress" className="flex">
            {[1, 2, 3].map((step, idx) => {
              const isTabDisabled = (step > 1 && (
                (!canPropose && proposalStatus !== "ACTIVE") ||
                (canPropose && proposalStatus !== "APPROVED" && proposalStatus !== "ACTIVE")
              )) || (step === 3 && (Math.round(totalAllocatedStep2 * 100) !== Math.round(totalAllocatedCaps * 100) || (proposalType !== "TOP_UP" && totalAllocatedCaps === 0)));
              return (
                <button
                  key={step}
                  onClick={() =>
                    !isTabDisabled && navigateWithParams(
                      proposalId
                        ? `/budget-planning/wizard/${proposalId}/step${step}${window.location.search}`
                        : `/budget-planning/wizard/step${step}${window.location.search}`,
                    )
                  }
                  disabled={isTabDisabled}
                  className={`relative flex-1 flex items-center justify-center py-4 text-sm font-medium transition
                  ${currentStep === step
                      ? "text-brand-600 bg-white border-b-2 border-brand-500"
                      : isTabDisabled
                        ? "text-slate-400 bg-slate-50 cursor-not-allowed border-b-2 border-transparent"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/80 border-b-2 border-transparent"
                    }
                  ${idx !== 2 ? "border-r border-slate-200" : ""}
                `}
                >
                  <span
                    className={`mr-1.5 sm:mr-2 flex h-5 w-5 sm:h-6 sm:w-6 text-[10px] sm:text-sm shrink-0 items-center justify-center rounded-full border-2 
                  ${currentStep === step ? "border-brand-600 text-brand-600 bg-brand-50" : "border-slate-300"}`}
                  >
                    {step}
                  </span>

                  <span className="hidden sm:inline">
                    {step === 1 ? "Vertical Caps" : step === 2 ? "Target Matrix" : "Task Distribution"}
                  </span>
                  <span className="sm:hidden text-[11px] font-semibold">
                    {step === 1 ? "Caps" : step === 2 ? "Matrix" : "Tasks"}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 sm:p-6 bg-slate-50/30 flex-1 flex flex-col min-h-0 overflow-hidden">
          {currentStep === 1 && (
            <Step1VerticalCaps
              financialYear={financialYear}
              setFinancialYear={setFinancialYear}
              totalAnnualBudget={totalAnnualBudget}
              setTotalAnnualBudget={setTotalAnnualBudget}
              verticals={verticals}
              verticalCaps={verticalCaps}
              setVerticalCaps={setVerticalCaps}
              quarterlyCaps={quarterlyCaps}
              setQuarterlyCaps={setQuarterlyCaps}
              isFrozen={isFrozen}
              onFreeze={handleFreeze}
              onUnfreeze={handleUnfreeze}
              freezing={freezing}
              isReadOnly={isReadOnly}
              proposalType={proposalType}
              urlFinancialYear={urlFinancialYear}
            />
          )}
          {currentStep === 2 && (
            <Step2EventCampaignMatrix
              verticals={verticals}
              eventCategories={eventCategories}
              step2Matrix={
                activePeriod === "Annual"
                  ? step2Matrix
                  : quarterlyStep2Matrix[activePeriod]
              }
              setStep2Matrix={
                activePeriod === "Annual"
                  ? setStep2Matrix
                  : (updater) => setQuarterlyStep2Matrix(prev => ({
                    ...prev,
                    [activePeriod]: typeof updater === 'function' ? updater(prev[activePeriod] || {}) : updater
                  }))
              }
              verticalCaps={
                activePeriod === "Annual"
                  ? verticalCaps
                  : quarterlyCaps[activePeriod]
              }
              isReadOnly={isReadOnly}
              activePeriod={activePeriod}
            />
          )}
          {currentStep === 3 && (
            <Step3TaskStateMatrix
              proposalId={proposalId}
              periodId={periodId}
              verticals={verticals}
              eventCategories={eventCategories}
              taskTypes={taskTypes}
              states={states}
              step2Matrix={
                activePeriod === "Annual"
                  ? step2Matrix
                  : quarterlyStep2Matrix[activePeriod]
              }
              allocations={
                activePeriod === "Annual"
                  ? allocations
                  : quarterlyAllocations[activePeriod]
              }
              setAllocations={
                activePeriod === "Annual"
                  ? setAllocations
                  : (updater) => setQuarterlyAllocations(prev => ({
                    ...prev,
                    [activePeriod]: typeof updater === 'function' ? updater(prev[activePeriod] || []) : updater
                  }))
              }
              setQuarterlyAllocations={setQuarterlyAllocations}
              isReadOnly={isReadOnly}
              activePeriod={activePeriod}
              hasGeneratedQuarters={hasGeneratedQuarters}
              setHasGeneratedQuarters={setHasGeneratedQuarters}
              quarterlyAllocations={quarterlyAllocations}
              annualAllocations={allocations}
              onMatrixSaved={() => fetchProposalData(urlProposalId)}

              isFutureQuartersEditMode={isFutureQuartersEditMode}
              quarterlyPeriods={quarterlyPeriods}
            />
          )}
        </div>

        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-slate-200 bg-slate-50/50 gap-4">
          {/* Previous button - hide when viewing from approvals */}
          {!fromApprovals && canPropose ? (
            <button
              className={`flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition
                ${currentStep === 1
                  ? "text-slate-300 cursor-not-allowed"
                  : "text-slate-600 hover:bg-white hover:text-slate-800 border border-slate-200 hover:shadow-sm bg-white"
                }`}
              onClick={() =>
                navigateWithParams(
                  `/budget-planning/wizard/${proposalId}/step${Math.max(1, currentStep - 1)}`,
                )
              }
              disabled={currentStep === 1}
            >
              <Icon name="chevronLeft" className="h-4 w-4" /> <span>Previous</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center justify-end gap-3">
            {/* Approve/Reject buttons when viewing from approvals page */}
            {fromApprovals && proposalStatus === "PENDING_APPROVAL" ? (
              <>
                <button
                  className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-5 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-100 transition disabled:opacity-50"
                  onClick={() => openApproveRejectModal('reject')}
                  disabled={submitting}
                >
                  <Icon name="xCircle" className="h-4 w-4" /> Reject
                </button>
                <button
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
                  onClick={() => openApproveRejectModal('approve')}
                  disabled={submitting}
                >
                  <Icon name="checkCircle" className="h-4 w-4" /> Approve
                </button>
              </>
            ) : (
              <>
                {currentStep === 3 ? (
                  canPropose && !isReadOnly && (
                    <div className="flex items-center gap-3">
                      {proposalType === "TOP_UP" && totalAllocatedCaps === 0 && (
                        <span className="text-sm font-semibold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-md border border-rose-100">
                          A Top-Up must contain an allocation greater than ₹0.
                        </span>
                      )}
                      <button
                        className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition disabled:opacity-50"
                        onClick={isFutureQuartersEditMode ? () => navigateWithParams("/budget-planning") : handleSubmit}
                        disabled={submitting || (proposalType === "TOP_UP" && totalAllocatedCaps === 0)}
                      >
                        {isFutureQuartersEditMode ? (
                          "Finish Editing"
                        ) : submitting ? (
                          proposalStatus === "APPROVED"
                            ? "Activating..."
                            : "Submitting..."
                        ) : proposalStatus === "APPROVED" ? (
                          "Activate Operational Plan"
                        ) : proposalStatus === "NEEDS_REVISION" ||
                          proposalStatus === "REJECTED" ? (
                          "Resubmit Proposal"
                        ) : (
                          "Submit Proposal"
                        )}
                        {!submitting && <Icon name="check" className="h-4 w-4" />}
                      </button>
                    </div>
                  )
                ) : canPropose && proposalStatus !== "PENDING_APPROVAL" ? (
                  <button
                    className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleNext}
                    disabled={
                      currentStep !== 1 && currentStep === 2 ? false : false
                    }
                  >
                    {currentStep === 1 && !isReadOnly
                      ? (!proposalStatus || proposalStatus === "DRAFT" || proposalStatus === "REJECTED" ? "Submit for Approval" : "Next")
                      : "Next"}{" "}
                    <Icon
                      name={
                        currentStep === 1 && !isReadOnly ? "check" : "chevronRight"
                      }
                      className="h-4 w-4"
                    />
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={confirmDialog.isOpen}
        onClose={
          confirmDialog.onCancel ||
          (() => setConfirmDialog((prev) => ({ ...prev, isOpen: false })))
        }
        title={confirmDialog.title}
        footer={
          <>
            <button
              onClick={
                confirmDialog.onCancel ||
                (() => setConfirmDialog((prev) => ({ ...prev, isOpen: false })))
              }
              className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={confirmDialog.onConfirm}
              className="rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              Continue
            </button>
          </>
        }
      >
        <div className="py-2 text-sm text-slate-600">
          {confirmDialog.message}
        </div>
      </Modal>

      {/* Approve/Reject Modal (when viewing from approvals page) */}
      <Modal
        open={approveRejectModal.isOpen}
        onClose={() => setApproveRejectModal({ isOpen: false, action: null, comments: '', commentsError: false })}
        title={
          approveRejectModal.action === 'approve' ? 'Approve Budget Proposal' : 'Reject Budget Proposal'
        }
        footer={
          <>
            <button
              onClick={() => setApproveRejectModal({ isOpen: false, action: null, comments: '', commentsError: false })}
              className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              onClick={handleApproveReject}
              className={`rounded-md px-5 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 ${approveRejectModal.action === 'approve'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-red-600 hover:bg-red-700'
                }`}
              disabled={submitting}
            >
              {submitting ? 'Processing...' : approveRejectModal.action === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
            </button>
          </>
        }
      >
        <div className="py-3 text-sm text-slate-600">
          <p className="mb-4">
            {approveRejectModal.action === 'approve'
              ? 'You are about to approve this budget proposal. It will become active.'
              : 'You are about to reject this budget proposal. The planner will be notified.'
            }
          </p>
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 block">
              Remarks {approveRejectModal.action === 'reject' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              className={`w-full p-3 border rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-sm ${approveRejectModal.commentsError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'
                }`}
              rows="3"
              placeholder={
                approveRejectModal.action === 'reject'
                  ? 'Please provide a reason for rejection...'
                  : 'Optional remarks...'
              }
              value={approveRejectModal.comments}
              onChange={(e) => {
                setApproveRejectModal(prev => ({ ...prev, comments: e.target.value }));
                if (e.target.value.trim()) setApproveRejectModal(prev => ({ ...prev, commentsError: false }));
              }}
            />
            {approveRejectModal.commentsError && <p className="text-xs text-red-600 mt-1">Remarks are required for rejection.</p>}
          </div>
        </div>
      </Modal>
    </div>
  );
}
