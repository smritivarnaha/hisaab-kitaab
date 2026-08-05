import React from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Building2, TrendingUp, TrendingDown, ArrowRightLeft, UserCheck, ShieldCheck } from 'lucide-react';

export const BusinessPartnerSummaryCard: React.FC = () => {
  const { businessSettlement } = useFinance();
  const {
    totalIncome,
    totalExpense,
    netProfit,
    fairSharePerPartner,
    praveenIncome,
    praveenExpense,
    praveenCashHeld,
    sarthakIncome,
    sarthakExpense,
    sarthakCashHeld,
    settlementText
  } = businessSettlement;

  return (
    <div className="bg-white rounded-3xl p-3.5 sm:p-5 border border-[#E2E8E0] shadow-xl space-y-3.5 font-outfit animate-fadeIn max-w-full overflow-hidden">
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-900 flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-[#0D2E14] flex items-center gap-1.5">
              Business 50-50 Ledger
            </h3>
            <p className="text-[11px] text-gray-500 font-medium">Shared Business Revenue & Equal Partner Profit Split</p>
          </div>
        </div>
        <span className="text-[10px] font-extrabold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-indigo-600" />
          50% Split
        </span>
      </div>

      {/* Top 4 Business Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-emerald-50/80 border border-emerald-200/80 p-3 rounded-2xl">
          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
            <TrendingUp className="w-3 h-3 text-emerald-600" />
            Total Revenue
          </div>
          <p className="text-base sm:text-lg font-black text-emerald-700">₹{totalIncome.toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-red-50/80 border border-red-200/80 p-3 rounded-2xl">
          <div className="flex items-center gap-1 text-[10px] font-bold text-red-800 uppercase tracking-wider mb-1">
            <TrendingDown className="w-3 h-3 text-red-600" />
            Total Spent
          </div>
          <p className="text-base sm:text-lg font-black text-red-600">₹{totalExpense.toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Net Profit
          </div>
          <p className={`text-base sm:text-lg font-black ${netProfit >= 0 ? 'text-emerald-800' : 'text-red-600'}`}>
            ₹{netProfit.toLocaleString('en-IN')}
          </p>
        </div>

        <div className="bg-indigo-50/80 border border-indigo-200/80 p-3 rounded-2xl">
          <div className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider mb-1">
            50% Fair Share
          </div>
          <p className="text-base sm:text-lg font-black text-indigo-700">₹{fairSharePerPartner.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Partner Breakdown: Praveen vs Sarthak */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Praveen Partner Card */}
        <div className="p-3.5 bg-emerald-50/40 border border-emerald-200/90 rounded-2xl space-y-1.5">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-1.5">
            <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
              Praveen
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Partner</span>
          </div>

          <div className="text-[11px] space-y-1 text-gray-700 font-medium">
            <div className="flex justify-between">
              <span>Collected Income:</span>
              <span className="font-bold text-emerald-700">₹{praveenIncome.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span>Out-of-Pocket Spent:</span>
              <span className="font-bold text-red-600">₹{praveenExpense.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-emerald-100 font-bold text-gray-900">
              <span>Net Cash Held:</span>
              <span className="text-emerald-800">₹{praveenCashHeld.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Sarthak Partner Card */}
        <div className="p-3.5 bg-indigo-50/40 border border-indigo-200/90 rounded-2xl space-y-1.5">
          <div className="flex items-center justify-between border-b border-indigo-100 pb-1.5">
            <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-indigo-700" />
              Sarthak
            </span>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">Partner</span>
          </div>

          <div className="text-[11px] space-y-1 text-gray-700 font-medium">
            <div className="flex justify-between">
              <span>Collected Income:</span>
              <span className="font-bold text-emerald-700">₹{sarthakIncome.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span>Out-of-Pocket Spent:</span>
              <span className="font-bold text-red-600">₹{sarthakExpense.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-indigo-100 font-bold text-gray-900">
              <span>Net Cash Held:</span>
              <span className="text-indigo-800">₹{sarthakCashHeld.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Auto Settlement Banner */}
      <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-center gap-2.5 max-w-full overflow-hidden">
        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
          <ArrowRightLeft className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[9px] font-extrabold text-amber-800 uppercase tracking-wider block">Auto Equalization Settlement</span>
          <p className="text-xs sm:text-sm font-black text-amber-900 leading-snug break-words">{settlementText}</p>
        </div>
      </div>
    </div>
  );
};
