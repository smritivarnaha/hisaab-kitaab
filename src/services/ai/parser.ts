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
  const cleaned = text.replace(/,/g, '');
  const kMatch = cleaned.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) {
    return { amount: parseFloat(kMatch[1]) * 1000, matchText: kMatch[0] };
  }

  const match = cleaned.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)\s*(?:rs\.?|rupees?|rupaye|inr|\/-)?/i);
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

  const merchants = memory?.merchants || {};
  for (const [merchantKey, cat] of Object.entries(merchants)) {
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

const HINGLISH_SPELLING_MAP: Record<string, string> = {
  'doodh': 'Milk',
  'dudh': 'Milk',
  'chai': 'Tea',
  'sabzi': 'Vegetables',
  'sabji': 'Vegetables',
  'kirana': 'Grocery',
  'bijli': 'Electricity',
  'dawa': 'Medicine',
  'dawai': 'Medicine',
  'petrol': 'Petrol',
  'chooran': 'Churan',
  'kapde': 'Clothes'
};

export function autocorrectTitleSpelling(title: string): string {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const mapped = HINGLISH_SPELLING_MAP[words[0].toLowerCase()];
    if (mapped) return mapped;
  }
  return words
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeInputText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
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

  // 1. Check Borrowed first (e.g. "borrowed 500 from sarthak", "sarthak se 500 liye", "took 500 from praveen")
  if (/\b(borrowed|borrow|udhaar liya|udhaar liye|udhar liya|udhar liye|taken from|took from|took|liye|liya|se liye|se liya)\b/i.test(lower)) {
    const personMatch = text.match(/(?:from|se)\s+([A-Za-z]+)/i) || text.match(/([A-Za-z]+)\s+se\b/i);
    const rawName = personMatch ? personMatch[1] : extractName(text);
    const person = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase() : undefined;
    return { type: 'borrowed', person, extractedReason: person ? `Borrowed from ${person}` : 'Borrowed Money', confidenceBoost: 30 };
  }

  // 2. Check Lent / Direct Partner Transfer Given (e.g. "lent 500 to sarthak", "gave 500 to praveen", "sarthak ko 500 diye")
  if (/\b(lent out|lent to|lent|loaned|udhaar diya|udhaar diye|udhar diya|udhar diye|gave to|given to|ko diye|ko diya|bheje|bheja)\b/i.test(lower) ||
      (/\b(transfer|transferred|sent|gave|diye|diya|given)\b/i.test(lower) && /\b(mummy|mother|father|papa|family|brother|sister|sarthak|praveen|nandini|rahul|rohan)\b/i.test(lower))) {
    const personMatch = text.match(/(?:to|ko|for|lent|gave)\s+([A-Za-z]+)/i) || text.match(/([A-Za-z]+)\s+(?:ko|given)/i);
    const rawName = (personMatch && !/^(out|to|for|rs|rupees|cash|upi)$/i.test(personMatch[1])) ? personMatch[1] : extractName(text);
    const person = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase() : undefined;
    return { type: 'lent', person, extractedReason: person ? `Lent to ${person}` : undefined, confidenceBoost: 30 };
  }

  // 3. Check Income
  if (/\b(income|earned|profit|sale|returned|wapas|wapis|credited|received|aa gaye|aa gayi|aaye|mila|mile|got back|got from|refund|salary|stipend)\b/i.test(lower)) {
    const personMatch = text.match(/([A-Za-z]+)\s+(?:returned|wapas|gave)/i) || text.match(/(?:from|se)\s+([A-Za-z]+)/i);
    const rawName = (personMatch && !/^(rs|rupees|cash|upi|bank)$/i.test(personMatch[1])) ? personMatch[1] : extractName(text);
    const person = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase() : undefined;
    return { type: 'income', person, extractedReason: person ? `Received from ${person}` : undefined, confidenceBoost: 30 };
  }

  const reasonMatch = text.match(/(?:for|on|in|mein|par|pe)\s+([A-Za-z0-9\s._-]+?)(?:\s+today|\s+kal|\s+parso|\s+rs|\s+rupees|\s+\d+|$)/i);
  const extractedReason = reasonMatch ? reasonMatch[1].trim() : undefined;

  const merchantMatch = text.match(/(?:at|from|to)\s+([A-Za-z0-9\s]+)/i);
  const merchant = merchantMatch ? merchantMatch[1].trim() : undefined;
  return { type: 'expense', merchant, extractedReason, confidenceBoost: 20 };
}

