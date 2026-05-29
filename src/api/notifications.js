import api from './client'

export const notificationsApi = {
  getAll:       ()       => api.get('/notifications').then(r => r.data),
  getUnread:    ()       => api.get('/notifications/unread-count').then(r => r.data),
  markRead:     (id)     => api.patch(`/notifications/${id}/read`),
  markAllRead:  ()       => api.patch('/notifications/read-all'),

  // Admin template management
  getTemplates: () => api.get('/notifications/templates').then((r) => r.data),

  /** Paged + filtered list for admin Notification Templates table. Returns PagedResponse. */
  listTemplatesPaged: ({
    id,
    eventType,
    appliesTo,
    message,
    url,
    page = 0,
    size = 20,
  } = {}) =>
    api.get('/notifications/templates', {
      params: { id, eventType, appliesTo, message, url, page, size },
    }).then((r) => r.data),

  updateTemplate: (id, body) => api.put(`/notifications/templates/${id}`, body).then((r) => r.data),
}
