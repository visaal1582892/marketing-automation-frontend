/**
 * Master Data hub — grouped navigation for admin configuration pages.
 */

export const MASTER_HUB_SECTIONS = [
  {
    id: 'request-fields',
    title: 'Request Fields Config',
    description: 'Dropdown options and values used on the marketing request form.',
    icon: 'fileText',
    accent: 'brand',
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
    id: 'campaign-specs',
    title: 'Campaign Specifications',
    description: 'Campaign types, verticals, store formats, and specification rules.',
    icon: 'tag',
    accent: 'violet',
    items: [
      { label: 'Campaign Types',      to: '/admin/master/campaign-types',      icon: 'tag'       },
      { label: 'Business Verticals',  to: '/admin/master/business-verticals',  icon: 'building'  },
      { label: 'Business Types',      to: '/admin/master/business-types',      icon: 'list'      },
      { label: 'Store / Format Types', to: '/admin/master/store-format-types', icon: 'globe'     },
      { label: 'Vertical → Type',     to: '/admin/campaign-mappings/vertical-type', icon: 'shield' },
      { label: 'Type → Format',       to: '/admin/campaign-mappings/type-format',   icon: 'shield' },
    ],
  },
  {
    id: 'organization',
    title: 'Organization',
    description: 'Departments, designations, roles, and regions for users and routing.',
    icon: 'building',
    accent: 'slate',
    items: [
      { label: 'Departments',   to: '/admin/master/departments',  icon: 'building' },
      { label: 'Designations',  to: '/admin/master/designations', icon: 'tag'      },
      { label: 'Roles',         to: '/admin/master/roles',        icon: 'shield'   },
      { label: 'Regions',       to: '/admin/master/regions',      icon: 'globe'    },
    ],
  },
  {
    id: 'tasks',
    title: 'Tasks',
    description: 'Task types and granular task definitions used when creating requests.',
    icon: 'list',
    accent: 'emerald',
    items: [
      { label: 'Task Types',      to: '/admin/master/task-types', icon: 'list' },
      { label: 'Granular Tasks',  to: '/admin/granular-tasks',    icon: 'list' },
    ],
  },
  {
    id: 'mappings',
    title: 'Mappings',
    description: 'Connect users, tasks, questions, QC routing, and assignment rules.',
    icon: 'shield',
    accent: 'amber',
    items: [
      { label: 'Task Mappings',    to: '/admin/task-mappings', icon: 'shield'    },
      { label: 'Question Library', to: '/admin/questions',     icon: 'clipboard' },
      { label: 'QC Routing',       to: '/admin/qc-routing',    icon: 'shield', adminOnly: true },
      { label: 'Users',            to: '/admin/users',         icon: 'users'     },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Email and in-app notification templates.',
    icon: 'bell',
    accent: 'sky',
    items: [
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
