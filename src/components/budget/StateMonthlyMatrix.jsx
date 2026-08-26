import { useState, useMemo, useEffect } from 'react'
import { stateMonthlyPlanApi } from '../../api/budgets'
import { formatInr, INDIAN_STATES, FINANCIAL_MONTHS } from '../../utils/budgetHelpers'
import { useToast } from '../Toast'
import AppSelect from '../AppSelect'
import Icon from '../Icon'

export default function StateMonthlyMatrix({ proposal, readOnly, onBack }) {
  const toast = useToast()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Internal state for the grid
  // We'll store a list of states that have been added to the grid.
  // For each state, we'll store a map of monthNumber -> allocatedBudget
  const [gridData, setGridData] = useState({})

  const loadPlans = React.useCallback(async () => {
    if (!proposal?.id) return
    setLoading(true)
    try {
      const data = await stateMonthlyPlanApi.getByProposalId(proposal.id)
      setPlans(data)
      
      const newGridData = {}
      data.forEach(p => {
        if (!newGridData[p.stateCode]) {
          newGridData[p.stateCode] = {}
        }
        newGridData[p.stateCode][p.monthNumber] = p.allocatedBudget
      })
      setGridData(newGridData)
    } catch (err) {
      toast.error('Failed to load state plans')
    } finally {
      setLoading(false)
    }
  }, [proposal?.id, toast]);

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  const stateOptions = INDIAN_STATES.map(s => ({ value: s.code, label: s.name }))
  const usedStates = Object.keys(gridData)

  const handleAddState = (stateCode) => {
    if (!stateCode || gridData[stateCode]) return
    setGridData(prev => ({
      ...prev,
      [stateCode]: {}
    }))
  }

  const handleRemoveState = (stateCode) => {
    setGridData(prev => {
      const next = { ...prev }
      delete next[stateCode]
      return next
    })
  }

  const handleCellChange = (stateCode, monthNumber, value) => {
    const numValue = value === '' ? 0 : Number(value)
    if (isNaN(numValue) || numValue < 0) return

    setGridData(prev => ({
      ...prev,
      [stateCode]: {
        ...prev[stateCode],
        [monthNumber]: numValue
      }
    }))
  }

  const { totalAllocated, remaining } = useMemo(() => {
    let sum = 0
    Object.values(gridData).forEach(stateMonths => {
      Object.values(stateMonths).forEach(val => {
        sum += (val || 0)
      })
    })
    return {
      totalAllocated: sum,
      remaining: (proposal?.totalAmount || 0) - sum
    }
  }, [gridData, proposal?.totalAmount])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Iterate through gridData and save each state/month combination.
      // For simplicity, we could recreate all or update existing.
      // Wait, the API requires POST for new, PUT for update. 
      // It's easier if the backend had a bulk update endpoint, but we don't.
      // We have to figure out which are new, which are updated, which are deleted.
      // Or we can just call delete on missing, update on existing, create on new.
      
      const existingMap = {}
      plans.forEach(p => {
        if (!existingMap[p.stateCode]) existingMap[p.stateCode] = {}
        existingMap[p.stateCode][p.monthNumber] = p
      })

      const promises = []

      // Create or Update
      Object.entries(gridData).forEach(([stateCode, monthData]) => {
        FINANCIAL_MONTHS.forEach(m => {
          const val = monthData[m.value] || 0
          const existing = existingMap[stateCode]?.[m.value]

          if (existing) {
            if (val !== existing.allocatedBudget) {
              promises.push(stateMonthlyPlanApi.update(existing.id, {
                proposalId: proposal.id,
                stateCode,
                monthNumber: m.value,
                allocatedBudget: val
              }))
            }
            // mark as processed
            existingMap[stateCode][m.value] = null
          } else if (val > 0) {
            promises.push(stateMonthlyPlanApi.create({
              proposalId: proposal.id,
              stateCode,
              monthNumber: m.value,
              allocatedBudget: val
            }))
          }
        })
      })

      // Delete the ones that were removed (or set to 0 and not in gridData anymore)
      Object.values(existingMap).forEach(months => {
        Object.values(months).forEach(p => {
          if (p) {
            promises.push(stateMonthlyPlanApi.delete(p.id))
          }
        })
      })

      await Promise.all(promises)
      toast.success('Matrix saved successfully')
      await loadPlans()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save matrix')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-10 text-center text-slate-500">Loading matrix...</div>

  return (
    <div className="space-y-6">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Budget</p>
            <p className="text-lg font-bold text-slate-900">{formatInr(proposal?.totalAmount)}</p>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Remaining Annual Budget</p>
            <p className={`text-lg font-bold ${remaining < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              {formatInr(remaining)}
            </p>
          </div>
          <div className="ml-auto text-xs text-slate-500">
            Allocated: {formatInr(totalAllocated)}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium sticky left-0 bg-slate-50 border-r border-slate-100 min-w-[200px]">
                State
              </th>
              {FINANCIAL_MONTHS.map(m => (
                <th key={m.value} className="px-4 py-3 font-medium min-w-[120px] text-right">
                  {m.label} ({m.value})
                </th>
              ))}
              {!readOnly && <th className="px-4 py-3 font-medium min-w-[60px]" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usedStates.map(stateCode => {
              const stateName = INDIAN_STATES.find(s => s.code === stateCode)?.name || stateCode
              return (
                <tr key={stateCode} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800 sticky left-0 bg-white border-r border-slate-100">
                    {stateName} ({stateCode})
                  </td>
                  {FINANCIAL_MONTHS.map(m => {
                    const val = gridData[stateCode][m.value] || 0
                    return (
                      <td key={m.value} className="px-4 py-3 text-right">
                        {readOnly ? (
                          <span className="text-slate-600">{val > 0 ? formatInr(val) : '-'}</span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            value={val || ''}
                            onChange={(e) => handleCellChange(stateCode, m.value, e.target.value)}
                            placeholder="0"
                            className="w-full text-right rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
                          />
                        )}
                      </td>
                    )
                  })}
                  {!readOnly && (
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveState(stateCode)}
                        className="text-slate-400 hover:text-red-600 transition"
                      >
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="flex items-center gap-4">
          <div className="w-64">
            <AppSelect
              options={stateOptions.filter(o => !usedStates.includes(o.value))}
              onChange={handleAddState}
              placeholder="Add state..."
              value={null}
            />
          </div>
          <div className="flex-1" />
          <button
            type="button"
            disabled={saving || remaining < 0}
            onClick={handleSave}
            className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Matrix'}
          </button>
        </div>
      )}
    </div>
  )
}
