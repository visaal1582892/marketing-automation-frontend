import client from './client'

export const analyticsApi = {
  getBudgetFinancials: async () => {
    const response = await client.get('/analytics/budget-financials')
    return response.data
  }
}
