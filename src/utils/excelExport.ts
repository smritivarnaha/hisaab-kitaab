import XLSX from 'xlsx-js-style';
import { Transaction } from '../types/finance';
import { formatGlobalDate } from './dateUtils';

export function exportToExcel(
  transactions: Transaction[],
  exportType: 'all' | 'monthly',
  selectedMonthYear?: string, // e.g. "2026-08"
  userName: string = 'User'
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
  const reportDateStr = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  // Reusable Styling Constants
  const titleStyle = {
    font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '0D2E14' } }, // Forest Green
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  const subtitleStyle = {
    font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '334155' } },
    fill: { fgColor: { rgb: 'F1F5F9' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  const headerStyle = {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '14471F' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '0D2E14' } },
      bottom: { style: 'medium', color: { rgb: '0D2E14' } }
    }
  };

  const zebraEvenFill = { fgColor: { rgb: 'FFFFFF' } };
  const zebraOddFill = { fgColor: { rgb: 'F8FAFC' } };

  // -------------------------------------------------------------
  // Sheet 1: Passbook Ledger
  // -------------------------------------------------------------
  const passbookRows: any[][] = [];

  // Header Title Block
  passbookRows.push(['HISAAB-KITAAB | FUNDS LOG PASSBOOK REPORT', '', '', '', '', '', '', '', '']);
  passbookRows.push([`User: ${userName}  |  Generated: ${reportDateStr}  |  Developed by Rankved`, '', '', '', '', '', '', '', '']);
  passbookRows.push([]); // Blank spacing

  // Table Headers
  const passbookHeaders = ['S.No', 'Date', 'Title', 'Category', 'Entry Type', 'Payment Method', 'Amount (₹)', 'Person / Party', 'Notes'];
  passbookRows.push(passbookHeaders);

  let totalIncomeSum = 0;
  let totalSpentSum = 0;
  let totalLentSum = 0;

  // Data Rows
  txList.forEach((t, idx) => {
    const amt = Number(t.amount || 0);
    if (t.type === 'income') totalIncomeSum += amt;
    else if (t.type === 'expense') totalSpentSum += amt;
    else if (t.type === 'lent') totalLentSum += amt;

    const typeLabel = t.type === 'income' ? 'Income' : t.type === 'lent' ? 'Lent' : t.type === 'borrowed' ? 'Borrowed' : 'Spent';

    passbookRows.push([
      idx + 1,
      formatGlobalDate(t.date || t.timestamp),
      t.title || t.category,
      t.category || 'Others',
      typeLabel,
      t.paymentMethod || 'UPI',
      amt,
      t.person || '',
      t.notes || ''
    ]);
  });

  // Total Summary Row
  passbookRows.push(['TOTALS', '', '', '', '', '', totalSpentSum, '', `Net: ₹${totalIncomeSum - totalSpentSum - totalLentSum}`]);

  const passbookSheet = XLSX.utils.aoa_to_sheet(passbookRows);

  // Apply Merges for Title Block
  passbookSheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }
  ];

  // Set Column Widths
  passbookSheet['!cols'] = [
    { wch: 8 },  // S.No
    { wch: 15 }, // Date
    { wch: 28 }, // Title
    { wch: 18 }, // Category
    { wch: 14 }, // Type
    { wch: 16 }, // Method
    { wch: 16 }, // Amount
    { wch: 18 }, // Person
    { wch: 32 }  // Notes
  ];

  // Apply Cell Styling to Sheet 1
  const passbookRange = XLSX.utils.decode_range(passbookSheet['!ref'] || 'A1:I1');

  for (let R = passbookRange.s.r; R <= passbookRange.e.r; ++R) {
    const isHeaderRow = R === 3;
    const isDataRow = R > 3 && R < passbookRange.e.r;
    const isTotalRow = R === passbookRange.e.r;

    for (let C = passbookRange.s.c; C <= passbookRange.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      if (!passbookSheet[cellRef]) passbookSheet[cellRef] = { v: '' };

      const cell = passbookSheet[cellRef];

      if (R === 0) {
        cell.s = titleStyle;
      } else if (R === 1) {
        cell.s = subtitleStyle;
      } else if (isHeaderRow) {
        cell.s = headerStyle;
      } else if (isDataRow) {
        const isOdd = R % 2 !== 0;
        const rowBg = isOdd ? zebraOddFill : zebraEvenFill;
        const typeVal = String(passbookSheet[XLSX.utils.encode_cell({ r: R, c: 4 })]?.v || '');

        let amountColor = '1E293B'; // Dark Slate
        if (typeVal === 'Income') amountColor = '16A34A'; // Green
        else if (typeVal === 'Spent') amountColor = 'DC2626'; // Red
        else if (typeVal === 'Lent') amountColor = 'D97706'; // Amber
        else if (typeVal === 'Borrowed') amountColor = '7C3AED'; // Purple

        let align: 'left' | 'center' | 'right' = 'left';
        if (C === 0 || C === 1 || C === 4 || C === 5) align = 'center';
        if (C === 6) align = 'right';

        cell.s = {
          font: {
            name: 'Calibri',
            sz: 10,
            bold: C === 6 || C === 2, // Bold Amount & Title
            color: { rgb: C === 6 ? amountColor : '1E293B' }
          },
          fill: rowBg,
          alignment: { horizontal: align, vertical: 'center' },
          border: {
            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } }
          }
        };

        if (C === 6 && typeof cell.v === 'number') {
          cell.z = '₹#,##0';
        }
      } else if (isTotalRow) {
        cell.s = {
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '0D2E14' } },
          fill: { fgColor: { rgb: 'E6F4EA' } },
          alignment: { horizontal: C === 6 ? 'right' : 'center', vertical: 'center' },
          border: {
            top: { style: 'medium', color: { rgb: '0D2E14' } },
            bottom: { style: 'double', color: { rgb: '0D2E14' } }
          }
        };
        if (C === 6 && typeof cell.v === 'number') cell.z = '₹#,##0';
      }
    }
  }

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
    if (t.type === 'income') monthGroup[monthKey].income += Number(t.amount || 0);
    else if (t.type === 'expense') monthGroup[monthKey].spent += Number(t.amount || 0);
    else if (t.type === 'lent') monthGroup[monthKey].lent += Number(t.amount || 0);
  });

  const monthlyRows: any[][] = [];
  monthlyRows.push(['MONTHLY FINANCIAL SUMMARY REPORT', '', '', '', '', '']);
  monthlyRows.push([`User: ${userName}  |  Generated: ${reportDateStr}  |  Developed by Rankved`, '', '', '', '', '']);
  monthlyRows.push([]);
  monthlyRows.push(['Month', 'Total Income (₹)', 'Total Spent (₹)', 'Total Lent (₹)', 'Net Balance (₹)', 'Total Txns']);

  Object.entries(monthGroup).forEach(([mKey, val]) => {
    const [y, m] = mKey.split('-');
    let monthLabel = mKey;
    if (y && m) {
      const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
      monthLabel = dateObj.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    }

    monthlyRows.push([
      monthLabel,
      val.income,
      val.spent,
      val.lent,
      val.income - val.spent - val.lent,
      val.count
    ]);
  });

  const monthlySheet = XLSX.utils.aoa_to_sheet(monthlyRows);
  monthlySheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }
  ];
  monthlySheet['!cols'] = [
    { wch: 22 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 },
    { wch: 16 }
  ];

  // Apply Styling Sheet 2
  const mRange = XLSX.utils.decode_range(monthlySheet['!ref'] || 'A1:F1');
  for (let R = mRange.s.r; R <= mRange.e.r; ++R) {
    for (let C = mRange.s.c; C <= mRange.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      if (!monthlySheet[cellRef]) monthlySheet[cellRef] = { v: '' };
      const cell = monthlySheet[cellRef];

      if (R === 0) cell.s = titleStyle;
      else if (R === 1) cell.s = subtitleStyle;
      else if (R === 3) cell.s = headerStyle;
      else if (R > 3) {
        let textClr = '1E293B';
        if (C === 1) textClr = '16A34A'; // Income Green
        if (C === 2) textClr = 'DC2626'; // Spent Red
        if (C === 3) textClr = 'D97706'; // Lent Amber
        if (C === 4) textClr = Number(cell.v) >= 0 ? '16A34A' : 'DC2626';

        cell.s = {
          font: { name: 'Calibri', sz: 10, bold: C >= 1, color: { rgb: textClr } },
          fill: R % 2 === 0 ? zebraEvenFill : zebraOddFill,
          alignment: { horizontal: C === 0 ? 'left' : 'right', vertical: 'center' },
          border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } }
        };
        if (C >= 1 && C <= 4 && typeof cell.v === 'number') cell.z = '₹#,##0';
      }
    }
  }

  XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Monthly Summary');

  // -------------------------------------------------------------
  // Sheet 3: Category Breakdown
  // -------------------------------------------------------------
  const catGroup: Record<string, { total: number; count: number }> = {};
  let totalSpentCategorySum = 0;

  txList.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.category || 'Others';
    if (!catGroup[cat]) catGroup[cat] = { total: 0, count: 0 };
    const amt = Number(t.amount || 0);
    catGroup[cat].total += amt;
    catGroup[cat].count += 1;
    totalSpentCategorySum += amt;
  });

  const categoryRows: any[][] = [];
  categoryRows.push(['CATEGORY-WISE SPEND BREAKDOWN REPORT', '', '', '']);
  categoryRows.push([`User: ${userName}  |  Generated: ${reportDateStr}  |  Developed by Rankved`, '', '', '']);
  categoryRows.push([]);
  categoryRows.push(['Category', 'Total Spent (₹)', 'Item Count', 'Share (% of Total)']);

  Object.entries(catGroup).forEach(([cat, val]) => {
    const pct = totalSpentCategorySum > 0 ? ((val.total / totalSpentCategorySum) * 100).toFixed(1) + '%' : '0%';
    categoryRows.push([cat, val.total, val.count, pct]);
  });

  const categorySheet = XLSX.utils.aoa_to_sheet(categoryRows);
  categorySheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }
  ];
  categorySheet['!cols'] = [
    { wch: 26 },
    { wch: 22 },
    { wch: 16 },
    { wch: 22 }
  ];

  // Apply Styling Sheet 3
  const cRange = XLSX.utils.decode_range(categorySheet['!ref'] || 'A1:D1');
  for (let R = cRange.s.r; R <= cRange.e.r; ++R) {
    for (let C = cRange.s.c; C <= cRange.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      if (!categorySheet[cellRef]) categorySheet[cellRef] = { v: '' };
      const cell = categorySheet[cellRef];

      if (R === 0) cell.s = titleStyle;
      else if (R === 1) cell.s = subtitleStyle;
      else if (R === 3) cell.s = headerStyle;
      else if (R > 3) {
        cell.s = {
          font: { name: 'Calibri', sz: 10, bold: C === 1, color: { rgb: C === 1 ? 'DC2626' : '1E293B' } },
          fill: R % 2 === 0 ? zebraEvenFill : zebraOddFill,
          alignment: { horizontal: C === 0 ? 'left' : C === 3 ? 'center' : 'right', vertical: 'center' },
          border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } }
        };
        if (C === 1 && typeof cell.v === 'number') cell.z = '₹#,##0';
      }
    }
  }

  XLSX.utils.book_append_sheet(workbook, categorySheet, 'Category Breakdown');

  // -------------------------------------------------------------
  // Sheet 4: Lent & Debt Ledger
  // -------------------------------------------------------------
  const personGroup: Record<string, { lent: number; borrowed: number; count: number }> = {};

  txList.filter(t => t.person || t.type === 'lent' || t.type === 'borrowed').forEach(t => {
    const personName = t.person || t.title || 'Unknown';
    if (!personGroup[personName]) personGroup[personName] = { lent: 0, borrowed: 0, count: 0 };
    personGroup[personName].count += 1;
    if (t.type === 'lent') personGroup[personName].lent += Number(t.amount || 0);
    else if (t.type === 'borrowed') personGroup[personName].borrowed += Number(t.amount || 0);
  });

  const lentRows: any[][] = [];
  lentRows.push(['LENT & BORROWED DEBT LEDGER REPORT', '', '', '']);
  lentRows.push([`User: ${userName}  |  Generated: ${reportDateStr}  |  Developed by Rankved`, '', '', '']);
  lentRows.push([]);
  lentRows.push(['Person / Party Name', 'Money Lent Out (₹)', 'Money Borrowed (₹)', 'Net Ledger Position']);

  Object.entries(personGroup).forEach(([name, val]) => {
    const statusStr = val.lent > val.borrowed 
      ? `To Collect ₹${val.lent - val.borrowed}` 
      : val.borrowed > val.lent 
      ? `To Pay ₹${val.borrowed - val.lent}` 
      : 'Settled';
    lentRows.push([name, val.lent, val.borrowed, statusStr]);
  });

  const lentSheet = XLSX.utils.aoa_to_sheet(lentRows);
  lentSheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }
  ];
  lentSheet['!cols'] = [
    { wch: 28 },
    { wch: 22 },
    { wch: 22 },
    { wch: 26 }
  ];

  // Apply Styling Sheet 4
  const lRange = XLSX.utils.decode_range(lentSheet['!ref'] || 'A1:D1');
  for (let R = lRange.s.r; R <= lRange.e.r; ++R) {
    for (let C = lRange.s.c; C <= lRange.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      if (!lentSheet[cellRef]) lentSheet[cellRef] = { v: '' };
      const cell = lentSheet[cellRef];

      if (R === 0) cell.s = titleStyle;
      else if (R === 1) cell.s = subtitleStyle;
      else if (R === 3) cell.s = headerStyle;
      else if (R > 3) {
        let clr = '1E293B';
        if (C === 1) clr = 'D97706'; // Amber Lent
        if (C === 2) clr = '7C3AED'; // Purple Borrowed
        if (C === 3) {
          const st = String(cell.v);
          if (st.startsWith('To Collect')) clr = '16A34A';
          else if (st.startsWith('To Pay')) clr = 'DC2626';
        }

        cell.s = {
          font: { name: 'Calibri', sz: 10, bold: C >= 1, color: { rgb: clr } },
          fill: R % 2 === 0 ? zebraEvenFill : zebraOddFill,
          alignment: { horizontal: C === 0 ? 'left' : C === 3 ? 'center' : 'right', vertical: 'center' },
          border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } }
        };
        if ((C === 1 || C === 2) && typeof cell.v === 'number') cell.z = '₹#,##0';
      }
    }
  }

  XLSX.utils.book_append_sheet(workbook, lentSheet, 'Lent & Borrowed');

  // Trigger Download
  const filename = exportType === 'monthly' && selectedMonthYear 
    ? `Funds_Log_Report_${selectedMonthYear}.xlsx` 
    : `Funds_Log_Full_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

  XLSX.writeFile(workbook, filename);
}
