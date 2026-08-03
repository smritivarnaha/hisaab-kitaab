import React, { useState } from 'react';
import { Transaction } from '../../types/finance';
import { formatGlobalDate } from '../../utils/dateUtils';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Package, 
  Clock, 
  BarChart2, 
  ShoppingBag,
  Filter,
  CheckCircle2
} from 'lucide-react';

interface Props {
  transactions: Transaction[];
}

export const AnalyticsPanel: React.FC<Props> = ({ transactions }) => {
  const finalized = transactions.filter(t => !t.isPending);

  const [dateFilter, setDateFilter] = useState<'all' | '7days' | 'month'>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Group transactions by date string YYYY-MM-DD
  const groupTransactionsByDate = () => {
    const map: Record<string, { total: number; items: Transaction[] }> = {};

    let list = finalized;
    const now = new Date();

    if (dateFilter === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      list = finalized.filter(t => {
        if (!t.date) return false;
        return new Date(t.date) >= sevenDaysAgo;
      });
    } else if (dateFilter === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      list = finalized.filter(t => {
        if (!t.date) return false;
        return new Date(t.date) >= firstDay;
      });
    }

    list.forEach(t => {
      const d = t.date || new Date(t.timestamp).toISOString().split('T')[0];
      if (!map[d]) {
        map[d] = { total: 0, items: [] };
      }
      if (t.type === 'expense' || t.type === 'lent') {
        map[d].total += Number(t.amount || 0);
      }
      map[d].items.push(t);
    });

    // Sort dates ascending for timeline X-axis
    const sortedDates = Object.keys(map).sort((a, b) => a.localeCompare(b));
    return { map, sortedDates };
  };

  const { map: dateMap, sortedDates } = groupTransactionsByDate();

  // Overall totals for selected filter
  const totalExpense = Object.values(dateMap).reduce((sum, d) => sum + d.total, 0);
  const totalItemsCount = Object.values(dateMap).reduce((sum, d) => sum + d.items.length, 0);

  // Find peak expense date
  let peakDate = '';
  let peakAmount = 0;
  Object.entries(dateMap).forEach(([date, data]) => {
    if (data.total > peakAmount) {
      peakAmount = data.total;
      peakDate = date;
    }
  });

  const maxBarHeight = peakAmount > 0 ? peakAmount : 1;

  // Filtered dates to display in timeline list
  const datesToDisplay = selectedDate ? [selectedDate] : sortedDates;

  return (
    <div className="space-y-4 font-outfit">
      
      {/* Top Filter & "Mota Mota Hisaab" Period Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white border border-[#E2E8E0] rounded-2xl shadow-2xs">
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-[#0D2E14]" />
          <span className="text-xs font-extrabold text-[#0D2E14] uppercase tracking-wider">
            Spending Timeline Matrix
          </span>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl">
          <button
            onClick={() => { setDateFilter('all'); setSelectedDate(null); }}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
              dateFilter === 'all' ? 'bg-[#0D2E14] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => { setDateFilter('7days'); setSelectedDate(null); }}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
              dateFilter === '7days' ? 'bg-[#0D2E14] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => { setDateFilter('month'); setSelectedDate(null); }}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
              dateFilter === 'month' ? 'bg-[#0D2E14] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            This Month
          </button>
        </div>
      </div>

      {/* Mota Mota Hisaab Mini Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-2xl border border-[#E2E8E0] shadow-2xs space-y-1">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Total Spent (Period)</span>
          <span className="text-sm sm:text-base font-extrabold text-red-600 block">
            ₹{totalExpense.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-[#E2E8E0] shadow-2xs space-y-1">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Total Items Purchased</span>
          <div className="flex items-center gap-1">
            <Package className="w-3.5 h-3.5 text-[#0D2E14]" />
            <span className="text-sm sm:text-base font-extrabold text-[#0D2E14]">{totalItemsCount} items</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-[#E2E8E0] shadow-2xs space-y-1">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Highest Expense Day</span>
          <span className="text-xs sm:text-sm font-extrabold text-amber-700 block truncate">
            {peakAmount > 0 ? `₹${peakAmount.toLocaleString('en-IN')} (${formatGlobalDate(peakDate)})` : 'N/A'}
          </span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-[#E2E8E0] shadow-2xs space-y-1">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Average Spend / Day</span>
          <span className="text-sm sm:text-base font-extrabold text-emerald-700 block">
            {sortedDates.length > 0
              ? `₹${Math.round(totalExpense / sortedDates.length).toLocaleString('en-IN')}`
              : '₹0'}
          </span>
        </div>
      </div>

      {/* 1. Interactive Timeline Graph (X-Axis: Dates, Height: Daily Spend Total) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#E2E8E0] shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xs sm:text-sm text-[#0D2E14] flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-[#0D2E14]" />
            Daily Spend Timeline (X-Axis: Dates | Y-Axis: Daily Totals)
          </h3>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate(null)}
              className="text-[10px] font-bold text-emerald-700 hover:underline bg-emerald-50 px-2 py-0.5 rounded-full"
            >
              Show All Dates
            </button>
          )}
        </div>

        {/* X-Axis Timeline Bar Chart */}
        {sortedDates.length > 0 ? (
          <div className="pt-4 border-t border-gray-100 space-y-2">
            <div className="h-44 flex items-end justify-between gap-1.5 overflow-x-auto pb-2 pt-6 px-2 no-scrollbar">
              {sortedDates.map(date => {
                const dayData = dateMap[date];
                const heightPercent = Math.max(12, Math.round((dayData.total / maxBarHeight) * 100));
                const isSelected = selectedDate === date;

                return (
                  <div
                    key={date}
                    onClick={() => setSelectedDate(isSelected ? null : date)}
                    className="flex-1 min-w-[38px] flex flex-col items-center gap-1.5 cursor-pointer group transition-all"
                  >
                    {/* Amount Tooltip over Bar */}
                    <span className={`text-[9px] font-extrabold transition-all group-hover:scale-110 ${
                      isSelected ? 'text-[#0D2E14] font-black' : 'text-gray-500'
                    }`}>
                      ₹{dayData.total > 1000 ? `${(dayData.total / 1000).toFixed(1)}k` : dayData.total}
                    </span>

                    {/* Bar Container */}
                    <div className="w-full flex-1 flex items-end justify-center">
                      <div
                        className={`w-full max-w-[28px] rounded-t-lg transition-all duration-300 ${
                          isSelected
                            ? 'bg-[#0D2E14] shadow-md scale-105'
                            : 'bg-[#93E044] hover:bg-[#0D2E14]/80'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>

                    {/* Date Label on X-Axis */}
                    <span className={`text-[9px] font-bold tracking-tight text-center truncate w-full ${
                      isSelected ? 'text-[#0D2E14] font-extrabold' : 'text-gray-400'
                    }`}>
                      {formatGlobalDate(date).split(' ').slice(0, 2).join(' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-gray-400 font-bold">
            No spending records found for this period.
          </div>
        )}
      </div>

      {/* 2. Detailed Itemized Material Matrix per Date */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#E2E8E0] shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xs sm:text-sm text-[#0D2E14] flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-[#0D2E14]" />
            Itemized Material & Price Matrix (Mota Mota Hisaab)
          </h3>
          <span className="text-[10px] text-gray-400 font-bold">
            {datesToDisplay.length} Date {datesToDisplay.length === 1 ? 'Entry' : 'Entries'}
          </span>
        </div>

        <div className="space-y-4">
          {datesToDisplay.map(date => {
            const data = dateMap[date];
            if (!data) return null;

            return (
              <div key={date} className="border border-gray-200 rounded-2xl overflow-hidden bg-slate-50/60 shadow-2xs">
                {/* Date Row Header */}
                <div className="px-3.5 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#0D2E14]" />
                    <span className="text-xs font-extrabold text-[#0D2E14]">
                      {formatGlobalDate(date)}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">
                      ({data.items.length} {data.items.length === 1 ? 'item' : 'items'})
                    </span>
                  </div>
                  <span className="text-xs font-black text-red-600">
                    Daily Subtotal: ₹{data.total.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Table of Materials & Prices */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-100/70 text-[9px] uppercase font-bold text-gray-500">
                        <th className="p-2 w-6 text-center">#</th>
                        <th className="p-2">Material / Item Title</th>
                        <th className="p-2">Category</th>
                        <th className="p-2">Mode</th>
                        <th className="p-2 text-right">Price (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((item, idx) => (
                        <tr key={item.id} className="border-b border-gray-100 bg-white hover:bg-emerald-50/40 transition-colors">
                          <td className="p-2 text-[10px] font-semibold text-gray-400 text-center">{idx + 1}</td>
                          <td className="p-2 font-bold text-gray-900">
                            {item.title || item.notes || 'Expense'}
                          </td>
                          <td className="p-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-2 text-[10px] font-medium text-gray-500 uppercase">
                            {item.paymentMethod || 'UPI'}
                          </td>
                          <td className="p-2 text-right font-extrabold text-red-600">
                            ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {datesToDisplay.length === 0 && (
            <div className="text-center py-8 text-xs text-gray-400 font-bold">
              No transactions match the selected date filter.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
