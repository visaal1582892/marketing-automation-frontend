import re
import sys

def main():
    try:
        with open("BudgetApprovalsPage.jsx", "r") as f:
            content = f.read()

        # 1. Update TopupGroupCard
        old_card = content[content.find("// ─── Top-Up Group Card ────────────────────────────────────────────────────────"):content.find("// ─── Main Page ────────────────────────────────────────────────────────────────")]
        
        new_card = """// ─── Top-Up Group Card ────────────────────────────────────────────────────────
function TopupGroupCard({ group, periodName, onAction }) {
  const [expanded, setExpanded] = useState(false)
  const topupCount = group.topups?.length || 0

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-brand-200 transition-all duration-200 overflow-hidden">
      {/* Card header */}
      <div className="bg-brand-50 border-b border-brand-100 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <span className="text-sm font-bold text-slate-800 font-mono shrink-0">{group.verticalName || 'Unknown Vertical'}</span>
          <span className="hidden sm:block h-4 w-px bg-brand-200" />
          <span className="text-sm text-slate-500 font-medium truncate max-w-[180px] sm:max-w-none">
            {periodName}
          </span>
        </div>
        <div className="shrink-0 ml-auto">
          <ActionMenu align="right">
            <ActionMenuItem icon="checkCircle" label="Approve Vertical" variant="success" onClick={() => onAction(group, 'approve')} />
            <ActionMenuItem icon="xCircle" label="Reject Vertical" variant="danger" onClick={() => onAction(group, 'reject')} />
          </ActionMenu>
        </div>
      </div>

      {/* Card body */}
      <div className="px-4 sm:px-6 py-5">
        {/* Key metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          <Chip label="Total Top-Up" value={formatCurrency(group.totalTopupAmount)} variant="brand" />
          <Chip label="Requests" value={topupCount} />
        </div>

        {/* Expandable individual rows */}
        {topupCount > 0 && (
          <div>
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors mb-2"
            >
              <Icon name={expanded ? 'chevron-up' : 'chevron-down'} className="h-3.5 w-3.5" />
              {expanded ? 'Hide' : 'Show'} individual requests ({topupCount})
            </button>
            {expanded && (
              <div className="flex flex-col gap-3">
                {/* Mobile View: Cards */}
                <div className="grid grid-cols-1 gap-1.5 sm:hidden">
                  {group.topups.map((t, i) => (
                    <div key={t.id || i} className="bg-white border border-slate-200 rounded-md p-2.5 flex flex-col gap-1.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800 text-xs">{t.stateCode || '—'}</span>
                        </div>
                        <span className="font-bold text-brand-700 text-xs">{formatCurrency(t.topupAmount ?? t.amount)}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        {t.requestedByName && <span>Req: <span className="font-medium text-slate-600">{t.requestedByName}</span></span>}
                      </div>
                      
                      {t.remarks && (
                        <div className="text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100 italic truncate mt-0.5" title={t.remarks}>
                          "{t.remarks}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden sm:block rounded-xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider">State</th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider">Requested By</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {group.topups.map((t, i) => (
                          <tr key={t.id || i} className="hover:bg-brand-50/40 transition-colors">
                            <td className="px-3 py-2.5 font-semibold text-slate-800">{t.stateCode || '—'}</td>
                            <td className="px-3 py-2.5 text-right font-bold text-brand-700">{formatCurrency(t.topupAmount ?? t.amount)}</td>
                            <td className="px-3 py-2.5 text-slate-500">{t.requestedByName || '—'}</td>
                            <td className="px-3 py-2.5 text-slate-400 truncate max-w-[120px]">{t.remarks || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

"""
        content = content.replace(old_card, new_card)

        # 2. Update topupPendingCount
        old_count = "const topupPendingCount = topupGroups.reduce((s, g) => s + (g.topups?.length || 0), 0)"
        new_count = "const topupPendingCount = topupGroups.reduce((s, quarter) => s + (quarter.verticals || []).reduce((vs, v) => vs + (v.topups?.length || 0), 0), 0)"
        content = content.replace(old_count, new_count)

        # 3. Update TAB: Top Up Approvals rendering
        old_tab = """        {!loading && activeTab === 'topups' && (
          topupGroups.length === 0
            ? <EmptyState icon="check-circle" title="No Top-Up Requests Pending" sub="All top-up requests have been reviewed." />
            : (
              <div className="space-y-4">
                {topupGroups.map(group => (
                  <TopupGroupCard key={group.taskId} group={group} onAction={openBulkModal} />
                ))}
              </div>
            )
        )}"""
        
        new_tab = """        {!loading && activeTab === 'topups' && (
          topupPendingCount === 0
            ? <EmptyState icon="check-circle" title="No Top-Up Requests Pending" sub="All top-up requests have been reviewed." />
            : (
              <div className="space-y-8">
                {topupGroups.map(quarter => quarter.verticals && quarter.verticals.length > 0 && (
                  <div key={quarter.periodId} className="space-y-4">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Icon name="calendar" className="h-5 w-5 text-slate-400" />
                      {quarter.periodName}
                    </h2>
                    {quarter.verticals.map(vertical => (
                      <TopupGroupCard key={vertical.verticalId} group={vertical} periodName={quarter.periodName} onAction={openBulkModal} />
                    ))}
                  </div>
                ))}
              </div>
            )
        )}"""
        content = content.replace(old_tab, new_tab)

        # 4. Update Bulk Modal task summary
        old_summary = """          {/* Task summary */}
          {bulkModal?.group && (
            <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 text-xs space-y-1.5">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span><span className="font-semibold text-slate-500">Task:</span> <span className="font-mono font-bold text-slate-800">{formatTaskId(bulkModal.group.taskId)}</span></span>
                <span><span className="font-semibold text-slate-500">Total:</span> <span className="font-bold text-brand-700">{formatCurrency(bulkModal.group.totalTopupAmount)}</span></span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span><span className="font-semibold text-slate-500">Requestor:</span> {bulkModal.group.requestorName || '—'}</span>
                <span><span className="font-semibold text-slate-500">Assignee:</span> {bulkModal.group.assigneeName || '—'}</span>
              </div>
            </div>
          )}"""
          
        new_summary = """          {/* Vertical summary */}
          {bulkModal?.group && (
            <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 text-xs space-y-1.5">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span><span className="font-semibold text-slate-500">Vertical:</span> <span className="font-mono font-bold text-slate-800">{bulkModal.group.verticalName || 'Unknown'}</span></span>
                <span><span className="font-semibold text-slate-500">Total:</span> <span className="font-bold text-brand-700">{formatCurrency(bulkModal.group.totalTopupAmount)}</span></span>
              </div>
            </div>
          )}"""
        content = content.replace(old_summary, new_summary)
        
        # 5. Update Bulk Modal table
        old_table = """          {/* Rows table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto" style={{ maxHeight: '260px', overflowY: 'auto' }}>
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th className="px-3 py-2 text-center w-8">
                      <input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-300"
                        checked={selectedIds.size > 0 && selectedIds.size === (bulkModal?.group?.topups?.length || 0)}
                        onChange={e => e.target.checked ? selectAll() : clearAll()} />
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider">State</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider">Vertical</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Period</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Requested By</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {(bulkModal?.group?.topups || []).map((t, i) => {
                    const checked = selectedIds.has(t.id)
                    return (
                      <tr key={t.id || i} onClick={() => toggleId(t.id)}
                        className={`cursor-pointer transition-colors ${checked ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
                        <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-300"
                            checked={checked} onChange={() => toggleId(t.id)} />
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-800">{t.stateCode || '—'}</td>
                        <td className="px-3 py-3 text-slate-600">{t.verticalName || '—'}</td>
                        <td className="px-3 py-3 text-slate-400 hidden sm:table-cell">{t.periodName || '—'}</td>
                        <td className="px-3 py-3 text-right font-bold text-slate-800">{formatCurrency(t.topupAmount ?? t.amount)}</td>
                        <td className="px-3 py-3 text-slate-400 hidden sm:table-cell">{t.requestedByName || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>"""
          
        new_table = """          {/* Rows table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto" style={{ maxHeight: '260px', overflowY: 'auto' }}>
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th className="px-3 py-2 text-center w-8">
                      <input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-300"
                        checked={selectedIds.size > 0 && selectedIds.size === (bulkModal?.group?.topups?.length || 0)}
                        onChange={e => e.target.checked ? selectAll() : clearAll()} />
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider">State</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Requested By</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {(bulkModal?.group?.topups || []).map((t, i) => {
                    const checked = selectedIds.has(t.id)
                    return (
                      <tr key={t.id || i} onClick={() => toggleId(t.id)}
                        className={`cursor-pointer transition-colors ${checked ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
                        <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-300"
                            checked={checked} onChange={() => toggleId(t.id)} />
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-800">{t.stateCode || '—'}</td>
                        <td className="px-3 py-3 text-right font-bold text-slate-800">{formatCurrency(t.topupAmount ?? t.amount)}</td>
                        <td className="px-3 py-3 text-slate-400 hidden sm:table-cell">{t.requestedByName || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>"""
        content = content.replace(old_table, new_table)
        
        with open("BudgetApprovalsPage.jsx", "w") as f:
            f.write(content)
        
        print("Done")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
