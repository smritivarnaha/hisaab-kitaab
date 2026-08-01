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

  const transactions: Transaction[] = [];
  let totalAmount = 0;
  let failed = 0;

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const columns = line.split(',').map(c => c.replace(/^["']|["']$/g, '').trim());

    if (columns.length < 2) {
      failed++;
      continue;
    }

    // Try common CSV layout formats (Date, Description, Amount / Debit / Credit)
    let dateStr = columns[0] || new Date().toISOString().split('T')[0];
    let description = columns[1] || 'Imported Transaction';
    let amountStr = columns[2] || columns[3] || '0';

    const amount = parseFloat(amountStr.replace(/[^0-9.]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      failed++;
      continue;
    }

    // Pass through AI parser to auto-classify category and payment method
    const parsed = parseSingleInput(`${description} ${amount}`, { merchants: {}, contacts: {}, paymentPreferences: {} });
    parsed.amount = amount;
    parsed.date = dateStr;
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
