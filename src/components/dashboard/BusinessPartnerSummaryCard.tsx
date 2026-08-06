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
  Calendar,
  Building2,
  CheckCircle2
} from 'lucide-react';

export const BusinessPartnerSummaryCard: React.FC = () => {
  const { businessSettlement, addTransaction } = useFinance();
  const [isIncomeOpen, setIsIncomeOpen] = useState(true);
  const [isExpenseOpen, setIsExpenseOpen] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [settled, setSettled] = useState(false);

  const {
    totalIncome,
    totalExpense,
    netProfit,
    fairSharePerPartner,
    praveenIncome,
    praveenExpense,
    sarthakIncome,
    sarthakExpense,
    payerName,
    payeeName,
    amountDue,
    settlementText
  } = businessSettlement;

  // Compute period range e.g. "01 Aug 26 - 06 Aug 26"
  const getCurrentPeriodRange = () => {
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[now.getMonth()] || 'Aug';
    const day = String(now.getDate()).padStart(2, '0');
    return `01 ${month} ${year} - ${day} ${month} ${year}`;
  };

  const isLoss = netProfit < 0;

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
    <div className="space-y-3 font-outfit max-w-xl mx-auto animate-fadeIn max-w-full overflow-hidden">
      {/* 1. Top Header Banner */}
      <div className="bg-[#0D2E14] text-white p-4 rounded-3xl shadow-md border border-[#1b4e27] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[#14471f] border border-[#93E044]/40 text-emerald-300 flex items-center justify-center font-bold flex-shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
              Business Overview
            </h2>
            <span className="text-[10px] font-semibold text-emerald-300 block">
              {getCurrentPeriodRange()}
            </span>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-[#14471f] border border-[#93E044]/30 flex items-center justify-center text-emerald-300 flex-shrink-0">
          <Calendar className="w-4 h-4" />
        </div>
      </div>

      {/* 2. Income Accordion Card */}
      <div className="bg-white rounded-3xl p-4 border border-gray-200/90 shadow-xs space-y-2.5">
        <div 
          onClick={() => setIsIncomeOpen(prev => !prev)}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black flex-shrink-0">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-500 block">Income</span>
              <span className="text-lg font-black text-emerald-700">₹{totalIncome.toLocaleString('en-IN')}</span>
            </div>
          </div>
          <button className="p-1 text-gray-400 hover:text-gray-600 rounded-full">
            {isIncomeOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {isIncomeOpen && (
          <div className="pt-2.5 border-t border-gray-100 animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700 bg-emerald-50/60 p-2.5 rounded-2xl border border-emerald-100/80 divide-x divide-emerald-200/80">
              {/* Left: Praveen */}
              <div className="flex-1 pr-2.5 flex items-center justify-between min-w-0">
                <span className="flex items-center gap-1.5 text-emerald-950 font-extrabold truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block flex-shrink-0" />
                  Praveen
                </span>
                <span className="font-extrabold text-emerald-800 ml-1">₹{praveenIncome.toLocaleString('en-IN')}</span>
              </div>

              {/* Right: Sarthak */}
              <div className="flex-1 pl-2.5 flex items-center justify-between min-w-0">
                <span className="flex items-center gap-1.5 text-emerald-950 font-extrabold truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block flex-shrink-0" />
                  Sarthak
                </span>
                <span className="font-extrabold text-emerald-800 ml-1">₹{sarthakIncome.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Expenses Accordion Card */}
      <div className="bg-white rounded-3xl p-4 border border-gray-200/90 shadow-xs space-y-2.5">
        <div 
          onClick={() => setIsExpenseOpen(prev => !prev)}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center font-black flex-shrink-0">
              <ArrowDownRight className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-500 block">Expenses</span>
              <span className="text-lg font-black text-rose-600">₹{totalExpense.toLocaleString('en-IN')}</span>
            </div>
          </div>
          <button className="p-1 text-gray-400 hover:text-gray-600 rounded-full">
            {isExpenseOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {isExpenseOpen && (
          <div className="pt-2.5 border-t border-gray-100 animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700 bg-rose-50/60 p-2.5 rounded-2xl border border-rose-100/80 divide-x divide-rose-200/80">
              {/* Left: Praveen */}
              <div className="flex-1 pr-2.5 flex items-center justify-between min-w-0">
                <span className="flex items-center gap-1.5 text-rose-950 font-extrabold truncate">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block flex-shrink-0" />
                  Praveen
                </span>
                <span className="font-extrabold text-rose-600 ml-1">₹{praveenExpense.toLocaleString('en-IN')}</span>
              </div>

              {/* Right: Sarthak */}
              <div className="flex-1 pl-2.5 flex items-center justify-between min-w-0">
                <span className="flex items-center gap-1.5 text-rose-950 font-extrabold truncate">
                  <span className="w-2 h-2 rounded-full bg-rose-400 inline-block flex-shrink-0" />
                  Sarthak
                </span>
                <span className="font-extrabold text-rose-600 ml-1">₹{sarthakExpense.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Net Result & Each Share Card */}
      <div className={`rounded-3xl p-4 border flex items-center justify-between ${
        isLoss ? 'bg-rose-50/70 border-rose-200' : 'bg-emerald-50/70 border-emerald-200'
      }`}>
        {/* Left: Net Result */}
        <div className="flex-1 pr-3 border-r border-gray-200/80">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold text-gray-700">Net Result</span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
              isLoss ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}>
              {isLoss ? 'Loss' : 'Profit'}
            </span>
          </div>
          <p className={`text-lg sm:text-xl font-black ${isLoss ? 'text-rose-600' : 'text-emerald-700'}`}>
            {isLoss ? '-' : ''}₹{Math.abs(netProfit).toLocaleString('en-IN')}
          </p>
        </div>

        {/* Right: Each Share */}
        <div className="flex-1 pl-4 text-right">
          <span className="text-xs font-extrabold text-gray-700 block mb-1">Each Share</span>
          <p className={`text-lg sm:text-xl font-black ${isLoss ? 'text-rose-600' : 'text-emerald-700'}`}>
            {isLoss ? '-' : ''}₹{Math.abs(fairSharePerPartner).toLocaleString('en-IN')}
            <span className="text-[10px] text-gray-500 font-bold block">each</span>
          </p>
        </div>
      </div>

      {/* 5. Settlement Flow Card */}
      <div className="bg-[#FFFBEB] rounded-3xl p-4 border border-amber-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-amber-100/80 pb-2">
          <span className="text-xs font-extrabold text-amber-900">Settlement</span>
          <Users className="w-4 h-4 text-amber-800" />
        </div>

        {settled ? (
          <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-2xl text-center space-y-1 animate-fadeIn">
            <CheckCircle2 className="w-6 h-6 text-emerald-700 mx-auto" />
            <p className="text-xs font-black text-emerald-900">Settlement Recorded to Business Passbook!</p>
          </div>
        ) : amountDue > 0 && payerName && payeeName ? (
          <div className="space-y-3">
            <div className="flex items-center justify-around py-2">
              {/* Payer Avatar */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 border-2 border-emerald-300 flex items-center justify-center font-black text-base shadow-2xs">
                  {payerName.charAt(0)}
                </div>
                <span className="text-xs font-bold text-gray-800">{payerName}</span>
              </div>

              {/* Amount Flow */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">Pays</span>
                <div className="flex items-center gap-1 text-amber-900 font-black text-lg sm:text-xl">
                  <span>₹{amountDue.toLocaleString('en-IN')}</span>
                  <ArrowRight className="w-5 h-5 text-amber-800" />
                </div>
              </div>

              {/* Payee Avatar */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-full bg-emerald-200 text-emerald-900 border-2 border-emerald-400 flex items-center justify-center font-black text-base shadow-2xs">
                  {payeeName.charAt(0)}
                </div>
                <span className="text-xs font-bold text-gray-800">{payeeName}</span>
              </div>
            </div>

            <button
              onClick={handleSettleNow}
              className="w-full py-3 bg-[#0D2E14] hover:bg-[#14471f] text-white rounded-2xl font-black text-xs sm:text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
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

      {/* 6. View Details Collapsible toggle */}
      <div className="text-center pt-1">
        <button
          onClick={() => setShowDetails(prev => !prev)}
          className="text-xs font-bold text-emerald-800 hover:text-emerald-900 inline-flex items-center gap-1 bg-white border border-emerald-200 px-3 py-1.5 rounded-full shadow-2xs transition-all cursor-pointer"
        >
          <span>{showDetails ? 'Hide Details' : 'View Details'}</span>
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {showDetails && (
        <div className="p-4 bg-white border border-gray-200 rounded-3xl space-y-2 text-xs text-gray-700 animate-fadeIn">
          <h4 className="font-extrabold text-gray-900 border-b border-gray-100 pb-1.5">Detailed Ledger Breakdown</h4>
          <div className="flex justify-between">
            <span>Praveen Collected Income:</span>
            <span className="font-bold text-emerald-700">₹{praveenIncome.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between">
            <span>Praveen Spent Out-of-Pocket:</span>
            <span className="font-bold text-rose-600">₹{praveenExpense.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between">
            <span>Sarthak Collected Income:</span>
            <span className="font-bold text-emerald-700">₹{sarthakIncome.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between">
            <span>Sarthak Spent Out-of-Pocket:</span>
            <span className="font-bold text-rose-600">₹{sarthakExpense.toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}
    </div>
  );
};
export default BusinessPartnerSummaryCard;
