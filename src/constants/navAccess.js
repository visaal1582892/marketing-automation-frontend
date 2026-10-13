import { Rights } from './rights'

/** Gate My Requests nav, /campaigns route, and requestor dashboard widgets. */
export const REQUESTOR_RIGHTS = [
  Rights.CAMPAIGN_READ_OWN,
]

export const REQUESTOR_NAV_LINKS = [
  {
    to: '/requestor/review-center',
    label: 'Review Center',
    icon: 'eye',
    right: Rights.REQUESTOR_QC_READ,
  },
]

export const ADMIN_CONFIG_RIGHTS = [
  Rights.MASTER_DATA_READ,
  Rights.MASTER_DATA_UPDATE,
  Rights.GRANULAR_TASK_UPDATE,
  Rights.ROUTING_CONFIG_UPDATE,
  Rights.USER_UPDATE,
  Rights.NOTIFICATION_TMPL_UPDATE,
  Rights.SYSTEM_SETTINGS_UPDATE,
]

/** Admin master-data config UI — Admin role only in DB mappings. */
export const MASTER_DATA_RIGHTS = [
  Rights.MASTER_DATA_UPDATE,
]

export const BUDGET_RIGHTS = [
  Rights.BUDGET_CREATE,
  Rights.BUDGET_APPROVE,
  Rights.BUDGET_READ_DEPT,
]

export const MANAGER_NAV_LINKS = [
  {
    to: '/manager/task-management',
    label: 'Task Management',
    icon: 'layers',
    anyRight: [Rights.TASK_READ_TEAM, Rights.TASK_HOLD],
  },
  {
    to: '/tasks/approvals',
    label: 'Task Approvals',
    icon: 'userCheck',
    anyRight: [Rights.MANAGER_QC_READ, Rights.MANAGER_QC_APPROVE, Rights.TASK_READ_TEAM],
  },
  {
    to: '/manager/analytics',
    label: 'Analytics',
    icon: 'barChart',
    anyRight: [Rights.ANALYTICS_READ_TEAM, Rights.ANALYTICS_READ_ALL, Rights.TASK_READ_TEAM],
  },
]

export function canAccessNavItem(item, hasRight, hasAnyRight) {
  if (item.right) return hasRight(item.right)
  if (item.anyRight) return hasAnyRight(...item.anyRight)
  return true
}
