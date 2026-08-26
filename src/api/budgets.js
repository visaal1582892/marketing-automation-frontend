import api from './client'

export const budgetApi = {
  list: () =>
    api.get('/budget-proposals').then(r => r.data),

  get: (id) =>
    api.get(`/budget-proposals/${id}`).then(r => r.data),

  create: (payload) =>
    api.post('/budget-proposals', payload).then(r => r.data),

  update: (id, payload) =>
    api.put(`/budget-proposals/${id}`, payload).then(r => r.data),

  submit: (id) =>
    api.post(`/budget-proposals/${id}/submit`).then(r => r.data),

  clone: (id) =>
    api.post(`/budget-proposals/${id}/clone`).then(r => r.data),

  approve: (id, comments) =>
    api.post(`/budget-proposals/${id}/approve`, { comments }).then(r => r.data),

  needsRevision: (id, payload) =>
    api.post(`/budget-proposals/${id}/needs-revision`, payload).then(r => r.data),

  myDepartment: () =>
    api.get('/budget-proposals/my-department').then(r => r.data),

  delete: (id) =>
    api.delete(`/budget-proposals/${id}`).then(r => r.data),
}

export const stateMonthlyPlanApi = {
  getByProposalId: (proposalId) => api.get('/state-monthly-plan', { params: { proposalId } }).then(r => r.data),
  create: (payload) => api.post('/state-monthly-plan', payload).then(r => r.data),
  update: (id, payload) => api.put(`/state-monthly-plan/${id}`, payload).then(r => r.data),
  delete: (id) => api.delete(`/state-monthly-plan/${id}`).then(r => r.data),
}

export const taskAllocationApi = {
  getByStatePlanId: (statePlanId) => api.get('/task-allocation', { params: { statePlanId } }).then(r => r.data),
  create: (payload) => api.post('/task-allocation', payload).then(r => r.data),
  update: (id, payload) => api.put(`/task-allocation/${id}`, payload).then(r => r.data),
  delete: (id) => api.delete(`/task-allocation/${id}`).then(r => r.data),
}

export const taskSpendApi = {
  getByAllocationId: (allocationId) => api.get('/task-spend', { params: { allocationId } }).then(r => r.data),
  create: (payload) => api.post('/task-spend', payload).then(r => r.data),
  update: (id, payload) => api.put(`/task-spend/${id}`, payload).then(r => r.data),
  delete: (id) => api.delete(`/task-spend/${id}`).then(r => r.data),
}

export const ledgerApi = {
  getLedger: (proposalId, stateCode) => api.get('/ledger', { params: { proposalId, stateCode } }).then(r => r.data),
}
