import api from './client'

/**
 * Catalog of master data resources surfaced in the sidebar + admin routes.
 * `slug` matches the backend path under /api/master/{slug}.
 */
export const MASTER_RESOURCES = [
  // Structural / configuration
  { slug: 'departments',         label: 'Departments',         icon: 'building'  },
  { slug: 'roles',               label: 'Roles',               icon: 'shield'    },
  { slug: 'requirement-types',   label: 'Requirement Types',   icon: 'clipboard' },
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
]

export const findResource = (slug) =>
  MASTER_RESOURCES.find((r) => r.slug === slug)

export const masterApi = {
  list:   (slug, includeInactive = false) =>
    api.get(`/master/${slug}`, { params: { includeInactive } }).then((r) => r.data),

  get:    (slug, code)        => api.get(`/master/${slug}/${code}`).then((r) => r.data),
  create: (slug, payload)     => api.post(`/master/${slug}`, payload).then((r) => r.data),
  update: (slug, code, body)  => api.put(`/master/${slug}/${code}`, body).then((r) => r.data),
  remove: (slug, code)        => api.delete(`/master/${slug}/${code}`).then((r) => r.data),
}

/** API for Granular Tasks (/api/master/granular-tasks) */
export const granularTasksApi = {
  list: (includeInactive = false, taskTypeId = null) => {
    const params = { includeInactive }
    if (taskTypeId) params.taskTypeId = taskTypeId
    return api.get('/master/granular-tasks', { params }).then((r) => r.data)
  },
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
  list:        ()              => api.get('/master/routing/role-task').then((r) => r.data),
  listByRole:  (roleId)        => api.get(`/master/routing/role-task/${roleId}`).then((r) => r.data),
  create:      (roleId, taskId) =>
    api.post('/master/routing/role-task', { roleId, taskId }).then((r) => r.data),
  update:      (mappingId, status) =>
    api.patch(`/master/routing/role-task/${mappingId}`, { status }).then((r) => r.data),
  remove:      (mappingId)     => api.delete(`/master/routing/role-task/${mappingId}`).then((r) => r.data),
}
