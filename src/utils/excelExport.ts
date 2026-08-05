import * as XLSX from 'xlsx';
import { Transaction } from '../types/finance';
import { formatGlobalDate } from './dateUtils';

export function exportToExcel(
  transactions: Transaction[],
  exportType: 'all' | 'monthly',
  selectedMonthYear?: string // e.g. "2026-08"
) {
  // Filter transactions based on selection
  let txList = transactions.filter(t => !t.isPending);

  if (exportType === 'monthly' && selectedMonthYear) {
    txList = txList.filter(t => {
      const dStr = t.date || (t.timestamp ? new Date(t.timestamp).toISOString().split('T')[0] : '');
      return dStr.startsWith(selectedMonthYear);
    });
  }

  // Sort by date descending
  txList.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : a.timestamp;
    const db = b.date ? new Date(b.date).getTime() : b.timestamp;
    return db - da;
  });

  const workbook = XLSX.utils.book_new();

  // -------------------------------------------------------------
  // Sheet 1: Passbook Ledger (Complete Transaction List)
  // -------------------------------------------------------------
  const passbookData = txList.map((t, index) => ({
    'S.No': index + 1,
    'Date': formatGlobalDate(t.date || t.timestamp),
    'Description / Title': t.title || t.category,
    'Category': t.category,
    'Entry Type': t.type === 'income' ? 'Income' : t.type === 'lent' ? 'Lent' : t.type === 'borrowed' ? 'Borrowed' : 'Spent',
    'Payment Method': t.paymentMethod,
    'Amount (₹)': t.amount,
    'Person / Party': t.person || '',
    'Notes': t.notes || ''
  }));

  const passbookSheet = XLSX.utils.json_to_sheet(passbookData);
  
  // Set column widths
  passbookSheet['!cols'] = [
    { wch: 6 },  // S.No
    { wch: 14 }, // Date
    { wch: 28 }, // Title
    { wch: 18 }, // Category
    { wch: 12 }, // Type
    { wch: 16 }, // Method
    { wch: 14 }, // Amount
    { wch: 16 }, // Person
    { wch: 30 }  // Notes
  ];

  XLSX.utils.book_append_sheet(workbook, passbookSheet, 'Passbook Ledger');

  // -------------------------------------------------------------
  // Sheet 2: Monthly Summary
  // -------------------------------------------------------------
  const monthGroup: Record<string, { income: number; spent: number; lent: number; count: number }> = {};

  txList.forEach(t => {
    const dStr = t.date || (t.timestamp ? new Date(t.timestamp).toISOString().split('T')[0] : 'Unknown');
    const monthKey = dStr.length >= 7 ? dStr.substring(0, 7) : 'Unknown';

    if (!monthGroup[monthKey]) {
      monthGroup[monthKey] = { income: 0, spent: 0, lent: 0, count: 0 };
    }

    monthGroup[monthKey].count += 1;
    if (t.type === 'income') {
      monthGroup[monthKey].income += Number(t.amount || 0);
    } else if (t.type === 'expense') {
      monthGroup[monthKey].spent += Number(t.amount || 0);
    } else if (t.type === 'lent') {
      monthGroup[monthKey].lent += Number(t.amount || 0);
    }
  });

  const monthlySummaryData = Object.entries(monthGroup).map(([mKey, val]) => {
    const [y, m] = mKey.split('-');
    let monthLabel = mKey;
    if (y && m) {
      const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
      monthLabel = dateObj.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    }

    return {
      'Month': monthLabel,
      'Total Income (₹)': val.income,
      'Total Spent (₹)': val.spent,
      'Total Lent (₹)': val.lent,
      'Net Balance (₹)': val.income - val.spent - val.lent,
      'Total Transactions': val.count
    };
  });

  const monthlySheet = XLSX.utils.json_to_sheet(monthlySummaryData);
  monthlySheet['!cols'] = [
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 }
  ];

  XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Monthly Summary');

  // -------------------------------------------------------------
  // Sheet 3: Category Wise Breakdown
  // -------------------------------------------------------------
  const catGroup: Record<string, { total: number; count: number }> = {};
  let totalSpentSum = 0;

  txList.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.category || 'Others';
    if (!catGroup[cat]) {
      catGroup[cat] = { total: 0, count: 0 };
    }
    const amt = Number(t.amount || 0);
    catGroup[cat].total += amt;
    catGroup[cat].count += 1;
    totalSpentSum += amt;
  });

  const categoryBreakdownData = Object.entries(catGroup).map(([cat, val]) => ({
    'Category': cat,
    'Total Spent (₹)': val.total,
    'Item Count': val.count,
    'Share (% of Total)': totalSpentSum > 0 ? `${((val.total / totalSpentSum) * 100).toFixed(1)}%` : '0%'
  }));

  const categorySheet = XLSX.utils.json_to_sheet(categoryBreakdownData);
  categorySheet['!cols'] = [
    { wch: 22 },
    { wch: 18 },
    { wch: 14 },
    { wch: 20 }
  ];

  XLSX.utils.book_append_sheet(workbook, categorySheet, 'Category Breakdown');

  // -------------------------------------------------------------
  // Sheet 4: Lent & Debt Ledger
  // -------------------------------------------------------------
  const personGroup: Record<string, { lent: number; borrowed: number; count: number }> = {};

  txList.filter(t => t.person || t.type === 'lent' || t.type === 'borrowed').forEach(t => {
    const personName = t.person || t.title || 'Unknown';
    if (!personGroup[personName]) {
      personGroup[personName] = { lent: 0, borrowed: 0, count: 0 };
    }
    personGroup[personName].count += 1;
    if (t.type === 'lent') {
      personGroup[personName].lent += Number(t.amount || 0);
    } else if (t.type === 'borrowed') {
      personGroup[personName].borrowed += Number(t.amount || 0);
    }
  });

  const lentLedgerData = Object.entries(personGroup).map(([name, val]) => ({
    'Person / Party Name': name,
    'Money Lent Out (₹)': val.lent,
    'Money Borrowed (₹)': val.borrowed,
    'Net Status': val.lent > val.borrowed ? `To Collect ₹${val.lent - val.borrowed}` : val.borrowed > val.lent ? `To Pay ₹${val.borrowed - val.lent}` : 'Settled'
  }));

  const lentSheet = XLSX.utils.json_to_sheet(lentLedgerData);
  lentSheet['!cols'] = [
    { wch: 24 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 }
  ];

  XLSX.utils.book_append_sheet(workbook, lentSheet, 'Lent & Borrowed');

  // Download File
  const filename = exportType === 'monthly' && selectedMonthYear 
    ? `Funds_Log_Report_${selectedMonthYear}.xlsx` 
    : `Funds_Log_Full_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

  XLSX.writeFile(workbook, filename);
}
