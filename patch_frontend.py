import os

def patch_budgetTopup():
    with open('src/api/budgetTopup.js', 'r') as f:
        content = f.read()
    
    old_snippet = """  getPendingTopUpsByTaskId: async (taskId) => {
    const response = await client.get(`/budget/topup/pending/task/${taskId}`)
    return response.data
  },"""
    if old_snippet in content:
        content = content.replace(old_snippet, "")
        with open('src/api/budgetTopup.js', 'w') as f:
            f.write(content)
        print("Patched budgetTopup.js")

def patch_ManagerQcReviewPage():
    with open('src/pages/manager/ManagerQcReviewPage.jsx', 'r') as f:
        content = f.read()

    # 1. Remove imports
    content = content.replace("import { budgetTopupApi } from '../../api/budgetTopup'\n", "")
    content = content.replace("import { budgetPlanningApi } from '../../api/budgetPlanning'\n", "")

    # 2. TopUpRequestSection component
    start_str = "function TopUpRequestSection("
    end_str = "function ReviewModal("
    start_idx = content.find(start_str)
    end_idx = content.find(end_str)
    if start_idx != -1 and end_idx != -1:
        content = content[:start_idx] + content[end_idx:]

    # 3. State and Effects
    states_to_remove = """
  // Pending topup tracking
  const [hasPendingTopup, setHasPendingTopup] = useState(false)
  const [pendingTopupStates, setPendingTopupStates] = useState([])

  // Top-up request state
  const [showTopUp, setShowTopUp] = useState(false)
  const [topUpItems, setTopUpItems] = useState([])
  const [topUpRemarks, setTopUpRemarks] = useState('')
  const [topUpRemarksError, setTopUpRemarksError] = useState(false)
  const [submittingTopUp, setSubmittingTopUp] = useState(false)

  // Active proposal ID for top-up
  const [activeProposalId, setActiveProposalId] = useState(null)
"""
    if states_to_remove in content:
        content = content.replace(states_to_remove, "")
        
    old_show_submit = "  const showSubmitButton = action !== 'APPROVED' || !isFinalLevel || !isBudgetOverrun || hasPendingTopup"
    new_show_submit = "  const showSubmitButton = action !== 'APPROVED' || !isFinalLevel || !isBudgetOverrun"
    content = content.replace(old_show_submit, new_show_submit)
    
    effects_to_remove = """  // Check for pending topups for this specific task (separate effect)
  useEffect(() => {
    if (!isFinalLevel || action !== 'APPROVED' || !task?.taskId) {
      setHasPendingTopup(false)
      return
    }
    budgetTopupApi.getPendingTopUpsByTaskId(task.taskId)
      .then(pendingTopups => {
        if (pendingTopups.length > 0) {
          setHasPendingTopup(true)
          setPendingTopupStates(pendingTopups.map(t => t.stateCode))
        } else {
          setHasPendingTopup(false)
          setPendingTopupStates([])
        }
      })
      .catch(() => { setHasPendingTopup(false) })
  }, [isFinalLevel, action, task?.taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load active proposal for top-up flow
  useEffect(() => {
    if (!showTopUp) return
    budgetPlanningApi.getProposals()
      .then(proposals => {
        const active = proposals.find(p => p.status === 'ACTIVE')
        setActiveProposalId(active?.id || null)
      })
      .catch(() => {})
  }, [showTopUp])

  // Initialize top-up items from budget check overrun states
  useEffect(() => {
    if (!showTopUp || !budgetCheck?.stateResults) return
    const items = budgetCheck.stateResults
      .filter(s => s.status === 'SOFT_OVERRUN' || s.status === 'HARD_BLOCK')
      .map(s => ({
        stateCode: s.stateCode,
        minimumAmount: Math.abs(Number(s.availableAfter) || 0),
        requestedAmount: Math.abs(Number(s.availableAfter) || 0),
        availableBefore: Number(s.availableBefore) || 0,
        thisPosAmount: Number(s.thisPosAmount) || 0,
      }))
    setTopUpItems(items)
  }, [showTopUp, budgetCheck]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTopUpSubmit = async () => {
    if (!activeProposalId) {
      showToast('No active budget proposal found. Cannot request top-up.', 'error')
      return
    }
    if (!topUpRemarks.trim()) {
      setTopUpRemarksError(true)
      return
    }
    setSubmittingTopUp(true)
    try {
      await budgetTopupApi.requestBatchTopUp({
        proposalId: activeProposalId,
        taskId: task.taskId,
        remarks: topUpRemarks.trim(),
        items: topUpItems.map(item => ({
          verticalId: campaign?.businessVerticalId || null,
          stateCode: item.stateCode,
          amount: item.requestedAmount,
        })),
      })
      showToast('Budget top-up requested successfully', 'success')
      if (onTopUpComplete) onTopUpComplete(); else onCancel()
      // The parent will refresh the list
    } catch (e) {
      showToast(e?.response?.data?.message || e?.message || 'Failed to request top-up', 'error')
    } finally {
      setSubmittingTopUp(false)
    }
  }"""
    content = content.replace(effects_to_remove, "")
    
    # 4. Remove UI components from return block
    ui_component = """          {showTopUp && activeProposalId && (
            <TopUpRequestSection
              topUpItems={topUpItems}
              setTopUpItems={setTopUpItems}
              topUpRemarks={topUpRemarks}
              setTopUpRemarks={setTopUpRemarks}
              topUpRemarksError={topUpRemarksError}
              formatCurrency={formatCurrency}
            />
          )}

          {!showTopUp && (
            <>"""
    content = content.replace(ui_component, """          <>""")

    buttons_to_remove = """                {/* Final level with overrun: show only "Request Top Up" (no Approve & Deliver) */}
                {isFinalLevel && isBudgetOverrun && action === 'APPROVED' && !hasPendingTopup && (
                  <button
                    onClick={() => { setShowTopUp(true); setTopUpRemarks(''); setTopUpRemarksError(false) }}
                    className="rounded-lg px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition flex items-center gap-1.5"
                  >
                    <Icon name="plus-circle" className="h-3.5 w-3.5" /> Request Top Up
                  </button>
                )}

                {/* Final level with pending topup: show faded disabled button */}
                {isFinalLevel && hasPendingTopup && action === 'APPROVED' && (
                  <button
                    disabled
                    className="rounded-lg px-5 py-2 text-sm font-semibold text-white bg-blue-600/40 cursor-not-allowed flex items-center gap-1.5"
                    title={`Top-up request pending for state(s): ${pendingTopupStates.join(', ')}`}
                  >
                    <Icon name="clock" className="h-3.5 w-3.5" /> Top Up Pending — Waiting for approval
                  </button>
                )}"""
                
    hard_block_msg = """                {/* Hard block message */}
                {isFinalLevel && isBudgetOverrun && action === 'APPROVED' && (
                  <div className="flex items-center gap-1.5 text-sm font-medium text-rose-600 bg-rose-50 px-4 py-2 rounded-lg border border-rose-200">
                    <Icon name="alert-triangle" className="h-4 w-4" />
                    Budget exhausted. A Top-Up must be approved first.
                  </div>
                )}"""
    content = content.replace(buttons_to_remove, hard_block_msg)
    
    close_tags = """            </>
          )}

          {showTopUp && (
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => { setShowTopUp(false); setTopUpRemarks(''); setTopUpRemarksError(false) }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Back
              </button>
              <button
                onClick={handleTopUpSubmit}
                disabled={submittingTopUp || !activeProposalId}
                className={`rounded-lg px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${tones.REQUEST_TOPUP}`}
              >
                {submittingTopUp ? 'Submitting…' : 'Submit Top-Up Request'}
              </button>
            </div>
          )}"""
    content = content.replace(close_tags, """            </>""")
    
    with open('src/pages/manager/ManagerQcReviewPage.jsx', 'w') as f:
        f.write(content)
    print("Patched ManagerQcReviewPage.jsx")

if __name__ == "__main__":
    patch_budgetTopup()
    patch_ManagerQcReviewPage()
