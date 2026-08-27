import api from './client'

export const budgetPlanningApi = {
  freezeAnnualBudget: (payload) => 
    api.post('/budget-planning/proposals/freeze-annual', payload).then(r => r.data),

  saveVerticalCaps: (proposalId, payload) => 
    api.put(`/budget-planning/proposals/${proposalId}/vertical-caps`, payload).then(r => r.data),

  saveTargetCaps: (proposalId, payload) => 
    api.put(`/budget-planning/proposals/${proposalId}/target-caps`, payload).then(r => r.data),

  getProposals: () => 
    api.get('/budget-planning/proposals').then(r => r.data),

  getProposalById: (proposalId) => 
    api.get(`/budget-planning/proposals/${proposalId}`).then(r => r.data),

  submitProposal: (proposalId) => 
    api.post(`/budget-planning/proposals/${proposalId}/submit`).then(r => r.data),

  approveProposal: (proposalId, overrideActive = false) => 
    api.post(`/budget-planning/proposals/${proposalId}/approve?overrideActive=${overrideActive}`).then(r => r.data),

  rejectProposal: (proposalId, payload) => 
    api.post(`/budget-planning/proposals/${proposalId}/reject`, payload).then(r => r.data),

  inactivateProposal: (proposalId) => 
    api.post(`/budget-planning/proposals/${proposalId}/inactivate`).then(r => r.data),

  saveAllocations: (proposalId, allocations) => 
    api.post(`/budget-planning/proposals/${proposalId}/allocations`, allocations).then(r => r.data),

  generateQuarters: (proposalId) => 
    api.post(`/budget-planning/proposals/${proposalId}/generate-quarters`).then(r => r.data),

  submitOperationalPlan: (proposalId) => 
    api.post(`/budget-planning/proposals/${proposalId}/submit-operational`).then(r => r.data),
    
  deleteProposal: (proposalId) => 
    api.delete(`/budget-planning/proposals/${proposalId}`).then(r => r.data),
}
