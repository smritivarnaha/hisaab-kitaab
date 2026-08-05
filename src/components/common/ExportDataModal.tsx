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
  const { settings } = useFinance();
  const [exportType, setExportType] = useState<'all' | 'monthly'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${m}`;
  });

  if (!isOpen) return null;

  // Extract available unique months from transactions
  const availableMonthsMap: Record<string, string> = {};
  transactions.forEach(t => {
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
    exportToExcel(transactions, exportType, selectedMonth, (settings as any).userName || 'User');
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
              <h3 className="font-bold text-sm sm:text-base text-[#0D2E14]">Export Data to Excel</h3>
              <p className="text-[10px] text-gray-500 font-medium">Download multi-sheet organized spreadsheet</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
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
