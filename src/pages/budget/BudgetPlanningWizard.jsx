import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  budgetMasterDataApi,
  masterApi,
  campaignTypeApi,
  eventCategoryApi,
} from "../../api/masterData";
import { budgetPlanningApi } from "../../api/budgetPlanning";
import Icon from "../../components/Icon";
import { useToast } from "../../components/Toast";

import Step1VerticalCaps from "../../components/budget/Step1VerticalCaps";
import Step2EventCampaignMatrix from "../../components/budget/Step2EventCampaignMatrix";
import Step3TaskStateMatrix from "../../components/budget/Step3TaskStateMatrix";
import Modal from "../../components/Modal";

export default function BudgetPlanningWizard() {
  const navigate = useNavigate();
  const toast = useToast();
  const { proposalId: urlProposalId, stepId } = useParams();
  const [proposalId, setProposalId] = useState(urlProposalId || null);
  const currentStep = stepId === "step2" ? 2 : stepId === "step3" ? 3 : 1;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const [proposalStatus, setProposalStatus] = useState(null);

  const [isQuarterEditMode, setIsQuarterEditMode] = useState(false);

  const isReadOnly =
    proposalStatus === "ACTIVE"
      ? !isQuarterEditMode
      : currentStep === 1
        ? proposalStatus !== "DRAFT" &&
          proposalStatus !== "NEEDS_REVISION" &&
          proposalStatus !== "REJECTED"
        : proposalStatus !== "APPROVED" &&
          proposalStatus !== "DRAFT" &&
          proposalStatus !== "NEEDS_REVISION" &&
          proposalStatus !== "REJECTED";

  // Master Data State
  const [verticals, setVerticals] = useState([]);
  const [campaignTypes, setCampaignTypes] = useState([]);
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

  useEffect(() => {
    setIsQuarterEditMode(false);
  }, [currentStep, activePeriod]);

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
        const [vData, ctData, ttData, ecData, stData] = await Promise.all([
          masterApi.list("business-verticals"),
          campaignTypeApi.list(),
          masterApi.list("task-types"),
          eventCategoryApi.list(),
          budgetMasterDataApi.getStates(),
        ]);
        setVerticals(vData || []);
        setCampaignTypes(ctData || []);
        setTaskTypes(ttData || []);
        setEventCategories(ecData || []);
        setStates(stData || []);

        // Load existing proposal if URL has proposalId
        if (urlProposalId) {
          await fetchProposalData(urlProposalId);
        }
      } catch (err) {
        console.error("Failed to load master data", err);
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
            const matrixKey = `${cap.eventCategoryId}_${cap.campaignTypeId}`;
            loadedStep2[cap.verticalId][matrixKey] = cap.allocatedCap;
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
              const matrixKey = `${cap.eventCategoryId}_${cap.campaignTypeId}`;
              loadedQStep2[q][cap.verticalId][matrixKey] = cap.allocatedCap;
            });
          });
        }
        setQuarterlyStep2Matrix(loadedQStep2);

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
          navigate(`/budget-planning/wizard/${urlProposalId}/${targetStep}`, {
            replace: true,
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch proposal", err);
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
    if (proposalStatus === "DRAFT" && currentStep > 1) {
      toast.error("Proposal is in Draft. Please submit Step 1 first.");
      navigate(`/budget-planning/wizard/${proposalId || ""}/step1`, {
        replace: true,
      });
      return;
    }

    if (
      (currentStep === 2 || currentStep === 3) &&
      (!isFrozen || totalAnnualBudget <= 0)
    ) {
      toast.error(
        "Please freeze the annual budget and set vertical caps first.",
      );
      navigate(`/budget-planning/wizard/${proposalId || ""}/step1`, {
        replace: true,
      });
      return;
    }
    if (currentStep === 3) {
      if (
        Math.round(totalAllocatedStep2) !== Math.round(totalAllocatedCaps) ||
        totalAllocatedCaps === 0
      ) {
        toast.error(
          "Please complete the Target Matrix before proceeding to Task Distribution.",
        );
        navigate(`/budget-planning/wizard/${proposalId || ""}/step2`, {
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
        financialYear,
        totalAnnualBudget,
      });
      setProposalId(proposal.id);
      setPeriodId(proposal.periodId);
      setIsFrozen(true);
      setSavedTotalAnnualBudget(totalAnnualBudget);
      navigate(`/budget-planning/wizard/${proposal.id}/step1`, {
        replace: true,
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to freeze annual budget.");
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

        // Refetch and hydrate to unlock quarters immediately
        const updatedProposal =
          await budgetPlanningApi.getProposalById(proposalId);
        if (updatedProposal) {
          setProposalStatus(updatedProposal.status);
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
                const matrixKey = `${cap.eventCategoryId}_${cap.campaignTypeId}`;
                loadedQStep2[q][cap.verticalId][matrixKey] = cap.allocatedCap;
              });
            });
          }
          setQuarterlyStep2Matrix(loadedQStep2);
          setQuarterlyAllocations(
            updatedProposal.quarterlyGroupedAllocations || {
              Q1: [],
              Q2: [],
              Q3: [],
              Q4: [],
            },
          );

          setSubmitting(false);
          return; // Prevent navigating away so user can view dropdown
        }
      } else {
        await budgetPlanningApi.submitProposal(proposalId);
        toast.success("Budget Proposal Submitted Successfully!");
      }

      navigate("/budget-planning");
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit budget. Check console for details.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      if (isReadOnly) {
        navigate(`/budget-planning/wizard/${proposalId}/step2`);
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
        navigate(`/budget-planning/wizard/${proposalId}/step2`);
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

        toast.success("Budget Submitted for Approval!");
        navigate("/budget-planning");
      } catch (err) {
        console.error("Save caps error:", err);
        const errMsg =
          err.response?.data?.message ||
          err.response?.data ||
          err.message ||
          "Failed to save vertical caps";
        toast.error(`Error saving vertical caps: ${errMsg}`);
      }
    } else if (currentStep === 2) {
      if (isReadOnly) {
        navigate(`/budget-planning/wizard/${proposalId}/step3`);
        return;
      }

      if (Math.round(totalAllocatedStep2) !== Math.round(totalAllocatedCaps)) {
        toast.error(
          `Please allocate the full vertical caps amount (₹${totalAllocatedCaps.toLocaleString()}) in the matrix.`,
        );
        return;
      }

      const isMatrixChanged =
        JSON.stringify(step2Matrix) !== JSON.stringify(savedStep2Matrix);
      const isFirstTimeEntry = Object.keys(savedStep2Matrix).length === 0;

      const saveTargetsAndProceed = async (isQuarterActiveEdit = false) => {
        try {
          const targetCapsArray = [];
          const sourceMatrix = isQuarterActiveEdit ? quarterlyStep2Matrix[activePeriod] : step2Matrix;
          
          Object.entries(sourceMatrix).forEach(([vId, ecCtMap]) => {
            Object.entries(ecCtMap).forEach(([ecCtKey, cap]) => {
              if (cap > 0) {
                const [ecId, ctId] = ecCtKey.split("_");
                targetCapsArray.push({
                  verticalId: vId,
                  eventCategoryId: Number(ecId),
                  campaignTypeId: ctId,
                  allocatedCap: cap,
                });
              }
            });
          });

          const payloadPeriodId = isQuarterActiveEdit ? quarterlyPeriods[activePeriod].periodId : periodId;
          const payload = {
            periodId: payloadPeriodId,
            targetCaps: targetCapsArray,
          };

          await budgetPlanningApi.saveTargetCaps(proposalId, payload);

          // Refetch to sync backend-generated quarter targets
          const updatedProposal =
            await budgetPlanningApi.getProposalById(proposalId);
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
                  const matrixKey = `${cap.eventCategoryId}_${cap.campaignTypeId}`;
                  loadedQStep2[q][cap.verticalId][matrixKey] = cap.allocatedCap;
                });
              });
            }
            setQuarterlyStep2Matrix(loadedQStep2);
          }

          // Cascade Reset
          const updatedAllocations = allocations.filter((alloc) => {
            const oldAmount =
              savedStep2Matrix[alloc.verticalId]?.[
                `${alloc.eventCategoryId}_${alloc.campaignTypeId}`
              ];
            const newAmount =
              step2Matrix[alloc.verticalId]?.[
                `${alloc.eventCategoryId}_${alloc.campaignTypeId}`
              ] || 0;
            return oldAmount === newAmount; // Keep if unchanged
          });

          setAllocations(updatedAllocations);
          setSavedStep2Matrix(step2Matrix);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          navigate(`/budget-planning/wizard/${proposalId}/step3`);
        } catch (err) {
          console.error("Save targets error:", err);
          const errMsg =
            err.response?.data?.message ||
            err.response?.data ||
            err.message ||
            "Failed to save target caps";
          toast.error(`Error saving targets: ${errMsg}`);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      };

      console.log("Calling saveTargetCaps API to ensure quarter generation...");
      const isActiveQuarterEdit = proposalStatus === "ACTIVE" && isQuarterEditMode && activePeriod !== "Annual";

      if (isActiveQuarterEdit) {
        setConfirmDialog({
            isOpen: true,
            title: "Warning: Destructive Action",
            message: "Modifying these Target Caps will permanently reset all Step 3 Task Allocations for this quarter. Do you wish to proceed?",
            onConfirm: () => saveTargetsAndProceed(true),
            onCancel: () => setConfirmDialog(prev => ({...prev, isOpen: false}))
        });
        return;
      }

      if (isFirstTimeEntry) {
        saveTargetsAndProceed(false);
      } else if (isMatrixChanged) {
        setConfirmDialog({
          isOpen: true,
          title: "Confirm Matrix Modification",
          message:
            "Modifying the matrix will reset the Task & State distributions for the changed targets. Continue?",
          onConfirm: () => saveTargetsAndProceed(false),
          onCancel: () => {
            setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          },
        });
      } else {
        // Force the save even if nothing changed to guarantee backend generation
        saveTargetsAndProceed(false);
      }
    } else {
      navigate(
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
    <div className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/budget-planning")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition font-medium text-sm border border-transparent hover:border-slate-200"
            title="Back to Budget Planning"
          >
            <Icon name="arrowLeft" className="h-4 w-4" />
            <span>Back</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Budget Planning
          </h1>
        </div>
        {proposalStatus === "ACTIVE" &&
          (currentStep === 2 || currentStep === 3) && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg shadow-sm">
              <Icon name="eye" className="h-5 w-5 text-amber-600" />
              <label className="text-sm font-semibold text-amber-800">
                View Mode:
              </label>
              <select
                className="rounded-md border border-amber-300 bg-white px-3 py-1 text-sm font-medium text-amber-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 transition"
                value={activePeriod}
                onChange={(e) => setActivePeriod(e.target.value)}
              >
                <option value="Annual">Annual</option>
                <option value="Q1">Q1</option>
                <option value="Q2">Q2</option>
                <option value="Q3">Q3</option>
                <option value="Q4">Q4</option>
              </select>
              {proposalStatus === "ACTIVE" && activePeriod !== "Annual" && (currentStep === 2 || currentStep === 3) && (
                (() => {
                  const qPeriod = quarterlyPeriods[activePeriod];
                  if (!qPeriod) return null;
                  
                  // Use timezone-stripped dates for precise calendar comparison
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const startDateParts = qPeriod.startDate.split('-');
                  const startDate = new Date(startDateParts[0], startDateParts[1] - 1, startDateParts[2]);
                  startDate.setHours(0, 0, 0, 0);
                  
                  const daysUntil = (startDate - today) / (1000 * 60 * 60 * 24);
                  
                  if (daysUntil >= 0 && daysUntil <= 30) {
                    if (!isQuarterEditMode) {
                      return (
                        <button 
                          className="ml-2 flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition"
                          onClick={() => setIsQuarterEditMode(true)}
                        >
                          <Icon name="unlock" className="h-4 w-4" />
                          Unlock Quarter
                        </button>
                      );
                    } else {
                      return (
                        <span className="ml-2 flex items-center gap-1.5 rounded-md bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800 border border-emerald-300">
                          <Icon name="unlock" className="h-4 w-4" />
                          Unlocked
                        </span>
                      );
                    }
                  } else {
                    return (
                      <span className="ml-2 text-xs text-slate-500 italic">
                        (Locked: 0-30 days before start)
                      </span>
                    );
                  }
                })()
              )}
            </div>
          )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/50">
          <nav aria-label="Progress" className="flex">
            {[1, 2, 3].map((step, idx) => (
              <button
                key={step}
                onClick={() =>
                  navigate(
                    proposalId
                      ? `/budget-planning/wizard/${proposalId}/step${step}`
                      : `/budget-planning/wizard/step${step}`,
                  )
                }
                className={`relative flex-1 flex items-center justify-center py-4 text-sm font-medium transition
                  ${
                    currentStep === step
                      ? "text-brand-600 bg-white border-b-2 border-brand-500"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/80 border-b-2 border-transparent"
                  }
                  ${idx !== 2 ? "border-r border-slate-200" : ""}
                `}
              >
                <span
                  className={`mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 
                  ${currentStep === step ? "border-brand-600 text-brand-600 bg-brand-50" : "border-slate-300"}`}
                >
                  {step}
                </span>
                {step === 1
                  ? "Vertical Caps"
                  : step === 2
                    ? "Target Matrix"
                    : "Task Distribution"}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 bg-slate-50/30">
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
            />
          )}
          {currentStep === 2 && (
            <Step2EventCampaignMatrix
              verticals={verticals}
              eventCategories={eventCategories}
              campaignTypes={campaignTypes}
              step2Matrix={
                activePeriod === "Annual"
                  ? step2Matrix
                  : quarterlyStep2Matrix[activePeriod]
              }
              setStep2Matrix={setStep2Matrix}
              setQuarterlyStep2Matrix={setQuarterlyStep2Matrix}
              verticalCaps={
                activePeriod === "Annual"
                  ? verticalCaps
                  : quarterlyCaps[activePeriod]
              }
              isReadOnly={isReadOnly}
              activePeriod={activePeriod}
              quarterlyStep2Matrix={quarterlyStep2Matrix}
              annualStep2Matrix={step2Matrix}
            />
          )}
          {currentStep === 3 && (
            <Step3TaskStateMatrix
              proposalId={proposalId}
              periodId={periodId}
              verticals={verticals}
              eventCategories={eventCategories}
              campaignTypes={campaignTypes}
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
              setAllocations={setAllocations}
              setQuarterlyAllocations={setQuarterlyAllocations}
              isReadOnly={isReadOnly}
              activePeriod={activePeriod}
              hasGeneratedQuarters={hasGeneratedQuarters}
              setHasGeneratedQuarters={setHasGeneratedQuarters}
              quarterlyAllocations={quarterlyAllocations}
              annualAllocations={allocations}
              onMatrixSaved={() => fetchProposalData(urlProposalId)}
              isQuarterEditMode={isQuarterEditMode}
              quarterlyPeriods={quarterlyPeriods}
            />
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/50">
          <button
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition
              ${
                currentStep === 1
                  ? "text-slate-300 cursor-not-allowed"
                  : "text-slate-600 hover:bg-white hover:text-slate-800 border border-slate-200 hover:shadow-sm bg-white"
              }`}
            onClick={() =>
              navigate(
                `/budget-planning/wizard/${proposalId}/step${Math.max(1, currentStep - 1)}`,
              )
            }
            disabled={currentStep === 1}
          >
            <Icon name="chevronLeft" className="h-4 w-4" /> Previous
          </button>

          <div className="flex items-center gap-3">
            {currentStep === 3 ? (
              !isReadOnly && (
                <button
                  className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition disabled:opacity-50"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting
                    ? proposalStatus === "APPROVED"
                      ? "Activating..."
                      : "Submitting..."
                    : proposalStatus === "APPROVED"
                      ? "Activate Operational Plan"
                      : proposalStatus === "NEEDS_REVISION" ||
                          proposalStatus === "REJECTED"
                        ? "Resubmit Proposal"
                        : "Submit Proposal"}
                  {!submitting && <Icon name="check" className="h-4 w-4" />}
                </button>
              )
            ) : (
              <button
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleNext}
                disabled={
                  currentStep !== 1 && currentStep === 2 ? false : false
                } // Adjust if you have step 2 validations later
              >
                {currentStep === 1 && !isReadOnly
                  ? "Submit for Approval"
                  : "Next"}{" "}
                <Icon
                  name={
                    currentStep === 1 && !isReadOnly ? "check" : "chevronRight"
                  }
                  className="h-4 w-4"
                />
              </button>
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
    </div>
  );
}
