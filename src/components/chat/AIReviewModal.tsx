import React, { useState } from 'react';
import { Transaction, Category, CATEGORIES_LIST } from '../../types/finance';
import { useFinance } from '../../context/FinanceContext';
import { Check, Trash2, X, AlertCircle } from 'lucide-react';

interface Props {
  items: Transaction[];
  onClose: () => void;
}

export const AIReviewModal: React.FC<Props> = ({ items, onClose }) => {
  const { confirmPendingItemsBatch } = useFinance();
  const [reviewItems, setReviewItems] = useState<Transaction[]>(items);

  const handleUpdateItem = (id: string, updates: Partial<Transaction>) => {
    setReviewItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          const updated = { ...item, ...updates };
          // If title was "Reason Missing" and category is chosen, update title
          if (updated.title === 'Reason Missing' && updates.category) {
            updated.title = `${updates.category} Expense`;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleDeleteItem = (id: string) => {
    setReviewItems(prev => prev.filter(item => item.id !== id));
  };

  const handleConfirmAll = () => {
    confirmPendingItemsBatch(reviewItems);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 font-outfit">
      <div className="bg-[#F8F9F6] w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-gray-200/80 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-200">
        
        {/* Simple, Breathable Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
          <div>
            <h3 className="font-extrabold text-sm text-[#0D2E14] flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              Reconcile Transactions
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Please add missing reasons or categories</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Breathable Pending Items List */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 no-scrollbar bg-slate-50/50">
          {reviewItems.map((item, index) => {
            const isMissingReason = item.title === 'Reason Missing';

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-sm space-y-3.5"
              >
                {/* Top Row: Title Input, Amount, Delete */}
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#E4ECE2] text-[#0D2E14] text-[9px] font-black flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={item.title === 'Reason Missing' ? '' : item.title}
                      onChange={e => handleUpdateItem(item.id, { title: e.target.value })}
                      placeholder="What was this spent for?"
                      className={`w-full text-xs font-bold text-[#0D2E14] bg-slate-50/50 border ${
                        isMissingReason ? 'border-amber-300 focus:border-amber-500' : 'border-gray-200/85 focus:border-[#0D2E14]'
                      } rounded-lg px-2.5 py-1.5 outline-none transition-all placeholder:text-gray-400 placeholder:font-normal`}
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-black text-rose-600">
                      Rs. {item.amount}
                    </span>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-gray-300 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Remove transaction"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Bottom Row: Minimal, Space-Saving Category Dropdown */}
                <div className="flex items-center justify-between gap-4 pt-1 border-t border-gray-50">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Category</span>
                  <select
                    value={item.category}
                    onChange={e => handleUpdateItem(item.id, { category: e.target.value as Category })}
                    className="text-xs font-bold text-[#0D2E14] bg-slate-50 border border-gray-200 rounded-lg px-2.5 py-1 outline-none focus:border-[#0D2E14]"
                  >
                    {CATEGORIES_LIST.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}

          {reviewItems.length === 0 && (
            <div className="text-center py-10 space-y-2">
              <p className="text-xs text-gray-400 font-bold">All pending items cleared!</p>
            </div>
          )}
        </div>

        {/* Footer actions with clear breathing space */}
        <div className="px-5 py-4 bg-white border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <span className="text-xs font-bold text-[#0D2E14]">
            {reviewItems.length} Pending
          </span>

          <button
            onClick={handleConfirmAll}
            disabled={reviewItems.length === 0}
            className="px-6 py-2.5 rounded-full bg-[#93E044] hover:bg-[#84D137] text-[#0D2E14] font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            Add to Passbook
          </button>
        </div>
      </div>
    </div>
  );
};
