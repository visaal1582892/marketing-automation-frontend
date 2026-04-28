import api from './client'

const BASE = '/campaigns'

const campaignsApi = {
  /** Submit a new Smart Form request. */
  create: (data) => api.post(BASE, data),

  /** List campaigns (admins/managers see all; others see own). */
  list: () => api.get(BASE),

  /** Get full campaign detail with deliverables and work tasks. */
  getById: (id) => api.get(`${BASE}/${id}`),

  // -------------------------------------------------------------------------
  // Dept Head / Regional Manager approval
  // -------------------------------------------------------------------------

  /** Queue for the logged-in Dept Head or Regional Manager. */
  pendingDept: () => api.get(`${BASE}/pending-dept`),

  deptApprove: (id) => api.patch(`${BASE}/${id}/dept-approve`),

  deptReject: (id, reason) => api.patch(`${BASE}/${id}/dept-reject`, { reason }),

  /** History of every dept-stage decision the logged-in user has made. */
  historyDept: () => api.get(`${BASE}/history/dept`),

  // -------------------------------------------------------------------------
  // Marketing Manager approval
  // -------------------------------------------------------------------------

  /** Queue for the Marketing Manager (campaigns that passed dept approval). */
  pendingMarketing: () => api.get(`${BASE}/pending-marketing`),

  marketingApprove: (id) => api.patch(`${BASE}/${id}/marketing-approve`),

  marketingReject: (id, reason) => api.patch(`${BASE}/${id}/marketing-reject`, { reason }),

  /** History of every marketing-stage decision the logged-in user has made. */
  historyMarketing: () => api.get(`${BASE}/history/marketing`),

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

  // -------------------------------------------------------------------------
  // Manager Intervention (Module 2-B) — proxied through ManagerController
  // (kept as helper here so list/dept screens can reuse the same axios instance).
  // -------------------------------------------------------------------------

  pendingIntervention: () => api.get('/manager/intervention/pending'),
  retryIntervention:   (id) => api.post(`/manager/intervention/${id}/retry`),
  overrideIntervention: (id, payload) => api.post(`/manager/intervention/${id}/override`, payload),
  rejectIntervention:   (id, reason) => api.post(`/manager/intervention/${id}/reject`, { reason }),
}

/** Returns granular tasks relevant to a requirement type (for form Section 5). */
export const getTasksForRequirement = (requirementTypeId) =>
  api.get(`/master/routing/tasks-for-requirement/${requirementTypeId}`)

export default campaignsApi
