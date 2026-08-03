import React, { useState } from 'react';
import { Transaction, Category } from '../../types/finance';
import { CategoryIcon } from '../common/CategoryIcon';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard, 
  ShoppingBag, 
  Calendar,
  Layers,
  ArrowUpRight
} from 'lucide-react';

interface Props {
  transactions: Transaction[];
}

export const AnalyticsPanel: React.FC<Props> = ({ transactions }) => {
  const finalized = transactions.filter(t => !t.isPending);
  
  // Extract all unique months from transactions (format: YYYY-MM)
  const availableMonths = Array.from(new Set(
    finalized.map(t => {
      if (!t.date) return '';
      return t.date.substring(0, 7); // "YYYY-MM"
    }).filter(Boolean)
  )).sort((a, b) => b.localeCompare(a)); // Newest first

  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Filter transactions by selected month
  const monthTransactions = selectedMonth === 'all'
    ? finalized
    : finalized.filter(t => t.date && t.date.startsWith(selectedMonth));

  // Calculations
  const totalIncome = monthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const totalExpense = monthTransactions
    .filter(t => t.type === 'expense' || t.type === 'lent')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  // Category breakdown
  const categoryTotals: Record<Category, { total: number; count: number }> = {} as any;
  let maxExpense = 0;
  let maxExpenseTitle = '';

  monthTransactions.forEach(t => {
    if (t.type === 'expense' || t.type === 'lent') {
      if (!categoryTotals[t.category]) {
        categoryTotals[t.category] = { total: 0, count: 0 };
      }
      categoryTotals[t.category].total += t.amount;
      categoryTotals[t.category].count += 1;

      if (t.amount > maxExpense) {
        maxExpense = t.amount;
        maxExpenseTitle = t.title || t.category;
      }
    }
  });

  const sortedCategories = Object.entries(categoryTotals)
    .map(([cat, data]) => ({
      category: cat as Category,
      total: data.total,
      count: data.count,
      percentage: totalExpense > 0 ? Math.round((data.total / totalExpense) * 100) : 0
    }))
    .sort((a, b) => b.total - a.total);

  // Preferred payment method
  const paymentMethodCounts: Record<string, number> = {};
  monthTransactions.forEach(t => {
    paymentMethodCounts[t.paymentMethod] = (paymentMethodCounts[t.paymentMethod] || 0) + 1;
  });
  const preferredPayment = Object.entries(paymentMethodCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  // Format month name
  const formatMonthName = (monthStr: string) => {
    if (monthStr === 'all') return 'All Time';
    try {
      const [year, month] = monthStr.split('-');
      const d = new Date(Number(year), Number(month) - 1, 1);
      return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    } catch {
      return monthStr;
    }
  };

  return (
    <div className="space-y-4 font-outfit">
      {/* Month Selector Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-gray-200">
        <button
          onClick={() => setSelectedMonth('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
            selectedMonth === 'all'
              ? 'bg-[#0D2E14] text-white shadow-xs'
              : 'bg-white text-gray-600 border border-[#E2E8E0] hover:bg-gray-50'
          }`}
        >
          All Time ({finalized.length})
        </button>
        {availableMonths.map(month => (
          <button
            key={month}
            onClick={() => setSelectedMonth(month)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              selectedMonth === month
                ? 'bg-[#0D2E14] text-white shadow-xs'
                : 'bg-white text-gray-600 border border-[#E2E8E0] hover:bg-gray-50'
            }`}
          >
            {formatMonthName(month)}
          </button>
        ))}
      </div>

      {/* Monthly Mini Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-2xl border border-[#E2E8E0] shadow-2xs space-y-1">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Income</span>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-green-600" />
            <span className="text-sm font-bold text-green-700">₹{totalIncome.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-[#E2E8E0] shadow-2xs space-y-1">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Expenses</span>
          <div className="flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            <span className="text-sm font-bold text-red-600">₹{totalExpense.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-[#E2E8E0] shadow-2xs space-y-1">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Net Savings</span>
          <span className={`text-sm font-bold block ${netSavings >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            ₹{netSavings.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-[#E2E8E0] shadow-2xs space-y-1">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Savings Rate</span>
          <span className="text-sm font-bold text-[#0D2E14] block">
            {savingsRate}%
          </span>
        </div>
      </div>

      {/* Main Analytics Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category Breakdown list */}
        <div className="bg-white rounded-3xl p-4 border border-[#E2E8E0] shadow-2xs space-y-3">
          <h3 className="font-bold text-sm text-[#0D2E14] flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#0D2E14]" />
            Category Distribution
          </h3>

          <div className="space-y-3.5">
            {sortedCategories.map(item => (
              <div key={item.category} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <CategoryIcon category={item.category} size="sm" />
                    <span className="font-bold text-[#0D2E14]">{item.category}</span>
                    <span className="text-gray-400 text-[10px] font-medium">({item.count} items)</span>
                  </div>
                  <span className="font-extrabold text-[#0D2E14]">
                    ₹{item.total.toLocaleString('en-IN')} ({item.percentage}%)
                  </span>
                </div>
                {/* Visual Progress Bar */}
                <div className="w-full h-2 bg-[#F3F5F1] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#93E044] rounded-full transition-all duration-500"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}

            {sortedCategories.length === 0 && (
              <div className="text-center py-8 text-xs text-gray-500 font-bold">
                No expense transactions found for this period.
              </div>
            )}
          </div>
        </div>

        {/* Transaction Stats Panel */}
        <div className="space-y-4">
          {/* Key Insights Card */}
          <div className="bg-white rounded-3xl p-4 border border-[#E2E8E0] shadow-2xs space-y-3">
            <h3 className="font-bold text-sm text-[#0D2E14] flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#0D2E14]" />
              Key Spend Insights
            </h3>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-2.5 bg-[#FAFCF9] border border-gray-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-amber-600" />
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Peak Expense</span>
                    <span className="text-xs font-bold text-[#0D2E14]">{maxExpenseTitle || 'N/A'}</span>
                  </div>
                </div>
                <span className="text-xs font-black text-red-600">
                  {maxExpense > 0 ? `₹${maxExpense.toLocaleString('en-IN')}` : 'N/A'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-[#FAFCF9] border border-gray-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Primary Payment Method</span>
                    <span className="text-xs font-bold text-[#0D2E14]">{preferredPayment}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-[#FAFCF9] border border-gray-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Average Spend Size</span>
                    <span className="text-xs font-bold text-[#0D2E14]">
                      {monthTransactions.length > 0
                        ? `₹${Math.round(totalExpense / monthTransactions.length).toLocaleString('en-IN')}`
                        : '₹0'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Monthwise Transaction List Feed */}
          <div className="bg-white rounded-3xl p-4 border border-[#E2E8E0] shadow-2xs space-y-3">
            <h3 className="font-bold text-sm text-[#0D2E14] flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#0D2E14]" />
              Selected Period Feed
            </h3>

            <div className="max-h-56 overflow-y-auto space-y-2 pr-1 no-scrollbar">
              {monthTransactions.slice(0, 10).map(tx => {
                const isCredit = tx.type === 'income';
                return (
                  <div key={tx.id} className="flex items-center justify-between gap-2 p-2 bg-[#FAFCF9] border border-gray-100 rounded-xl text-xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <CategoryIcon category={tx.category} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[#0D2E14] truncate">{tx.title || tx.category}</p>
                        <p className="text-[10px] text-gray-500 font-semibold">{tx.date}</p>
                      </div>
                    </div>
                    <span className={`font-black ${isCredit ? 'text-green-700' : 'text-red-600'}`}>
                      {isCredit ? '+' : '-'}₹{Number(tx.amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                );
              })}

              {monthTransactions.length === 0 && (
                <div className="text-center py-6 text-xs text-gray-500 font-bold">
                  No records to display.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
