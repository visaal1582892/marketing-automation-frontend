import React, { useState, useMemo, useEffect } from 'react';
import Icon from '../Icon';
import SearchableSelect from '../common/SearchableSelect';
import MultiSelectDropdown from '../MultiSelectDropdown';
import { eventCampaignTaskApi } from '../../api/masterData';
import { budgetPlanningApi } from '../../api/budgetPlanning';
import { useToast } from '../Toast';

export default function Step3TaskStateMatrix({
  proposalId,
  periodId,
  verticals,
  eventCategories,
  campaignTypes,
  taskTypes,
  states,
  step2Matrix,
  allocations,
  setAllocations,
  isReadOnly,
  activePeriod,
  hasGeneratedQuarters,
  setHasGeneratedQuarters,
  quarterlyAllocations,
  annualAllocations,
  onMatrixSaved,
  isQuarterEditMode,
  quarterlyPeriods
}) {
  const activeCombinations = useMemo(() => {
    const combos = [];
    Object.keys(step2Matrix).forEach(vId => {
      Object.keys(step2Matrix[vId]).forEach(ecCtKey => {
        const targetAmount = step2Matrix[vId][ecCtKey];
        if (targetAmount > 0) {
          const [ecId, ctId] = ecCtKey.split('_');
          const vName = verticals.find(v => v.id.toString() === vId)?.name;
          const ecName = eventCategories.find(ec => ec.id.toString() === ecId)?.name;
          const ctName = campaignTypes.find(ct => ct.id.toString() === ctId)?.name;
          
          combos.push({
            id: `${vId}_${ecId}_${ctId}`,
            verticalId: vId,
            eventCategoryId: ecId,
            campaignTypeId: ctId,
            label: `${vName} ➔ ${ecName} ➔ ${ctName}`,
            targetAmount
          });
        }
      });
    });
    return combos;
  }, [step2Matrix, verticals, eventCategories, campaignTypes]);

  const [activeComboId, setActiveComboId] = useState(activeCombinations[0]?.id || '');
  const activeCombo = activeCombinations.find(c => c.id === activeComboId);
  const toast = useToast();

  const [savedComboIds, setSavedComboIds] = useState(() => {
    const ids = new Set();
    allocations.forEach(a => {
      if (a.taskAllocations && a.taskAllocations.length > 0) {
        ids.add(`${a.verticalId}_${a.eventCategoryId}_${a.campaignTypeId}`);
      }
    });
    return ids;
  });

  const isCurrentCombinationFrozen = activeCombo ? savedComboIds.has(activeCombo.id) : false;

  // Mapped task types for the currently selected combination
  const [mappedTaskTypeIds, setMappedTaskTypeIds] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  useEffect(() => {
    if (activeCombo) {
      fetchMappedTasks(activeCombo.eventCategoryId, activeCombo.campaignTypeId);
    } else {
      setMappedTaskTypeIds([]);
    }
  }, [activeCombo?.eventCategoryId, activeCombo?.campaignTypeId]);

  const fetchMappedTasks = async (ecId, ctId) => {
    setIsLoadingTasks(true);
    try {
      const data = await eventCampaignTaskApi.getTasks(ecId, ctId);
      setMappedTaskTypeIds(data || []);
    } catch (err) {
      console.error("Failed to fetch mapped tasks", err);
      setMappedTaskTypeIds([]);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  // Find the allocation for the current combination
  const currentComboAllocation = useMemo(() => {
    if (!activeCombo) return null;
    return allocations.find(
      a => a.verticalId === activeCombo.verticalId && 
           a.eventCategoryId.toString() === activeCombo.eventCategoryId && 
           a.campaignTypeId === activeCombo.campaignTypeId
    );
  }, [allocations, activeCombo]);

  const updateCurrentComboAllocations = (newTaskAllocations) => {
    if (!activeCombo) return;
    
    setAllocations(prev => {
      const copy = [...prev];
      const index = copy.findIndex(
        a => a.verticalId === activeCombo.verticalId && 
             a.eventCategoryId.toString() === activeCombo.eventCategoryId && 
             a.campaignTypeId === activeCombo.campaignTypeId
      );

      const newCombo = {
        periodId: periodId,
        verticalId: activeCombo.verticalId,
        eventCategoryId: Number(activeCombo.eventCategoryId),
        campaignTypeId: activeCombo.campaignTypeId,
        taskAllocations: newTaskAllocations
      };

      if (index >= 0) {
        copy[index] = newCombo;
      } else {
        copy.push(newCombo);
      }
      return copy;
    });
  };

  const getTaskGroups = (taskTypeId) => {
    if (!currentComboAllocation || !currentComboAllocation.taskAllocations) return [];
    const taskAlloc = currentComboAllocation.taskAllocations.find(ta => ta.taskTypeId === taskTypeId);
    return taskAlloc ? taskAlloc.groups || [] : [];
  };

  const setTaskGroups = (taskTypeId, newGroups) => {
    let currentTasks = currentComboAllocation?.taskAllocations || [];
    let updatedTasks = [...currentTasks];
    const taskIndex = updatedTasks.findIndex(ta => ta.taskTypeId === taskTypeId);
    
    if (taskIndex >= 0) {
      updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], groups: newGroups };
    } else {
      updatedTasks.push({ taskTypeId, groups: newGroups });
    }
    // Clean up empty tasks
    updatedTasks = updatedTasks.filter(ta => ta.groups && ta.groups.length > 0);
    
    updateCurrentComboAllocations(updatedTasks);
  };

  const addGroup = (taskTypeId) => {
    const groups = getTaskGroups(taskTypeId);
    setTaskGroups(taskTypeId, [...groups, { stateCodes: [], budgetPerState: 0 }]);
  };

  const removeGroup = (taskTypeId, groupIndex) => {
    const groups = getTaskGroups(taskTypeId);
    const newGroups = groups.filter((_, idx) => idx !== groupIndex);
    setTaskGroups(taskTypeId, newGroups);
  };

  const updateGroup = (taskTypeId, groupIndex, field, value) => {
    if (field === 'budgetPerState' && value && Number(value) > 999999999999) return;
    const groups = getTaskGroups(taskTypeId);
    const newGroups = [...groups];
    newGroups[groupIndex] = { ...newGroups[groupIndex], [field]: value };
    setTaskGroups(taskTypeId, newGroups);
  };

  const selectRemainingStates = (taskTypeId, groupIndex) => {
    const groups = getTaskGroups(taskTypeId);
    const allSelectedStates = new Set();
    groups.forEach((g, idx) => {
      if (idx !== groupIndex) {
        g.stateCodes.forEach(s => allSelectedStates.add(s));
      }
    });
    
    const remainingStateCodes = states
      .map(s => s.stateCode)
      .filter(code => !allSelectedStates.has(code));

    updateGroup(taskTypeId, groupIndex, 'stateCodes', remainingStateCodes);
  };

  // Calculate totals
  const totalAllocated = useMemo(() => {
    if (!currentComboAllocation || !currentComboAllocation.taskAllocations) return 0;
    return currentComboAllocation.taskAllocations.reduce((sum, task) => {
      if (!task.groups) return sum;
      const taskSum = task.groups.reduce((gSum, g) => {
        return gSum + ((g.stateCodes?.length || 0) * Number(g.budgetPerState || 0));
      }, 0);
      return sum + taskSum;
    }, 0);
  }, [currentComboAllocation]);

  const remaining = activeCombo ? activeCombo.targetAmount - totalAllocated : 0;
  const isComplete = remaining === 0 && totalAllocated > 0;

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveCombination = async () => {
    if (totalAllocated > activeCombo.targetAmount) {
      toast.error("Allocated amount cannot exceed the target budget.");
      return;
    }

    if (!currentComboAllocation || !currentComboAllocation.taskAllocations || currentComboAllocation.taskAllocations.length === 0) {
      toast.error("No allocations made for this combination.");
      return;
    }

    // Scrub empty groups and tasks
    const scrubbedAllocations = currentComboAllocation.taskAllocations.map(task => {
      const validGroups = (task.groups || []).filter(g => 
        g.stateCodes && g.stateCodes.length > 0 && Number(g.budgetPerState) > 0
      );
      return { ...task, groups: validGroups };
    }).filter(task => task.groups.length > 0);

    const payloadPeriodId = (isQuarterEditMode && activePeriod !== 'Annual') ? quarterlyPeriods[activePeriod].periodId : periodId;

    const payload = [{
      ...currentComboAllocation,
      periodId: payloadPeriodId,
      taskAllocations: scrubbedAllocations
    }];

    setIsSaving(true);
    try {
      await budgetPlanningApi.saveAllocations(proposalId, payload);
      toast.success("Combination allocations saved successfully!");
      setSavedComboIds(prev => {
        const next = new Set(prev);
        next.add(activeCombo.id);
        return next;
      });
      // Update local state with scrubbed data
      setAllocations(prev => {
        const copy = [...prev];
        const idx = copy.findIndex(a => 
          a.verticalId === activeCombo.verticalId && 
          a.eventCategoryId.toString() === activeCombo.eventCategoryId && 
          a.campaignTypeId === activeCombo.campaignTypeId
        );
        if (idx >= 0) copy[idx].taskAllocations = scrubbedAllocations;
        return copy;
      });
      
      // Trigger parent hydration
      if (onMatrixSaved) {
        onMatrixSaved();
      }
    } catch (err) {
      console.error("Failed to save combination", err);
      toast.error("Failed to save allocations. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (activeCombinations.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center bg-slate-50 border border-dashed border-slate-300 rounded-xl">
        <Icon name="alertCircle" className="h-8 w-8 text-slate-400 mb-3" />
        <h3 className="text-sm font-semibold text-slate-700">No active targets found</h3>
        <p className="text-xs text-slate-500 mt-1">Please allocate targets in Step 2 first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32">
      {isReadOnly && (
        <div className="flex justify-end -mb-4">
          <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md text-sm font-medium border border-blue-100 shadow-sm">
            Currently viewing <span className="font-bold">{activePeriod}</span> allocations
          </div>
        </div>
      )}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Select Combination to Allocate
        </label>
        <div className="relative">
          <SearchableSelect
            options={activeCombinations.map(combo => {
              const comboAlloc = allocations.find(
                a => a.verticalId === combo.verticalId && 
                     a.eventCategoryId.toString() === combo.eventCategoryId && 
                     a.campaignTypeId === combo.campaignTypeId
              );
              
              let allocTotal = 0;
              if (comboAlloc && comboAlloc.taskAllocations) {
                allocTotal = comboAlloc.taskAllocations.reduce((sum, task) => {
                  return sum + (task.groups || []).reduce((gSum, g) => gSum + ((g.stateCodes?.length || 0) * Number(g.budgetPerState || 0)), 0);
                }, 0);
              }
              const done = allocTotal === combo.targetAmount;
              
              const isSaved = savedComboIds.has(combo.id);
              const prefix = isSaved 
                ? `🔒 [SAVED] ` 
                : (done ? `✓ ` : ``);
                
              return {
                value: combo.id,
                label: `${prefix}${combo.label} (Target: ₹${combo.targetAmount.toLocaleString()})`
              };
            })}
            value={activeComboId}
            onChange={(newValue) => setActiveComboId(newValue)}
            placeholder="Select a combination to allocate..."
          />
        </div>
      </section>

      {activeCombo && (
        <div className="space-y-5">
          <div className="flex justify-between items-center bg-brand-50/50 border border-brand-100 p-4 rounded-xl shadow-sm sticky top-0 z-10 backdrop-blur-sm">
            <div>
              <span className="text-[10px] font-bold text-brand-600/70 uppercase tracking-wider block mb-1">Target Budget</span>
              <p className="text-xl font-bold text-brand-900">₹{activeCombo.targetAmount.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Allocated</span>
              <p className="text-xl font-bold text-slate-800">₹{totalAllocated.toLocaleString()}</p>
            </div>
            <div className={`text-right ${remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">Remaining</span>
              <p className="text-xl font-bold flex items-center justify-end gap-1.5">
                {isComplete && <Icon name="check" className="h-5 w-5" />} 
                ₹{remaining.toLocaleString()}
              </p>
            </div>
          </div>
          
          {remaining < 0 && (
            <div className="p-3 bg-red-50 text-red-700 text-sm font-medium rounded-lg border border-red-200 flex items-center gap-2">
              <Icon name="alertCircle" className="h-5 w-5 shrink-0" />
              You have exceeded the target budget by ₹{Math.abs(remaining).toLocaleString()}. Please adjust allocations.
            </div>
          )}

          {isLoadingTasks ? (
            <div className="flex justify-center p-10"><Icon name="loader" className="h-8 w-8 text-brand-500 animate-spin" /></div>
          ) : mappedTaskTypeIds.length === 0 ? (
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
              No tasks mapped to this combination. Configure them in Master Data first.
            </div>
          ) : (
            <div className="space-y-6">
              {mappedTaskTypeIds.map(ttId => {
                const taskDef = taskTypes.find(t => t.id?.toString() === ttId || t.taskTypeId === ttId);
                const taskName = taskDef ? (taskDef.name || taskDef.taskName) : ttId;
                const groups = getTaskGroups(ttId);

                // For double dip protection, calculate globally selected states in this task
                const allSelectedStates = new Set();
                groups.forEach(g => {
                  if (g.stateCodes) g.stateCodes.forEach(s => allSelectedStates.add(s));
                });

                return (
                  <div key={ttId} className="bg-white rounded-xl border border-slate-200 shadow-sm">
                    <div className="bg-slate-50 rounded-t-xl border-b border-slate-200 px-5 py-3 flex items-center justify-between">
                      <h4 className="font-semibold text-slate-800">{taskName}</h4>
                      {!isCurrentCombinationFrozen && !isReadOnly && (
                        <button 
                          onClick={() => addGroup(ttId)}
                          className="text-xs font-medium text-brand-600 hover:text-brand-800 flex items-center gap-1 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded transition"
                        >
                          <Icon name="plus" className="h-3.5 w-3.5" /> Add State Group
                        </button>
                      )}
                    </div>
                    <div className="p-5 space-y-4">
                      {groups.length === 0 ? (
                        <p className="text-sm text-slate-400 italic">No groups added. Click 'Add State Group' to allocate budget.</p>
                      ) : (
                        groups.map((group, gIdx) => {
                          const stateOptions = states.map(s => ({
                            id: s.stateCode,
                            name: s.stateName,
                            disabled: allSelectedStates.has(s.stateCode) && !group.stateCodes.includes(s.stateCode)
                          }));
                          
                          const groupTotal = (group.stateCodes?.length || 0) * Number(group.budgetPerState || 0);

                          return (
                            <div key={gIdx} className="grid grid-cols-12 gap-4 items-start border-b border-gray-100 pb-4 mb-4 relative">
                              {/* Column 1: State Selection (Wider) */}
                              <div className="col-span-7">
                                <div className="flex justify-between items-center mb-1">
                                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">States</label>
                                  {!isCurrentCombinationFrozen && !isReadOnly && (
                                    <div className="flex gap-3">
                                      <button 
                                        type="button"
                                        onClick={() => selectRemainingStates(ttId, gIdx)}
                                        className="text-xs font-medium text-red-600 hover:text-red-800"
                                      >
                                        Select All
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => updateGroup(ttId, gIdx, 'stateCodes', [])}
                                        className="text-xs font-medium text-slate-500 hover:text-slate-700"
                                      >
                                        Clear All
                                      </button>
                                    </div>
                                  )}
                                </div>
                                {isReadOnly ? (
                                  <div className="flex flex-wrap items-center gap-1 mt-1">
                                    {(group.stateCodes || []).slice(0, 2).map(state => (
                                      <span key={state} className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                                        {state}
                                      </span>
                                    ))}
                                    {(group.stateCodes || []).length > 2 && (
                                      <div className="relative group/badge cursor-pointer">
                                        <span className="px-2 py-1 text-xs font-medium bg-red-50 text-red-700 rounded-md border border-red-100 hover:bg-red-100 transition-colors inline-block">
                                          +{(group.stateCodes || []).length - 2}
                                        </span>
                                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover/badge:block w-48 p-2 bg-slate-800 text-white text-xs rounded-md shadow-lg z-50">
                                          {(group.stateCodes || []).slice(2).join(', ')}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <MultiSelectDropdown
                                    options={stateOptions}
                                    value={group.stateCodes || []}
                                    onChange={(vals) => updateGroup(ttId, gIdx, 'stateCodes', vals)}
                                    placeholder="Search and select states..."
                                    disabled={isCurrentCombinationFrozen}
                                  />
                                )}
                              </div>

                              {/* Column 2: Budget Input */}
                              <div className="col-span-3">
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Budget per State</label>
                                <div className="relative">
                                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">₹</span>
                                  <input
                                    type="number"
                                    min="0"
                                    className={`w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 ${isCurrentCombinationFrozen || isReadOnly ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                                    value={group.budgetPerState || ''}
                                    onChange={(e) => updateGroup(ttId, gIdx, 'budgetPerState', e.target.value)}
                                    onWheel={(e) => e.target.blur()}
                                    placeholder="0"
                                    disabled={isCurrentCombinationFrozen || isReadOnly}
                                  />
                                </div>
                              </div>

                              {/* Column 3: Row Total & Remove Button */}
                              <div className="col-span-2 flex flex-col justify-end h-full">
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 text-right">Group Total</label>
                                <div className="flex items-center justify-end space-x-2 h-[42px]">
                                  <span className="text-sm font-bold text-gray-900">
                                    ₹{groupTotal.toLocaleString()}
                                  </span>
                                  {!isCurrentCombinationFrozen && !isReadOnly && (
                                    <button 
                                      type="button" 
                                      onClick={() => removeGroup(ttId, gIdx)}
                                      className="text-gray-400 hover:text-red-500 ml-2"
                                      title="Remove Group"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
              
              <div className="flex items-center justify-end pt-4 border-t border-slate-200">
                {!isReadOnly && (
                  savedComboIds.has(activeComboId) ? (
                    <button
                      onClick={() => {
                        setSavedComboIds(prev => {
                          const next = new Set(prev);
                          next.delete(activeCombo.id);
                          return next;
                        });
                      }}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium shadow-sm hover:bg-slate-50 transition"
                    >
                      <Icon name="edit" className="h-4 w-4" /> Edit Combination
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSaveCombination}
                      disabled={isSaving || remaining < 0}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? (
                        <Icon name="loader" className="h-4 w-4 animate-spin" /> 
                      ) : (
                        <Icon name="check" className="h-4 w-4" />
                      )}
                      {isSaving ? 'Saving...' : 'Save & Freeze Combination'}
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}


    </div>
  );
}
