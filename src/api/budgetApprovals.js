import api from './client'

export const budgetApprovalsApi = {
  getPendingOverruns: () =>
    api.get('/budget/overrun/pending').then(r => r.data),

  approveOverrun: (taskId, comments) =>
    api.post(`/budget/overrun/${taskId}/approve`, { comments }).then(r => r.data),

  rejectOverrun: (taskId, comments) =>
    api.post(`/budget/overrun/${taskId}/reject`, { comments }).then(r => r.data),

  reworkOverrun: (taskId, comments) =>
    api.post(`/budget/overrun/${taskId}/rework`, { comments }).then(r => r.data),

  logTaskExpense: (taskId, expenseAmount) =>
    api.post(`/budget/overrun/task/${taskId}/expense`, { expenseAmount }).then(r => r.data),

  // Unified approvals (merged top-ups + overruns)
  getUnifiedApprovals: () =>
    api.get('/budget/overrun/unified').then(r => r.data),
}
