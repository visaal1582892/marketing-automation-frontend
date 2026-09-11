import api from './client'

/**
 * Catalog of master data resources surfaced in the sidebar + admin routes.
 * `slug` matches the backend path under /api/master/{slug}.
 */
export const MASTER_RESOURCES = [
  // Structural / configuration
  { slug: 'departments',         label: 'Departments',         icon: 'building'  },
  { slug: 'designations',        label: 'Designations',        icon: 'tag'       },
  { slug: 'roles',               label: 'Roles',               icon: 'shield'    },
  { slug: 'capabilities',        label: 'Capabilities',        icon: 'zap',       isCode: true },
  { slug: 'task-types',          label: 'Task Types',          icon: 'list'      },
  // Form field dropdowns — all master-table driven
  { slug: 'audiences',           label: 'Audience Types',      icon: 'users'     },
  { slug: 'business-objectives', label: 'Business Objectives', icon: 'target'    },
  { slug: 'languages',           label: 'Languages',           icon: 'globe'     },
  { slug: 'tones',               label: 'Tone / Style',        icon: 'mic'       },
  { slug: 'offer-types',         label: 'Offer Types',         icon: 'tag'       },
  { slug: 'supporting-proofs',   label: 'Supporting Proofs',   icon: 'fileText'  },
  { slug: 'budget-tiers',        label: 'Budget Tiers',        icon: 'dollar'    },
  { slug: 'vendor-types',        label: 'Vendor Types',        icon: 'truck'     },
  { slug: 'kpi-types',           label: 'KPI Types',           icon: 'barChart'  },
  { slug: 'expected-outputs',    label: 'Expected Outputs',    icon: 'download'  },
  // Campaign Specifications
  { slug: 'business-verticals',  label: 'Business Verticals',  icon: 'building'  },
]

export const findResource = (slug) =>
  MASTER_RESOURCES.find((r) => r.slug === slug)

export const masterApi = {
  /** Full list (no pagination) — used by form dropdowns. */
  list: (slug, includeInactive = false) =>
    api.get(`/master/${slug}`, { params: { includeInactive } }).then((r) => r.data),

  /** Paged + filtered list for admin management tables. Returns PagedResponse. */
  listPaged: (slug, { id, name, status, page = 0, size = 20 } = {}) =>
    api.get(`/master/${slug}`, { params: { id, name, status, page, size } }).then((r) => r.data),

  get:    (slug, code)        => api.get(`/master/${slug}/${code}`).then((r) => r.data),
  create: (slug, payload)     => api.post(`/master/${slug}`, payload).then((r) => r.data),
  update: (slug, code, body)  => api.put(`/master/${slug}/${code}`, body).then((r) => r.data),
  remove: (slug, code)        => api.delete(`/master/${slug}/${code}`).then((r) => r.data),
  restore: (slug, code)       => api.put(`/master/${slug}/${code}/restore`).then((r) => r.data),
}

