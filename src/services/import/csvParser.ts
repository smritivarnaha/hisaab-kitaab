import { Transaction } from '../../types/finance';
import { parseSingleInput } from '../ai/parser';

export interface ImportSummary {
  totalParsed: number;
  totalAmount: number;
  transactions: Transaction[];
  failedRows: number;
}

export function parseCSVStatement(csvText: string): ImportSummary {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    return { totalParsed: 0, totalAmount: 0, transactions: [], failedRows: 0 };
  }

  const headerLine = lines[0].toLowerCase();
  const headerCols = headerLine.split(',').map(c => c.replace(/^["']|["']$/g, '').trim());

  let dateIdx = headerCols.findIndex(c => c.includes('date') || c.includes('txn date') || c.includes('time'));
  let descIdx = headerCols.findIndex(c => c.includes('desc') || c.includes('narration') || c.includes('particular') || c.includes('details') || c.includes('remark') || c.includes('title'));
  let amountIdx = headerCols.findIndex(c => c.includes('amount') || c.includes('debit') || c.includes('dr') || c.includes('value'));
  let creditIdx = headerCols.findIndex(c => c.includes('credit') || c.includes('cr'));

  if (dateIdx === -1) dateIdx = 0;
  if (descIdx === -1) descIdx = 1;
  if (amountIdx === -1) amountIdx = 2;

  const transactions: Transaction[] = [];
  let totalAmount = 0;
  let failed = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const columns = line.split(',').map(c => c.replace(/^["']|["']$/g, '').trim());

    if (columns.length < 2) {
      failed++;
      continue;
    }

    const rawDate = columns[dateIdx] || new Date().toISOString().split('T')[0];
    const description = columns[descIdx] || 'Bank Statement Import';
    
    let isIncome = false;
    let rawAmountStr = columns[amountIdx] || '0';

    if (creditIdx !== -1 && columns[creditIdx] && parseFloat(columns[creditIdx].replace(/[^0-9.]/g, '')) > 0) {
      rawAmountStr = columns[creditIdx];
      isIncome = true;
    }

    const amount = parseFloat(rawAmountStr.replace(/[^0-9.]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      failed++;
      continue;
    }

    const parsed = parseSingleInput(`${description} ${amount}`, { merchants: {}, contacts: {}, paymentPreferences: {} });
    parsed.amount = amount;
    parsed.type = isIncome ? 'income' : 'expense';
    parsed.date = rawDate;
    parsed.notes = `Imported: ${description}`;

    transactions.push(parsed);
    totalAmount += amount;
  }

  return {
    totalParsed: transactions.length,
    totalAmount,
    transactions,
    failedRows: failed
  };
}
