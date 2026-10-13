import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import Icon from '../Icon';

const BudgetImpactWarningModal = ({ isOpen, onClose, onProceed, overrunStates = [] }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl overflow-y-auto max-h-[92vh] flex flex-col">
                <div className="p-6 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-slate-900">Budget Impact Warning</h3>
                        <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 transition">
                            <Icon name="x" className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Warning banner */}
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                        <Icon name="alert-triangle" className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800">
                            Approving this task will exceed the remaining budget for the state(s) below.
                            Budget will be reconciled at the final approval level via a top-up request.
                        </p>
                    </div>

                    {/* Overrun details */}
                    <div className="space-y-2">
                        {overrunStates.map((s, i) => {
                            const overrun = Math.abs(s.availableAfter || 0);
                            return (
                                <div key={i} className="flex justify-between items-center bg-slate-50 rounded-lg border border-slate-200 px-3 py-2.5 text-xs">
                                    <span className="font-semibold text-slate-700">{s.stateCode}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-slate-500">
                                            Available: <span className="font-bold text-slate-700">{formatCurrency(s.availableBefore)}</span>
                                        </span>
                                        <span className="text-slate-500">
                                            Expense: <span className="font-bold">{formatCurrency(s.thisPosAmount)}</span>
                                        </span>
                                        <span className="text-slate-500">
                                            After: <span className="font-bold text-red-600">{formatCurrency(s.availableAfter)}</span>
                                        </span>
                                        <span className="font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                                            OVERRUN {formatCurrency(overrun)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-1">
                        <button
                            onClick={onClose}
                            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onProceed}
                            className="rounded-lg bg-amber-600 hover:bg-amber-700 px-5 py-2 text-sm font-semibold text-white transition"
                        >
                            Proceed Anyway
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BudgetImpactWarningModal;
