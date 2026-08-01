import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { DebtLentLedger } from './DebtLentLedger';
import { InsightsCard } from './InsightsCard';
import { DailyReconciliationCard } from './DailyReconciliationCard';
import { CategoryIcon } from '../common/CategoryIcon';
import { PaymentMethodIcon } from '../common/PaymentMethodIcon';
import { AnalyticsPanel } from './AnalyticsPanel';
import { 
  Search, 
  ArrowUpRight,
  FileText,
  BarChart3,
  History
} from 'lucide-react';

export const DashboardOverview: React.FC = () => {
  const { transactions, updateTransaction } = useFinance();
  const [searchTerm, setSearchTerm] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'debit' | 'credit'>('all');
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [activeSubTab, setActiveSubTab] = useState<'passbook' | 'analytics'>('passbook');

  // Only show finalized (non-pending) transactions in Passbook History
  const finalizedTransactions = transactions.filter(t => !t.isPending);

  const totalExpense = finalizedTransactions
    .filter(t => t.type === 'expense' || t.type === 'lent')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = finalizedTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const currentBalance = totalIncome - totalExpense;

  const filteredTransactions = finalizedTransactions.filter(t => {
    const isDebit = t.type === 'expense' || t.type === 'lent';
    const isCredit = t.type === 'income';

    if (txTypeFilter === 'debit' && !isDebit) return false;
    if (txTypeFilter === 'credit' && !isCredit) return false;

    const matchesSearch = 
      (t.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.merchant || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.person || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.title || '').toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const toggleNoteExpand = (id: string) => {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSettle = (id: string) => {
    updateTransaction(id, { type: 'income', notes: 'Settled' });
  };

  const formatDateDisplay = (dateStr: string, relText?: string) => {
    if (relText) return relText;
    if (!dateStr) return 'Today';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 pb-28 sm:pb-12 no-scrollbar bg-[#F3F5F1] font-outfit">
      {/* 1. Proportional Top Summary Card with Spreading Bottom-Left Green Gradient & Grid Overlay */}
      <div className="relative overflow-hidden bg-[#0D2E14] text-white p-3.5 sm:p-5 rounded-3xl shadow-md mb-3 sm:mb-4 border border-[#1b4e27] max-w-4xl mx-auto">
        {/* Spreading Bottom-Left Green Gradient Layer */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-[#93E044]/25 via-[#14471f]/50 to-[#0D2E14] pointer-events-none" />

        {/* Faded Green Grid Lines Overlay Blending into Gradient */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(147, 224, 68, 0.25) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(147, 224, 68, 0.25) 1px, transparent 1px)
            `,
            backgroundSize: '24px 24px'
          }}
        />

        {/* Soft Spreading Ambient Glow at Bottom Left Corner */}
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-[#93E044]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#93E044]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Content Container */}
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3 mb-2.5 sm:mb-3">
            <div>
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#93E044] block">
                Financial Summary
              </span>
              <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight font-outfit mt-0.5">
                Net Overview
              </h2>
            </div>
            <div className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-[#93E044] text-[#0D2E14] text-xs sm:text-sm font-bold flex items-center gap-1 flex-shrink-0 shadow-xs">
              <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              +18.4%
            </div>
          </div>

          {/* Refined Numbers Sub-Boxes */}
          <div className="pt-2 sm:pt-3 border-t border-gray-800/80">
            <div className="bg-white text-[#0D2E14] p-2.5 sm:p-3 rounded-2xl border border-[#E2E8E0] shadow-2xs space-y-2 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:divide-x divide-gray-200">
              {/* 1. Income (Credit) Row */}
              <div className="flex items-center justify-between sm:justify-start sm:flex-col sm:items-start text-xs px-1 sm:px-2">
                <span className="text-gray-500 font-bold text-[11px] sm:text-xs">Income (Credit)</span>
                <span className="font-bold text-green-700 text-xs sm:text-sm sm:mt-1">+₹{totalIncome.toLocaleString('en-IN')}</span>
              </div>

              {/* 2. Spent (Debit) Row */}
              <div className="flex items-center justify-between sm:justify-start sm:flex-col sm:items-start text-xs pt-1.5 sm:pt-0 border-t sm:border-t-0 border-gray-100 px-1 sm:px-2">
                <span className="text-gray-500 font-bold text-[11px] sm:text-xs">Spent (Debit)</span>
                <span className="font-bold text-[#D93025] text-xs sm:text-sm sm:mt-1">-₹{totalExpense.toLocaleString('en-IN')}</span>
              </div>

              {/* 3. Current Balance Row */}
              <div className="flex items-center justify-between sm:justify-start sm:flex-col sm:items-start text-xs pt-1.5 sm:pt-0 border-t sm:border-t-0 border-gray-100 px-1 sm:px-2">
                <span className="text-gray-500 font-bold text-[11px] sm:text-xs">Current Balance</span>
                <span className="font-bold text-[#0D2E14] text-xs sm:text-sm sm:mt-1">₹{currentBalance.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Same-Day AI Audit Banner */}
      <div className="max-w-4xl mx-auto mb-3 sm:mb-4">
        <DailyReconciliationCard transactions={transactions} />
      </div>

      {/* 3. Financial Mobile App Passbook Feed */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Left 2-Column: Passbook & Analytics Toggle */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {/* Subtab Navigation Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-white border border-[#E2E8E0] rounded-2xl max-w-xs shadow-2xs">
            <button
              onClick={() => setActiveSubTab('passbook')}
              className={`flex-1 py-1.5 px-3.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                activeSubTab === 'passbook'
                  ? 'bg-[#0D2E14] text-white shadow-sm'
                  : 'text-gray-500 hover:text-[#0D2E14]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Passbook
            </button>
            <button
              onClick={() => setActiveSubTab('analytics')}
              className={`flex-1 py-1.5 px-3.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                activeSubTab === 'analytics'
                  ? 'bg-[#0D2E14] text-white shadow-sm'
                  : 'text-gray-500 hover:text-[#0D2E14]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Analytics & Stats
            </button>
          </div>

          {activeSubTab === 'passbook' ? (
            <div className="bg-white rounded-3xl p-3.5 sm:p-4 border border-[#E2E8E0] shadow-2xs">
              {/* Header: Title + Filter Pills */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-bold text-[#0D2E14] text-sm sm:text-base font-outfit whitespace-nowrap">
                  Passbook History
                </h3>

                {/* Filter Pills */}
                <div className="flex items-center gap-0.5 p-0.5 bg-[#F3F5F1] rounded-full border border-[#E2E8E0] text-[10px] font-bold">
                  <button
                    onClick={() => setTxTypeFilter('all')}
                    className={`px-2.5 py-0.5 rounded-full transition-all ${
                      txTypeFilter === 'all' ? 'bg-[#0D2E14] text-white shadow-xs' : 'text-gray-600'
                    }`}
                  >
                    All ({finalizedTransactions.length})
                  </button>
                  <button
                    onClick={() => setTxTypeFilter('debit')}
                    className={`px-2 py-0.5 rounded-full transition-all ${
                      txTypeFilter === 'debit' ? 'bg-[#D93025] text-white shadow-xs' : 'text-red-600'
                    }`}
                  >
                    Debit
                  </button>
                  <button
                    onClick={() => setTxTypeFilter('credit')}
                    className={`px-2 py-0.5 rounded-full transition-all ${
                      txTypeFilter === 'credit' ? 'bg-green-700 text-white shadow-xs' : 'text-green-700'
                    }`}
                  >
                    Credit
                  </button>
                </div>
              </div>

              {/* Compact Search Bar */}
              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search transactions..."
                  className="w-full bg-[#F3F5F1] border border-[#E2E8E0] rounded-full py-1.5 pl-8 pr-3 text-xs font-semibold text-[#0D2E14] placeholder-gray-400 outline-none focus:border-[#0D2E14] font-outfit"
                />
              </div>

              {/* Passbook Item Rows */}
              <div className="space-y-2">
                {filteredTransactions.map(tx => {
                  const isCredit = tx.type === 'income';
                  const hasSpecialNotes = !!tx.notes && tx.notes !== tx.title;
                  const isExpanded = !!expandedNotes[tx.id];
                  const displayDate = formatDateDisplay(tx.date, tx.relativeDateText);

                  return (
                    <div 
                      key={tx.id} 
                      className="p-2.5 sm:p-3 rounded-2xl border border-[#E2E8E0] bg-[#FAFCF9] hover:bg-white transition-all shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* Left: Category Icon + Title + Plain Text Date & Method */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <CategoryIcon category={tx.category} size="sm" />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <h4 className="text-xs font-bold text-[#0D2E14] font-outfit leading-tight truncate">
                                {tx.title || tx.category} {tx.person ? `(${tx.person})` : ''}
                              </h4>
                              {hasSpecialNotes && (
                                <button
                                  onClick={() => toggleNoteExpand(tx.id)}
                                  className="text-blue-600 hover:text-blue-800 p-0.5"
                                  title={isExpanded ? "Hide note" : "View note"}
                                >
                                  <FileText className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-500 font-medium truncate">
                              <span className="font-bold text-gray-700">{tx.category}</span>
                              <span>•</span>
                              <span>{tx.paymentMethod}</span>
                              <span>•</span>
                              <span className="font-medium text-gray-600">{displayDate}</span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Amount */}
                        <div className="text-right flex-shrink-0">
                          <span
                            className={`text-xs sm:text-sm font-bold font-outfit block ${
                              isCredit ? 'text-green-700' : 'text-[#D93025]'
                            }`}
                          >
                            {isCredit ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {/* Special Note Drawer */}
                      {hasSpecialNotes && isExpanded && (
                        <div className="mt-2 p-2 bg-blue-50/90 border border-blue-200 rounded-xl text-[10px] text-gray-800 italic">
                          <span className="font-bold text-blue-700 not-italic block mb-0.5">Special Note:</span>
                          {tx.notes}
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredTransactions.length === 0 && (
                  <div className="p-6 text-center text-xs text-gray-500 font-semibold">
                    No transactions match your search filter.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <AnalyticsPanel transactions={transactions} />
          )}
        </div>

        {/* Right 1-Column */}
        <div className="space-y-3 sm:space-y-4">
          <InsightsCard transactions={transactions} />
          <DebtLentLedger transactions={transactions} onSettle={handleSettle} />
        </div>
      </div>
    </div>
  );
};
