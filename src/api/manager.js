import api from './client'

const BASE = '/manager'

const managerApi = {
  // ── All tasks — Marketing Head overview (server-side paged + filtered) ──────
  allTasks: (params = {}) => api.get(`${BASE}/tasks/all`, { params }),

  // ── QC review queue (server-side paged + filtered) ────────────────────────
  pendingTasks: (params = {}) => api.get(`${BASE}/tasks/review`, { params }),
  reviewTask:   (id, payload) => api.post(`${BASE}/tasks/${id}/review`, payload),
  taskHistory:  (id)      => api.get(`${BASE}/tasks/${id}/history`),

  // ── Capacity / Hold (Module 2-B redesign) ─────────────────────────────────
  campaignCapacity:     (campaignId) => api.get(`${BASE}/campaigns/${campaignId}/capacity`),
  holdTask:             (taskId)     => api.post(`${BASE}/tasks/${taskId}/hold`),
  unholdTask:           (taskId)     => api.post(`${BASE}/tasks/${taskId}/unhold`),
  cancelTask:           (taskId)     => api.post(`${BASE}/tasks/${taskId}/cancel`),
  heldTasks:            ()           => api.get(`${BASE}/tasks/held`),
  eligibleUsersForTask: (taskId)     => api.get(`${BASE}/tasks/${taskId}/eligible-users`),
  assignHeldTask:       (taskId, userId) => api.post(`${BASE}/tasks/${taskId}/assign`, { userId }),

  // ── Capacity dashboard ─────────────────────────────────────────────────────
  capacity: (roleId) => api.get(`${BASE}/capacity`, { params: roleId ? { roleId } : {} }),

  // ── Legacy intervention queue (kept for backward compat with old data) ────
  pendingIntervention:  ()                  => api.get(`${BASE}/intervention/pending`),
  retryIntervention:    (id)                => api.post(`${BASE}/intervention/${id}/retry`),
  overrideIntervention: (id, payload)       => api.post(`${BASE}/intervention/${id}/override`, payload),
  rejectIntervention:   (id, reason)        => api.post(`${BASE}/intervention/${id}/reject`, { reason }),

  analytics:   () => api.get(`${BASE}/reports/analytics`),

  // ── Time-tracking reports (Module 3) ───────────────────────────────────────
  timeReport: (from, to) => api.get(`${BASE}/reports/time`, { params: { from, to } }),

  // ── Dashboard KPI sparklines — 7-day daily trend data ────────────────────
  dashboardTrend: () => api.get(`${BASE}/dashboard/trend`),
}

export default managerApi
