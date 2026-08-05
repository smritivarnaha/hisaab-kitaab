import React, { useState } from 'react';
import { Transaction } from '../../types/finance';
import { useFinance } from '../../context/FinanceContext';
import { DebtLentLedger } from './DebtLentLedger';
import { InsightsCard } from './InsightsCard';
import { DailyReconciliationCard } from './DailyReconciliationCard';
import { BusinessPartnerSummaryCard } from './BusinessPartnerSummaryCard';
import { CategoryIcon } from '../common/CategoryIcon';
import { PaymentMethodIcon } from '../common/PaymentMethodIcon';
import { AnalyticsPanel } from './AnalyticsPanel';
import { TransactionEditModal } from '../common/TransactionEditModal';
import { formatGlobalDate, sortTransactionsLatestFirst } from '../../utils/dateUtils';
import { 
  Search, 
  ArrowUpRight,
  FileText,
  BarChart3,
  History,
  User,
  ChevronRight,
  Loader2
} from 'lucide-react';

export const DashboardOverview: React.FC = () => {
  const { transactions, updateTransaction, currentUser, dbStatus, accountMode } = useFinance();
  const [searchTerm, setSearchTerm] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'debit' | 'credit'>('all');
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [activeSubTab, setActiveSubTab] = useState<'passbook' | 'analytics'>('passbook');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Compute period range e.g. "01 Aug 26 - 03 Aug 26"
  const getCurrentPeriodRange = () => {
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[now.getMonth()] || 'Aug';
    const day = String(now.getDate()).padStart(2, '0');
    return `01 ${month} ${year} - ${day} ${month} ${year}`;
  };

  const periodRange = getCurrentPeriodRange();

  // Mode Filter: Personal vs Business
  const modeFiltered = transactions.filter(t => !t.isPending && (accountMode === 'business' ? t.mode === 'business' : t.mode !== 'business'));
  const finalizedTransactions = sortTransactionsLatestFirst(modeFiltered);

  const totalExpense = finalizedTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const totalIncome = finalizedTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const totalLent = finalizedTransactions
    .filter(t => t.type === 'lent')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const currentBalance = totalIncome - totalExpense - totalLent;

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
    <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 pb-28 sm:pb-12 no-scrollbar bg-[#F3F5F1] font-outfit space-y-3 sm:space-y-4 max-w-4xl mx-auto">
      {/* Shared Business Partner 50-50 Settlement Overview */}
      {accountMode === 'business' && <BusinessPartnerSummaryCard />}

      {/* 1. Proportional Top Summary Card with Spreading Bottom-Left Green Gradient & Grid Overlay */}
      <div className="relative overflow-hidden bg-[#0D2E14] text-white p-3.5 sm:p-5 rounded-3xl shadow-md border border-[#1b4e27] max-w-4xl mx-auto">
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
              <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight font-outfit">
                Net Overview
              </h2>
              <span className="text-[10px] sm:text-xs font-semibold text-emerald-300 block mt-0.5">
                Period: {periodRange}
              </span>
            </div>
            {/* Active Username Pill with WHITE text (replaces +18.4% growth pill) */}
            <div className="px-3 py-1 rounded-full bg-[#14471f] border border-[#93E044]/50 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 flex-shrink-0 shadow-xs">
              <User className="w-3.5 h-3.5 text-white" />
              <span className="text-white font-bold capitalize">{currentUser?.name || 'Nandini'}</span>
            </div>
          </div>

          {/* Single White Card Container: 4 Horizontal Rows with Vertical Divider Line & Bold Numbers */}
          <div className="pt-2 sm:pt-3 border-t border-gray-800/80">
            <div className="bg-white text-[#0D2E14] p-3.5 sm:p-4 rounded-2xl border border-[#E2E8E0] shadow-2xs divide-y divide-gray-100">
              {/* 1. Income Row */}
              <div className="grid grid-cols-2 divide-x divide-gray-200 py-2 first:pt-0">
                <div className="pr-3 flex items-center justify-start text-left">
                  <span className="text-gray-500 font-bold text-xs sm:text-sm">Income</span>
                </div>
                <div className="pl-3.5 flex items-center justify-start text-left">
                  {dbStatus === 'loading' ? (
                    <span className="inline-block w-16 h-5 bg-gray-200 animate-pulse rounded-md"></span>
                  ) : (
                    <span className="font-bold text-green-700 text-sm sm:text-base tracking-tight">₹{totalIncome.toLocaleString('en-IN')}</span>
                  )}
                </div>
              </div>

              {/* 2. Spent Row */}
              <div className="grid grid-cols-2 divide-x divide-gray-200 py-2">
                <div className="pr-3 flex items-center justify-start text-left">
                  <span className="text-gray-500 font-bold text-xs sm:text-sm">Spent</span>
                </div>
                <div className="pl-3.5 flex items-center justify-start text-left">
                  {dbStatus === 'loading' ? (
                    <span className="inline-block w-16 h-5 bg-gray-200 animate-pulse rounded-md"></span>
                  ) : (
                    <span className="font-bold text-[#D93025] text-sm sm:text-base tracking-tight">₹{totalExpense.toLocaleString('en-IN')}</span>
                  )}
                </div>
              </div>

              {/* 3. Lent Out Row */}
              <div className="grid grid-cols-2 divide-x divide-gray-200 py-2">
                <div className="pr-3 flex items-center justify-start text-left">
                  <span className="text-gray-500 font-bold text-xs sm:text-sm">Lent Out</span>
                </div>
                <div className="pl-3.5 flex items-center justify-start text-left">
                  {dbStatus === 'loading' ? (
                    <span className="inline-block w-16 h-5 bg-gray-200 animate-pulse rounded-md"></span>
                  ) : (
                    <span className="font-bold text-amber-700 text-sm sm:text-base tracking-tight">₹{totalLent.toLocaleString('en-IN')}</span>
                  )}
                </div>
              </div>

              {/* 4. Current Row */}
              <div className="grid grid-cols-2 divide-x divide-gray-200 py-2 last:pb-0">
                <div className="pr-3 flex items-center justify-start text-left">
                  <span className="text-gray-500 font-bold text-xs sm:text-sm">Current</span>
                </div>
                <div className="pl-3.5 flex items-center justify-start text-left">
                  {dbStatus === 'loading' ? (
                    <span className="inline-block w-16 h-5 bg-gray-200 animate-pulse rounded-md"></span>
                  ) : (
                    <span className="font-bold text-[#0D2E14] text-sm sm:text-base tracking-tight">
                      {currentBalance >= 0 ? '+ ' : '- '}₹{Math.abs(currentBalance).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Same-Day AI Audit Banner */}
      <div className="max-w-4xl mx-auto mb-3 sm:mb-4">
        <DailyReconciliationCard transactions={finalizedTransactions} />
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
                      onClick={() => setEditingTx(tx)}
                      className="p-2.5 sm:p-3 rounded-2xl border border-[#E2E8E0] bg-[#FAFCF9] hover:bg-white hover:border-[#0D2E14] transition-all shadow-2xs cursor-pointer group relative"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* Left: Category Icon + Title + Plain Text Date & Method */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <CategoryIcon category={tx.category} size="sm" />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs font-bold text-[#0D2E14] font-outfit leading-tight truncate group-hover:text-emerald-900">
                                {tx.title || tx.category} {tx.person ? `(${tx.person})` : ''}
                              </h4>
                              {accountMode === 'business' && (
                                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full border ${
                                  (tx.enteredBy || '').toLowerCase().includes('sarthak')
                                    ? 'bg-indigo-100 text-indigo-900 border-indigo-200'
                                    : 'bg-emerald-100 text-emerald-900 border-emerald-200'
                                }`}>
                                  👤 {tx.enteredBy || 'Praveen'}
                                </span>
                              )}
                              {hasSpecialNotes && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleNoteExpand(tx.id);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 p-0.5"
                                  title={isExpanded ? "Hide note" : "View note"}
                                >
                                  <FileText className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-500 font-medium truncate">
                              <span className="font-semibold text-gray-600">{formatGlobalDate(tx.date || tx.timestamp)}</span>
                              <span>•</span>
                              <span className="text-gray-400">{tx.paymentMethod}</span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Amount + Faded PhonePe-style Chevron Arrow */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <span
                              className={`text-xs sm:text-sm font-bold font-outfit block ${
                                isCredit ? 'text-green-700' : 'text-[#D93025]'
                              }`}
                            >
                              ₹{Number(tx.amount || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#0D2E14] transition-colors flex-shrink-0" />
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
                  <div className="p-6 text-center text-xs text-gray-500 font-semibold flex items-center justify-center gap-2">
                    {dbStatus === 'loading' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#0D2E14]" />
                        <span>Syncing passbook from cloud...</span>
                      </>
                    ) : (
                      <span>No transactions match your search filter.</span>
                    )}
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
          <DebtLentLedger transactions={transactions} onSettle={handleSettle} />
        </div>
      </div>

      {/* Transaction Edit Modal */}
      {editingTx && (
        <TransactionEditModal
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
        />
      )}
    </div>
  );
};
