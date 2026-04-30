import api from './client'

const BASE = '/campaigns'

const campaignsApi = {
  /** Submit a new Smart Form request. */
  create: (data) => api.post(BASE, data),

  /** List campaigns (admins/managers see all; others see own). */
  list: () => api.get(BASE),

  /** Get full campaign detail with deliverables and work tasks. */
  getById: (id) => api.get(`${BASE}/${id}`),

  /**
   * Requestor (owner) appends new task deliverables to an existing campaign,
   * including task-specific questionnaire answers.
   * specs: [{ granularTaskId, questionnaireAnswers: [{questionId, answerValue}] }]
   */
  addTasks: (id, specs) => api.post(`${BASE}/${id}/add-tasks`, specs),

  /**
   * Requestor (owner) edits campaign form fields and/or adds new tasks/files.
   * payload: { ...formFields, newTaskSpecs: [...], newFileUrls: [...] }
   * Existing tasks and files are never modified or removed.
   */
  requestorEdit: (id, payload) => api.put(`${BASE}/${id}/requestor-edit`, payload),

  /**
   * Requestor deletes a single task spec (by specId) from their campaign.
   * Only allowed when the task has not yet been started (ASSIGNED / HELD / ACCEPTED).
   */
  deleteTask: (campaignId, specId) => api.delete(`${BASE}/${campaignId}/deliverables/${specId}`),

  /**
   * Requestor deletes their entire campaign.
   * Only allowed when none of the tasks has been started.
   */
  deleteCampaign: (id) => api.delete(`${BASE}/${id}`),

  /**
   * Marketing Head or Admin edits campaign fields (priority, keyMessage, budgetTier).
   * Server re-evaluates the inconsistency flag automatically.
   */
  updateCampaign: (id, payload) => api.patch(`${BASE}/${id}`, payload),

  /**
   * Marketing Head changes priority on any non-terminal campaign.
   * Server re-evaluates the inconsistency flag automatically.
   */
  updatePriority: (id, priority) =>
    api.patch(`${BASE}/${id}/priority`, { priority }),

  /**
   * Requestor sends a COMPLETED task back for rework with a message.
   * Only works when the task status is COMPLETED and the caller is the campaign owner (or Admin).
   */
  requestorRework: (campaignId, taskId, message) =>
    api.post(`${BASE}/${campaignId}/tasks/${taskId}/requestor-rework`, { message }),

}

/** Returns granular tasks relevant to a requirement type (for form Section 5). */
export const getTasksForRequirement = (requirementTypeId) =>
  api.get(`/master/routing/tasks-for-requirement/${requirementTypeId}`)

export default campaignsApi
