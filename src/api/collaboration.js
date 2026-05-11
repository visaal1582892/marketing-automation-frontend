import api from './client'

const BASE = '/collaborations'

const collaborationApi = {
  /**
   * Start collaboration on a task — auto-holds the task and ensures the
   * requestor is a collaborator. Only the task's assigned worker calls this.
   */
  startCollaboration: (taskId) => api.post(`${BASE}/${taskId}/start`),

  /**
   * Pause collaboration — restores the task to its pre-hold status so it
   * re-enters the active queue.
   */
  pauseCollaboration: (taskId) => api.post(`${BASE}/${taskId}/pause`),

  /** Invite collaborators to a task. body: { userIds: number[] } */
  invite: (taskId, userIds) =>
    api.post(`${BASE}/${taskId}/invite`, { userIds }),

  /** List all collaborators on a task. */
  getMembers: (taskId) => api.get(`${BASE}/${taskId}/members`),

  /** All tasks where the caller is a collaborator — server-side paged + filtered. */
  getMyCollaborations: (params = {}) => api.get(`${BASE}/my`, { params }),

  /**
   * Lightweight active-collaboration count for the sidebar badge.
   * Runs a single SQL COUNT on the backend — far cheaper than getMyCollaborations().
   */
  getActiveCount: () => api.get(`${BASE}/active-count`),

  /** All active users — used to populate the collaborator picker. */
  getAllUsers: () => api.get(`${BASE}/users`),

  /** Send a chat message. body: { message: string } */
  sendMessage: (taskId, message) =>
    api.post(`${BASE}/${taskId}/messages`, { message }),

  /** Get full message history for a task (initial load). */
  getMessages: (taskId) => api.get(`${BASE}/${taskId}/messages`),

  /** Add an asset to a task (url, optional thumbnailUrl, original filename). */
  addAsset: (taskId, url, thumbnailUrl, originalFilename) =>
    api.post(`${BASE}/${taskId}/assets`, { url, thumbnailUrl, originalFilename }),

  /** Delete an asset (only the uploader can delete). */
  deleteAsset: (taskId, assetId) =>
    api.delete(`${BASE}/${taskId}/assets/${assetId}`),

  /** Get all assets for a task. */
  getAssets: (taskId) => api.get(`${BASE}/${taskId}/assets`),
}

export default collaborationApi
