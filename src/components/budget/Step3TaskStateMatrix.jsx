import React, { useState, useMemo, useEffect, useRef } from 'react';
import Icon from '../Icon';
import SearchableSelect from '../common/SearchableSelect';
import MultiSelectDropdown from '../MultiSelectDropdown';
import { eventCampaignTaskApi } from '../../api/masterData';
import { budgetPlanningApi } from '../../api/budgetPlanning';
import { useToast } from '../Toast';

const ReadOnlyStateList = ({ stateCodes = [], states = [] }) => {
  const [expanded, setExpanded] = useState(false);
  const displayStates = expanded ? stateCodes : stateCodes.slice(0, 2);

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {displayStates.map(state => {
        const sObj = states.find(s => String(s.stateCode || s.code || s.subName) === String(state));
        const displayName = sObj ? (sObj.stateName || sObj.name || sObj.subName) : state;
        return (
          <span key={state} className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-md border border-slate-200">
            {displayName}
          </span>
        );
      })}
      {stateCodes.length > 2 && (
        <button 
          onClick={() => setExpanded(!expanded)}
          className="px-2 py-1 text-xs font-medium bg-brand-50 text-brand-700 rounded-md border border-brand-100 hover:bg-brand-100 transition-colors inline-block cursor-pointer"
        >
          {expanded ? "Show less" : `+${stateCodes.length - 2} more`}
        </button>
      )}
    </div>
  );
};

