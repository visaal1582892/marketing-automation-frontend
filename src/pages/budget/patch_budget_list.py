import re

with open("BudgetProposalListPage.jsx", "r") as f:
    content = f.read()

# 1. Imports
content = content.replace(
    "import { budgetTopupApi } from '../../api/budgetTopup';",
    "import { budgetTopupApi } from '../../api/budgetTopup';\nimport { masterApi, budgetMasterDataApi } from '../../api/masterData';"
)

# 2. State
old_state = """  const [topupDialog, setTopupDialog] = useState({ isOpen: false, proposalId: null });
  const [topupData, setTopupData] = useState({ verticalId: '', stateCode: '', amount: '', remarks: '' });
  const [topupError, setTopupError] = useState('');"""
new_state = """  const [topupDialog, setTopupDialog] = useState({ isOpen: false, proposalId: null });
  const [topupData, setTopupData] = useState({ periodId: '', stateCode: '', totalAmount: '', remarks: '', allocations: [{ id: crypto.randomUUID(), verticalId: '', amount: '' }] });
  const [topupError, setTopupError] = useState('');
  const [masterVerticals, setMasterVerticals] = useState([]);
  const [masterStates, setMasterStates] = useState([]);
  const [masterQuarters, setMasterQuarters] = useState([]);

  const handleOpenTopup = (proposalId) => {
    const currentQ = masterQuarters.length > 0 ? masterQuarters[0].id : '';
    setTopupData({
      periodId: currentQ,
      stateCode: '',
      totalAmount: '',
      remarks: '',
      allocations: [{ id: crypto.randomUUID(), verticalId: '', amount: '' }]
    });
    setTopupError('');
    setTopupDialog({ isOpen: true, proposalId });
  };"""
content = content.replace(old_state, new_state)

# 3. useEffect
old_useeffect = """  useEffect(() => {
    loadStats();
  }, []);"""
new_useeffect = """  useEffect(() => {
    loadStats();
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    try {
      const [vRes, sRes, qRes] = await Promise.all([
        masterApi.list('business-verticals'),
        budgetMasterDataApi.getStates(),
        budgetMasterDataApi.getPeriods('QUARTER')
      ]);
      setMasterVerticals(vRes || []);
      setMasterStates(sRes || []);
      const now = new Date();
      const validQuarters = (qRes || []).filter(q => new Date(q.endDate) >= now);
      setMasterQuarters(validQuarters);
    } catch (err) {
      console.error("Failed to load master data", err);
    }
  };"""
content = content.replace(old_useeffect, new_useeffect)

# 4. ActionMenuItem onClick
old_action = """                            <ActionMenuItem
                              label="Request Top-Up"
                              variant="success"
                              disabled={processing}
                              onClick={() => setTopupDialog({ isOpen: true, proposalId: proposal.id })}
                            />"""
new_action = """                            <ActionMenuItem
                              label="Request Top-Up"
                              variant="success"
                              disabled={processing}
                              onClick={() => handleOpenTopup(proposal.id)}
                            />"""
content = content.replace(old_action, new_action)

# 5. Topup calculations before return
old_return = """  if (loading) {"""
new_return = """  const totalAmountCents = Math.round((Number(topupData.totalAmount) || 0) * 100);
  const allocatedCents = topupData.allocations.reduce((acc, curr) => acc + Math.round((Number(curr.amount) || 0) * 100), 0);
  const remainingBalance = (totalAmountCents - allocatedCents) / 100;
  
  const isValidToSubmit = 
    remainingBalance === 0 &&
    topupData.allocations.length > 0 &&
    topupData.allocations.every(a => a.verticalId && Number(a.amount) > 0) &&
    topupData.periodId &&
    topupData.stateCode &&
    topupData.totalAmount;

  if (loading) {"""
content = content.replace(old_return, new_return)

