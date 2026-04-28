import api from './client'

const BASE = '/admin/questions'

const questionnaireApi = {
  listAll: () => api.get(BASE),

  create: (payload) => api.post(BASE, payload),

  update: (questionId, payload) => api.put(`${BASE}/${questionId}`, payload),

  remove: (questionId) => api.delete(`${BASE}/${questionId}`),
}

export default questionnaireApi
