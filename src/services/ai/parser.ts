import { Transaction, TransactionType, Category, PaymentMethod, AIClarificationQuestion, AIMemoryMap } from '../../types/finance';

const DEFAULT_MEMORY: AIMemoryMap = {
  merchants: {
    'ccd': 'Food & Drinks',
    'starbucks': 'Food & Drinks',
    'swiggy': 'Food & Drinks',
    'zomato': 'Food & Drinks',
    'blinkit': 'Grocery',
    'zepto': 'Grocery',
    'instamart': 'Grocery',
    'uber': 'Travel',
    'ola': 'Travel',
    'amazon': 'Shopping',
    'flipkart': 'Shopping',
    'hpcl': 'Fuel',
    'bpcl': 'Fuel',
    'shell': 'Fuel'
  },
  contacts: {
    'rahul': 'Friend',
    'rohan': 'Friend',
    'priya': 'Sister',
    'mummy': 'Family',
    'papa': 'Family',
    'boss': 'Work'
  },
  paymentPreferences: {
    'petrol': 'UPI',
    'grocery': 'UPI',
    'milk': 'Cash'
  }
};

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function parseBankSMS(smsText: string): Transaction | null {
  const text = smsText.trim();
  const isDebit = /debited|spent|paid|withdrawn|deducted/i.test(text);
  const isCredit = /credited|received|deposited|added/i.test(text);

  if (!isDebit && !isCredit) return null;

  const amountMatch = text.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) || text.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|rupees)/i);
  if (!amountMatch) return null;

  const rawAmount = amountMatch[1].replace(/,/g, '');
  const amount = parseFloat(rawAmount);
  if (isNaN(amount) || amount <= 0) return null;

  const merchantMatch = text.match(/(?:to|at|vpa|info|for)\s+([A-Za-z0-9\s._-]+?)(?:\.|\s+bal|\s+on|\s+ref|\s+a\/c|$)/i);
  const merchant = merchantMatch ? merchantMatch[1].trim() : undefined;

  let method: PaymentMethod = 'UPI';
  if (/upi|gpay|paytm|phonepe/i.test(text)) method = 'UPI';
  else if (/card|debit card|credit card/i.test(text)) method = 'Credit Card';
  else if (/atm|cash/i.test(text)) method = 'Cash';
  else if (/neft|rtgs|imps|net banking/i.test(text)) method = 'Bank Transfer';

  const type: TransactionType = isCredit ? 'income' : 'expense';
  const { category } = parseCategory(text);

  const title = merchant ? merchant : 'Bank Transaction (Reason Missing)';
  const isPending = !merchant;

  return {
    id: `tx_sms_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    amount,
    currency: '₹',
    type,
    category,
    title,
    merchant,
    paymentMethod: method,
    date: formatDate(new Date()),
    relativeDateText: 'Today',
    timestamp: Date.now(),
    confidenceScore: isPending ? 70 : 92,
    rawInput: text,
    shortDisplayTitle: title,
    notes: text,
    isPending
  };
}

function parseAmount(text: string): { amount: number | null; matchText: string | null } {
  const kMatch = text.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) {
    return { amount: parseFloat(kMatch[1]) * 1000, matchText: kMatch[0] };
  }

  const match = text.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)\s*(?:rs\.?|rupees|rupee)?/i);
  if (match && match[1]) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val > 0) {
      return { amount: val, matchText: match[0] };
    }
  }

  return { amount: null, matchText: null };
}

function parseDate(text: string): { date: string; relativeText: string; explicit: boolean } {
  const lower = text.toLowerCase();
  const today = new Date();

  if (lower.includes('kal') || lower.includes('yesterday')) {
    const yest = new Date(today);
    yest.setDate(today.getDate() - 1);
    return { date: formatDate(yest), relativeText: 'Yesterday', explicit: true };
  }

  if (lower.includes('parso') || lower.includes('day before yesterday')) {
    const dby = new Date(today);
    dby.setDate(today.getDate() - 2);
    return { date: formatDate(dby), relativeText: 'Day before yesterday', explicit: true };
  }

  if (lower.includes('aaj') || lower.includes('today')) {
    return { date: formatDate(today), relativeText: 'Today', explicit: true };
  }

  return { date: formatDate(today), relativeText: 'Today', explicit: false };
}

// AI decides category automatically; if confused, assign 'Others' (Miscellaneous)
function parseCategory(text: string, memory: AIMemoryMap = DEFAULT_MEMORY): { category: Category; confidenceBoost: number } {
  const lower = text.toLowerCase();

  for (const [merchantKey, cat] of Object.entries(memory.merchants)) {
    if (lower.includes(merchantKey)) {
      return { category: cat as Category, confidenceBoost: 20 };
    }
  }

  if (/petrol|diesel|fuel|cng|gasoline|engine oil|vehicle fuel/i.test(lower)) {
    return { category: 'Fuel', confidenceBoost: 25 };
  }
  if (/chai|tea|coffee|ccd|starbucks|food|lunch|dinner|breakfast|biryani|swiggy|zomato|restaurant|burger|pizza|samosa|momos|snack|khana|piya|churan|chooran|hajmola|candy|sweet|mithai|dosa|idli|paneer|chicken|mutton|roti|sabji|curry|thali|coke|pepsi|juice|lassi|soda|peena/i.test(lower)) {
    return { category: 'Food & Drinks', confidenceBoost: 25 };
  }
  if (/grocery|milk|doodh|sabzi|vegetables|fruit|kirana|ration|blinkit|zepto|instamart|bread|eggs|toothbrush|brush|toothpaste|paste|soap|shampoo|conditioner|detergent|harpic|tissue|wiper|cleaner|personal care|toiletries|atta|chawal|dal|rice|oil|masala|spices|namkeen|biscuit|kurkure|lays|chips/i.test(lower)) {
    return { category: 'Grocery', confidenceBoost: 25 };
  }
  if (/electricity|bijli|recharge|wifi|broadband|rent|kiraya|water bill|gas bill|mobile bill|maintenance/i.test(lower)) {
    return { category: 'Bills & Utilities', confidenceBoost: 25 };
  }
  if (/clothes|cloth|shirt|pants|amazon|flipkart|shopping|shoes|zara|myntra|dress/i.test(lower)) {
    return { category: 'Shopping', confidenceBoost: 25 };
  }
  if (/movie|cinema|netflix|hotstar|prime|game|gaming|concert|show|ticket/i.test(lower)) {
    return { category: 'Entertainment', confidenceBoost: 25 };
  }
  if (/cab|uber|ola|auto|metro|bus|flight|train|parking|toll|fastag|travel|rapido/i.test(lower)) {
    return { category: 'Travel', confidenceBoost: 25 };
  }
  if (/medicine|dawa|doctor|pharmacy|hospital|lab test|checkup|health/i.test(lower)) {
    return { category: 'Healthcare', confidenceBoost: 25 };
  }
  if (/sip|mutual fund|stock|stocks|crypto|share|investment|gold/i.test(lower)) {
    return { category: 'Investments', confidenceBoost: 25 };
  }
  if (/salary|stipend|wages|paycheck|tankhah/i.test(lower)) {
    return { category: 'Salary', confidenceBoost: 30 };
  }

  // If AI is confused, automatically assign Miscellaneous ('Others')
  return { category: 'Others', confidenceBoost: 0 };
}

// Autocorrects common Hinglish, Hindi, or misspelled words into neat English/proper names (Disabled: delegated to Gemini LLM)
export function autocorrectTitleSpelling(title: string): string {
  return title;
}

export function normalizeInputText(text: string): string {
  return text;
}

function parsePaymentMethod(text: string): { method: PaymentMethod; explicit: boolean } {
  const lower = text.toLowerCase();
  if (/upi|gpay|paytm|phonepe|bhim|qr|scan/i.test(lower)) {
    return { method: 'UPI', explicit: true };
  }
  if (/cash|nagad|currency/i.test(lower)) {
    return { method: 'Cash', explicit: true };
  }
  if (/credit card|cc|axis card|hdfc card|icici card/i.test(lower)) {
    return { method: 'Credit Card', explicit: true };
  }
  if (/debit card|atm card/i.test(lower)) {
    return { method: 'Debit Card', explicit: true };
  }
  if (/bank transfer|neft|rtgs|imps|net banking/i.test(lower)) {
    return { method: 'Bank Transfer', explicit: true };
  }
  if (/wallet|paytm wallet/i.test(lower)) {
    return { method: 'Wallet', explicit: true };
  }

  return { method: 'UPI', explicit: false };
}

function parseTransactionTypeAndEntity(text: string): {
  type: TransactionType;
  person?: string;
  merchant?: string;
  extractedReason?: string;
  confidenceBoost: number;
} {
  const lower = text.toLowerCase();

  if (/returned|wapas|wapis|credited|received|aa gaye|aa gayi|got back|refund|salary/i.test(lower)) {
    const personMatch = text.match(/([A-Z][a-z]+)\s+(?:returned|wapas|gave)/i) || text.match(/(?:from|se)\s+([A-Z][a-z]+)/i);
    const person = personMatch ? personMatch[1] : extractName(text);
    return { type: 'income', person, extractedReason: person ? `${person} returned money` : 'Income Received', confidenceBoost: 30 };
  }

  if (/lent|diye|diya|gave to|paid to|ko diye|ko cash/i.test(lower) && !/shop|store|petrol|grocery|bill|swiggy|zomato/i.test(lower)) {
    const personMatch = text.match(/([A-Z][a-z]+)\s+ko/i) || text.match(/(?:to|gave)\s+([A-Z][a-z]+)/i);
    const person = personMatch ? personMatch[1] : extractName(text);
    return { type: 'lent', person, extractedReason: person ? `Lent to ${person}` : 'Lent Money', confidenceBoost: 25 };
  }

  if (/borrowed|udhaar|taken from|liye|se liye/i.test(lower)) {
    const personMatch = text.match(/(?:from|se)\s+([A-Z][a-z]+)/i);
    const person = personMatch ? personMatch[1] : extractName(text);
    return { type: 'borrowed', person, extractedReason: person ? `Borrowed from ${person}` : 'Borrowed Money', confidenceBoost: 25 };
  }

  const reasonMatch = text.match(/(?:for|in|mein|par|pe|se)\s+([A-Za-z0-9\s._-]+?)(?:\s+today|\s+kal|\s+parso|\s+rs|\s+rupees|\s+\d+|$)/i);
  const extractedReason = reasonMatch ? reasonMatch[1].trim() : undefined;

  const merchantMatch = text.match(/(?:at|from|to)\s+([A-Za-z0-9\s]+)/i);
  const merchant = merchantMatch ? merchantMatch[1].trim() : undefined;
  return { type: 'expense', merchant, extractedReason, confidenceBoost: 20 };
}

function extractName(text: string): string | undefined {
  const names = ['Rahul', 'Rohan', 'Priya', 'Amit', 'Neha', 'Vikas', 'Mummy', 'Papa', 'Ankit', 'Suresh', 'Ramesh', 'Pooja', 'Karan'];
  for (const n of names) {
    if (new RegExp(`\\b${n}\\b`, 'i').test(text)) {
      return n;
    }
  }
  return undefined;
}

export function parseSingleInput(input: string, memory: AIMemoryMap = DEFAULT_MEMORY): Transaction {
  const smsResult = parseBankSMS(input);
  if (smsResult) return smsResult;

  const cleaned = normalizeInputText(input.trim());
  const { amount } = parseAmount(cleaned);
  const { date, relativeText } = parseDate(cleaned);
  const { category, confidenceBoost: catBoost } = parseCategory(cleaned, memory);
  const { method: paymentMethod, explicit: isPaymentExplicit } = parsePaymentMethod(cleaned);
  const { type, person, merchant, extractedReason, confidenceBoost: typeBoost } = parseTransactionTypeAndEntity(cleaned);

  let confidence = 50;
  if (amount !== null && amount > 0) confidence += 25;
  if (isPaymentExplicit) confidence += 10;
  confidence += catBoost + typeBoost;
  if (confidence > 99) confidence = 99;

  const fallbackAmount = amount || 0;

  let rawTitleCandidate = extractedReason || merchant || person;
  let notes: string | undefined = undefined;
  let isPending = false;

  // Check for explicit "in the name of <Name>" or "for <Name>" or "to <Name>"
  const nameOfMatch = cleaned.match(/(?:in the name of|in name of|named|for|to)\s+([A-Za-z0-9]+)/i);
  if (nameOfMatch && nameOfMatch[1] && !/^(the|a|an|me|my|rs|rupees|cash|upi|today|yesterday|aaj|kal)$/i.test(nameOfMatch[1])) {
    const extracted = nameOfMatch[1].trim();
    rawTitleCandidate = extracted.charAt(0).toUpperCase() + extracted.slice(1);
  }

  const words = cleaned.split(/\s+/);
  const nonAmountWords = words.filter(w => !/^\d+$/.test(w) && !/^(rs|inr|₹|rs\.)$/i.test(w) && !/^(today|aaj|kal|yesterday|upi|cash)$/i.test(w));

  if (!rawTitleCandidate && nonAmountWords.length > 0) {
    rawTitleCandidate = nonAmountWords.join(' ');
  }

  let title = 'Reason Missing';

  if (rawTitleCandidate) {
    // Strip conversational intro fluff (e.g. "hi how are you so I spend 23 in the name of Nandini")
    let cleanedTitle = rawTitleCandidate
      .replace(/^(hi|hello|hey|so|i|we)\s+(how are you|hope you are well)?\s*(so|then)?\s*(i|we)?\s*(spent|spend|paid|gave|received|got)?\s*/i, '')
      .replace(/^(in the name of|in name of|for the purpose of|under the name of|for|to)\s+/i, '')
      .replace(/\b(rupees|rupee|rs|inr|cash|upi|today|aaj|kal|yesterday)\b/gi, '')
      .trim();

    if (cleanedTitle.length > 0) {
      const candidateWords = cleanedTitle.split(/\s+/).filter(Boolean);
      if (candidateWords.length > 3) {
        title = candidateWords.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        notes = cleaned;
      } else {
        title = candidateWords.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        if (words.length > 4) notes = cleaned;
      }
    } else {
      isPending = true;
    }
  } else {
    isPending = true; // Only mark pending if reason/name is missing!
  }

  title = autocorrectTitleSpelling(title);

  return {
    id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    amount: fallbackAmount,
    currency: '₹',
    type,
    category,
    title,
    paymentMethod,
    merchant,
    person,
    date,
    relativeDateText: relativeText,
    timestamp: Date.now(),
    confidenceScore: isPending ? 70 : confidence,
    rawInput: input,
    shortDisplayTitle: title,
    notes,
    isPending
  };
}

export function parseMultiInput(input: string, memory: AIMemoryMap = DEFAULT_MEMORY): Transaction[] {
  const text = input.trim();
  if (!text) return [];

  let lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  if (lines.length === 1) {
    if (/\b(?:fir|then|and then|after that|\.)\b/i.test(text)) {
      lines = text.split(/\b(?:fir|then|and then|after that|\.)\b/i).map(l => l.trim()).filter(Boolean);
    }
  }

  const results: Transaction[] = [];

  for (const line of lines) {
    if (!line) continue;
    const tx = parseSingleInput(line, memory);
    if (tx.amount > 0) {
      results.push(tx);
    }
  }

  return results;
}

// Only build clarification for missing reason/name or amount — NEVER for category!
export function buildClarification(tx: Transaction): AIClarificationQuestion | null {
  if (tx.confidenceScore >= 85 && !tx.isPending) return null;

  if (!tx.amount || tx.amount === 0) {
    return {
      transactionId: tx.id,
      field: 'amount',
      prompt: `Please let me know the missing amount for "${tx.title}":`,
      options: [
        { label: '₹100', value: '100' },
        { label: '₹500', value: '500' },
        { label: '₹1000', value: '1000' },
        { label: '₹2000', value: '2000' }
      ],
      draftTransaction: tx
    };
  }

  if (tx.title === 'Reason Missing') {
    return {
      transactionId: tx.id,
      field: 'reason',
      prompt: `I recorded ₹${tx.amount}, but what was the reason/name for this entry?`,
      options: [
        { label: '⛽ Petrol Refill', value: 'Petrol Refill' },
        { label: '☕ Food / Dining', value: 'Food Dinner' },
        { label: '🛒 Groceries', value: 'Grocery Ration' },
        { label: '🤝 Sent to Friend', value: 'Rahul Loan' }
      ],
      draftTransaction: tx
    };
  }

  return null;
}

export function applySelfCorrection(lastTx: Transaction, correctionInput: string): Transaction {
  const updated = { ...lastTx };
  const lower = correctionInput.toLowerCase();

  const newPayment = parsePaymentMethod(correctionInput);
  if (newPayment.explicit) {
    updated.paymentMethod = newPayment.method;
  }

  const amountObj = parseAmount(correctionInput);
  if (amountObj.amount && amountObj.amount > 0) {
    updated.amount = amountObj.amount;
  }

  if (lower.includes('yesterday') || lower.includes('kal')) {
    const { date, relativeText } = parseDate(correctionInput);
    updated.date = date;
    updated.relativeDateText = relativeText;
  }

  const { category } = parseCategory(correctionInput);
  updated.category = category;

  updated.title = correctionInput.split(/\s+/).slice(0, 3).join(' ');
  updated.confidenceScore = 98;
  updated.isPending = false;
  return updated;
}