# 6. Modal
old_modal = """      <Modal
        open={topupDialog.isOpen}
        onClose={() => { setTopupDialog({ isOpen: false, proposalId: null }); setTopupData({ verticalId: '', stateCode: '', amount: '', remarks: '' }); setTopupError(''); }}
        title="Request Budget Top-Up"
        footer={
          <>
            <button
              onClick={() => { setTopupDialog({ isOpen: false, proposalId: null }); setTopupData({ verticalId: '', stateCode: '', amount: '', remarks: '' }); setTopupError(''); }}
              className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
              disabled={processing}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!topupData.verticalId || !topupData.stateCode || !topupData.amount) {
                  setTopupError('Vertical, State, and Amount are required.');
                  return;
                }
                setProcessing(true);
                try {
                  await budgetTopupApi.requestTopUp(topupDialog.proposalId, {
                    verticalId: topupData.verticalId,
                    stateCode: topupData.stateCode,
                    topupAmount: Number(topupData.amount),
                    remarks: topupData.remarks
                  });
                  toast.success('Top-Up requested successfully.');
                  setTopupDialog({ isOpen: false, proposalId: null });
                  setTopupData({ verticalId: '', stateCode: '', amount: '', remarks: '' });
                  setTopupError('');
                } catch (e) {
                  setTopupError(e?.response?.data?.message || 'Failed to request top-up');
                } finally {
                  setProcessing(false);
                }
              }}
              className="rounded-md px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              disabled={processing}
            >
              {processing ? 'Submitting...' : 'Submit Request'}
            </button>
          </>
        }
      >
        <div className="py-2 text-sm text-slate-600 space-y-4">
          <p>Request additional funds for an active budget.</p>
          {topupError && <p className="text-xs text-rose-600 font-medium">{topupError}</p>}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Business Vertical ID</label>
            <input type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-emerald-500 focus:border-emerald-500" value={topupData.verticalId} onChange={e => setTopupData({ ...topupData, verticalId: e.target.value })} placeholder="e.g. PHARMA" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">State Code</label>
            <input type="text" className="w-full p-2 border border-slate-300 rounded focus:ring-emerald-500 focus:border-emerald-500" value={topupData.stateCode} onChange={e => setTopupData({ ...topupData, stateCode: e.target.value })} placeholder="e.g. TS" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹)</label>
            <input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-emerald-500 focus:border-emerald-500" value={topupData.amount} onChange={e => setTopupData({ ...topupData, amount: e.target.value })} placeholder="e.g. 50000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks</label>
            <textarea className="w-full p-2 border border-slate-300 rounded focus:ring-emerald-500 focus:border-emerald-500" value={topupData.remarks} onChange={e => setTopupData({ ...topupData, remarks: e.target.value })} placeholder="Reason for top-up..." rows={2}></textarea>
          </div>
        </div>
      </Modal>"""

