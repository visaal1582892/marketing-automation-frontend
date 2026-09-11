/**
 * Utility functions for formatting values across the application.
 */

/**
 * Formats a Work Task ID by stripping prefixes like "WORK-TASK-", "WORK_TASK-", or "TASK-".
 * e.g., "WORK-TASK-2435" -> "2435", 2435 -> "2435"
 *
 * @param {string|number|null|undefined} id
 * @returns {string}
 */
export function formatTaskId(id) {
  if (id === null || id === undefined || id === '') return ''
  const str = String(id).trim()
  return str.replace(/^(WORK-TASK-|WORK_TASK-|TASK-(?=\d+))/i, '')
}

/**
 * Formats a number as INR currency.
 */
export function formatCurrency(amount) {
  const num = Number(amount)
  if (isNaN(num)) return '₹0'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num)
}
