import { useCallback, useEffect, useState } from 'react'
import { budgetApi } from '../../api/budgets'
import { masterApi } from '../../api/masterData'
import { useAuthRights } from '../../auth/useAuthRights'
import HasRight from '../../components/HasRight'
import { useToast } from '../../components/Toast'
import { Rights } from '../../constants/rights'
import BudgetDashboard from '../../components/budget/BudgetDashboard'
import BudgetPlannerEditor from '../../components/budget/BudgetPlannerEditor'
import BudgetApproverView from '../../components/budget/BudgetApproverView'
import BudgetPlannerGrid from '../../components/budget/BudgetPlannerGrid'
import HeadBudgetWidget from '../../components/budget/HeadBudgetWidget'
import { formatInr, STATUS_LABELS } from '../../utils/budgetHelpers'

export default function BudgetPlanningPage() {
  const toast = useToast()
  const { user, hasRight, hasAnyRight } = useAuthRights()

  const isPlanner  = hasRight(Rights.PROPOSE_BUDGET)
  const isApprover = hasRight(Rights.APPROVE_BUDGET)
  const isHeadOnly = hasRight(Rights.VIEW_DEPT_BUDGET) && !hasAnyRight(Rights.PROPOSE_BUDGET, Rights.APPROVE_BUDGET)

  const [departments, setDepartments] = useState([])
  const [proposals, setProposals]     = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [headData, setHeadData]       = useState(null)
  const [headLoading, setHeadLoading] = useState(false)

  const [selectedId, setSelectedId]   = useState(null)
  const [activeProposal, setActiveProposal] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [mode, setMode] = useState('list')
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cloningId, setCloningId] = useState(null)

  const deptOptions = departments.map(d => ({ value: String(d.id), label: d.name }))

  const loadDepartments = useCallback(() => {
    masterApi.list('departments')
      .then(d => setDepartments(d))
      .catch(() => toast.error('Failed to load departments.'))
  }, [toast])

  const loadList = useCallback(() => {
    if (!isPlanner && !isApprover) return
    setListLoading(true)
    budgetApi.list()
      .then(setProposals)
      .catch(err => toast.error(err?.response?.data?.message || 'Failed to load budgets.'))
      .finally(() => setListLoading(false))
  }, [isPlanner, isApprover, toast])

  const loadHead = useCallback(() => {
    if (!hasRight(Rights.VIEW_DEPT_BUDGET)) return
    setHeadLoading(true)
    budgetApi.myDepartment()
      .then(setHeadData)
      .catch(err => toast.error(err?.response?.data?.message || 'Failed to load department budget.'))
      .finally(() => setHeadLoading(false))
  }, [hasRight, toast])

  useEffect(() => {
    loadDepartments()
    loadHead()
    loadList()
  }, [loadDepartments, loadHead, loadList])

  const loadDetail = useCallback(async (id) => {
    setDetailLoading(true)
    try {
      const data = await budgetApi.get(id)
      setActiveProposal(data)
      return data
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load proposal.')
      return null
    } finally {
      setDetailLoading(false)
    }
  }, [toast])

  const handleSelect = async (id) => {
    setSelectedId(id)
    const data = await loadDetail(id)
    if (!data) return

    if (data.status === 'PROPOSED' && isApprover) {
      setMode('review')
    } else if ((data.status === 'DRAFT' || data.status === 'NEEDS_REVISION') && isPlanner
        && data.createdBy === user?.id) {
      setMode('edit')
    } else if (data.status === 'APPROVED') {
      setMode('readonly')
    } else {
      setMode('readonly')
    }
  }

  const handleNew = () => {
    setSelectedId(null)
    setActiveProposal(null)
    setMode('new')
  }

  const handleBack = () => {
    setMode('list')
    setSelectedId(null)
    setActiveProposal(null)
    loadList()
    loadHead()
  }

  const handleClone = async (id) => {
    setCloningId(id)
    try {
      const cloned = await budgetApi.clone(id)
      toast.success('Budget cloned as new draft.')
      await loadList()
      setSelectedId(cloned.id)
      setActiveProposal(cloned)
      setMode('edit')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Clone failed.')
    } finally {
      setCloningId(null)
    }
  }

  const persistProposal = async (payload, existingId) => {
    if (existingId) {
      return budgetApi.update(existingId, payload)
    }
    return budgetApi.create(payload)
  }

  const handleSave = async (payload) => {
    setSaving(true)
    try {
      const saved = await persistProposal(payload, activeProposal?.id)
      toast.success('Budget saved.')
      setActiveProposal(saved)
      setSelectedId(saved.id)
      await loadList()
      if (mode === 'new') setMode('edit')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (payload) => {
    setSubmitting(true)
    try {
      const saved = await persistProposal(payload, activeProposal?.id)
      const submitted = await budgetApi.submit(saved.id)
      toast.success('Budget sent for approval.')
      setActiveProposal(submitted)
      setSelectedId(submitted.id)
      setMode('list')
      await loadList()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Submit failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async (comments) => {
    setSaving(true)
    try {
      await budgetApi.approve(activeProposal.id, comments)
      toast.success('Budget approved.')
      handleBack()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Approval failed.')
      throw err
    } finally {
      setSaving(false)
    }
  }

  const handleNeedsRevision = async (payload) => {
    setSaving(true)
    try {
      await budgetApi.needsRevision(activeProposal.id, payload)
      toast.success('Sent back for revision.')
      handleBack()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed.')
      throw err
    } finally {
      setSaving(false)
    }
  }

  if (isHeadOnly) {
    return (
      <div className="mx-auto max-w-2xl">
        <HeadBudgetWidget data={headData} loading={headLoading} />
      </div>
    )
  }

  const showDetail = mode !== 'list'

  const readonlyRows = (activeProposal?.departmentBudgets ?? []).map(r => ({
    key: `ro-${r.id}`,
    departmentId: r.departmentId,
    departmentName: r.departmentName,
    isPercentage: r.percentage,
    percentageValue: r.percentageValue,
    allocatedAmount: r.allocatedAmount,
    plannerComment: r.plannerComment,
    inputValue: '',
    markedForRevision: false,
    revisionDismissed: false,
  }))

  return (
    <div className="space-y-6">
      <HasRight right={Rights.VIEW_DEPT_BUDGET}>
        <HeadBudgetWidget data={headData} loading={headLoading} />
      </HasRight>

      <div className={`grid gap-6 ${showDetail ? 'lg:grid-cols-5' : ''}`}>
        <div className={showDetail ? 'lg:col-span-2' : ''}>
          <BudgetDashboard
            proposals={proposals}
            loading={listLoading}
            selectedId={selectedId}
            onSelect={handleSelect}
            onNew={handleNew}
            onClone={handleClone}
            cloningId={cloningId}
          />
        </div>

        {showDetail && (
          <div className="lg:col-span-3">
            {detailLoading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                Loading…
              </div>
            ) : mode === 'new' || mode === 'edit' ? (
              <HasRight right={Rights.PROPOSE_BUDGET}>
                <BudgetPlannerEditor
                  key={activeProposal?.id ?? 'new'}
                  proposal={activeProposal}
                  departments={deptOptions}
                  saving={saving}
                  submitting={submitting}
                  onSave={handleSave}
                  onSubmit={handleSubmit}
                  onBack={handleBack}
                />
              </HasRight>
            ) : mode === 'review' ? (
              <HasRight right={Rights.APPROVE_BUDGET}>
                <BudgetApproverView
                  proposal={activeProposal}
                  saving={saving}
                  onApprove={handleApprove}
                  onNeedsRevision={handleNeedsRevision}
                  onBack={handleBack}
                />
              </HasRight>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <button type="button" onClick={handleBack} className="text-xs font-medium text-brand-600">
                    ← Back to list
                  </button>
                  <h2 className="mt-1 text-base font-semibold text-slate-900">
                    FY {activeProposal?.financialYear}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {STATUS_LABELS[activeProposal?.status]?.label} · {formatInr(activeProposal?.totalAmount)}
                  </p>
                </div>
                <div className="p-5">
                  <BudgetPlannerGrid
                    totalBudget={activeProposal?.totalAmount}
                    rows={readonlyRows}
                    departments={deptOptions}
                    readOnly
                    onRowChange={() => {}}
                    onAddRow={() => {}}
                    onRemoveRow={() => {}}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
