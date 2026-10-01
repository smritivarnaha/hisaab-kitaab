import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  Check, 
  Sparkles
} from 'lucide-react';
import { Transaction } from '../../types/finance';

interface PeriodSelectorProps {
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  transactions?: Transaction[];
  theme?: 'light' | 'emerald';
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  selectedPeriod,
  onPeriodChange,
  transactions = [],
  theme = 'light'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Extract initial browse year
  const getInitialYear = () => {
    if (/^\d{4}-\d{2}$/.test(selectedPeriod)) {
      return parseInt(selectedPeriod.split('-')[0], 10);
    }
    return currentYear;
  };

  const [browseYear, setBrowseYear] = useState<number>(getInitialYear());

  // Keep browseYear in sync when selectedPeriod changes
  useEffect(() => {
    if (/^\d{4}-\d{2}$/.test(selectedPeriod)) {
      setBrowseYear(parseInt(selectedPeriod.split('-')[0], 10));
    }
  }, [selectedPeriod]);

  // Set of year-month strings that have transactions (e.g. '2026-09')
  const activeMonthsSet = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => {
      let d: Date | null = null;
      if (t.date) {
        const parts = t.date.split('T')[0].split('-');
        if (parts.length === 3) {
          d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
          d = new Date(t.timestamp || t.date);
        }
      } else if (t.timestamp) {
        d = new Date(t.timestamp);
      }
      if (d && !isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        set.add(key);
      }
    });
    return set;
  }, [transactions]);

  // Resolve current active year & month from selectedPeriod
  const activeYearMonth = useMemo(() => {
    if (selectedPeriod === 'this_month') {
      return { year: currentYear, month: currentMonth };
    }
    if (selectedPeriod === 'last_month') {
      const lmYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const lmMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      return { year: lmYear, month: lmMonth };
    }
    if (/^\d{4}-\d{2}$/.test(selectedPeriod)) {
      const [y, m] = selectedPeriod.split('-').map(Number);
      return { year: y, month: m - 1 };
    }
    return null;
  }, [selectedPeriod, currentYear, currentMonth]);

  // Handle jump to previous month via left chevron
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    let y = currentYear;
    let m = currentMonth;
    if (activeYearMonth) {
      y = activeYearMonth.year;
      m = activeYearMonth.month;
    }
    const prevDate = new Date(y, m - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth();
    const formatted = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;
    onPeriodChange(formatted);
  };

  // Handle jump to next month via right chevron
  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    let y = currentYear;
    let m = currentMonth;
    if (activeYearMonth) {
      y = activeYearMonth.year;
      m = activeYearMonth.month;
    }
    const nextDate = new Date(y, m + 1, 1);
    const nextYear = nextDate.getFullYear();
    const nextMonth = nextDate.getMonth();
    const formatted = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`;
    onPeriodChange(formatted);
  };

  // Get readable label on button
  const displayLabel = useMemo(() => {
    if (selectedPeriod === 'today') return 'Today';
    if (selectedPeriod === 'this_year') return `Year ${currentYear}`;
    if (selectedPeriod === 'all') return 'All Time';
    
    if (selectedPeriod === 'this_month') {
      return `${FULL_MONTH_NAMES[currentMonth]} ${currentYear}`;
    }
    if (selectedPeriod === 'last_month') {
      const lmYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const lmMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      return `${FULL_MONTH_NAMES[lmMonth]} ${lmYear}`;
    }
    if (/^\d{4}-\d{2}$/.test(selectedPeriod)) {
      const [y, m] = selectedPeriod.split('-').map(Number);
      return `${FULL_MONTH_NAMES[m - 1]} ${y}`;
    }
    return selectedPeriod;
  }, [selectedPeriod, currentYear, currentMonth]);

  // Check if a specific month tile is selected
  const isMonthSelected = (year: number, monthIndex: number) => {
    if (selectedPeriod === 'this_month') {
      return year === currentYear && monthIndex === currentMonth;
    }
    if (selectedPeriod === 'last_month') {
      const lmYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const lmMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      return year === lmYear && monthIndex === lmMonth;
    }
    if (/^\d{4}-\d{2}$/.test(selectedPeriod)) {
      const [y, m] = selectedPeriod.split('-').map(Number);
      return year === y && monthIndex === m - 1;
    }
    return false;
  };

  // Styles based on theme
  const isEmerald = theme === 'emerald';
  const triggerContainerClass = isEmerald
    ? 'bg-[#14471f] hover:bg-[#1a5526] border border-[#93E044]/50 text-emerald-100'
    : 'bg-[#FAFCF9] hover:bg-white border border-gray-200/90 text-gray-800 shadow-2xs';

  const chevronButtonClass = isEmerald
    ? 'p-1 hover:bg-[#1f632d] text-emerald-300 hover:text-white rounded-full transition-colors'
    : 'p-1 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-full transition-colors';

  return (
    <div className="relative inline-block text-left z-50">
      {/* Trigger Group: [ ‹ ] [ 📅 Month Year ▾ ] [ › ] */}
      <div className={`flex items-center rounded-full p-0.5 gap-0.5 transition-all ${triggerContainerClass}`}>
        <button
          type="button"
          onClick={handlePrevMonth}
          title="Previous Month"
          className={chevronButtonClass}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold select-none cursor-pointer focus:outline-none"
        >
          <Calendar className={`w-3.5 h-3.5 ${isEmerald ? 'text-[#93E044]' : 'text-emerald-700'}`} />
          <span className="truncate max-w-[130px] sm:max-w-[170px]">{displayLabel}</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''} ${isEmerald ? 'text-emerald-300' : 'text-gray-500'}`} />
        </button>

        <button
          type="button"
          onClick={handleNextMonth}
          title="Next Month"
          className={chevronButtonClass}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop click-away */}
          <div 
            className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[0.5px]"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white text-gray-900 rounded-3xl shadow-2xl border border-gray-200 z-50 p-3 sm:p-4 space-y-3 animate-fadeIn">
            {/* 1. Header & Quick Filter Pills */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-gray-400 px-1">
                <span>Select Period</span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                  Live Sync
                </span>
              </div>

              {/* Quick shortcut pills */}
              <div className="grid grid-cols-4 gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => { onPeriodChange('this_month'); setIsOpen(false); }}
                  className={`px-1.5 py-1 rounded-xl text-[11px] font-bold text-center transition-all ${
                    selectedPeriod === 'this_month'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => { onPeriodChange('today'); setIsOpen(false); }}
                  className={`px-1.5 py-1 rounded-xl text-[11px] font-bold text-center transition-all ${
                    selectedPeriod === 'today'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => { onPeriodChange('this_year'); setIsOpen(false); }}
                  className={`px-1.5 py-1 rounded-xl text-[11px] font-bold text-center transition-all ${
                    selectedPeriod === 'this_year'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  This Year
                </button>
                <button
                  type="button"
                  onClick={() => { onPeriodChange('all'); setIsOpen(false); }}
                  className={`px-1.5 py-1 rounded-xl text-[11px] font-bold text-center transition-all ${
                    selectedPeriod === 'all'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  All Time
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100" />

            {/* 2. Interactive Month & Year Navigator */}
            <div className="space-y-2">
              {/* Year Selector */}
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => setBrowseYear(y => y - 1)}
                  className="p-1 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Previous Year"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="text-center">
                  <span className="text-sm font-black text-gray-900 tracking-tight block">
                    {browseYear}
                  </span>
                  <span className="text-[9px] font-semibold text-gray-400">
                    Jump to any month
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setBrowseYear(y => y + 1)}
                  className="p-1 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Next Year"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* 12 Months 4x3 Grid */}
              <div className="grid grid-cols-4 gap-1.5">
                {MONTH_NAMES.map((monthName, idx) => {
                  const isSelected = isMonthSelected(browseYear, idx);
                  const isCurrent = browseYear === currentYear && idx === currentMonth;
                  const monthKey = `${browseYear}-${String(idx + 1).padStart(2, '0')}`;
                  const hasData = activeMonthsSet.has(monthKey);

                  return (
                    <button
                      key={monthName}
                      type="button"
                      onClick={() => {
                        onPeriodChange(monthKey);
                        setIsOpen(false);
                      }}
                      className={`relative py-2 px-1 rounded-2xl text-xs font-bold flex flex-col items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/20 font-black scale-102 ring-2 ring-emerald-600'
                          : isCurrent
                            ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-gray-900 border border-gray-100'
                      }`}
                    >
                      <span className="text-[11px] sm:text-xs">{monthName}</span>
                      
                      {/* Active indicator dot or badge */}
                      <div className="flex items-center gap-0.5 mt-0.5 h-1.5">
                        {isSelected && (
                          <Check className="w-2.5 h-2.5 text-white" />
                        )}
                        {!isSelected && hasData && (
                          <span 
                            className="w-1.5 h-1.5 rounded-full bg-emerald-500" 
                            title="Has transactions"
                          />
                        )}
                        {!isSelected && isCurrent && !hasData && (
                          <span 
                            className="text-[8px] leading-none text-emerald-600 font-extrabold"
                          >
                            now
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PeriodSelector;