/** API for Granular Tasks (/api/master/granular-tasks) */
export const granularTasksApi = {
  /** Full list (no pagination) — used by form dropdowns. */
  list: (includeInactive = false, taskTypeId = null) => {
    const params = { includeInactive }
    if (taskTypeId) params.taskTypeId = taskTypeId
    return api.get('/master/granular-tasks', { params }).then((r) => r.data)
  },

  /** Paged + filtered list for admin Granular Tasks table. Returns PagedResponse. */
  listPaged: ({ taskId, taskName, taskTypeName, status, needsPaymentTracking, page = 0, size = 20 } = {}) =>
    api.get('/master/granular-tasks', {
      params: { taskId, taskName, taskTypeName, status, needsPaymentTracking, page, size },
    }).then((r) => r.data),

  /** Dynamic questions mapped to this granular task (new-request form). */
  getQuestions: (id) =>
    api.get(`/master/granular-tasks/${id}/questions`).then((r) => r.data),
  get:    (id)          => api.get(`/master/granular-tasks/${id}`).then((r) => r.data),
  create: (payload)     => api.post('/master/granular-tasks', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/master/granular-tasks/${id}`, payload).then((r) => r.data),
  remove: (id)          => api.delete(`/master/granular-tasks/${id}`).then((r) => r.data),
  restore: (id)         => api.put(`/master/granular-tasks/${id}/restore`).then((r) => r.data),
}

/**
 * API for Capability → Task mappings (/api/master/routing/capability-task).
 * Capabilities are pure business routing metadata — decoupled from IAM roles.
 * The legacy /role-task endpoints still work (backward-compatible aliases).
 */
export const roleTaskApi = {
  /** Full list (no pagination) — delegates to capability-task backend. */
  list: ()              => api.get('/master/routing/role-task').then((r) => r.data),

  /** Paged + filtered list for admin mapping table. Returns PagedResponse. */
  listPaged: ({ roleName, taskName, status, page = 0, size = 20 } = {}) =>
    api.get('/master/routing/role-task', {
      params: { roleName, taskName, status, page, size },
    }).then((r) => r.data),

  listByRole:  (roleId)        => api.get(`/master/routing/role-task/${roleId}`).then((r) => r.data),
  create:      (roleId, taskId) =>
    api.post('/master/routing/role-task', { roleId, taskId }).then((r) => r.data),
  update:      (mappingId, { roleId, taskId, status }) =>
    api.patch(`/master/routing/role-task/${mappingId}`, { roleId, taskId, status }).then((r) => r.data),
  remove:      (mappingId)     => api.delete(`/master/routing/role-task/${mappingId}`).then((r) => r.data),
}

/**
 * API for Capability → Task mappings — the native capability-domain endpoints.
 * Use these for any new capability-specific UI.
 */
export const capabilityTaskApi = {
  list: ()              => api.get('/master/routing/capability-task').then((r) => r.data),
  listPaged: ({ capabilityName, taskName, status, page = 0, size = 20 } = {}) =>
    api.get('/master/routing/capability-task', {
      params: { capabilityName, taskName, status, page, size },
    }).then((r) => r.data),
  listByCapability: (capabilityId) =>
    api.get(`/master/routing/capability-task/${capabilityId}`).then((r) => r.data),
  create: (capabilityId, taskId) =>
    api.post('/master/routing/capability-task', { capabilityId, taskId }).then((r) => r.data),
  update: (mappingId, { capabilityId, taskId, status }) =>
    api.patch(`/master/routing/capability-task/${mappingId}`, { capabilityId, taskId, status }).then((r) => r.data),
  remove: (mappingId) =>
    api.delete(`/master/routing/capability-task/${mappingId}`).then((r) => r.data),
}

/** API for Requirement → Capability mappings (/api/master/routing/requirement-capability) */
export const requirementCapabilityApi = {
  list: () => api.get('/master/routing/requirement-capability').then((r) => r.data),
  set: (requirementTypeId, defaultCapabilityId) =>
    api.put(`/master/routing/requirement-capability/${requirementTypeId}`, { defaultCapabilityId }).then((r) => r.data),
  remove: (mappingId) =>
    api.delete(`/master/routing/requirement-capability/${mappingId}`).then((r) => r.data),
}

/** API for Campaign Task Configurations (/api/campaign-task-config) */
export const campaignTaskConfigApi = {
  /** Grouped list of all configs. */
  list: () => api.get('/campaign-task-config').then((r) => r.data),

  /** Bulk-create tasks for a combination. */
  create: (payload) => api.post('/campaign-task-config', payload).then((r) => r.data),

  /** Replace all tasks for a combination with a new set. */
  updateCombination: (payload) => api.put('/campaign-task-config/combination', payload).then((r) => r.data),

  /** Delete a single task row by its DB id. */
  deleteById: (id) => api.delete(`/campaign-task-config/${id}`).then((r) => r.data),

  /** Delete all rows for a combination (by query params). */
  deleteByCombination: (businessVerticalId = '', businessTypeId = '', storeFormatTypeId = '') =>
    api.delete('/campaign-task-config/combination', {
      params: { businessVerticalId, businessTypeId, storeFormatTypeId },
    }).then((r) => r.data),
}

/** API for Question Library (/api/admin/questions) */
export const questionApi = {
  /** Full list (no pagination). */
  list: () => api.get('/admin/questions').then((r) => r.data),

  /** Paged + filtered list for admin Question Library table. Returns PagedResponse. */
  listPaged: ({
    questionId,
    questionText,
    fieldType,
    required,
    granularTaskId,
    page = 0,
    size = 20,
  } = {}) =>
    api.get('/admin/questions', {
      params: { questionId, questionText, fieldType, required, granularTaskId, page, size },
    }).then((r) => r.data),
}

/** API for Budget Master Data (/api/master-data) */
export const budgetMasterDataApi = {
  getStates: () => api.get('/master-data/states').then((r) => r.data),
  getPeriods: (type = 'ANNUAL') => api.get('/master/periods', { params: { type } }).then((r) => r.data),
}

export const eventCategoryApi = {
  list: () => api.get('/master/event-categories').then(r => r.data),
  getByVertical: (businessVerticalId) => api.get(`/master/event-categories/by-vertical/${businessVerticalId}`).then(r => r.data),
  create: (payload) => api.post('/master/event-categories', payload).then(r => r.data),
  update: (id, payload) => api.put(`/master/event-categories/${id}`, payload).then(r => r.data),
}

export const eventTaskTypeApi = {
  listGroupedTasks: () => api.get('/master-data/event-task-types/list').then((r) => r.data),
  getTasks: (eventCategoryId, businessVerticalId) => api.get('/master-data/event-task-types', { params: { eventCategoryId, businessVerticalId } }).then((r) => r.data),
  saveTasks: (eventCategoryId, businessVerticalId, payload) => api.put('/master-data/event-task-types', payload, { params: { eventCategoryId, businessVerticalId } }).then((r) => r.data)
}

export const eventCampaignTaskApi = eventTaskTypeApi;