new_modal = """      <Modal
        open={topupDialog.isOpen}
        onClose={() => { setTopupDialog({ isOpen: false, proposalId: null }); setTopupError(''); }}
        title="Request Budget Top-Up"
        footer={
          <>
            <button
              onClick={() => { setTopupDialog({ isOpen: false, proposalId: null }); setTopupError(''); }}
              className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
              disabled={processing}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!isValidToSubmit) return;
                setProcessing(true);
                try {
                  const verticalDistribution = {};
                  topupData.allocations.forEach(a => {
                    verticalDistribution[a.verticalId] = Number(a.amount);
                  });
                  await budgetTopupApi.requestTopUp(topupDialog.proposalId, {
                    periodId: topupData.periodId,
                    stateCode: topupData.stateCode,
                    totalAmount: Number(topupData.totalAmount),
                    remarks: topupData.remarks,
                    verticalDistribution
                  });
                  toast.success('Top-Up requested successfully.');
                  setTopupDialog({ isOpen: false, proposalId: null });
                } catch (e) {
                  setTopupError(e?.response?.data?.message || 'Failed to request top-up');
                } finally {
                  setProcessing(false);
                }
              }}
              className="rounded-md px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              disabled={!isValidToSubmit || processing}
            >
              {processing ? 'Submitting...' : 'Submit Request'}
            </button>
          </>
        }
      >
        <div className="py-2 text-sm text-slate-600 space-y-4">
          <p>Request additional funds for an active budget.</p>
          {topupError && <p className="text-xs text-rose-600 font-medium">{topupError}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Period</label>
              <SingleSelectDropdown
                value={topupData.periodId}
                onChange={val => setTopupData({ ...topupData, periodId: val })}
                options={masterQuarters.map(q => ({ value: q.id, label: q.periodName }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
              <SingleSelectDropdown
                value={topupData.stateCode}
                onChange={val => setTopupData({ ...topupData, stateCode: val })}
                options={masterStates.map(s => ({ value: s.stateCode, label: s.stateName }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Total Amount (₹)</label>
            <input type="number" className="w-full p-2 border border-slate-300 rounded focus:ring-emerald-500 focus:border-emerald-500" value={topupData.totalAmount} onChange={e => setTopupData({ ...topupData, totalAmount: e.target.value })} placeholder="e.g. 50000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks</label>
            <textarea className="w-full p-2 border border-slate-300 rounded focus:ring-emerald-500 focus:border-emerald-500" value={topupData.remarks} onChange={e => setTopupData({ ...topupData, remarks: e.target.value })} placeholder="Reason for top-up..." rows={2}></textarea>
          </div>
          
          <div className="border-t border-slate-200 pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-bold text-slate-800">Business Vertical Allocation</label>
              <div className="text-sm">
                <span className="font-semibold text-slate-600">Remaining Balance: </span>
                <span className={`font-bold ${remainingBalance === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>₹{remainingBalance.toLocaleString()}</span>
              </div>
            </div>
            <div className="space-y-3">
              {topupData.allocations.map((alloc, idx) => {
                const availableVerticals = masterVerticals.filter(v => 
                  v.businessVerticalId == alloc.verticalId || !topupData.allocations.some(a => a.verticalId == v.businessVerticalId)
                );
                return (
                  <div key={alloc.id} className="flex gap-3 items-start">
                    <div className="flex-1">
                      <SingleSelectDropdown
                        value={alloc.verticalId}
                        onChange={val => {
                          const newAllocs = [...topupData.allocations];
                          newAllocs[idx].verticalId = val;
                          setTopupData({ ...topupData, allocations: newAllocs });
                        }}
                        options={availableVerticals.map(v => ({ value: String(v.businessVerticalId), label: v.businessVerticalName }))}
                      />
                    </div>
                    <div className="w-40">
                      <input type="number" className="w-full p-2 border border-slate-300 rounded h-[38px] focus:ring-emerald-500 focus:border-emerald-500" value={alloc.amount} onChange={e => {
                        const newAllocs = [...topupData.allocations];
                        newAllocs[idx].amount = e.target.value;
                        setTopupData({ ...topupData, allocations: newAllocs });
                      }} placeholder="Amount" />
                    </div>
                    <button
                      onClick={() => {
                        const newAllocs = topupData.allocations.filter(a => a.id !== alloc.id);
                        setTopupData({ ...topupData, allocations: newAllocs });
                      }}
                      className="h-[38px] w-10 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded shrink-0 border border-transparent hover:border-rose-200"
                    >
                      <Icon name="trash" className="h-5 w-5" />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={() => {
                  setTopupData({ ...topupData, allocations: [...topupData.allocations, { id: crypto.randomUUID(), verticalId: '', amount: '' }] });
                }}
                className="text-sm font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1 mt-2"
              >
                <Icon name="plus" className="h-4 w-4" /> Add Vertical Allocation
              </button>
            </div>
          </div>
        </div>
      </Modal>"""
content = content.replace(old_modal, new_modal)

with open("BudgetProposalListPage.jsx", "w") as f:
    f.write(content)
