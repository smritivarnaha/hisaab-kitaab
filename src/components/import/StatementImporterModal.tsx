import React, { useState } from 'react';
import { parseCSVStatement, ImportSummary } from '../../services/import/csvParser';
import { useFinance } from '../../context/FinanceContext';
import { FileText, Upload, Check, X, CheckCircle2 } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const StatementImporterModal: React.FC<Props> = ({ onClose }) => {
  const { addTransactionsBatch } = useFinance();
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const parsed = parseCSVStatement(text);
      setSummary(parsed);
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (summary && summary.transactions.length > 0) {
      addTransactionsBatch(summary.transactions);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn font-poppins">
      <div className="w-full max-w-md bg-white border border-[#dadce0] rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#f1f3f4] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-google-blueLight text-google-blue flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-[#202124] text-sm">Statement Importer</h3>
              <p className="text-[11px] text-[#5f6368]">Import CSV, Bank Statements & UPI Exports</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#5f6368] hover:text-[#202124] rounded-full hover:bg-[#f1f3f4]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 no-scrollbar bg-[#f8f9fa]">
          {!summary ? (
            <label className="border-2 border-dashed border-[#dadce0] hover:border-google-blue bg-white rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center group">
              <Upload className="w-10 h-10 text-[#5f6368] group-hover:text-google-blue mb-3 transition-colors" />
              <span className="text-sm font-semibold text-[#202124] mb-1">Select Bank CSV or Statement</span>
              <span className="text-xs text-[#5f6368]">Supports standard HDFC, ICICI, SBI, Paytm & UPI CSV files</span>
              <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
            </label>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-google-blueLight border border-blue-200 rounded-2xl">
                <div className="flex items-center gap-2 text-google-blue font-semibold text-sm mb-1">
                  <CheckCircle2 className="w-4 h-4 text-google-blue" />
                  Successfully Parsed {summary.totalParsed} Transactions
                </div>
                <p className="text-xs text-[#3c4043]">Total Value: ₹{summary.totalAmount.toLocaleString('en-IN')}</p>
              </div>

              {/* Transactions Preview */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-[#5f6368] uppercase tracking-wider">Transaction Preview</p>
                {summary.transactions.slice(0, 5).map((tx, idx) => (
                  <div key={idx} className="p-3 bg-white border border-[#dadce0] rounded-xl flex justify-between items-center text-xs shadow-2xs">
                    <div>
                      <p className="font-semibold text-[#202124]">{tx.category}</p>
                      <p className="text-[10px] text-[#5f6368] truncate max-w-[200px]">{tx.notes}</p>
                    </div>
                    <span className="font-bold text-google-green">₹{tx.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {summary && (
          <div className="p-4 bg-white border-t border-[#dadce0] flex gap-3">
            <button
              onClick={() => setSummary(null)}
              className="flex-1 py-3 rounded-full border border-[#dadce0] text-[#3c4043] text-xs font-semibold hover:bg-[#f1f3f4]"
            >
              Choose Different File
            </button>
            <button
              onClick={handleConfirmImport}
              className="flex-1 py-3 rounded-full bg-google-blue hover:bg-google-blueHover text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Check className="w-4 h-4" />
              Import All ({summary.totalParsed})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
