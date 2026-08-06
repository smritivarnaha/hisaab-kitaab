import React, { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Transaction } from '../../types/finance';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  ChevronDown, 
  ChevronUp, 
  Users, 
  ArrowRight,
  Building2,
  CheckCircle2,
  Calendar
} from 'lucide-react';

export const BusinessPartnerSummaryCard: React.FC = () => {
  const { transactions, addTransaction } = useFinance();
  const [isIncomeOpen, setIsIncomeOpen] = useState(true);
  const [isExpenseOpen, setIsExpenseOpen] = useState(true);
  const [settled, setSettled] = useState(false);

  const [selectedPeriod, setSelectedPeriod] = useState<'this_month' | 'today' | 'last_month' | 'this_year' | 'all'>('this_month');
  const [isCalendarMenuOpen, setIsCalendarMenuOpen] = useState(false);

  const filteredBusinessTx = useMemo(() => {
    const bTx = transactions.filter(t => !t.isPending && t.mode === 'business');
    const now = new Date();

    if (selectedPeriod === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      return bTx.filter(t => t.date === todayStr);
    }
    if (selectedPeriod === 'this_month') {
      const curYear = now.getFullYear();
      const curMonth = now.getMonth();
      return bTx.filter(t => {
        const d = new Date(t.date || t.timestamp);
        return d.getFullYear() === curYear && d.getMonth() === curMonth;
      });
    }
    if (selectedPeriod === 'last_month') {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lmYear = lastMonthDate.getFullYear();
      const lmMonth = lastMonthDate.getMonth();
      return bTx.filter(t => {
        const d = new Date(t.date || t.timestamp);
        return d.getFullYear() === lmYear && d.getMonth() === lmMonth;
      });
    }
    if (selectedPeriod === 'this_year') {
      const curYear = now.getFullYear();
      return bTx.filter(t => {
        const d = new Date(t.date || t.timestamp);
        return d.getFullYear() === curYear;
      });
    }
    return bTx;
  }, [transactions, selectedPeriod]);

  const {
    totalIncome,
    totalExpense,
    praveenIncome,
    praveenExpense,
    sarthakIncome,
    sarthakExpense,
    praveenCashHeld,
    sarthakCashHeld,
    netProfit,
    fairSharePerPartner,
    payerName,
    payeeName,
    amountDue
  } = useMemo(() => {
    const incList = filteredBusinessTx.filter(t => t.type === 'income');
    const expList = filteredBusinessTx.filter(t => t.type === 'expense');

    const totalIncome = incList.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalExpense = expList.reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const isPraveen = (t: Transaction) => (t.enteredBy || '').toLowerCase().includes('praveen') || !t.enteredBy;
    const isSarthak = (t: Transaction) => (t.enteredBy || '').toLowerCase().includes('sarthak');

    const praveenIncome = incList.filter(isPraveen).reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const sarthakIncome = incList.filter(isSarthak).reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const praveenExpense = expList.filter(isPraveen).reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const sarthakExpense = expList.filter(isSarthak).reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const praveenCashHeld = praveenIncome - praveenExpense;
    const sarthakCashHeld = sarthakIncome - sarthakExpense;

    const netProfit = totalIncome - totalExpense;
    const fairSharePerPartner = netProfit / 2;

    const praveenDue = fairSharePerPartner - praveenCashHeld;
    const sarthakDue = fairSharePerPartner - sarthakCashHeld;

    let payerName = '';
    let payeeName = '';
    let amountDue = 0;

    if (praveenDue > 0.01) {
      payeeName = 'Praveen';
      payerName = 'Sarthak';
      amountDue = Math.round(praveenDue);
    } else if (sarthakDue > 0.01) {
      payeeName = 'Sarthak';
      payerName = 'Praveen';
      amountDue = Math.round(sarthakDue);
    }

    return {
      totalIncome,
      totalExpense,
      praveenIncome,
      praveenExpense,
      sarthakIncome,
      sarthakExpense,
      praveenCashHeld,
      sarthakCashHeld,
      netProfit,
      fairSharePerPartner,
      payerName,
      payeeName,
      amountDue
    };
  }, [filteredBusinessTx]);

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

  const handleSettleNow = () => {
    if (!payerName || !payeeName || amountDue <= 0) return;
    const newTx: Transaction = {
      id: `tx_settle_${Date.now()}`,
      amount: amountDue,
      currency: '₹',
      type: 'income',
      category: 'Others',
      title: `Settlement: ${payerName} paid ${payeeName}`,
      date: new Date().toISOString().split('T')[0],
      relativeDateText: 'Today',
      timestamp: Date.now(),
      confidenceScore: 100,
      paymentMethod: 'UPI',
      notes: `Equalized 50-50 business ledger`,
      isPending: false,
      mode: 'business',
      enteredBy: payerName
    };
    addTransaction(newTx);
    setSettled(true);
    setTimeout(() => setSettled(false), 4000);
  };

  return (
    <div className="space-y-2.5 sm:space-y-4 font-outfit w-full mx-auto animate-fadeIn">
      {/* 1. Top Green Business Overview Card */}
      <div className="relative overflow-visible bg-[#0D2E14] text-white p-3 sm:p-5 rounded-3xl shadow-md border border-[#1b4e27] space-y-2.5 sm:space-y-4 w-full z-20">
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

        {/* Inner White Card: Income & Expenses Sections ONLY */}
        <div className="relative z-0 bg-white text-[#0D2E14] rounded-2xl border border-[#E2E8E0] shadow-2xs divide-y divide-gray-100 overflow-hidden">
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
                  <span className="text-base sm:text-lg font-black text-emerald-700">₹{totalIncome.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <button className="p-1 text-gray-400 hover:text-gray-600 rounded-full">
                {isIncomeOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {isIncomeOpen && (
              <div className="pt-2.5 border-t border-gray-100 animate-fadeIn">
                <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 divide-x divide-gray-200 py-1">
                  {/* Left: Praveen */}
                  <div className="flex-1 pr-2.5 flex items-center justify-between min-w-0">
                    <span className="flex items-center gap-1.5 font-medium text-gray-600 truncate">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block flex-shrink-0" />
                      Praveen
                    </span>
                    <span className="font-semibold text-gray-900 ml-1">₹{praveenIncome.toLocaleString('en-IN')}</span>
                  </div>

                  {/* Right: Sarthak */}
                  <div className="flex-1 pl-2.5 flex items-center justify-between min-w-0">
                    <span className="flex items-center gap-1.5 font-medium text-gray-600 truncate">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block flex-shrink-0" />
                      Sarthak
                    </span>
                    <span className="font-semibold text-gray-900 ml-1">₹{sarthakIncome.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            )}
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
                  <span className="text-base sm:text-lg font-black text-rose-600">₹{totalExpense.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <button className="p-1 text-gray-400 hover:text-gray-600 rounded-full">
                {isExpenseOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {isExpenseOpen && (
              <div className="pt-2.5 border-t border-gray-100 animate-fadeIn">
                <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 divide-x divide-gray-200 py-1">
                  {/* Left: Praveen */}
                  <div className="flex-1 pr-2.5 flex items-center justify-between min-w-0">
                    <span className="flex items-center gap-1.5 font-medium text-gray-600 truncate">
                      <span className="w-2 h-2 rounded-full bg-rose-500 inline-block flex-shrink-0" />
                      Praveen
                    </span>
                    <span className="font-semibold text-gray-900 ml-1">₹{praveenExpense.toLocaleString('en-IN')}</span>
                  </div>

                  {/* Right: Sarthak */}
                  <div className="flex-1 pl-2.5 flex items-center justify-between min-w-0">
                    <span className="flex items-center gap-1.5 font-medium text-gray-600 truncate">
                      <span className="w-2 h-2 rounded-full bg-rose-400 inline-block flex-shrink-0" />
                      Sarthak
                    </span>
                    <span className="font-semibold text-gray-900 ml-1">₹{sarthakExpense.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. OUTSIDE CARD: Current Amount & Final Settlement Outcome Grid */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-3xl p-3.5 sm:p-5 grid grid-cols-2 divide-x divide-slate-200 items-center shadow-xs w-full">
        {/* Left: Current Amount */}
        <div className="pr-2.5 sm:pr-4 flex flex-col justify-center text-left">
          <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
            Current Amount
          </span>
          <p className={`text-lg sm:text-2xl font-black tracking-tight ${
            netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
          }`}>
            {netProfit >= 0 ? '+ ' : '- '}₹{Math.abs(netProfit).toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-slate-400 font-semibold mt-0.5">Total Net Balance</span>
        </div>

        {/* Right: Partner Final Settlement Outcome */}
        <div className="pl-2.5 sm:pl-4 flex flex-col justify-center text-left space-y-1">
          <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
            Final Settlement
          </span>

          <div className="space-y-1 text-xs sm:text-sm font-bold">
            {/* Praveen outcome */}
            <div className="flex items-center justify-between gap-1">
              <span className="text-slate-700 font-bold truncate">Praveen:</span>
              <span className={`font-black flex-shrink-0 text-xs sm:text-sm ${
                praveenCashHeld < fairSharePerPartner ? 'text-emerald-700' : praveenCashHeld > fairSharePerPartner ? 'text-rose-600' : 'text-slate-600'
              }`}>
                {fairSharePerPartner - praveenCashHeld > 0 ? `+₹${Math.round(fairSharePerPartner - praveenCashHeld).toLocaleString('en-IN')} (gets)` :
                 fairSharePerPartner - praveenCashHeld < 0 ? `-₹${Math.round(Math.abs(fairSharePerPartner - praveenCashHeld)).toLocaleString('en-IN')} (pays)` :
                 '₹0 (settled)'}
              </span>
            </div>

            {/* Sarthak outcome */}
            <div className="flex items-center justify-between gap-1">
              <span className="text-slate-700 font-bold truncate">Sarthak:</span>
              <span className={`font-black flex-shrink-0 text-xs sm:text-sm ${
                sarthakCashHeld < fairSharePerPartner ? 'text-emerald-700' : sarthakCashHeld > fairSharePerPartner ? 'text-rose-600' : 'text-slate-600'
              }`}>
                {fairSharePerPartner - sarthakCashHeld > 0 ? `+₹${Math.round(fairSharePerPartner - sarthakCashHeld).toLocaleString('en-IN')} (gets)` :
                 fairSharePerPartner - sarthakCashHeld < 0 ? `-₹${Math.round(Math.abs(fairSharePerPartner - sarthakCashHeld)).toLocaleString('en-IN')} (pays)` :
                 '₹0 (settled)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. OUTSIDE CARD: Settlement Equalization Action Card */}
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
        ) : amountDue > 0 && payerName && payeeName ? (
          <div className="space-y-3">
            <div className="flex items-center justify-around py-1">
              <div className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 border-2 border-emerald-300 flex items-center justify-center font-black text-xs shadow-2xs">
                  {payerName.charAt(0)}
                </div>
                <span className="text-xs font-bold text-gray-800">{payerName}</span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">Pays</span>
                <div className="flex items-center gap-1 text-amber-900 font-black text-base sm:text-xl">
                  <span>₹{amountDue.toLocaleString('en-IN')}</span>
                  <ArrowRight className="w-5 h-5 text-amber-800" />
                </div>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full bg-emerald-200 text-emerald-900 border-2 border-emerald-400 flex items-center justify-center font-black text-xs shadow-2xs">
                  {payeeName.charAt(0)}
                </div>
                <span className="text-xs font-bold text-gray-800">{payeeName}</span>
              </div>
            </div>

            <button
              onClick={handleSettleNow}
              className="w-full py-3 bg-[#0D2E14] hover:bg-[#14471f] text-white rounded-2xl font-black text-xs sm:text-sm shadow-xs active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Settle Now</span>
            </button>
          </div>
        ) : (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
            <p className="text-xs font-extrabold text-emerald-800">✅ Business 50-50 Ledger is perfectly balanced!</p>
          </div>
        )}
      </div>
    </div>
  );
};
export default BusinessPartnerSummaryCard;
