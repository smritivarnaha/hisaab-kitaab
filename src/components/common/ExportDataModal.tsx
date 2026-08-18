import React, { useState } from 'react';
import { X, FileSpreadsheet, Download, Calendar, Layers } from 'lucide-react';
import { Transaction } from '../../types/finance';
import { exportToExcel } from '../../utils/excelExport';
import { useFinance } from '../../context/FinanceContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
}

export const ExportDataModal: React.FC<Props> = ({ isOpen, onClose, transactions }) => {
  const { settings, accountMode, currentUser } = useFinance();
  const [exportType, setExportType] = useState<'all' | 'monthly'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${m}`;
  });

  if (!isOpen) return null;

  // Strictly scope transactions to active mode and logged-in user:
  const scopedTransactions = transactions.filter(t => {
    if (t.isPending) return false;
    if (accountMode === 'business') {
      return t.mode === 'business';
    }
    // Personal mode: strictly logged-in user's personal records
    const currentUserName = (currentUser?.name || '').toLowerCase();
    const currentUserId = (currentUser?.id || '').toLowerCase();
    const enteredByName = (t.enteredBy || '').toLowerCase();
    const txUserId = (t.userId || '').toLowerCase();

    return t.mode !== 'business' && (
      txUserId === currentUserId ||
      (currentUserName && enteredByName.includes(currentUserName)) ||
      (!t.enteredBy && !t.userId)
    );
  });

  // Extract available unique months from scoped transactions
  const availableMonthsMap: Record<string, string> = {};
  scopedTransactions.forEach(t => {
    const dStr = t.date || (t.timestamp ? new Date(t.timestamp).toISOString().split('T')[0] : '');
    if (dStr && dStr.length >= 7) {
      const monthKey = dStr.substring(0, 7); // e.g. "2026-08"
      const [y, m] = monthKey.split('-');
      const dObj = new Date(parseInt(y), parseInt(m) - 1, 1);
      const label = dObj.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      availableMonthsMap[monthKey] = label;
    }
  });

  const availableMonths = Object.entries(availableMonthsMap);

  const handleDownload = () => {
    const reportUser = accountMode === 'business' 
      ? 'Business (50-50 Ledger)' 
      : `${currentUser?.name || 'User'} (Personal)`;
    exportToExcel(scopedTransactions, exportType, selectedMonth, reportUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-outfit animate-fadeIn">
      <div className="bg-white text-[#0D2E14] w-full max-w-md rounded-3xl p-5 shadow-2xl border border-[#E2E8E0] space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-[#0D2E14]">
                {accountMode === 'business' ? 'Export Business Excel' : `Export ${currentUser?.name || 'Personal'} Excel`}
              </h3>
              <p className="text-[10px] text-gray-500 font-medium">
                {accountMode === 'business' 
                  ? `50/50 Business Ledger (${scopedTransactions.length} records)` 
                  : `${currentUser?.name || 'Personal'} Account (${scopedTransactions.length} records)`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active Mode Pill */}
        <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700">Export Scope:</span>
          <span className="font-extrabold text-[#0D2E14] flex items-center gap-1 capitalize">
            {accountMode === 'business' ? '🏢 Business Ledger' : `👤 ${currentUser?.name || 'Personal'} Ledger`}
          </span>
        </div>

        {/* Selection Options */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-gray-700 block">Select Export Range</label>
          
          <div className="grid grid-cols-2 gap-2">
            {/* Option 1: Whole Data */}
            <button
              type="button"
              onClick={() => setExportType('all')}
              className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                exportType === 'all'
                  ? 'bg-emerald-50 border-emerald-700 ring-2 ring-emerald-700/20'
                  : 'bg-slate-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <Layers className={`w-4 h-4 ${exportType === 'all' ? 'text-emerald-700' : 'text-gray-500'}`} />
                {exportType === 'all' && <span className="w-2 h-2 rounded-full bg-emerald-600"></span>}
              </div>
              <div>
                <span className="text-xs font-bold text-[#0D2E14] block">Whole Data</span>
                <span className="text-[9px] text-gray-500 font-medium block mt-0.5">All-time ledger records</span>
              </div>
            </button>

            {/* Option 2: Monthly Data */}
            <button
              type="button"
              onClick={() => setExportType('monthly')}
              className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                exportType === 'monthly'
                  ? 'bg-emerald-50 border-emerald-700 ring-2 ring-emerald-700/20'
                  : 'bg-slate-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <Calendar className={`w-4 h-4 ${exportType === 'monthly' ? 'text-emerald-700' : 'text-gray-500'}`} />
                {exportType === 'monthly' && <span className="w-2 h-2 rounded-full bg-emerald-600"></span>}
              </div>
              <div>
                <span className="text-xs font-bold text-[#0D2E14] block">Monthly Data</span>
                <span className="text-[9px] text-gray-500 font-medium block mt-0.5">Select specific month</span>
              </div>
            </button>
          </div>

          {/* Month Selector (shown if monthly selected) */}
          {exportType === 'monthly' && (
            <div className="pt-2 animate-fadeIn">
              <label className="text-[11px] font-bold text-gray-600 block mb-1">Choose Month</label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs font-bold text-[#0D2E14] outline-none focus:border-emerald-700"
              >
                {availableMonths.length > 0 ? (
                  availableMonths.map(([mKey, mLabel]) => (
                    <option key={mKey} value={mKey}>{mLabel}</option>
                  ))
                ) : (
                  <option value={selectedMonth}>Current Month</option>
                )}
              </select>
            </div>
          )}

          {/* Info Card describing Sheets included */}
          <div className="p-3 bg-[#F0F7EE] rounded-2xl border border-[#c4d6c1] text-[10px] text-gray-700 space-y-1">
            <span className="font-bold text-[#0D2E14] block">📊 Excel Workbook Includes 4 Sheets:</span>
            <ul className="list-disc pl-4 space-y-0.5 text-gray-600 font-medium">
              <li><strong>Passbook Ledger:</strong> Complete itemized transactions list</li>
              <li><strong>Monthly Summary:</strong> Income, Spent & Net Balance breakdown</li>
              <li><strong>Category Breakdown:</strong> Spend totals & percentage shares</li>
              <li><strong>Lent & Borrowed:</strong> Party-wise debt & collection ledger</li>
            </ul>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#0D2E14] hover:bg-emerald-900 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download Excel (.xlsx)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
