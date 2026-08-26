const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const INDIAN_STATES = [
  { code: 'AP', name: 'Andhra Pradesh' },
  { code: 'AR', name: 'Arunachal Pradesh' },
  { code: 'AS', name: 'Assam' },
  { code: 'BR', name: 'Bihar' },
  { code: 'CG', name: 'Chhattisgarh' },
  { code: 'GA', name: 'Goa' },
  { code: 'GJ', name: 'Gujarat' },
  { code: 'HR', name: 'Haryana' },
  { code: 'HP', name: 'Himachal Pradesh' },
  { code: 'JH', name: 'Jharkhand' },
  { code: 'KA', name: 'Karnataka' },
  { code: 'KL', name: 'Kerala' },
  { code: 'MP', name: 'Madhya Pradesh' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'MN', name: 'Manipur' },
  { code: 'ML', name: 'Meghalaya' },
  { code: 'MZ', name: 'Mizoram' },
  { code: 'NL', name: 'Nagaland' },
  { code: 'OR', name: 'Odisha' },
  { code: 'PB', name: 'Punjab' },
  { code: 'RJ', name: 'Rajasthan' },
  { code: 'SK', name: 'Sikkim' },
  { code: 'TN', name: 'Tamil Nadu' },
  { code: 'TS', name: 'Telangana' },
  { code: 'TR', name: 'Tripura' },
  { code: 'UP', name: 'Uttar Pradesh' },
  { code: 'UK', name: 'Uttarakhand' },
  { code: 'WB', name: 'West Bengal' },
  { code: 'AN', name: 'Andaman and Nicobar Islands' },
  { code: 'CH', name: 'Chandigarh' },
  { code: 'DN', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: 'DL', name: 'Delhi' },
  { code: 'JK', name: 'Jammu and Kashmir' },
  { code: 'LA', name: 'Ladakh' },
  { code: 'LD', name: 'Lakshadweep' },
  { code: 'PY', name: 'Puducherry' },
]

export const FINANCIAL_MONTHS = [
  { value: 1, label: 'Apr' },
  { value: 2, label: 'May' },
  { value: 3, label: 'Jun' },
  { value: 4, label: 'Jul' },
  { value: 5, label: 'Aug' },
  { value: 6, label: 'Sep' },
  { value: 7, label: 'Oct' },
  { value: 8, label: 'Nov' },
  { value: 9, label: 'Dec' },
  { value: 10, label: 'Jan' },
  { value: 11, label: 'Feb' },
  { value: 12, label: 'Mar' },
]

export function formatInr(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return INR.format(0)
  return INR.format(n)
}

export function parseAmount(value) {
  if (value === '' || value == null) return 0
  const n = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function round2(n) {
  return Math.round(n * 100) / 100
}

export function computeRowAmount(totalBudget, row) {
  if (row.isPercentage) {
    const pct = parseAmount(row.inputValue)
    return round2((parseAmount(totalBudget) * pct) / 100)
  }
  return round2(parseAmount(row.inputValue))
}

export function amountsEqual(a, b) {
  return Math.abs(round2(a) - round2(b)) < 0.005
}

export const STATUS_LABELS = {
  DRAFT:            { label: 'Draft',            cls: 'bg-slate-100 text-slate-700 ring-slate-200' },
  PENDING_APPROVAL: { label: 'Pending Approval', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  PROPOSED:         { label: 'Pending Approval', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  ACTIVE:           { label: 'Active',           cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  APPROVED:         { label: 'Active',           cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  NEEDS_REVISION:   { label: 'Needs Revision',   cls: 'bg-red-50 text-red-800 ring-red-200' },
  TERMINATED:       { label: 'Terminated',       cls: 'bg-zinc-100 text-zinc-600 ring-zinc-300' },
}


export function defaultFinancialYear() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const start = month >= 4 ? year : year - 1
  const end = String(start + 1).slice(-2)
  return `${start}-${end}`
}

/**
 * Before submitting to backend, fix floating-point rounding on the last row
 * so that sum(absoluteValues) === targetTotal exactly.
 * Returns a NEW array — does not mutate input.
 */
export function reconcileAbsoluteValues(rows, targetTotal) {
  const total = parseAmount(targetTotal)
  const filtered = rows.filter(r => r.departmentId)
  if (filtered.length === 0) return rows

  const sum = filtered.reduce((acc, r) => acc + (r.absoluteValue ?? 0), 0)
  const diff = round2(total - sum)
  if (diff === 0) return rows

  // Apply diff to the last row with a departmentId
  const lastFiltered = filtered[filtered.length - 1]
  return rows.map(r =>
    r === lastFiltered
      ? { ...r, absoluteValue: Math.round(r.absoluteValue + diff) }
      : r,
  )
}
