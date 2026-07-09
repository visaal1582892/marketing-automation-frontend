import api from './client'

export const workingHoursApi = {
  getSnapshot: () =>
    api.get('/settings/working-hours-snapshot').then(r => r.data),

  getConfig: () =>
    api.get('/settings/working-hours').then(r => r.data),

  updateConfig: (payload) =>
    api.put('/settings/working-hours', payload).then(r => r.data),

  createSchedule: (payload) =>
    api.post('/settings/schedules', payload).then(r => r.data),

  listSchedules: () =>
    api.get('/settings/schedules').then(r => r.data),

  patchActiveEndTime: (workEndTime) =>
    api.patch('/settings/schedules/active/end-time', { workEndTime }).then(r => r.data),

  listHolidays: ({ year, month, page = 0, size = 20 } = {}) =>
    api.get('/holidays', { params: { year, month, page, size } }).then(r => r.data),

  createHoliday: (payload) =>
    api.post('/holidays', payload).then(r => r.data),

  deleteHoliday: (id) =>
    api.delete(`/holidays/${id}`),
}

export default workingHoursApi
