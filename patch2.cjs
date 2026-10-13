const fs = require('fs');
const file = 'src/pages/budget/BudgetProposalListPage.jsx';
let code = fs.readFileSync(file, 'utf8');

// Replace desktop table rendering
const newDesktopTableRows = `
              {initialBudgets.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500 text-sm">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                        <Icon name="inbox" className="h-6 w-6 text-slate-400" />
                      </div>
                      <p>No proposals found. Create one to get started.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                initialBudgets.map(proposal => {
                  const hasTopUps = topUpsByParent[proposal.id] && topUpsByParent[proposal.id].length > 0;
                  const isExpanded = expandedRows[proposal.id];
                  
                  return (
                    <React.Fragment key={proposal.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 flex items-center gap-2">
                          {hasTopUps && (
                            <button onClick={() => toggleRow(proposal.id)} className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors">
                              <Icon name={isExpanded ? 'chevronDown' : 'chevronRight'} className="h-4 w-4" />
                            </button>
                          )}
                          {!hasTopUps && <span className="w-6"></span>}
                          {proposal.financialYear || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getProposalTypeBadge(proposal.proposalType)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700">
                          <div className="flex flex-col">
                            <span>{formatCurrency(proposal.totalAnnualBudget)}</span>
                            {proposal.totalTopupAmount > 0 && (
                              <span className="text-[10px] font-medium text-emerald-600">+ {formatCurrency(proposal.totalTopupAmount)} (Top-Ups)</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(proposal.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {new Date(proposal.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium opacity-80 group-hover:opacity-100 transition-opacity">
                          <ActionMenu triggerIcon="moreVertical" align="right">
                            <ActionMenuItem label={(!canPropose || proposal.status !== 'DRAFT') ? 'View' : 'Edit'} onClick={() => navigate(\`/budget-planning/wizard/\${proposal.id}/step1\`)} />
                            {canPropose && proposal.status === 'DRAFT' && <ActionMenuItem label="Delete" variant="danger" disabled={processing} onClick={() => handleAction('delete', proposal.id)} />}
                            {canPropose && proposal.status === 'NEEDS_REVISION' && <ActionMenuItem label="Resubmit" variant="warning" onClick={() => navigate(\`/budget-planning/wizard/\${proposal.id}/step1\`)} />}
                            {canPropose && proposal.status === 'APPROVED' && <ActionMenuItem label="Complete Planning" onClick={() => navigate(\`/budget-planning/wizard/\${proposal.id}/step2\`)} />}
                            {proposal.status === 'ACTIVE' && (
                              <>
                                {canEditFutureQuarters && <ActionMenuItem label="Edit Future Quarters" variant="purple" onClick={() => navigate(\`/budget-planning/wizard/\${proposal.id}/step2?editFutureQuarters=true\`)} />}
                                <ActionMenuItem label="Request Top-Up" variant="success" disabled={processing} onClick={() => handleOpenTopup(proposal.id)} />
                              </>
                            )}
                          </ActionMenu>
                        </td>
                      </tr>
                      {/* Top-Up Rows */}
                      {hasTopUps && isExpanded && topUpsByParent[proposal.id].map(topUp => (
                        <tr key={topUp.id} className="bg-slate-50/50 hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 pl-14 border-l-4 border-l-amber-200">
                            {topUp.financialYear || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap border-l border-l-transparent">
                            {getProposalTypeBadge(topUp.proposalType)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-600 border-l border-l-transparent">
                            {formatCurrency(topUp.totalAnnualBudget)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap border-l border-l-transparent">
                            {getStatusBadge(topUp.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 border-l border-l-transparent">
                            {new Date(topUp.updatedAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium opacity-80 group-hover:opacity-100 transition-opacity border-l border-l-transparent">
                            <ActionMenu triggerIcon="moreVertical" align="right">
                              <ActionMenuItem label={(!canPropose || topUp.status !== 'DRAFT') ? 'View' : 'Edit'} onClick={() => navigate(\`/budget-planning/wizard/\${topUp.id}/step1\`)} />
                              {canPropose && topUp.status === 'DRAFT' && <ActionMenuItem label="Delete" variant="danger" disabled={processing} onClick={() => handleAction('delete', topUp.id)} />}
                              {canPropose && topUp.status === 'NEEDS_REVISION' && <ActionMenuItem label="Resubmit" variant="warning" onClick={() => navigate(\`/budget-planning/wizard/\${topUp.id}/step1\`)} />}
                            </ActionMenu>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })
              )}
`;

