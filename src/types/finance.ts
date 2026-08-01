export type TransactionType = 'expense' | 'income' | 'lent' | 'borrowed' | 'transfer';

export type PaymentMethod = 'UPI' | 'Cash' | 'Credit Card' | 'Debit Card' | 'Bank Transfer' | 'Wallet';

export type Category = 
  | 'Fuel' 
  | 'Food & Drinks' 
  | 'Grocery' 
  | 'Bills & Utilities' 
  | 'Shopping' 
  | 'Entertainment' 
  | 'Travel' 
  | 'Healthcare' 
  | 'Investments' 
  | 'Salary' 
  | 'Transfer/Settlement' 
  | 'Others';

export const CATEGORIES_LIST: Category[] = [
  'Fuel',
  'Food & Drinks',
  'Grocery',
  'Bills & Utilities',
  'Shopping',
  'Entertainment',
  'Travel',
  'Healthcare',
  'Investments',
  'Salary',
  'Transfer/Settlement',
  'Others'
];

export interface Transaction {
  id: string;
  amount: number;
  currency: string; // '₹'
  type: TransactionType;
  category: Category;
  title: string; // User-provided name or 'Reason Missing'
  merchant?: string;
  person?: string;
  notes?: string;
  shortDisplayTitle?: string;
  paymentMethod: PaymentMethod;
  date: string; // Defaults to current date if missing
  relativeDateText?: string;
  timestamp: number;
  confidenceScore: number;
  rawInput?: string;
  audioRecordUrl?: string;
  location?: string;
  tags?: string[];
  isPending?: boolean;
}

export interface ClarificationOption {
  label: string;
  value: string;
  icon?: string;
}

export interface AIClarificationQuestion {
  transactionId?: string;
  field: 'type' | 'category' | 'paymentMethod' | 'person' | 'date' | 'amount' | 'reason';
  prompt: string;
  options: ClarificationOption[];
  draftTransaction: Transaction;
}

export interface AIMemoryMap {
  merchants: Record<string, Category>;
  contacts: Record<string, string>;
  paymentPreferences: Record<string, PaymentMethod>;
  userFacts?: Record<string, string>;
  goals?: Record<string, string>;
  monthlyBudgets?: Record<string, number>;
}

export interface ReceiptItem {
  name: string;
  price: number;
  category?: Category;
}

export interface ReceiptData {
  merchant: string;
  date: string;
  totalAmount: number;
  gstNumber?: string;
  taxAmount?: number;
  items: ReceiptItem[];
  confidence: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  audioUrl?: string;
  confidenceScore?: number;
  pendingReviewItems?: Transaction[];
  clarification?: AIClarificationQuestion;
  actionSummary?: string;
}

export interface UserSettings {
  autoSaveHighConfidence: boolean;
  currency: string;
  defaultPaymentMethod: PaymentMethod;
  theme: 'dark' | 'light';
  apiKey?: string;
  openaiApiKey?: string;
  aiProvider?: 'gemini' | 'openai';
  voiceLanguage: 'en-IN' | 'hi-IN' | 'hinglish';
  autoTTS: boolean;
}
