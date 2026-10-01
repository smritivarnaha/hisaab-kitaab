import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Transaction } from '../../types/finance';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  ChevronDown, 
  ChevronUp, 
  Users, 
  CheckCircle2,
  Calendar,
  History
} from 'lucide-react';
import { PeriodSelector } from '../common/PeriodSelector';

interface Props {
  selectedPeriod?: string;
  onPeriodChange?: (period: string) => void;
}

export const BusinessPartnerSummaryCard: React.FC<Props> = ({
  selectedPeriod: propSelectedPeriod,
  onPeriodChange
}) => {
  const { transactions, currentUser, dbStatus } = useFinance();
  const isAdmin = currentUser?.id === 'praveen' || currentUser?.id === 'sarthak' || (currentUser?.name || '').toLowerCase().includes('praveen') || (currentUser?.name || '').toLowerCase().includes('sarthak');
  const [isIncomeOpen, setIsIncomeOpen] = useState(true);
  const [isExpenseOpen, setIsExpenseOpen] = useState(true);
  const [isDirectOpen, setIsDirectOpen] = useState(true);

  const [internalPeriod, setInternalPeriod] = useState<string>('this_month');
  const selectedPeriod = propSelectedPeriod !== undefined ? propSelectedPeriod : internalPeriod;
  const setSelectedPeriod = (period: string) => {
    if (onPeriodChange) {
      onPeriodChange(period);
    } else {
      setInternalPeriod(period);
    }
  };

  const renderAmount = (amount: number, colorClass: string, prefix = '₹', skeletonWidth = 'w-16') => {
    if (dbStatus === 'loading') {
      return <span className={`inline-block ${skeletonWidth} h-4 sm:h-5 bg-gray-200 animate-pulse rounded-md align-middle my-0.5`} />;
    }
    return <span className={colorClass}>{prefix}{amount.toLocaleString('en-IN')}</span>;
  };

  // Helper to compute partner balance components for a transaction slice
  const calculatePartnerBalance = (txList: Transaction[], currentUserName?: string) => {
    let totalIncome = 0;
    let totalExpense = 0;
    let praveenIncome = 0;
    let praveenExpense = 0;
    let sarthakIncome = 0;
    let sarthakExpense = 0;
    let praveenDirectGiven = 0;
    let sarthakDirectGiven = 0;

    txList.filter(t => !t.title?.startsWith('Settlement:')).forEach(t => {
      const amt = Number(t.amount || 0);
      const isPraveen = (t.enteredBy || '').toLowerCase().includes('praveen') || (!t.enteredBy && currentUserName?.toLowerCase().includes('praveen'));
      
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

    // 1. 50% Income Split:
    const incomeDuePtoS = (praveenIncome - sarthakIncome) / 2;
    // 2. 50% Expense Equalization:
    const fairExpensePerPartner = totalExpense / 2;
    const expenseDeficitStoP = (praveenExpense - sarthakExpense) / 2;
    // 3. Net Operating Balance:
    const operatingNetPtoS = incomeDuePtoS - expenseDeficitStoP;
    // 4. Direct Partner Transfers (Pure Loans):
    const netDirectLoanPtoS = sarthakDirectGiven - praveenDirectGiven;
    // 5. Final Net Balance (Positive = Praveen owes Sarthak, Negative = Sarthak owes Praveen):
    const finalNetPtoS = Math.round(operatingNetPtoS + netDirectLoanPtoS);

    return {
      totalIncome,
      totalExpense,
      praveenIncome,
      praveenExpense,
      praveenDirectGiven,
      sarthakIncome,
      sarthakExpense,
      sarthakDirectGiven,
      fairExpensePerPartner,
      incomeDuePtoS,
      expenseDeficitStoP,
      operatingNetPtoS,
      netDirectLoanPtoS,
      finalNetPtoS
    };
  };

  // Split business transactions into prior carryover vs current period
  const { priorTransactions, periodFilteredTransactions, priorPeriodLabel } = React.useMemo(() => {
    const bTxList = transactions.filter(t => t.mode === 'business' && !t.isPending);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const todayStr = now.toISOString().split('T')[0];

    const getTDateInfo = (t: Transaction): { dateObj: Date; dateStr: string } => {
      if (t.date) {
        const parts = t.date.split('T')[0].split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const d = parseInt(parts[2], 10);
          return {
            dateObj: new Date(y, m, d),
            dateStr: `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
          };
        }
      }
      const d = new Date(t.timestamp || t.date || Date.now());
      return { dateObj: d, dateStr: d.toISOString().split('T')[0] };
    };

    if (selectedPeriod === 'all') {
      return {
        priorTransactions: [],
        periodFilteredTransactions: bTxList,
        priorPeriodLabel: ''
      };
    }

    if (selectedPeriod === 'today') {
      const prior: Transaction[] = [];
      const current: Transaction[] = [];
      bTxList.forEach(t => {
        const { dateStr } = getTDateInfo(t);
        if (dateStr === todayStr) {
          current.push(t);
        } else if (dateStr < todayStr) {
          prior.push(t);
        }
      });
      return {
        priorTransactions: prior,
        periodFilteredTransactions: current,
        priorPeriodLabel: 'Carryover Before Today'
      };
    }

    if (selectedPeriod === 'this_month') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const prevMonthName = currentMonth === 0 ? 'Dec' : monthNames[currentMonth - 1];
      const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
      const endOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

      const prior: Transaction[] = [];
      const current: Transaction[] = [];
      bTxList.forEach(t => {
        const { dateObj } = getTDateInfo(t);
        if (dateObj < startOfCurrentMonth) {
          prior.push(t);
        } else if (dateObj <= endOfCurrentMonth) {
          current.push(t);
        }
      });
      return {
        priorTransactions: prior,
        periodFilteredTransactions: current,
        priorPeriodLabel: `Past Months Carryover (up to ${prevMonthName})`
      };
    }

    if (selectedPeriod === 'last_month') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const lastMonthIndex = currentMonth === 0 ? 11 : currentMonth - 1;
      const startOfLastMonth = new Date(lastMonthYear, lastMonthIndex, 1);
      const endOfLastMonth = new Date(lastMonthYear, lastMonthIndex + 1, 0, 23, 59, 59, 999);

      const prior: Transaction[] = [];
      const current: Transaction[] = [];
      bTxList.forEach(t => {
        const { dateObj } = getTDateInfo(t);
        if (dateObj < startOfLastMonth) {
          prior.push(t);
        } else if (dateObj <= endOfLastMonth) {
          current.push(t);
        }
      });
      return {
        priorTransactions: prior,
        periodFilteredTransactions: current,
        priorPeriodLabel: `Carryover (before ${monthNames[lastMonthIndex]})`
      };
    }

    if (/^\d{4}-\d{2}$/.test(selectedPeriod)) {
      const [targetYear, targetMonth] = selectedPeriod.split('-').map(Number);
      const targetMonthIndex = targetMonth - 1;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const prevMonthName = targetMonthIndex === 0 ? 'Dec' : monthNames[targetMonthIndex - 1];
      const startOfTargetMonth = new Date(targetYear, targetMonthIndex, 1);
      const endOfTargetMonth = new Date(targetYear, targetMonthIndex + 1, 0, 23, 59, 59, 999);

      const prior: Transaction[] = [];
      const current: Transaction[] = [];
      bTxList.forEach(t => {
        const { dateObj } = getTDateInfo(t);
        if (dateObj < startOfTargetMonth) {
          prior.push(t);
        } else if (dateObj <= endOfTargetMonth) {
          current.push(t);
        }
      });
      return {
        priorTransactions: prior,
        periodFilteredTransactions: current,
        priorPeriodLabel: `Carryover (up to ${prevMonthName})`
      };
    }

    if (selectedPeriod === 'this_year') {
      const startOfYear = new Date(currentYear, 0, 1);
      const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);

      const prior: Transaction[] = [];
      const current: Transaction[] = [];
      bTxList.forEach(t => {
        const { dateObj } = getTDateInfo(t);
        if (dateObj < startOfYear) {
          prior.push(t);
        } else if (dateObj <= endOfYear) {
          current.push(t);
        }
      });
      return {
        priorTransactions: prior,
        periodFilteredTransactions: current,
        priorPeriodLabel: `Carryover (before ${currentYear})`
      };
    }

    return { priorTransactions: [], periodFilteredTransactions: bTxList, priorPeriodLabel: '' };
  }, [transactions, selectedPeriod]);

  // Compute balance components for selected period
  const periodBalance = React.useMemo(() => {
    return calculatePartnerBalance(periodFilteredTransactions, currentUser?.name);
  }, [periodFilteredTransactions, currentUser]);

  // Compute balance components for prior carryover
  const priorBalance = React.useMemo(() => {
    if (selectedPeriod === 'all' || priorTransactions.length === 0) {
      return { finalNetPtoS: 0 };
    }
    return calculatePartnerBalance(priorTransactions, currentUser?.name);
  }, [priorTransactions, currentUser, selectedPeriod]);

  const {
    totalIncome,
    totalExpense,
    praveenIncome,
    praveenExpense,
    praveenDirectGiven,
    sarthakIncome,
    sarthakExpense,
    sarthakDirectGiven,
    fairExpensePerPartner,
    incomeDuePtoS,
    expenseDeficitStoP,
    operatingNetPtoS,
    netDirectLoanPtoS,
    finalNetPtoS: periodNetPtoS
  } = periodBalance;

  const priorNetPtoS = priorBalance.finalNetPtoS;
  const totalCumulativeNetPtoS = priorNetPtoS + periodNetPtoS;
  const finalNetPtoS = totalCumulativeNetPtoS;

  const praveenOwesSarthak = Math.max(0, totalCumulativeNetPtoS);
  const sarthakOwesPraveen = Math.max(0, -totalCumulativeNetPtoS);

  const getPeriodLabel = () => {
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const yearShort = String(currentYear).slice(-2);

    if (selectedPeriod === 'today') {
      const day = String(now.getDate()).padStart(2, '0');
      const month = monthNames[currentMonth];
      return `Today (${day} ${month} ${yearShort})`;
    }
    if (selectedPeriod === 'this_month') {
      const month = monthNames[currentMonth];
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      return `01 ${month} ${yearShort} - ${String(lastDay).padStart(2, '0')} ${month} ${yearShort}`;
    }
    if (selectedPeriod === 'last_month') {
      const lm = new Date(currentYear, currentMonth - 1, 1);
      const lmMonth = monthNames[lm.getMonth()];
      const lmYearShort = String(lm.getFullYear()).slice(-2);
      const lmLastDay = new Date(lm.getFullYear(), lm.getMonth() + 1, 0).getDate();
      return `01 ${lmMonth} ${lmYearShort} - ${String(lmLastDay).padStart(2, '0')} ${lmMonth} ${lmYearShort}`;
    }
    if (/^\d{4}-\d{2}$/.test(selectedPeriod)) {
      const [y, m] = selectedPeriod.split('-').map(Number);
      const month = monthNames[m - 1];
      const lastDay = new Date(y, m, 0).getDate();
      return `01 ${month} ${String(y).slice(-2)} - ${String(lastDay).padStart(2, '0')} ${month} ${String(y).slice(-2)}`;
    }
    if (selectedPeriod === 'this_year') {
      return `Year ${currentYear}`;
    }
    return 'All Time';
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

          <PeriodSelector
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            transactions={transactions.filter(t => t.mode === 'business')}
            theme="light"
          />
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
                    Praveen Lent
                  </span>
                  {renderAmount(praveenDirectGiven, 'font-extrabold text-gray-900 ml-1 text-[11px] sm:text-xs')}
                </div>

                {/* Right: Sarthak Direct Given */}
                <div className="flex-1 pl-2 flex items-center justify-between min-w-0">
                  <span className="flex items-center gap-1 font-semibold text-gray-500 truncate text-[11px] sm:text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block flex-shrink-0" />
                    Sarthak Lent
                  </span>
                  {renderAmount(sarthakDirectGiven, 'font-extrabold text-gray-900 ml-1 text-[11px] sm:text-xs')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Clean Partnership Equalization & Net Standing Card */}
      <div className="bg-[#FFFBEB] rounded-3xl p-4 sm:p-5 border border-amber-200 shadow-xs space-y-3.5 w-full">
        <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-900" />
            <span className="text-xs sm:text-sm font-black text-amber-950">
              Partnership Equalization & Net Standing
            </span>
          </div>
          <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
            50/50 Split Rule
          </span>
        </div>

        {/* Big Outcome Banner: Who owes Whom and Net Amount */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-amber-200 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Net Live Settlement
            </span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
              totalCumulativeNetPtoS > 0
                ? 'bg-rose-100 text-rose-900 border-rose-200'
                : totalCumulativeNetPtoS < 0
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                  : 'bg-green-100 text-green-900 border-green-200'
            }`}>
              {totalCumulativeNetPtoS > 0
                ? 'Praveen ➔ Sarthak Due'
                : totalCumulativeNetPtoS < 0
                  ? 'Sarthak ➔ Praveen Due'
                  : 'All Balanced (₹0)'}
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="text-xl sm:text-2xl font-black text-gray-900">
                {renderAmount(
                  Math.abs(totalCumulativeNetPtoS), 
                  totalCumulativeNetPtoS !== 0 ? (totalCumulativeNetPtoS > 0 ? 'text-rose-700' : 'text-emerald-700') : 'text-gray-900'
                )}
              </p>
              <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                {totalCumulativeNetPtoS > 0 ? (
                  <span><b>Praveen</b> needs to pay <b>Sarthak</b> ₹{Math.abs(totalCumulativeNetPtoS).toLocaleString('en-IN')} to fully balance profit and personal loans.</span>
                ) : totalCumulativeNetPtoS < 0 ? (
                  <span><b>Sarthak</b> needs to pay <b>Praveen</b> ₹{Math.abs(totalCumulativeNetPtoS).toLocaleString('en-IN')} to fully balance profit and personal loans.</span>
                ) : (
                  <span>Both partner accounts are perfectly balanced down to the rupee.</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* 3-Step Clear Calculation Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Step 1: 50% Income Split */}
          <div className="bg-white rounded-2xl p-3 border border-amber-200/80 shadow-2xs space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-1 mb-1">
                <span className="text-[11px] font-bold text-gray-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  1. Income Share
                </span>
                <span className="text-[9px] font-semibold text-gray-400">50/50</span>
              </div>
              <div className="text-[10px] text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Praveen collected:</span>
                  <span className="font-semibold text-gray-800">₹{praveenIncome.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sarthak collected:</span>
                  <span className="font-semibold text-gray-800">₹{sarthakIncome.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
            <div className="pt-1.5 border-t border-gray-100 flex justify-between items-center text-[10px]">
              <span className="font-bold text-gray-700">Income Due to Sarthak:</span>
              <span className="font-black text-emerald-700">
                {incomeDuePtoS >= 0 ? `+₹${incomeDuePtoS.toLocaleString('en-IN')}` : `-₹${Math.abs(incomeDuePtoS).toLocaleString('en-IN')}`}
              </span>
            </div>
          </div>

          {/* Step 2: 50% Expense Equalization */}
          <div className="bg-white rounded-2xl p-3 border border-amber-200/80 shadow-2xs space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-1 mb-1">
                <span className="text-[11px] font-bold text-gray-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                  2. Expense Equalization
                </span>
                <span className="text-[9px] font-semibold text-gray-400">50/50</span>
              </div>
              <div className="text-[10px] text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Praveen paid:</span>
                  <span className="font-semibold text-gray-800">₹{praveenExpense.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sarthak paid:</span>
                  <span className="font-semibold text-gray-800">₹{sarthakExpense.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-gray-400 text-[9px]">
                  <span>Fair share each:</span>
                  <span>₹{Math.round(fairExpensePerPartner).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
            <div className="pt-1.5 border-t border-gray-100 flex justify-between items-center text-[10px]">
              <span className="font-bold text-gray-700">Sarthak Expense Share:</span>
              <span className="font-black text-rose-700">
                {expenseDeficitStoP >= 0 ? `-₹${expenseDeficitStoP.toLocaleString('en-IN')}` : `+₹${Math.abs(expenseDeficitStoP).toLocaleString('en-IN')}`}
              </span>
            </div>
          </div>

          {/* Step 3: Pure Personal Loans */}
          <div className="bg-white rounded-2xl p-3 border border-amber-200/80 shadow-2xs space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-1 mb-1">
                <span className="text-[11px] font-bold text-gray-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                  3. Pure Partner Loans
                </span>
                <span className="text-[9px] font-semibold text-gray-400">100% Direct</span>
              </div>
              <div className="text-[10px] text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Taken from Sarthak:</span>
                  <span className="font-semibold text-gray-800">₹{sarthakDirectGiven.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Given to Sarthak:</span>
                  <span className="font-semibold text-gray-800">₹{praveenDirectGiven.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
            <div className="pt-1.5 border-t border-gray-100 flex justify-between items-center text-[10px]">
              <span className="font-bold text-gray-700">Net Personal Loan:</span>
              <span className="font-black text-purple-700">
                {netDirectLoanPtoS >= 0 ? `+₹${netDirectLoanPtoS.toLocaleString('en-IN')}` : `-₹${Math.abs(netDirectLoanPtoS).toLocaleString('en-IN')}`}
              </span>
            </div>
          </div>
        </div>

        {/* Live Equation Summary Strip */}
        <div className="p-2.5 rounded-xl bg-amber-100/70 border border-amber-200/90 text-[10px] text-amber-950 font-medium flex items-center justify-between flex-wrap gap-1">
          <span className="font-bold">Summary Equation:</span>
          <span>
            {priorNetPtoS !== 0 ? (
              <>
                Past Carryover ({priorNetPtoS > 0 ? `+₹${priorNetPtoS.toLocaleString('en-IN')}` : `-₹${Math.abs(priorNetPtoS).toLocaleString('en-IN')}`})
                {' '}+ Period Net ({periodNetPtoS >= 0 ? `+₹${periodNetPtoS.toLocaleString('en-IN')}` : `-₹${Math.abs(periodNetPtoS).toLocaleString('en-IN')}`})
                {' '}= <b className="font-black">{totalCumulativeNetPtoS >= 0 ? `Praveen owes Sarthak ₹${totalCumulativeNetPtoS.toLocaleString('en-IN')}` : `Sarthak owes Praveen ₹${Math.abs(totalCumulativeNetPtoS).toLocaleString('en-IN')}`}</b>
              </>
            ) : (
              <>
                Income Share ({incomeDuePtoS >= 0 ? `+₹${incomeDuePtoS.toLocaleString('en-IN')}` : `-₹${Math.abs(incomeDuePtoS).toLocaleString('en-IN')}`})
                {' '}- Expense Offset ({expenseDeficitStoP >= 0 ? `₹${expenseDeficitStoP.toLocaleString('en-IN')}` : `-₹${Math.abs(expenseDeficitStoP).toLocaleString('en-IN')}`})
                {' '}+ Pure Loans ({netDirectLoanPtoS >= 0 ? `+₹${netDirectLoanPtoS.toLocaleString('en-IN')}` : `-₹${Math.abs(netDirectLoanPtoS).toLocaleString('en-IN')}`})
                {' '}= <b className="font-black">{periodNetPtoS >= 0 ? `Praveen owes Sarthak ₹${periodNetPtoS.toLocaleString('en-IN')}` : `Sarthak owes Praveen ₹${Math.abs(periodNetPtoS).toLocaleString('en-IN')}`}</b>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};
export default BusinessPartnerSummaryCard;