code = code.replace(
  /\{proposals\.length === 0 \? \([\s\S]*?\}\)\n              \)\}/m,
  newDesktopTableRows
);


// Replace mobile view rendering
const newMobileRows = `
          {initialBudgets.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm flex flex-col items-center justify-center space-y-3 bg-white rounded-xl border border-slate-200">
              <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                <Icon name="inbox" className="h-6 w-6 text-slate-400" />
              </div>
              <p>No proposals found.</p>
            </div>
          ) : (
            initialBudgets.map(proposal => {
              const hasTopUps = topUpsByParent[proposal.id] && topUpsByParent[proposal.id].length > 0;
              const isExpanded = expandedRows[proposal.id];
              return (
                <div key={proposal.id} className="flex flex-col gap-2">
                  <div 
                    onClick={() => navigate(\`/budget-planning/wizard/\${proposal.id}/step1\`)}
                    className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 flex flex-col gap-3 transition-colors hover:border-slate-300 cursor-pointer active:bg-slate-50"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-slate-50 flex items-center justify-center border border-slate-200 shrink-0">
                          <Icon name="calendar" className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                        <span className="text-sm font-bold text-slate-800">{proposal.financialYear || '-'}</span>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        {getStatusBadge(proposal.status)}
                        <Icon name="chevronRight" className="h-4 w-4 text-slate-300" />
                      </div>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Budget</span>
                        <div className="flex flex-col">
                          <span className="text-lg font-extrabold text-rose-600 tracking-tight leading-none block">
                            {formatCurrency(proposal.totalAnnualBudget)}
                          </span>
                          {proposal.totalTopupAmount > 0 && (
                            <span className="text-[10px] font-bold text-emerald-600 mt-1">+ {formatCurrency(proposal.totalTopupAmount)} (Top-Ups)</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getProposalTypeBadge(proposal.proposalType)}
                        <span className="text-[10px] font-medium text-slate-400">
                          Upd: {new Date(proposal.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                    {hasTopUps && (
                      <div className="border-t border-slate-100 pt-2 mt-1 flex justify-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleRow(proposal.id); }}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1 bg-slate-50 px-3 py-1 rounded-full"
                        >
                          {isExpanded ? 'Hide' : 'View'} {topUpsByParent[proposal.id].length} Top-Up{topUpsByParent[proposal.id].length > 1 ? 's' : ''}
                          <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Mobile Top-Up Cards */}
                  {hasTopUps && isExpanded && (
                    <div className="flex flex-col gap-2 pl-4 border-l-2 border-amber-200 ml-2">
                      {topUpsByParent[proposal.id].map(topUp => (
                        <div 
                          key={topUp.id} 
                          onClick={() => navigate(\`/budget-planning/wizard/\${topUp.id}/step1\`)}
                          className="bg-slate-50/80 rounded-xl p-3 shadow-sm border border-amber-100 flex flex-col gap-2 transition-colors hover:border-amber-200 cursor-pointer"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              {getProposalTypeBadge(topUp.proposalType)}
                              <span className="text-xs font-bold text-slate-700">{topUp.financialYear || '-'}</span>
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5">
                              {getStatusBadge(topUp.status)}
                            </div>
                          </div>
                          <div className="flex justify-between items-end">
                            <div>
                              <span className="text-lg font-extrabold text-slate-700 tracking-tight leading-none block">
                                {formatCurrency(topUp.totalAnnualBudget)}
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-slate-400">
                              {new Date(topUp.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
`;

code = code.replace(
  /\{proposals\.length === 0 \? \([\s\S]*?\}\)\n          \)\}/m,
  newMobileRows
);

fs.writeFileSync(file, code);
