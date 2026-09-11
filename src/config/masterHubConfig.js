/**
 * Master Data hub — grouped navigation for admin configuration pages.
 */

export const MASTER_HUB_SECTIONS = [
  {
    id: 'campaign-taxonomy',
    title: 'Campaign & Task Taxonomy',
    description: 'Event categories, campaign types, task types, granular tasks, and business verticals.',
    icon: 'layers',
    accent: 'brand',
    items: [
      { label: 'Event Categories',   to: '/admin/master/budget/event-categories', icon: 'list'        },
      { label: 'Event & Task Mappings', to: '/admin/master/event-task-types',     icon: 'gitMerge'    },
      { label: 'Task Types',         to: '/admin/master/task-types',             icon: 'list'        },
      { label: 'Granular Tasks',     to: '/admin/granular-tasks',                icon: 'checkSquare' },
      { label: 'Business Verticals', to: '/admin/master/business-verticals',     icon: 'building'    },
    ],
  },
  {
    id: 'request-form-fields',
    title: 'Request Form Master Data',
    description: 'Configurable dropdown options and metadata used on marketing request forms.',
    icon: 'fileText',
    accent: 'violet',
    items: [
      { label: 'Audience Types',      to: '/admin/master/audiences',           icon: 'users'     },
      { label: 'Business Objectives', to: '/admin/master/business-objectives', icon: 'target'    },
      { label: 'Languages',           to: '/admin/master/languages',           icon: 'globe'     },
      { label: 'Tone / Style',        to: '/admin/master/tones',               icon: 'mic'       },
      { label: 'Offer Types',         to: '/admin/master/offer-types',         icon: 'tag'       },
      { label: 'Supporting Proofs',   to: '/admin/master/supporting-proofs',   icon: 'fileText'  },
      { label: 'Budget Tiers',        to: '/admin/master/budget-tiers',        icon: 'dollar'    },
      { label: 'Vendor Types',        to: '/admin/master/vendor-types',        icon: 'truck'     },
      { label: 'KPI Types',           to: '/admin/master/kpi-types',           icon: 'barChart'  },
      { label: 'Expected Outputs',    to: '/admin/master/expected-outputs',    icon: 'download'  },
    ],
  },
  {
    id: 'organization-capabilities',
    title: 'Organization & Capabilities',
    description: 'Departments, designations, roles, capability task assignments, and user management.',
    icon: 'building',
    accent: 'emerald',
    items: [
      { label: 'Departments',          to: '/admin/master/departments',  icon: 'building' },
      { label: 'Designations',         to: '/admin/master/designations', icon: 'tag'      },
      { label: 'Roles & Permissions',  to: '/admin/roles',               icon: 'shield'   },
      { label: 'Capabilities & Tasks', to: '/admin/master/capabilities', icon: 'zap'      },
      { label: 'User Management',      to: '/admin/users',               icon: 'users'     },
    ],
  },
  {
    id: 'workflow-settings',
    title: 'Workflow & Governance Settings',
    description: 'Question library, working schedules, approval flows, and notification templates.',
    icon: 'sliders',
    accent: 'sky',
    items: [
      { label: 'Question Library',       to: '/admin/questions',              icon: 'clipboard' },
      { label: 'Working Hours',          to: '/admin/working-hours',          icon: 'clock', right: 'MANAGE_SYSTEM_SETTINGS' },
      { label: 'Approval Flows',         to: '/admin/approval-flows',         icon: 'shield', right: 'MANAGE_SYSTEM_SETTINGS' },
      { label: 'Notification Templates', to: '/admin/notification-templates', icon: 'bell' },
    ],
  },
]

const ACCENT_STYLES = {
  brand:   { card: 'border-brand-200 bg-gradient-to-br from-brand-50/80 to-white', icon: 'bg-brand-100 text-brand-600', link: 'hover:border-brand-200 hover:bg-brand-50/50' },
  violet:  { card: 'border-violet-200 bg-gradient-to-br from-violet-50/80 to-white', icon: 'bg-violet-100 text-violet-600', link: 'hover:border-violet-200 hover:bg-violet-50/50' },
  slate:   { card: 'border-slate-200 bg-gradient-to-br from-slate-50 to-white', icon: 'bg-slate-100 text-slate-600', link: 'hover:border-slate-300 hover:bg-slate-50' },
  emerald: { card: 'border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white', icon: 'bg-emerald-100 text-emerald-600', link: 'hover:border-emerald-200 hover:bg-emerald-50/50' },
  amber:   { card: 'border-amber-200 bg-gradient-to-br from-amber-50/80 to-white', icon: 'bg-amber-100 text-amber-600', link: 'hover:border-amber-200 hover:bg-amber-50/50' },
  sky:     { card: 'border-sky-200 bg-gradient-to-br from-sky-50/80 to-white', icon: 'bg-sky-100 text-sky-600', link: 'hover:border-sky-200 hover:bg-sky-50/50' },
}

export function getAccentStyle(accent) {
  return ACCENT_STYLES[accent] || ACCENT_STYLES.slate
}