export default function Step3TaskStateMatrix({
  proposalId,
  periodId,
  verticals,
  eventCategories,
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

  isFutureQuartersEditMode,
  quarterlyPeriods
}) {
  const activeCombinations = useMemo(() => {
    const combos = [];
    Object.keys(step2Matrix).forEach(vId => {
      Object.keys(step2Matrix[vId]).forEach(ecId => {
        const targetAmount = step2Matrix[vId][ecId];
        if (targetAmount > 0) {
          const vName = verticals.find(v => String(v.id) === String(vId))?.name;
          const ecName = eventCategories.find(ec => String(ec.id) === String(ecId))?.name;
          
          combos.push({
            id: `${vId}_${ecId}`,
            verticalId: vId,
            eventCategoryId: ecId,
            label: `${vName} ➔ ${ecName}`,
            targetAmount
          });
        }
      });
    });
    return combos;
  }, [step2Matrix, verticals, eventCategories]);

  const [activeComboId, setActiveComboId] = useState(activeCombinations[0]?.id || '');
  const activeCombo = activeCombinations.find(c => c.id === activeComboId);
  const toast = useToast();

  const [savedComboIds, setSavedComboIds] = useState(() => {
    const ids = new Set();
    allocations.forEach(a => {
      if (a.taskAllocations && a.taskAllocations.length > 0) {
        ids.add(`${a.verticalId}_${a.eventCategoryId}`);
      }
    });
    return ids;
  });

  const isLocalEdit = useRef(false);

  useEffect(() => {
    if (isLocalEdit.current) {
      isLocalEdit.current = false;
      return;
    }
    
    setSavedComboIds(prev => {
      const ids = new Set();
      allocations.forEach(a => {
        if (a.taskAllocations && a.taskAllocations.length > 0) {
          ids.add(`${a.verticalId}_${a.eventCategoryId}`);
        }
      });
      // Preserve any combinations that are currently active and being edited locally
      // Actually, if we just sync it, it fixes the bug where switching periods doesn't update the lock state.
      // But we shouldn't overwrite the local unlock (Edit Again) if they haven't switched periods.
      // Let's just always sync it from allocations. If they "Edit Again", the backend allocations 
      // haven't changed, but this effect won't fire unless allocations prop changes.
      return ids;
    });
  }, [allocations]);

  const isCurrentCombinationFrozen = activeCombo ? savedComboIds.has(activeCombo.id) : false;

  // Mapped task types for the currently selected combination
  const [mappedTaskTypeIds, setMappedTaskTypeIds] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  useEffect(() => {
    if (activeCombo) {
      fetchMappedTasks(activeCombo.eventCategoryId, activeCombo.verticalId);
    } else {
      setMappedTaskTypeIds([]);
    }
  }, [activeCombo?.eventCategoryId, activeCombo?.verticalId]);

  const fetchMappedTasks = async (ecId, vId) => {
    setIsLoadingTasks(true);
    try {
      const data = await eventCampaignTaskApi.getTasks(ecId, vId);
      setMappedTaskTypeIds(data || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load mapped tasks for this combination.");
      setMappedTaskTypeIds([]);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  // Find the allocation for the current combination
  const currentComboAllocation = useMemo(() => {
    if (!activeCombo) return null;
    return allocations.find(
      a => String(a.verticalId) === String(activeCombo.verticalId) && 
           String(a.eventCategoryId) === String(activeCombo.eventCategoryId)
    );
  }, [allocations, activeCombo]);

  const updateCurrentComboAllocations = (newTaskAllocations) => {
    if (!activeCombo) return;
    
    setAllocations(prev => {
      const copy = [...prev];
      const index = copy.findIndex(
        a => String(a.verticalId) === String(activeCombo.verticalId) && 
             String(a.eventCategoryId) === String(activeCombo.eventCategoryId)
      );

      const newCombo = {
        periodId: periodId,
        verticalId: activeCombo.verticalId,
        eventCategoryId: Number(activeCombo.eventCategoryId),
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
    isLocalEdit.current = true;
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
        (g.stateCodes || []).forEach(s => allSelectedStates.add(String(s)));
      }
    });
    
    const remainingStateCodes = states
      .map(s => String(s.stateCode || s.code || s.subName))
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

    const payloadPeriodId = (isFutureQuartersEditMode && activePeriod !== 'Annual')
        ? quarterlyPeriods[activePeriod].periodId
        : periodId;

    const payload = [{
      ...currentComboAllocation,
      periodId: payloadPeriodId,
      taskAllocations: scrubbedAllocations
    }];

    setIsSaving(true);
    try {
      if (isFutureQuartersEditMode) {
        await budgetPlanningApi.updateFutureQuarters(proposalId, payload);
      } else {
        await budgetPlanningApi.saveAllocations(proposalId, payload);
      }
      toast.success("Combination allocations saved successfully!");
      setSavedComboIds(prev => {
        const next = new Set(prev);
        next.add(activeCombo.id);
        return next;
      });
      // Update local state with scrubbed data
      // Update local state with scrubbed data
      setAllocations(prev => {
        const copy = [...prev];
        const idx = copy.findIndex(a => 
          String(a.verticalId) === String(activeCombo.verticalId) && 
          String(a.eventCategoryId) === String(activeCombo.eventCategoryId)
        );
        if (idx >= 0) copy[idx].taskAllocations = scrubbedAllocations;
        return copy;
      });
      
      // Trigger parent hydration
      if (onMatrixSaved) {
        onMatrixSaved();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save allocations. Please try again.");
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
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      <div className="flex flex-col xl:flex-row gap-4 shrink-0 bg-white border border-slate-200 p-4 rounded-xl shadow-sm z-10">
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Select Combination
          </label>
          <SearchableSelect
            options={activeCombinations.map(combo => {
              const comboAlloc = allocations.find(
                a => String(a.verticalId) === String(combo.verticalId) && 
                     String(a.eventCategoryId) === String(combo.eventCategoryId)
              );
              
              let allocTotal = 0;
              if (comboAlloc && comboAlloc.taskAllocations) {
                allocTotal = comboAlloc.taskAllocations.reduce((sum, task) => {
                  return sum + (task.groups || []).reduce((gSum, g) => gSum + ((g.stateCodes?.length || 0) * Number(g.budgetPerState || 0)), 0);
                }, 0);
              }
              const done = allocTotal === combo.targetAmount;
              
              const isSaved = savedComboIds.has(combo.id);
              const prefix = isSaved ? `🔒 [SAVED] ` : (done ? `✓ ` : ``);
                
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
        
        {activeCombo && !isReadOnly && (
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 xl:border-l xl:border-slate-200 xl:pl-6">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Target</span>
              <p className="text-lg font-bold text-slate-800">₹{activeCombo.targetAmount.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Allocated</span>
              <p className="text-lg font-bold text-brand-600">₹{totalAllocated.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Remaining</span>
              <p className={`text-lg font-bold flex items-center gap-1.5 ${remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {isComplete && <Icon name="check" className="h-4 w-4" />}
                ₹{remaining.toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {activeCombo && (
        <div className="flex flex-col flex-1 min-h-0 space-y-4 pb-4">
          {!isReadOnly && remaining < 0 && (
            <div className="p-3 bg-red-50 text-red-700 text-sm font-medium rounded-lg border border-red-200 flex items-center gap-2 shrink-0">
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
            <div className="flex-1 overflow-y-auto space-y-6 min-h-0 pr-1 pb-16 custom-scrollbar">
              {(() => {
                const visibleTaskTypeIds = isReadOnly 
                  ? mappedTaskTypeIds.filter(ttId => getTaskGroups(ttId).length > 0)
                  : mappedTaskTypeIds;
                  
                if (visibleTaskTypeIds.length === 0 && isReadOnly) {
                  return (
                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
                      No tasks allocated for this combination.
                    </div>
                  );
                }
                
                return visibleTaskTypeIds.map(ttId => {
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
                    <div className="bg-slate-50 rounded-t-xl border-b border-slate-200 px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
                          const stateOptions = states.map(s => {
                            const code = String(s.stateCode || s.code || s.subName || '');
                            const name = s.stateName || s.name || s.subName || code;
                            return {
                              id: code,
                              name: name,
                              disabled: allSelectedStates.has(code) && !(group.stateCodes || []).map(String).includes(code),
                            };
                          });
                          
                          const groupTotal = (group.stateCodes?.length || 0) * Number(group.budgetPerState || 0);

                          return (
                            <div key={gIdx} className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start border-b border-gray-100 pb-4 mb-4 relative">
                              {/* Column 1: State Selection (Wider) */}
                              <div className="col-span-1 lg:col-span-7">
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
                                  <ReadOnlyStateList stateCodes={group.stateCodes || []} states={states} />
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
                              <div className="col-span-1 lg:col-span-3">
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
                              <div className="col-span-1 lg:col-span-2 flex flex-row lg:flex-col justify-between lg:justify-end items-center lg:items-stretch h-full">
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0 lg:mb-1 text-left lg:text-right">Group Total</label>
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
              })
              })()}
              
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
