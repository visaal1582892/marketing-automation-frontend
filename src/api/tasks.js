import api from './client'

const BASE = '/tasks'

const tasksApi = {
  /** Tasks assigned to the currently logged-in user. */
  listMy: () => api.get(`${BASE}/my`),

  getById: (id) => api.get(`${BASE}/${id}`),

  /** Click "Accept" — starts the timer (status → IN_PROGRESS). */
  accept: (id) => api.patch(`${BASE}/${id}/accept`),

  /**
   * Submit work for QC review.
   * payload: { submissionNotes, assetUrls: string[] }
   */
  complete: (id, payload = {}) => api.patch(`${BASE}/${id}/complete`, payload),

  /**
   * Upload one or more asset files to the company image server.
   * Pass a FormData object with key "files" containing the File objects.
   * Returns { urls: string[] } — one full public URL per uploaded file.
   */
  uploadAssets: (formData) =>
    api.post('/upload/asset', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000, // large files (videos) may take longer than the default 20 s
    }),

  // ── Questionnaire ──────────────────────────────────────────────────────────

  /** Fetch dynamic questions mapped to this work task (empty array if none). */
  getQuestions: (taskId) => api.get(`${BASE}/${taskId}/questions`),

  /**
   * Batch-save worker answers.
   * payload: { answers: [{ questionId, answerValue }, …] }
   */
  submitAnswers: (taskId, answers) =>
    api.post(`${BASE}/${taskId}/answers`, { answers }),

  /** Retrieve previously saved answers for a task (for pre-filling the form). */
  getAnswers: (taskId) => api.get(`${BASE}/${taskId}/answers`),
}

export default tasksApi
