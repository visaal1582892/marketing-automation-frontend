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
  { slug: 'task-types',          label: 'Task Types',          icon: 'list'      },
  { slug: 'regions',             label: 'Regions',             icon: 'globe'     },
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
  { slug: 'campaign-types',      label: 'Campaign Types',      icon: 'tag'       },
  { slug: 'business-verticals',  label: 'Business Verticals',  icon: 'building'  },
  { slug: 'business-types',      label: 'Business Types',      icon: 'list'      },
  { slug: 'store-format-types',  label: 'Store / Format Types', icon: 'globe'    },
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
  listPaged: ({ taskId, taskName, taskTypeName, status, page = 0, size = 20 } = {}) =>
    api.get('/master/granular-tasks', {
      params: { taskId, taskName, taskTypeName, status, page, size },
    }).then((r) => r.data),

  /** Dynamic questions mapped to this granular task (new-request form). */
  getQuestions: (id) =>
    api.get(`/master/granular-tasks/${id}/questions`).then((r) => r.data),
  get:    (id)          => api.get(`/master/granular-tasks/${id}`).then((r) => r.data),
  create: (payload)     => api.post('/master/granular-tasks', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/master/granular-tasks/${id}`, payload).then((r) => r.data),
  remove: (id)          => api.delete(`/master/granular-tasks/${id}`).then((r) => r.data),
}

/** API for Role → Task mappings (/api/master/routing/role-task) */
export const roleTaskApi = {
  /** Full list (no pagination). */
  list: ()              => api.get('/master/routing/role-task').then((r) => r.data),

  /** Paged + filtered list for admin Role-Task Mapping table. Returns PagedResponse. */
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
  deleteByCombination: (campaignTypeId = '', businessVerticalId = '', businessTypeId = '', storeFormatTypeId = '') =>
    api.delete('/campaign-task-config/combination', {
      params: { campaignTypeId, businessVerticalId, businessTypeId, storeFormatTypeId },
    }).then((r) => r.data),
}

/** API for Question Library (/api/admin/questions) */
export const questionApi = {
  /** Full list (no pagination). */
  list: () => api.get('/admin/questions').then((r) => r.data),

  /** Paged + filtered list for admin Question Library table. Returns PagedResponse. */
  listPaged: ({ questionText, page = 0, size = 20 } = {}) =>
    api.get('/admin/questions', { params: { questionText, page, size } }).then((r) => r.data),
}
