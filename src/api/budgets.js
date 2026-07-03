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
}
