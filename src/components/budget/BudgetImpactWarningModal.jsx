import React from 'react';
import { formatCurrency } from '../../utils/formatters';

const BudgetImpactWarningModal = ({ isOpen, onClose, onProceed, overrunStates = [] }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
                <div className="bg-amber-50 p-6 border-b border-amber-100 flex items-start space-x-4">
                    <div className="flex-shrink-0">
                        <svg className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-amber-900">Budget Impact Warning</h3>
                        <p className="mt-2 text-sm text-amber-800">
                            Warning: Approving/Submitting this task will exceed the remaining budget for the following state(s). 
                            If you proceed, this task will be routed to the <strong>Budget Overrun queue</strong> for additional approval from the Marketing Head.
                        </p>
                    </div>
                </div>
                
                <div className="p-6 overflow-y-auto max-h-96">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">State</th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Current Balance</th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Task Expense</th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Projected Overrun</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {overrunStates.map((state, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {state.stateCode}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                                        {formatCurrency(state.availableBefore)}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                        {formatCurrency(state.thisPosAmount)}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-medium text-red-600">
                                        {formatCurrency(Math.abs(state.availableAfter))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onProceed}
                        className="px-4 py-2 text-sm font-medium text-amber-900 bg-amber-200 border border-transparent rounded-lg hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors"
                    >
                        Proceed Anyway
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BudgetImpactWarningModal;
