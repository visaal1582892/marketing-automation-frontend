import client from './client'

export const budgetTopupApi = {
  requestTopUp: async (proposalId, data) => {
    const response = await client.post(`/budget/topup/${proposalId}`, data)
    return response.data
  },
  getPendingTopUps: async () => {
    const response = await client.get('/budget/topup/pending')
    return response.data
  },

  getPendingTopUpsGrouped: async () => {
    const response = await client.get('/budget/topup/pending/grouped')
    return response.data
  },
  getAllTopUps: async () => {
    const response = await client.get('/budget/topup/all')
    return response.data
  },
  approveTopUp: async (topupId, comments) => {
    const response = await client.post(`/budget/topup/${topupId}/approve`, { comments })
    return response.data
  },
  rejectTopUp: async (topupId, comments) => {
    const response = await client.post(`/budget/topup/${topupId}/reject`, { comments })
    return response.data
  },
  requestBatchTopUp: async (data) => {
    const response = await client.post('/budget/topup/batch', data)
    return response.data
  },
  bulkApproveTopUps: async ({ topupIds, comments }) => {
    const response = await client.post('/budget/topup/bulk-approve', { topupIds, comments })
    return response.data
  },
  bulkRejectTopUps: async ({ topupIds, comments }) => {
    const response = await client.post('/budget/topup/bulk-reject', { topupIds, comments })
    return response.data
  },
}
