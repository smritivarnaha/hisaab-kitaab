import React, { useState } from 'react';
import { Transaction } from '../../types/finance';
import { formatGlobalDate } from '../../utils/dateUtils';
import { CategoryIcon } from '../common/CategoryIcon';
import { 
  Calendar, 
  Package, 
  Clock, 
  BarChart2, 
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Layers
} from 'lucide-react';

interface Props {
  transactions: Transaction[];
}

export const AnalyticsPanel: React.FC<Props> = ({ transactions }) => {
  const finalized = transactions.filter(t => !t.isPending);

  const [dateFilter, setDateFilter] = useState<'all' | '7days' | 'month'>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  // Track expanded dates in accordion view
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const toggleDateExpand = (date: string) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

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

    // Sort dates descending for newest first in daily bunches
    const sortedDates = Object.keys(map).sort((a, b) => b.localeCompare(a));
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

  // Filtered dates to display in timeline list (reverse for chart timeline X-axis)
  const chartSortedDates = [...sortedDates].sort((a, b) => a.localeCompare(b));
  const datesToDisplay = selectedDate ? [selectedDate] : sortedDates;

  return (
    <div className="space-y-4 font-outfit">
      
      {/* Top Filter & "Mota Mota Hisaab" Period Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white border border-[#E2E8E0] rounded-2xl shadow-2xs">
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-[#0D2E14]" />
          <span className="text-xs font-bold text-[#0D2E14] uppercase tracking-wider">
            Spending Timeline Matrix
          </span>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl">
          <button
            onClick={() => { setDateFilter('all'); setSelectedDate(null); }}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
              dateFilter === 'all' ? 'bg-[#0D2E14] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => { setDateFilter('7days'); setSelectedDate(null); }}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
              dateFilter === '7days' ? 'bg-[#0D2E14] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => { setDateFilter('month'); setSelectedDate(null); }}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
              dateFilter === 'month' ? 'bg-[#0D2E14] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            This Month
          </button>
        </div>
      </div>

      {/* Mota Mota Hisaab Standardized Mini Stats Cards (Unbolded & Uniform Color) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-2xl border border-[#E2E8E0] shadow-2xs space-y-1">
          <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block">Total Spent (Period)</span>
          <span className="text-xs sm:text-sm font-semibold text-slate-900 block">
            ₹{totalExpense.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-[#E2E8E0] shadow-2xs space-y-1">
          <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block">Total Items Purchased</span>
          <div className="flex items-center gap-1">
            <Package className="w-3.5 h-3.5 text-slate-700" />
            <span className="text-xs sm:text-sm font-semibold text-slate-900">{totalItemsCount} items</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-[#E2E8E0] shadow-2xs space-y-1">
          <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block">Highest Expense Day</span>
          <span className="text-xs sm:text-sm font-semibold text-slate-900 block truncate">
            {peakAmount > 0 ? `₹${peakAmount.toLocaleString('en-IN')} (${formatGlobalDate(peakDate)})` : 'N/A'}
          </span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-[#E2E8E0] shadow-2xs space-y-1">
          <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block">Average Spend / Day</span>
          <span className="text-xs sm:text-sm font-semibold text-slate-900 block">
            {sortedDates.length > 0
              ? `₹${Math.round(totalExpense / sortedDates.length).toLocaleString('en-IN')}`
              : '₹0'}
          </span>
        </div>
      </div>

      {/* 1. Interactive Timeline Graph (X-Axis: Dates, Height: Daily Spend Total) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#E2E8E0] shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-[#0D2E14]" />
            Daily Spend Timeline
          </h3>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate(null)}
              className="text-[10px] font-semibold text-emerald-700 hover:underline bg-emerald-50 px-2 py-0.5 rounded-full"
            >
              Show All Dates
            </button>
          )}
        </div>

        {/* X-Axis Timeline Bar Chart */}
        {chartSortedDates.length > 0 ? (
          <div className="pt-2 border-t border-gray-100 space-y-2">
            <div className="h-44 flex items-end justify-between gap-1.5 overflow-x-auto pb-2 pt-6 px-2 no-scrollbar">
              {chartSortedDates.map(date => {
                const dayData = dateMap[date];
                const heightPercent = Math.max(15, Math.round((dayData.total / maxBarHeight) * 100));
                const isSelected = selectedDate === date;

                return (
                  <div
                    key={date}
                    onClick={() => {
                      setSelectedDate(isSelected ? null : date);
                      // Auto expand date when clicked from bar chart
                      setExpandedDates(prev => ({ ...prev, [date]: true }));
                    }}
                    className="flex-1 min-w-[44px] flex flex-col items-center gap-1.5 cursor-pointer group transition-all"
                  >
                    {/* Amount Tooltip over Bar */}
                    <span className={`text-[10px] font-semibold transition-all group-hover:scale-110 ${
                      isSelected ? 'text-[#0D2E14] font-bold' : 'text-slate-600'
                    }`}>
                      ₹{dayData.total >= 1000 ? `${(dayData.total / 1000).toFixed(1)}k` : dayData.total}
                    </span>

                    {/* Bar Track Container with explicit height */}
                    <div className="h-28 sm:h-32 w-full flex items-end justify-center bg-emerald-50/60 rounded-xl p-1 border border-emerald-100/80">
                      <div
                        className={`w-full max-w-[24px] rounded-t-lg transition-all duration-300 ${
                          isSelected
                            ? 'bg-[#0D2E14] shadow-md ring-2 ring-emerald-500/30'
                            : 'bg-[#93E044] hover:bg-[#0D2E14]'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>

                    {/* Date Label on X-Axis */}
                    <span className={`text-[10px] font-medium tracking-tight text-center truncate w-full ${
                      isSelected ? 'text-[#0D2E14] font-bold' : 'text-slate-500'
                    }`}>
                      {formatGlobalDate(date).split(' ').slice(0, 2).join(' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-gray-400 font-medium">
            No spending records found for this period.
          </div>
        )}
      </div>

      {/* 2. Daily Bunches with Overlapping Category Avatar Chips & Click-to-Expand Accordion */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#E2E8E0] shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-[#0D2E14]" />
            Daily Spend Bunches (Mota Mota Hisaab)
          </h3>
          <span className="text-[10px] text-gray-400 font-medium">
            {datesToDisplay.length} Date {datesToDisplay.length === 1 ? 'Bunch' : 'Bunches'} • Click to view breakdown
          </span>
        </div>

        <div className="space-y-3">
          {datesToDisplay.map(date => {
            const data = dateMap[date];
            if (!data) return null;

            const isExpanded = !!expandedDates[date] || selectedDate === date;

            // Extract unique categories for overlapping circular chips
            const uniqueCategories = Array.from(new Set(data.items.map(i => i.category)));
            const visibleChips = uniqueCategories.slice(0, 4);
            const hiddenCount = uniqueCategories.length - visibleChips.length;

            return (
              <div 
                key={date} 
                className={`border rounded-2xl overflow-hidden transition-all duration-200 ${
                  isExpanded ? 'border-[#0D2E14] shadow-md bg-white' : 'border-gray-200 bg-white hover:border-emerald-600/50 shadow-2xs'
                }`}
              >
                {/* Daily Bunch Header Card (Clickable) */}
                <div 
                  onClick={() => toggleDateExpand(date)}
                  className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/80 transition-colors"
                >
                  {/* Left: Date Badge + Overlapping Circular Chips */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div>
                      <span className="text-xs sm:text-sm font-semibold text-slate-900 block">
                        {formatGlobalDate(date)}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium block">
                        {data.items.length} {data.items.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    {/* Overlapping Circular Category Chips */}
                    <div className="flex items-center pl-1">
                      {visibleChips.map((cat, idx) => (
                        <div 
                          key={cat} 
                          className="relative -ml-2.5 first:ml-0 rounded-full border-2 border-white bg-white shadow-2xs overflow-hidden flex items-center justify-center"
                          title={cat}
                        >
                          <CategoryIcon category={cat} size="sm" />
                        </div>
                      ))}
                      {hiddenCount > 0 && (
                        <div className="w-6 h-6 rounded-full bg-[#0D2E14] text-white text-[9px] font-semibold border-2 border-white flex items-center justify-center -ml-2.5 shadow-2xs">
                          +{hiddenCount}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Daily Subtotal + Expand/Collapse Chevron */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <span className="text-xs sm:text-sm font-semibold text-slate-900 block">
                        ₹{data.total.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[9px] font-medium text-emerald-700 block">
                        {isExpanded ? 'Click to collapse' : 'Click for items'}
                      </span>
                    </div>

                    <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      isExpanded ? 'bg-[#0D2E14] text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Itemized Table Breakdown */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-slate-50/60 p-3 space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-900 px-1">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-[#0D2E14]" />
                        Itemized Material Breakdown
                      </span>
                      <span className="text-gray-400 font-medium text-[10px]">
                        Exact Prices & Details
                      </span>
                    </div>

                    <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white shadow-2xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-100/70 text-[9px] uppercase font-semibold text-gray-500">
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
                              <td className="p-2 font-semibold text-slate-900">
                                {item.title || item.notes || 'Expense'}
                              </td>
                              <td className="p-2">
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 inline-flex items-center gap-1">
                                  {item.category}
                                </span>
                              </td>
                              <td className="p-2 text-[10px] font-medium text-gray-500 uppercase">
                                {item.paymentMethod || 'UPI'}
                              </td>
                              <td className="p-2 text-right font-semibold text-slate-900">
                                ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {datesToDisplay.length === 0 && (
            <div className="text-center py-8 text-xs text-gray-400 font-medium">
              No transactions match the selected date filter.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
