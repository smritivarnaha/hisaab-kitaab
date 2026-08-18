import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Transaction } from '../../types/finance';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  ChevronDown, 
  ChevronUp, 
  Users, 
  ArrowRight,
  CheckCircle2,
  Calendar
} from 'lucide-react';

export const BusinessPartnerSummaryCard: React.FC = () => {
  const { transactions, currentUser, addTransaction, dbStatus } = useFinance();
  const [isIncomeOpen, setIsIncomeOpen] = useState(true);
  const [isExpenseOpen, setIsExpenseOpen] = useState(true);
  const [isDirectOpen, setIsDirectOpen] = useState(true);
  const [settled, setSettled] = useState(false);

  const [selectedPeriod, setSelectedPeriod] = useState<'this_month' | 'today' | 'last_month' | 'this_year' | 'all'>('this_month');
  const [isCalendarMenuOpen, setIsCalendarMenuOpen] = useState(false);

  const renderAmount = (amount: number, colorClass: string, prefix = '₹', skeletonWidth = 'w-16') => {
    if (dbStatus === 'loading') {
      return <span className={`inline-block ${skeletonWidth} h-4 sm:h-5 bg-gray-200 animate-pulse rounded-md align-middle my-0.5`} />;
    }
    return <span className={colorClass}>{prefix}{amount.toLocaleString('en-IN')}</span>;
  };

  // Filter business transactions by selected period
  const periodFilteredTransactions = React.useMemo(() => {
    const bTxList = transactions.filter(t => t.mode === 'business' && !t.isPending);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const todayStr = now.toISOString().split('T')[0];

    return bTxList.filter(t => {
      if (selectedPeriod === 'all') return true;

      let tDate: Date;
      if (t.date) {
        const parts = t.date.split('T')[0].split('-');
        if (parts.length === 3) {
          tDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
          tDate = new Date(t.timestamp || t.date);
        }
      } else if (t.timestamp) {
        tDate = new Date(t.timestamp);
      } else {
        return true;
      }

      if (selectedPeriod === 'today') {
        const tDateStr = t.date ? t.date.split('T')[0] : tDate.toISOString().split('T')[0];
        return tDateStr === todayStr;
      }
      if (selectedPeriod === 'this_month') {
        return tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth;
      }
      if (selectedPeriod === 'last_month') {
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const lastMonthIndex = currentMonth === 0 ? 11 : currentMonth - 1;
        return tDate.getFullYear() === lastMonthYear && tDate.getMonth() === lastMonthIndex;
      }
      if (selectedPeriod === 'this_year') {
        return tDate.getFullYear() === currentYear;
      }
      return true;
    });
  }, [transactions, selectedPeriod]);

  // Compute 50/50 Settlement for the selected period
  const {
    totalIncome,
    totalExpense,
    praveenIncome,
    praveenExpense,
    praveenDirectGiven,
    sarthakIncome,
    sarthakExpense,
    sarthakDirectGiven,
    praveenOperatingDue,
    sarthakOperatingDue,
    praveenOwesSarthak,
    sarthakOwesPraveen
  } = React.useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let praveenIncome = 0;
    let praveenExpense = 0;
    let sarthakIncome = 0;
    let sarthakExpense = 0;
    let praveenDirectGiven = 0;
    let sarthakDirectGiven = 0;

    periodFilteredTransactions.filter(t => !t.title?.startsWith('Settlement:')).forEach(t => {
      const amt = Number(t.amount || 0);
      const isPraveen = (t.enteredBy || '').toLowerCase().includes('praveen') || (!t.enteredBy && currentUser?.name?.toLowerCase().includes('praveen'));
      
      if (t.type === 'income') {
        totalIncome += amt;
        if (isPraveen) praveenIncome += amt;
        else sarthakIncome += amt;
      } else if (t.type === 'expense') {
        totalExpense += amt;
        if (isPraveen) praveenExpense += amt;
        else sarthakExpense += amt;
      } else if (t.type === 'lent') {
        if (isPraveen) praveenDirectGiven += amt;
        else sarthakDirectGiven += amt;
      } else if (t.type === 'borrowed') {
        if (isPraveen) sarthakDirectGiven += amt;
        else praveenDirectGiven += amt;
      }
    });

    // ── BUCKET A: PRAVEEN ➔ SARTHAK (Expense Equalization) ────────────────────
    const praveenBase = (praveenIncome - totalExpense) / 2;
    const praveenFairExpense = totalExpense / 2;
    const praveenExpenseSurplus = Math.max(0, praveenExpense - praveenFairExpense);
    const praveenOperatingSettlement = praveenBase - praveenExpenseSurplus;
    const praveenOwesSarthak = Math.max(0, Math.round(praveenOperatingSettlement - praveenDirectGiven));

    // ── BUCKET B: SARTHAK ➔ PRAVEEN (50% Income - Sarthak Direct Transfers) ───
    const sarthakBase = sarthakIncome / 2;
    const sarthakOwesPraveen = Math.max(0, Math.round(sarthakBase - sarthakDirectGiven));

    const praveenOperatingDue = Math.round(praveenOperatingSettlement);
    const sarthakOperatingDue = Math.round(sarthakBase);

    return {
      totalIncome,
      totalExpense,
      praveenIncome,
      praveenExpense,
      praveenDirectGiven,
      sarthakIncome,
      sarthakExpense,
      sarthakDirectGiven,
      praveenOperatingDue,
      sarthakOperatingDue,
      praveenOwesSarthak,
      sarthakOwesPraveen
    };
  }, [periodFilteredTransactions, currentUser]);

  const getPeriodLabel = () => {
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (selectedPeriod === 'today') {
      const day = String(now.getDate()).padStart(2, '0');
      const month = monthNames[now.getMonth()];
      return `Today (${day} ${month})`;
    }
    if (selectedPeriod === 'this_month') {
      const month = monthNames[now.getMonth()];
      const year = String(now.getFullYear()).slice(-2);
      return `01 ${month} ${year} - 31 ${month} ${year}`;
    }
    if (selectedPeriod === 'last_month') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const month = monthNames[lm.getMonth()];
      const year = String(lm.getFullYear()).slice(-2);
      return `01 ${month} ${year} - 31 ${month} ${year}`;
    }
    if (selectedPeriod === 'this_year') {
      return `Year ${now.getFullYear()}`;
    }
    return 'All Time';
  };

  const handleSettlePraveenToSarthak = () => {
    if (praveenOwesSarthak <= 0) return;
    const newTx: Transaction = {
      id: `tx_settle_${Date.now()}`,
      amount: praveenOwesSarthak,
      currency: '₹',
      type: 'income',
      category: 'Others',
      title: `Settlement: Praveen paid Sarthak`,
      date: new Date().toISOString().split('T')[0],
      relativeDateText: 'Today',
      timestamp: Date.now(),
      confidenceScore: 100,
      paymentMethod: 'UPI',
      notes: `Settled Praveen ➔ Sarthak business obligation`,
      isPending: false,
      mode: 'business',
      enteredBy: 'Praveen'
    };
    addTransaction(newTx);
    setSettled(true);
    setTimeout(() => setSettled(false), 4000);
  };

  const handleSettleSarthakToPraveen = () => {
    if (sarthakOwesPraveen <= 0) return;
    const newTx: Transaction = {
      id: `tx_settle_${Date.now()}`,
      amount: sarthakOwesPraveen,
      currency: '₹',
      type: 'income',
      category: 'Others',
      title: `Settlement: Sarthak paid Praveen`,
      date: new Date().toISOString().split('T')[0],
      relativeDateText: 'Today',
      timestamp: Date.now(),
      confidenceScore: 100,
      paymentMethod: 'UPI',
      notes: `Settled Sarthak ➔ Praveen business obligation`,
      isPending: false,
      mode: 'business',
      enteredBy: 'Sarthak'
    };
    addTransaction(newTx);
    setSettled(true);
    setTimeout(() => setSettled(false), 4000);
  };

  return (
    <div className="space-y-2.5 sm:space-y-4 font-outfit w-full mx-auto animate-fadeIn">
      {/* 1. Top Green Business Overview Card */}
      <div className="relative overflow-hidden bg-[#0D2E14] text-white p-3 sm:p-5 rounded-3xl shadow-md border border-[#1b4e27] space-y-2.5 sm:space-y-4 w-full z-20">
        {/* Spreading Bottom-Left Green Gradient Layer */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-[#93E044]/25 via-[#14471f]/50 to-[#0D2E14] pointer-events-none rounded-3xl overflow-hidden" />

        {/* Faded Green Grid Lines Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20 rounded-3xl overflow-hidden"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(147, 224, 68, 0.25) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(147, 224, 68, 0.25) 1px, transparent 1px)
            `,
            backgroundSize: '24px 24px'
          }}
        />

        {/* Soft Spreading Ambient Glow */}
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-[#93E044]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#93E044]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header Row */}
        <div className="relative z-30 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-2xl font-extrabold tracking-tight text-white">
              Business Overview
            </h2>
            <span className="text-[10px] sm:text-xs font-semibold text-emerald-300 block mt-0.5">
              Period: {getPeriodLabel()}
            </span>
          </div>

          <div className="relative z-50">
            <button 
              onClick={() => setIsCalendarMenuOpen(prev => !prev)}
              className="px-3 py-1.5 rounded-full bg-[#FAFCF9] hover:bg-white border border-gray-200 text-gray-800 text-xs font-bold flex items-center gap-1.5 flex-shrink-0 shadow-2xs cursor-pointer active:scale-95 transition-all"
            >
              <Calendar className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-gray-800 font-bold">{selectedPeriod === 'this_month' ? 'This Month' : selectedPeriod === 'today' ? 'Today' : selectedPeriod === 'last_month' ? 'Last Month' : selectedPeriod === 'this_year' ? 'This Year' : 'All Time'}</span>
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </button>

            {isCalendarMenuOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white text-gray-800 rounded-2xl shadow-2xl border border-gray-200 z-[100] py-1.5 animate-fadeIn">
                <div className="px-3 py-1 text-[10px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-1">
                  Select Period
                </div>
                <button
                  onClick={() => { setSelectedPeriod('this_month'); setIsCalendarMenuOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs font-bold flex items-center justify-between hover:bg-emerald-50 ${selectedPeriod === 'this_month' ? 'text-emerald-800 bg-emerald-50/80 font-black' : 'text-gray-700'}`}
                >
                  <span>This Month</span>
                  {selectedPeriod === 'this_month' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </button>
                <button
                  onClick={() => { setSelectedPeriod('today'); setIsCalendarMenuOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs font-bold flex items-center justify-between hover:bg-emerald-50 ${selectedPeriod === 'today' ? 'text-emerald-800 bg-emerald-50/80 font-black' : 'text-gray-700'}`}
                >
                  <span>Today</span>
                  {selectedPeriod === 'today' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </button>
                <button
                  onClick={() => { setSelectedPeriod('last_month'); setIsCalendarMenuOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs font-bold flex items-center justify-between hover:bg-emerald-50 ${selectedPeriod === 'last_month' ? 'text-emerald-800 bg-emerald-50/80 font-black' : 'text-gray-700'}`}
                >
                  <span>Last Month</span>
                  {selectedPeriod === 'last_month' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </button>
                <button
                  onClick={() => { setSelectedPeriod('this_year'); setIsCalendarMenuOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs font-bold flex items-center justify-between hover:bg-emerald-50 ${selectedPeriod === 'this_year' ? 'text-emerald-800 bg-emerald-50/80 font-black' : 'text-gray-700'}`}
                >
                  <span>This Year</span>
                  {selectedPeriod === 'this_year' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </button>
                <button
                  onClick={() => { setSelectedPeriod('all'); setIsCalendarMenuOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs font-bold flex items-center justify-between hover:bg-emerald-50 ${selectedPeriod === 'all' ? 'text-emerald-800 bg-emerald-50/80 font-black' : 'text-gray-700'}`}
                >
                  <span>All Time</span>
                  {selectedPeriod === 'all' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Inner White Card: Income, Expenses & Direct Personal Transfers */}
        <div className="relative z-0 bg-white text-[#0D2E14] rounded-2xl border border-[#E2E8E0] shadow-2xs divide-y md:divide-y-0 md:divide-x divide-gray-300 md:divide-slate-300 md:grid md:grid-cols-3 overflow-hidden">
          {/* Income Section */}
          <div className="p-3 sm:p-4 space-y-2.5">
            <div 
              onClick={() => setIsIncomeOpen(prev => !prev)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black flex-shrink-0">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 block">Income</span>
                  {renderAmount(totalIncome, 'text-base sm:text-lg font-black text-emerald-700')}
                </div>
              </div>
              <button className="p-1 text-gray-400 hover:text-gray-600 rounded-full md:hidden">
                {isIncomeOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            <div className="pt-2.5 border-t border-gray-100">
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-gray-600 divide-x divide-gray-200 py-0.5">
                {/* Left: Praveen */}
                <div className="flex-1 pr-2 flex items-center justify-between min-w-0">
                  <span className="flex items-center gap-1 font-semibold text-gray-500 truncate text-[11px] sm:text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block flex-shrink-0" />
                    Praveen
                  </span>
                  {renderAmount(praveenIncome, 'font-extrabold text-gray-900 ml-1 text-[11px] sm:text-xs')}
                </div>

                {/* Right: Sarthak */}
                <div className="flex-1 pl-2 flex items-center justify-between min-w-0">
                  <span className="flex items-center gap-1 font-semibold text-gray-500 truncate text-[11px] sm:text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block flex-shrink-0" />
                    Sarthak
                  </span>
                  {renderAmount(sarthakIncome, 'font-extrabold text-gray-900 ml-1 text-[11px] sm:text-xs')}
                </div>
              </div>
            </div>
          </div>

          {/* Expenses Section */}
          <div className="p-3 sm:p-4 space-y-2.5">
            <div 
              onClick={() => setIsExpenseOpen(prev => !prev)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center font-black flex-shrink-0">
                  <ArrowDownRight className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 block">Expenses</span>
                  {renderAmount(totalExpense, 'text-base sm:text-lg font-black text-rose-600')}
                </div>
              </div>
              <button className="p-1 text-gray-400 hover:text-gray-600 rounded-full md:hidden">
                {isExpenseOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            <div className="pt-2.5 border-t border-gray-100">
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-gray-600 divide-x divide-gray-200 py-0.5">
                {/* Left: Praveen */}
                <div className="flex-1 pr-2 flex items-center justify-between min-w-0">
                  <span className="flex items-center gap-1 font-semibold text-gray-500 truncate text-[11px] sm:text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block flex-shrink-0" />
                    Praveen
                  </span>
                  {renderAmount(praveenExpense, 'font-extrabold text-gray-900 ml-1 text-[11px] sm:text-xs')}
                </div>

                {/* Right: Sarthak */}
                <div className="flex-1 pl-2 flex items-center justify-between min-w-0">
                  <span className="flex items-center gap-1 font-semibold text-gray-500 truncate text-[11px] sm:text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block flex-shrink-0" />
                    Sarthak
                  </span>
                  {renderAmount(sarthakExpense, 'font-extrabold text-gray-900 ml-1 text-[11px] sm:text-xs')}
                </div>
              </div>
            </div>
          </div>

          {/* Direct Partner & Family Transfers Section */}
          <div className="p-3 sm:p-4 space-y-2.5">
            <div 
              onClick={() => setIsDirectOpen(prev => !prev)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black flex-shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 block">Direct Partner Transfers</span>
                  {renderAmount(praveenDirectGiven + sarthakDirectGiven, 'text-base sm:text-lg font-black text-blue-700')}
                </div>
              </div>
              <button className="p-1 text-gray-400 hover:text-gray-600 rounded-full md:hidden">
                {isDirectOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            <div className="pt-2.5 border-t border-gray-100">
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-gray-600 divide-x divide-gray-200 py-0.5">
                {/* Left: Praveen Direct Given */}
                <div className="flex-1 pr-2 flex items-center justify-between min-w-0">
                  <span className="flex items-center gap-1 font-semibold text-gray-500 truncate text-[11px] sm:text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block flex-shrink-0" />
                    Praveen
                  </span>
                  {renderAmount(praveenDirectGiven, 'font-extrabold text-gray-900 ml-1 text-[11px] sm:text-xs')}
                </div>

                {/* Right: Sarthak Direct Given */}
                <div className="flex-1 pl-2 flex items-center justify-between min-w-0">
                  <span className="flex items-center gap-1 font-semibold text-gray-500 truncate text-[11px] sm:text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block flex-shrink-0" />
                    Sarthak
                  </span>
                  {renderAmount(sarthakDirectGiven, 'font-extrabold text-gray-900 ml-1 text-[11px] sm:text-xs')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Settlement Equalization Action Card with Direction-Specific Buckets */}
      <div className="bg-[#FFFBEB] rounded-3xl p-4 sm:p-5 border border-amber-200 shadow-xs space-y-3 w-full">
        <div className="flex items-center justify-between border-b border-amber-100 pb-2">
          <span className="text-xs font-extrabold text-amber-900">Settlement Equalization</span>
          <Users className="w-4 h-4 text-amber-800" />
        </div>

        {settled ? (
          <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-2xl text-center space-y-1 animate-fadeIn">
            <CheckCircle2 className="w-6 h-6 text-emerald-700 mx-auto" />
            <p className="text-xs font-black text-emerald-900">Settlement Recorded to Business Passbook!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* BUCKET A: Praveen ➔ Sarthak */}
            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-amber-200 shadow-2xs space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-1.5 mb-1.5">
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                    Praveen ➔ Sarthak
                  </span>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">Expense Equalized</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-gray-500 font-medium">Due Amount:</span>
                  {renderAmount(praveenOwesSarthak, 'text-base sm:text-lg font-black text-rose-700')}
                </div>
                <div className="text-[10px] text-gray-500 bg-slate-50 rounded-lg p-1.5 mt-1.5 space-y-0.5 border border-gray-100">
                  <div className="flex justify-between">
                    <span>Operating Share:</span>
                    <span className="font-semibold text-gray-700">₹{praveenOperatingDue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Praveen ➔ Sarthak Transfers:</span>
                    <span className="font-semibold text-gray-700">-₹{praveenDirectGiven.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {praveenOwesSarthak > 0 ? (
                <button
                  onClick={handleSettlePraveenToSarthak}
                  className="w-full py-2 bg-[#0D2E14] hover:bg-[#14471f] text-white rounded-xl font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Settle Praveen ➔ Sarthak</span>
                </button>
              ) : (
                <div className="py-1.5 bg-emerald-50 text-emerald-800 rounded-xl text-center text-xs font-bold border border-emerald-200">
                  ✅ Fully Settled
                </div>
              )}
            </div>

            {/* BUCKET B: Sarthak ➔ Praveen */}
            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-amber-200 shadow-2xs space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-1.5 mb-1.5">
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Sarthak ➔ Praveen
                  </span>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">50% Income Split</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-gray-500 font-medium">Due Amount:</span>
                  {renderAmount(sarthakOwesPraveen, 'text-base sm:text-lg font-black text-emerald-700')}
                </div>
                <div className="text-[10px] text-gray-500 bg-slate-50 rounded-lg p-1.5 mt-1.5 space-y-0.5 border border-gray-100">
                  <div className="flex justify-between">
                    <span>50% Sarthak Income:</span>
                    <span className="font-semibold text-gray-700">₹{sarthakOperatingDue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sarthak ➔ Praveen Transfers:</span>
                    <span className="font-semibold text-gray-700">-₹{sarthakDirectGiven.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {sarthakOwesPraveen > 0 ? (
                <button
                  onClick={handleSettleSarthakToPraveen}
                  className="w-full py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Settle Sarthak ➔ Praveen</span>
                </button>
              ) : (
                <div className="py-1.5 bg-emerald-50 text-emerald-800 rounded-xl text-center text-xs font-bold border border-emerald-200">
                  ✅ Fully Settled
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default BusinessPartnerSummaryCard;
