import api from './client'

export const notificationsApi = {
  getAll:       ()       => api.get('/notifications').then(r => r.data),
  getUnread:    ()       => api.get('/notifications/unread-count').then(r => r.data),
  markRead:     (id)     => api.patch(`/notifications/${id}/read`),
  markAllRead:  ()       => api.patch('/notifications/read-all'),

  // Admin template management
  getTemplates:    ()            => api.get('/notifications/templates').then(r => r.data),
  updateTemplate:  (id, body)    => api.put(`/notifications/templates/${id}`, body).then(r => r.data),
}
