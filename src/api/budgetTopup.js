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
  }
}
