import api from './client'

const BASE = '/collaborations'

const collaborationApi = {
  /** Invite collaborators to a task. body: { userIds: number[] } */
  invite: (taskId, userIds) =>
    api.post(`${BASE}/${taskId}/invite`, { userIds }),

  /** List all collaborators on a task. */
  getMembers: (taskId) => api.get(`${BASE}/${taskId}/members`),

  /** All tasks where the caller is a collaborator (newest first). */
  getMyCollaborations: () => api.get(`${BASE}/my`),

  /** All active users — used to populate the collaborator picker. */
  getAllUsers: () => api.get(`${BASE}/users`),

  /** Send a chat message. body: { message: string } */
  sendMessage: (taskId, message) =>
    api.post(`${BASE}/${taskId}/messages`, { message }),

  /** Get full message history for a task (initial load). */
  getMessages: (taskId) => api.get(`${BASE}/${taskId}/messages`),

  /** Add an asset URL to a task. */
  addAsset: (taskId, url) =>
    api.post(`${BASE}/${taskId}/assets`, { url }),

  /** Get all assets for a task. */
  getAssets: (taskId) => api.get(`${BASE}/${taskId}/assets`),
}

export default collaborationApi
