import { Rights } from './rights'

/** Gate My Requests nav, /campaigns route, and requestor dashboard widgets. */
export const REQUESTOR_RIGHTS = [
  Rights.VIEW_OWN_CAMPAIGNS,
]

export const REQUESTOR_NAV_LINKS = [
  {
    to: '/requestor/review-center',
    label: 'Review Center',
    icon: 'check',
    right: Rights.VIEW_REQUESTOR_QC_QUEUE,
  },
]

export const ADMIN_CONFIG_RIGHTS = [
  Rights.VIEW_MASTER_DATA,
  Rights.MANAGE_MASTER_DATA,
  Rights.MANAGE_GRANULAR_TASKS,
  Rights.MANAGE_ROUTING_CONFIG,
  Rights.MANAGE_USERS,
  Rights.MANAGE_QUESTION_LIBRARY,
  Rights.MANAGE_QC_ROUTING,
  Rights.MANAGE_NOTIFICATION_TEMPLATES,
  Rights.MANAGE_CAMPAIGN_SPEC_MAPPINGS,
  Rights.MANAGE_SYSTEM_SETTINGS,
]

/** Admin master-data config UI — Admin role only in DB mappings. */
export const MASTER_DATA_RIGHTS = [
  Rights.MANAGE_MASTER_DATA,
]

export const BUDGET_RIGHTS = [
  Rights.PROPOSE_BUDGET,
  Rights.APPROVE_BUDGET,
  Rights.VIEW_DEPT_BUDGET,
]

export const MANAGER_NAV_LINKS = [
  {
    to: '/manager/task-management',
    label: 'Task Management',
    icon: 'fileText',
    anyRight: [Rights.ACCESS_MANAGER_TOOLS, Rights.VIEW_TEAM_TASKS],
  },
  {
    to: '/tasks/approvals',
    label: 'Task Approvals',
    icon: 'check',
    anyRight: [Rights.REVIEW_MANAGER_QC, Rights.APPROVE_TEAM_TASKS],
  },
  {
    to: '/manager/analytics',
    label: 'Analytics',
    icon: 'barChart',
    anyRight: [Rights.VIEW_ANALYTICS_REPORTS, Rights.ACCESS_MANAGER_TOOLS, Rights.VIEW_TEAM_ANALYTICS],
  },
]

export function canAccessNavItem(item, hasRight, hasAnyRight) {
  if (item.right) return hasRight(item.right)
  if (item.anyRight) return hasAnyRight(...item.anyRight)
  return true
}
