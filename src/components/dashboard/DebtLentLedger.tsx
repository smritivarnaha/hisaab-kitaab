import React from 'react';
import { Transaction } from '../../types/finance';
import { UserCheck, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { formatGlobalDate } from '../../utils/dateUtils';

interface Props {
  transactions: Transaction[];
  onSettle?: (id: string) => void;
}

export const DebtLentLedger: React.FC<Props> = ({ transactions, onSettle }) => {
  // Strictly filter out business mode transactions so business expenses/transfers never leak into personal ledger
  const personalTx = transactions.filter(t => !t.isPending && t.mode !== 'business');
  const lentItems = personalTx.filter(t => t.type === 'lent' || (t.type === 'expense' && t.person));
  const borrowedItems = personalTx.filter(t => t.type === 'borrowed');

  const totalLent = lentItems.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalBorrowed = borrowedItems.reduce((sum, t) => sum + Number(t.amount || 0), 0);

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#E2E8E0] space-y-3.5 font-outfit shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#F3F5F1] text-[#0D2E14] flex items-center justify-center font-bold text-xs border border-[#E2E8E0]">
            <UserCheck className="w-3.5 h-3.5 text-[#0D2E14]" />
          </div>
          <div>
            <h3 className="font-bold text-[#0D2E14] text-sm">Friends & Loans Ledger</h3>
            <span className="text-[10px] text-gray-500 font-medium">Who owes you & what you owe</span>
          </div>
        </div>
      </div>

      {/* Clean Unified Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-2xl bg-[#FAFCF9] border border-[#E2E8E0]">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">You Lent Out</span>
          <span className="text-sm sm:text-base font-bold text-green-700 block mt-0.5">₹{Number(totalLent || 0).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-gray-500 font-medium">Pending collection</span>
        </div>

        <div className="p-3 rounded-2xl bg-[#FAFCF9] border border-[#E2E8E0]">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">You Borrowed</span>
          <span className="text-sm sm:text-base font-bold text-[#0D2E14] block mt-0.5">₹{Number(totalBorrowed || 0).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-gray-500 font-medium">To be paid back</span>
        </div>
      </div>

      {/* Item List */}
      <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
        {lentItems.map(item => (
          <div key={item.id} className="p-2.5 rounded-2xl bg-[#FAFCF9] border border-[#E2E8E0] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-3.5 h-3.5 text-green-700 flex-shrink-0" />
              <div>
                <span className="font-bold text-[#0D2E14] block text-xs">{item.person || 'Friend'} owes you</span>
                <span className="text-[10px] text-gray-500 font-semibold">{formatGlobalDate(item.date || item.timestamp)}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-green-700 block text-xs">₹{Number(item.amount || 0).toLocaleString('en-IN')}</span>
              {onSettle && (
                <button
                  onClick={() => onSettle(item.id)}
                  className="text-[10px] font-bold text-blue-600 hover:underline mt-0.5 block"
                >
                  Mark Settled
                </button>
              )}
            </div>
          </div>
        ))}

        {borrowedItems.map(item => (
          <div key={item.id} className="p-2.5 rounded-2xl bg-[#FAFCF9] border border-[#E2E8E0] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <ArrowDownLeft className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
              <div>
                <span className="font-bold text-[#0D2E14] block text-xs">You owe {item.person || 'Friend'}</span>
                <span className="text-[10px] text-gray-500 font-semibold">{formatGlobalDate(item.date || item.timestamp)}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-[#0D2E14] block text-xs">₹{Number(item.amount || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        ))}

        {lentItems.length === 0 && borrowedItems.length === 0 && (
          <p className="text-xs text-gray-500 italic text-center py-2 font-medium">No pending loan or debt records.</p>
        )}
      </div>
    </div>
  );
};