function extractName(text: string): string | undefined {
  const names = ['Sarthak', 'Praveen', 'Nandini', 'Rahul', 'Rohan', 'Priya', 'Amit', 'Neha', 'Vikas', 'Mummy', 'Papa', 'Ankit', 'Suresh', 'Ramesh', 'Pooja', 'Karan'];
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
  let notes: string | undefined = undefined;
  let isPending = false;

  // Strip amounts, currencies, action verbs, dates, and payment methods to isolate the pure item/entity title
  let strippedTitle = cleaned
    .replace(/(?:₹|rs\.?|inr)\s*\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|rs\.?|rupees?|rupaye|inr|\/-)?/gi, ' ')
    .replace(/\b\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|rs\.?|rupees?|rupaye|inr|\/-)?\b/gi, ' ')
    .replace(/^(?:hi|hello|hey|so|i|we)\s+(?:how are you|hope you are well)?\s*(?:so|then)?\s*/i, ' ')
    .replace(/\b(?:i|we|have|had|has|just|also)\b/gi, ' ')
    .replace(/\b(?:spent on|spent for|spent|spend|paid for|paid to|paid|bought|lent out|lent to|lent|loaned|borrowed from|borrowed|borrow|taken from|took from|took|received from|received|got from|got back|got|earned|credited|in the name of|in name of|named)\b/gi, ' ')
    .replace(/\b(?:via upi|by upi|by cash|in cash|upi|gpay|phonepe|paytm|cash|nagad|today|yesterday|day before yesterday|aaj|kal|parso|rupees|rupee|rupaye|rs|inr)\b/gi, ' ')
    .replace(/^(?:on|for|in|to|from|at|of|with|by|mein|par|pe|ko|se|ka|ki|ke)\b\s*/gi, '')
    .replace(/\s+\b(?:on|for|in|to|from|at|of|with|by|mein|par|pe|ko|se|ka|ki|ke|diye|diya|liye|liya|aaye|mila|mile)$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  let rawTitleCandidate = strippedTitle || extractedReason || merchant || person;
  let title = 'Reason Missing';

  if (rawTitleCandidate && rawTitleCandidate.length > 0) {
    const candidateWords = rawTitleCandidate.split(/\s+/).filter(Boolean);
    if (candidateWords.length > 4) {
      title = candidateWords.slice(0, 4).join(' ');
      notes = cleaned;
    } else if (candidateWords.length > 0) {
      title = candidateWords.join(' ');
    } else {
      isPending = true;
    }
  } else if (type === 'income') {
    title = person ? `Received from ${person}` : 'Income';
  } else if (type === 'lent') {
    title = person ? `Lent to ${person}` : 'Lent Money';
  } else if (type === 'borrowed') {
    title = person ? `Borrowed from ${person}` : 'Borrowed Money';
  } else {
    isPending = true;
  }

  // Filter out grammatical filler words, prepositions, or generic text from title
  const cleanTitleLower = title.toLowerCase().trim();
  const isFiller = /^(and|but|or|for|to|the|a|an|of|in|on|at|by|with|from|spent|spent rupees|rupees|rupee|rs|inr|cash|upi|today|yesterday|aaj|kal|parso|amount|reason missing|others|other)$/i.test(cleanTitleLower);

  if (isFiller || cleanTitleLower.length === 0) {
    if (type === 'income') title = 'Income';
    else if (type === 'lent') title = person ? `Lent to ${person}` : 'Lent Money';
    else if (type === 'borrowed') title = person ? `Borrowed from ${person}` : 'Borrowed Money';
    else {
      title = 'Reason Missing';
      isPending = true;
    }
  } else {
    title = autocorrectTitleSpelling(title);
  }

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

export function parseMultiInput(text: string, memory: AIMemoryMap = DEFAULT_MEMORY): Transaction[] {
  if (!text || !text.trim()) return [];

  const lowerText = text.toLowerCase().trim();
  let inheritType: TransactionType | null = null;
  
  if (/^(?:lent out|lent to|lent|loaned|gave to)\b/i.test(lowerText)) {
    inheritType = 'lent';
  } else if (/^(?:borrowed from|taken from|took from|borrowed)\b/i.test(lowerText)) {
    inheritType = 'borrowed';
  } else if (/^(?:received from|got from|income from|credited)\b/i.test(lowerText)) {
    inheritType = 'income';
  } else if (/^(?:spent on|paid for|bought|spent)\b/i.test(lowerText)) {
    inheritType = 'expense';
  }

  // Split by newlines, commas, 'and', 'fir', 'then'
  let parts = text.split(/\n+|,|\b(?:and|fir|then|and then|after that|\.)\b/i).map(l => l.trim()).filter(Boolean);

  // If still a single combined line, extract distinct quantity-name or name-quantity pairs e.g. "30 banana 50 aloo 30 kismis 50 for adrak 80 apple"
  if (parts.length === 1) {
    const multiMatches = text.match(/(?:(?:\d+(?:\.\d+)?\s*(?:rs|rupees|k)?\s*(?:for\s+)?[\w\s]+)|(?:[\w\s]+\s*\d+(?:\.\d+)?\s*(?:rs|rupees|k)?))/gi);
    if (multiMatches && multiMatches.length > 1) {
      parts = multiMatches.map(p => p.trim()).filter(Boolean);
    }
  }

  const results: Transaction[] = [];
  for (const part of parts) {
    if (!part) continue;

    // Strip prefix action words from each part to get pure item name and amount
    let cleanPart = part.replace(/^(?:lent out|lent to|lent|loaned|gave to|borrowed from|taken from|took from|borrowed|received from|got from|income from|spent on|paid for|bought|spent)\s*/i, '').trim();
    if (!cleanPart) continue;

    const tx = parseSingleInput(cleanPart, memory);
    if (inheritType) {
      tx.type = inheritType;
    }
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
