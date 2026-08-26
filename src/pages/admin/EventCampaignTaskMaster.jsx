import React, { useState, useEffect, useMemo } from 'react';
import Icon from '../../components/Icon';
import MultiSelectDropdown from '../../components/MultiSelectDropdown';
import BackToMaster from '../../components/admin/BackToMaster';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import { useToast } from '../../components/Toast';
import { masterApi, campaignTypeApi, eventCategoryApi, eventCampaignTaskApi } from '../../api/masterData';

export default function EventCampaignTaskMaster() {
  const [eventCategories, setEventCategories] = useState([]);
  const [campaignTypes, setCampaignTypes] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  
  const [mappings, setMappings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const toast = useToast();

  // Search/Filter state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination state
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const [expandedRows, setExpandedRows] = useState({});

  useEffect(() => {
    fetchMasterData();
    fetchMappings();
  }, []);

  const fetchMasterData = async () => {
    try {
      const [events, campaigns, tasks] = await Promise.all([
        eventCategoryApi.list().catch(() => []),
        campaignTypeApi.list().catch(() => []),
        masterApi.list('task-types').catch(() => [])
      ]);
      
      setEventCategories(Array.isArray(events) && events.length > 0 ? events : []);
      setCampaignTypes(Array.isArray(campaigns) && campaigns.length > 0 ? campaigns : []);
      setTaskTypes(Array.isArray(tasks) && tasks.length > 0 ? tasks : []);
    } catch (err) {
      console.error("Failed to load master data for dropdowns", err);
    }
  };

  const fetchMappings = async () => {
    setIsLoading(true);
    try {
      const data = await eventCampaignTaskApi.listGroupedTasks();
      setMappings(data || []);
    } catch (err) {
      toast.error('Failed to load mappings');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Client-side filtering and pagination
  const filteredMappings = useMemo(() => {
    if (!searchTerm) return mappings;
    const lowerSearch = searchTerm.toLowerCase();
    return mappings.filter(m => 
      (m.eventCategoryName || '').toLowerCase().includes(lowerSearch) ||
      (m.campaignTypeName || '').toLowerCase().includes(lowerSearch) ||
      (m.tasks || []).some(t => (t.taskName || '').toLowerCase().includes(lowerSearch))
    );
  }, [mappings, searchTerm]);

  const paginatedMappings = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredMappings.slice(start, start + PAGE_SIZE);
  }, [filteredMappings, page]);

  const totalPages = Math.ceil(filteredMappings.length / PAGE_SIZE);

  // Reset page to 0 if searching
  useEffect(() => {
    setPage(0);
  }, [searchTerm]);

  const handleOpenAddModal = () => {
    setIsEditMode(false);
    setSelectedEventId('');
    setSelectedCampaignId('');
    setSelectedTaskIds([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (mapping) => {
    setIsEditMode(true);
    setSelectedEventId(mapping.eventCategoryId.toString());
    setSelectedCampaignId(mapping.campaignTypeId.toString());
    setSelectedTaskIds((mapping.tasks || []).map(t => t.taskTypeId));
    setIsModalOpen(true);
  };

  const handleDelete = async (mapping) => {
    if (!window.confirm(`Are you sure you want to delete all tasks mapped to ${mapping.eventCategoryName} - ${mapping.campaignTypeName}?`)) {
      return;
    }
    
    try {
      // Deleting all tasks for a combination is effectively passing an empty array to PUT
      // Or we can add a DELETE endpoint. Re-using PUT with empty array works if backend supports it.
      // But looking at our backend saveMappings logic: 
      // `if (taskTypeIds != null && !taskTypeIds.isEmpty()) { ... saveAll ... }`
      // So passing an empty array will delete them all. Let's do that.
      await eventCampaignTaskApi.saveTasks(mapping.eventCategoryId, mapping.campaignTypeId, { taskTypeIds: [] });
      toast.success('Mapping deleted successfully');
      fetchMappings();
    } catch (err) {
      toast.error('Failed to delete mapping');
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!selectedEventId || !selectedCampaignId) {
      toast.error('Please select an Event Category and Campaign Type');
      return;
    }
    if (selectedTaskIds.length === 0) {
      toast.error('Please select at least one mapped task');
      return;
    }

    if (!isEditMode) {
      const existing = mappings.find(m => 
        m.eventCategoryId.toString() === selectedEventId && 
        m.campaignTypeId.toString() === selectedCampaignId
      );
      if (existing) {
        toast.error('This mapping already exists. Please edit the existing row.');
        return;
      }
    }

    setIsSaving(true);
    try {
      await eventCampaignTaskApi.saveTasks(selectedEventId, selectedCampaignId, { taskTypeIds: selectedTaskIds });
      toast.success('Mappings saved successfully!');
      setIsModalOpen(false);
      fetchMappings();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || 'Failed to save mappings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <BackToMaster className="mb-3" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Event-Campaign Task Mapping</h1>
            <p className="text-sm text-slate-500 mt-1">Configure which Task Types are available for each combination.</p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <Icon name="plus" className="h-4 w-4" /> Add Mapping
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
        {/* Table Header/Toolbar */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="relative w-full max-w-sm">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by event, campaign, or task..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none transition"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 w-1/4">Event Category</th>
                <th className="px-5 py-3 w-1/4">Campaign Type</th>
                <th className="px-5 py-3 w-1/3">Mapped Tasks</th>
                <th className="px-5 py-3 w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan="4" className="px-5 py-10 text-center">
                    <Icon name="loader" className="h-6 w-6 text-brand-500 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : paginatedMappings.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-5 py-10 text-center text-slate-400">
                    No mappings found.
                  </td>
                </tr>
              ) : (
                paginatedMappings.map((m, idx) => (
                  <tr key={`${m.eventCategoryId}-${m.campaignTypeId}-${idx}`} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-3 font-medium text-slate-800">{m.eventCategoryName}</td>
                    <td className="px-5 py-3">{m.campaignTypeName}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {(() => {
                          const isExpanded = expandedRows[`${m.eventCategoryId}-${m.campaignTypeId}`];
                          const tasks = m.tasks || [];
                          const maxVisible = 3;
                          const showAll = isExpanded || tasks.length <= maxVisible;
                          const visibleTasks = showAll ? tasks : tasks.slice(0, maxVisible);
                          const extraCount = tasks.length - maxVisible;

                          return (
                            <>
                              {visibleTasks.map(t => (
                                <span key={t.taskTypeId} className="inline-block px-2 py-0.5 rounded bg-brand-50 border border-brand-100 text-brand-700 text-xs font-medium">
                                  {t.taskName}
                                </span>
                              ))}
                              {!showAll && extraCount > 0 && (
                                <button 
                                  onClick={() => setExpandedRows(prev => ({ ...prev, [`${m.eventCategoryId}-${m.campaignTypeId}`]: true }))}
                                  className="inline-block px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-200 transition"
                                >
                                  +{extraCount} more
                                </button>
                              )}
                              {showAll && tasks.length > maxVisible && (
                                <button 
                                  onClick={() => setExpandedRows(prev => ({ ...prev, [`${m.eventCategoryId}-${m.campaignTypeId}`]: false }))}
                                  className="inline-block px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500 text-xs font-medium hover:bg-slate-200 transition cursor-pointer"
                                  title="Show less"
                                >
                                  <Icon name="chevron" className="h-3 w-3 inline -rotate-90" />
                                </button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right space-x-2">
                      <button 
                        onClick={() => handleOpenEditModal(m)}
                        className="p-1.5 text-slate-400 hover:text-brand-600 rounded transition hover:bg-brand-50"
                        title="Edit"
                      >
                        <Icon name="edit" className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(m)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded transition hover:bg-red-50"
                        title="Delete"
                      >
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="border-t border-slate-100 bg-white p-3">
          <Pagination
            page={page}
            totalPages={totalPages}
            totalElements={filteredMappings.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            loading={isLoading}
          />
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditMode ? "Edit Task Mapping" : "Add Task Mapping"}
        size="lg"
        footer={
          <>
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Mapping'}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Event Category</label>
              <select 
                className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none transition ${isEditMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500'}`}
                value={selectedEventId}
                onChange={(e) => {
                  setSelectedEventId(e.target.value);
                  if (!isEditMode) setSelectedCampaignId(''); // Reset campaign on event change
                }}
                disabled={isEditMode}
              >
                <option value="">Select Event...</option>
                {eventCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Campaign Type</label>
              <select 
                className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none transition ${isEditMode || !selectedEventId ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500'}`}
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                disabled={isEditMode || !selectedEventId}
              >
                {!selectedEventId ? (
                  <option value="">Select an Event Category first...</option>
                ) : (
                  <option value="">Select Campaign...</option>
                )}
                {campaignTypes.filter(camp => {
                  if (isEditMode) return true; // Show the selected one if in edit mode (it's locked anyway)
                  
                  if (camp.status && camp.status !== 'ACTIVE') return false;
                  if (camp.isActive === false) return false;

                  const event = eventCategories.find(e => e.id.toString() === selectedEventId);
                  if (!event || !event.mappedCampaignTypeIds) return false;
                  return event.mappedCampaignTypeIds.includes(camp.campaignTypeId || camp.id);
                }).map(camp => (
                  <option key={camp.campaignTypeId || camp.id} value={camp.campaignTypeId || camp.id}>
                    {camp.campaignTypeName || camp.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mapped Task Types</label>
            <MultiSelectDropdown
              options={taskTypes.map(tt => ({
                id: tt.taskTypeId || tt.id,
                name: tt.taskName || tt.name
              }))}
              value={selectedTaskIds}
              onChange={setSelectedTaskIds}
              placeholder="Search and select tasks..."
            />
            
            <div className="mt-3 flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-lg border border-slate-100">
              {selectedTaskIds.length === 0 ? (
                <span className="text-xs text-slate-400">No tasks selected</span>
              ) : (
                selectedTaskIds.map(id => {
                  const tt = taskTypes.find(t => (t.taskTypeId || t.id) === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white text-slate-700 text-xs font-medium border border-slate-200">
                      {tt ? (tt.taskName || tt.name) : id}
                      <button 
                        onClick={() => setSelectedTaskIds(prev => prev.filter(t => t !== id))}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <Icon name="x" className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
