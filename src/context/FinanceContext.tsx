import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Transaction, 
  ChatMessage, 
  UserSettings, 
  AIMemoryMap, 
  AIClarificationQuestion,
  Category,
  PaymentMethod
} from '../types/finance';
import { parseMultiInput, buildClarification, applySelfCorrection } from '../services/ai/parser';
import { getAIMemory, learnMerchantCategory, learnPaymentPreference } from '../services/ai/memory';
import { speakText } from '../services/voice/speechRecognition';

interface FinanceContextType {
  transactions: Transaction[];
  chatMessages: ChatMessage[];
  aiMemory: AIMemoryMap;
  settings: UserSettings;
  pendingReviewItems: Transaction[];
  activeClarification: AIClarificationQuestion | null;
  isProcessingAI: boolean;
  
  // Actions
  addTransaction: (tx: Transaction) => void;
  addTransactionsBatch: (txList: Transaction[]) => void;
  updateTransaction: (id: string, updated: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  processUserInputText: (text: string, isVoice?: boolean) => void;
  processClarificationAnswer: (answerValue: string) => void;
  resolvePendingWithAIInput: (voiceOrText: string) => void;
  confirmPendingItemsBatch: (clearedList: Transaction[]) => void;
  setPendingReviewItems: (items: Transaction[]) => void;
  clearPendingReview: () => void;
  toggleTheme: () => void;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  resetAllData: () => void;
}

const STORAGE_KEYS = {
  TRANSACTIONS: 'hisaab_kitab_transactions',
  MESSAGES: 'hisaab_kitab_chat_messages',
  SETTINGS: 'hisaab_kitab_settings',
};

const DEFAULT_SETTINGS: UserSettings = {
  autoSaveHighConfidence: false,
  currency: 'Rs.',
  defaultPaymentMethod: 'UPI',
  theme: 'light',
  voiceLanguage: 'en-IN',
  autoTTS: false,
};

const INITIAL_DEMO_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx_demo_1',
    amount: 2200,
    currency: 'Rs.',
    type: 'expense',
    category: 'Fuel',
    title: 'Petrol at HPCL',
    merchant: 'HP Petrol Pump',
    paymentMethod: 'UPI',
    date: new Date().toISOString().split('T')[0],
    relativeDateText: 'Today',
    timestamp: Date.now() - 3600000 * 2,
    confidenceScore: 98,
    rawInput: 'Petrol 2200 UPI',
    shortDisplayTitle: 'Petrol at HPCL',
    notes: 'Petrol refill for bike',
    isPending: false
  },
  {
    id: 'tx_demo_2',
    amount: 500,
    currency: 'Rs.',
    type: 'income',
    category: 'Transfer/Settlement',
    title: 'Rahul returned cash',
    person: 'Rahul',
    paymentMethod: 'UPI',
    date: new Date().toISOString().split('T')[0],
    relativeDateText: 'Today',
    timestamp: Date.now() - 3600000 * 5,
    confidenceScore: 96,
    rawInput: 'Rahul returned my 500',
    shortDisplayTitle: 'Rahul returned cash',
    notes: 'Rahul returned borrowed cash',
    isPending: false
  },
  {
    id: 'tx_demo_3',
    amount: 1800,
    currency: 'Rs.',
    type: 'expense',
    category: 'Grocery',
    title: 'Blinkit Superstore',
    merchant: 'Blinkit Superstore',
    paymentMethod: 'UPI',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    relativeDateText: 'Yesterday',
    timestamp: Date.now() - 86400000 - 10000,
    confidenceScore: 95,
    rawInput: 'Kal grocery mein 1800 kharch hue',
    shortDisplayTitle: 'Blinkit Superstore',
    notes: 'Weekly household groceries',
    isPending: false
  },
  {
    id: 'tx_demo_4',
    amount: 50000,
    currency: 'Rs.',
    type: 'income',
    category: 'Salary',
    title: 'Monthly Company Salary',
    paymentMethod: 'Bank Transfer',
    date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
    relativeDateText: '3 days ago',
    timestamp: Date.now() - 86400000 * 3,
    confidenceScore: 99,
    rawInput: 'Salary credited 50000',
    shortDisplayTitle: 'Monthly Company Salary',
    notes: 'Monthly company salary',
    isPending: false
  }
];

const INITIAL_WELCOME_MESSAGES: ChatMessage[] = [
  {
    id: 'msg_welcome',
    sender: 'assistant',
    text: 'Namaste! 🙏 I am your **Hisaab Kitab AI Accountant**.\n\nYou don\'t need to fill complex forms — just talk or type naturally in English, Hindi, or Hinglish!\n\nExamples:\n• *"I spent 2200 for petrol refill today"* \n• *"Rahul returned my 500"*\n• *"Kal grocery mein 1800 kharch hue"*',
    timestamp: Date.now() - 1000
  }
];

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const fetchTransactions = async (): Promise<Transaction[] | null> => {
  try {
    const res = await fetch('/api/transactions');
    if (!res.ok) throw new Error('Failed to fetch transactions');
    return await res.json();
  } catch (err) {
    console.warn('Backend database API not available, using local storage:', err);
    return null;
  }
};

const saveTransactionToDb = async (tx: Transaction) => {
  try {
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx)
    });
  } catch (err) {
    console.error('Failed to save transaction to database:', err);
  }
};

const saveTransactionsBatchToDb = async (txList: Transaction[]) => {
  try {
    await fetch('/api/transactions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(txList)
    });
  } catch (err) {
    console.error('Failed to save batch to database:', err);
  }
};

const deleteTransactionFromDb = async (id: string) => {
  try {
    await fetch(`/api/transactions?id=${id}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.error('Failed to delete transaction from database:', err);
  }
};

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      return stored ? JSON.parse(stored) : INITIAL_DEMO_TRANSACTIONS;
    } catch (e) {
      return INITIAL_DEMO_TRANSACTIONS;
    }
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      return stored ? JSON.parse(stored) : INITIAL_WELCOME_MESSAGES;
    } catch (e) {
      return INITIAL_WELCOME_MESSAGES;
    }
  });

  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  });

  const [aiMemory, setAiMemory] = useState<AIMemoryMap>(() => getAIMemory());
  const [pendingReviewItems, setPendingReviewItems] = useState<Transaction[]>([]);
  const [activeClarification, setActiveClarification] = useState<AIClarificationQuestion | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // Sync with DB on mount
  useEffect(() => {
    const loadFromDb = async () => {
      const dbTx = await fetchTransactions();
      if (dbTx && dbTx.length > 0) {
        setTransactions(dbTx);
      }
    };
    loadFromDb();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  const addTransaction = (tx: Transaction) => {
    setTransactions(prev => [tx, ...prev]);
    saveTransactionToDb(tx); // Sync to Neon DB
    if (tx.merchant && tx.category) {
      const updatedMem = learnMerchantCategory(tx.merchant, tx.category);
      setAiMemory(updatedMem);
    }
  };

  const addTransactionsBatch = (txList: Transaction[]) => {
    setTransactions(prev => [...txList, ...prev]);
    saveTransactionsBatchToDb(txList); // Sync to Neon DB
    txList.forEach(tx => {
      if (tx.merchant && tx.category) {
        learnMerchantCategory(tx.merchant, tx.category);
      }
    });
    setAiMemory(getAIMemory());
  };

  const updateTransaction = (id: string, updated: Partial<Transaction>) => {
    setTransactions(prev => prev.map(t => {
      if (t.id === id) {
        const merged = { ...t, ...updated };
        saveTransactionToDb(merged); // Sync updated transaction to Neon DB
        return merged;
      }
      return t;
    }));
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    deleteTransactionFromDb(id); // Sync deletion to Neon DB
  };

  const toggleTheme = () => {
    setSettings(prev => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark'
    }));
  };

  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const clearPendingReview = () => {
    setPendingReviewItems([]);
  };

  const confirmPendingItemsBatch = (clearedList: Transaction[]) => {
    const finalized = clearedList.map(item => ({ ...item, isPending: false }));
    addTransactionsBatch(finalized);
    setPendingReviewItems([]);
  };

  const resolvePendingWithAIInput = (voiceOrText: string) => {
    if (!pendingReviewItems.length) return;

    const lower = voiceOrText.toLowerCase();
    const updatedPending = pendingReviewItems.map(item => {
      const newItem = { ...item };
      if (lower.includes('petrol') || lower.includes('fuel')) {
        newItem.category = 'Fuel';
        if (newItem.title === 'Reason Missing') newItem.title = 'Petrol Refill';
      }
      if (lower.includes('swiggy') || lower.includes('zomato') || lower.includes('dinner') || lower.includes('food')) {
        newItem.category = 'Food & Drinks';
        if (newItem.title === 'Reason Missing') newItem.title = 'Food & Dining';
      }
      if (lower.includes('grocery') || lower.includes('milk') || lower.includes('blinkit')) {
        newItem.category = 'Grocery';
        if (newItem.title === 'Reason Missing') newItem.title = 'Groceries';
      }
      return newItem;
    });

    confirmPendingItemsBatch(updatedPending);
  };

  const resetAllData = () => {
    // Clear state
    setTransactions([]);
    setChatMessages(INITIAL_WELCOME_MESSAGES);
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(STORAGE_KEYS.MESSAGES);

    // Async clear DB records
    transactions.forEach(tx => deleteTransactionFromDb(tx.id));
  };

  const processUserInputText = (text: string, isVoice = false) => {
    if (!text.trim()) return;

    const userMsgId = `msg_u_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: text,
      timestamp: Date.now()
    };

    setChatMessages(prev => [...prev, userMsg]);
    setIsProcessingAI(true);

    setTimeout(() => {
      const lower = text.toLowerCase();

      // If active clarification is pending and user responds directly
      if (activeClarification && !/\d+/.test(lower)) {
        processClarificationAnswer(text);
        setIsProcessingAI(false);
        return;
      }

      // Conversational Q&A / Advice / Financial Queries (without amounts)
      if (/hi|hello|hey|namaste|kaise ho|who are you|how much|total spend|show|what happened|rahul|july|summary|advice|saving|tip|budget|balance|cashflow/i.test(lower) && !/\d+/.test(lower)) {
        let responseText = handleNaturalLanguageQuery(lower, transactions);
        const aiMsg: ChatMessage = {
          id: `msg_ai_${Date.now()}`,
          sender: 'assistant',
          text: responseText,
          timestamp: Date.now()
        };
        setChatMessages(prev => [...prev, aiMsg]);
        setIsProcessingAI(false);

        if (isVoice || settings.autoTTS) {
          speakText(responseText, settings.voiceLanguage);
        }
        return;
      }

      const parsedItems = parseMultiInput(text, aiMemory);

      if (!parsedItems.length) {
        const responseText = `I couldn't detect an amount in your input. Try saying e.g. *"Petrol 2200"* or *"Paid Rahul 500"*`;
        const aiMsg: ChatMessage = {
          id: `msg_ai_${Date.now()}`,
          sender: 'assistant',
          text: responseText,
          timestamp: Date.now()
        };
        setChatMessages(prev => [...prev, aiMsg]);
        setIsProcessingAI(false);

        if (isVoice || settings.autoTTS) {
          speakText(responseText, settings.voiceLanguage);
        }
        return;
      }

      const pendingItems = parsedItems.filter(tx => tx.isPending);
      const readyItems = parsedItems.filter(tx => !tx.isPending);

      if (pendingItems.length > 0) {
        // Sync to Pending Section AND prompt immediately in Chat!
        addTransactionsBatch(parsedItems);
        setPendingReviewItems(parsedItems);

        const singlePending = pendingItems[0];
        const clarification = buildClarification(singlePending);
        setActiveClarification(clarification);

        const responseText = clarification?.prompt || `I logged **Rs. ${singlePending.amount}**, but the reason is missing. Please tell me what it was spent for!`;
        const aiMsg: ChatMessage = {
          id: `msg_ai_${Date.now()}`,
          sender: 'assistant',
          text: responseText,
          timestamp: Date.now(),
          clarification: clarification || undefined,
          pendingReviewItems: parsedItems
        };
        setChatMessages(prev => [...prev, aiMsg]);
        setIsProcessingAI(false);

        if (isVoice || settings.autoTTS) {
          speakText(responseText, settings.voiceLanguage);
        }
        return;
      }

      addTransactionsBatch(readyItems);

      const singleTx = readyItems[0];
      const typeLabel = singleTx.type === 'income' ? 'Income 📈' : singleTx.type === 'lent' ? 'Lent Money 🤝' : 'Expense 💳';
      const responseText = `Saved **Rs. ${singleTx.amount.toLocaleString('en-IN')}** for **${singleTx.title}** (${singleTx.category}) via **${singleTx.paymentMethod}** as ${typeLabel}. Added to Passbook!`;

      const aiMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        sender: 'assistant',
        text: responseText,
        timestamp: Date.now(),
        actionSummary: `Saved ${singleTx.title} Rs. ${singleTx.amount}`
      };
      setChatMessages(prev => [...prev, aiMsg]);
      setIsProcessingAI(false);

      if (isVoice || settings.autoTTS) {
        speakText(responseText, settings.voiceLanguage);
      }

    }, 400);
  };

  const processClarificationAnswer = (answerValue: string) => {
    if (!activeClarification) return;

    const draft = { ...activeClarification.draftTransaction };
    const field = activeClarification.field;

    if (field === 'category') draft.category = answerValue as Category;
    if (field === 'paymentMethod') draft.paymentMethod = answerValue as PaymentMethod;
    if (field === 'amount') draft.amount = parseFloat(answerValue) || 100;
    if (field === 'reason') draft.title = answerValue;

    draft.confidenceScore = 98;
    draft.isPending = false; // Cleared and added to Passbook!

    updateTransaction(draft.id, draft);
    setActiveClarification(null);

    // Remove from pendingReviewItems if present
    setPendingReviewItems(prev => prev.filter(p => p.id !== draft.id));

    const responseText = `Saved **Rs. ${draft.amount.toLocaleString('en-IN')}** for **${draft.title}** (${draft.category}) to Passbook!`;
    const aiMsg: ChatMessage = {
      id: `msg_ai_${Date.now()}`,
      sender: 'assistant',
      text: responseText,
      timestamp: Date.now()
    };
    setChatMessages(prev => [...prev, aiMsg]);
    if (settings.autoTTS) {
      speakText(responseText, settings.voiceLanguage);
    }
  };

  return (
    <FinanceContext.Provider value={{
      transactions,
      chatMessages,
      aiMemory,
      settings,
      pendingReviewItems,
      activeClarification,
      isProcessingAI,
      addTransaction,
      addTransactionsBatch,
      updateTransaction,
      deleteTransaction,
      processUserInputText,
      processClarificationAnswer,
      resolvePendingWithAIInput,
      confirmPendingItemsBatch,
      setPendingReviewItems,
      clearPendingReview,
      toggleTheme,
      updateSettings,
      resetAllData,
    }}>
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};

function handleNaturalLanguageQuery(query: string, transactions: Transaction[]): string {
  const lower = query.toLowerCase();

  // Greetings & Intros
  if (/hi|hello|hey|namaste|kaise ho|who are you|what can you do/i.test(lower)) {
    return `Namaste! 🙏 I am your **Hisaab Kitab AI Voice Accountant**. I help you record expenses, track cashflow, reconcile pending entries, and analyze your money naturally! You can talk to me in English, Hindi, or Hinglish!`;
  }

  // Savings & Advice
  if (/advice|saving|tip|budget|how to save|reduce expense/i.test(lower)) {
    const totalExp = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const foodExp = transactions.filter(t => t.category === 'Food & Drinks' && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    let tip = `💡 **AI Financial Tip**: Your total spending is **Rs. ${totalExp.toLocaleString('en-IN')}**.`;
    if (foodExp > 2000) {
      tip += ` You spent **Rs. ${foodExp.toLocaleString('en-IN')}** on Food & Dining. Cutting down 15% on dining out can save you **Rs. ${Math.round(foodExp * 0.15).toLocaleString('en-IN')}** monthly!`;
    } else {
      tip += ` Keep tracking every small cash and UPI transaction daily to maintain 100% financial clarity!`;
    }
    return tip;
  }

  // Food & Drinks
  if (lower.includes('food') || lower.includes('dinner') || lower.includes('swiggy') || lower.includes('zomato') || lower.includes('restaurant')) {
    const foodTx = transactions.filter(t => t.category === 'Food & Drinks' && t.type === 'expense');
    const total = foodTx.reduce((s, t) => s + t.amount, 0);
    return `You have spent **Rs. ${total.toLocaleString('en-IN')}** on Food & Drinks across ${foodTx.length} transactions.`;
  }

  // Fuel / Petrol
  if (lower.includes('petrol') || lower.includes('fuel') || lower.includes('diesel')) {
    const fuelTx = transactions.filter(t => t.category === 'Fuel' && t.type === 'expense');
    const total = fuelTx.reduce((s, t) => s + t.amount, 0);
    return `Total spent on Petrol/Fuel is **Rs. ${total.toLocaleString('en-IN')}** (${fuelTx.length} refills).`;
  }

  // Grocery
  if (lower.includes('grocery') || lower.includes('blinkit') || lower.includes('zepto') || lower.includes('milk')) {
    const groceryTx = transactions.filter(t => t.category === 'Grocery' && t.type === 'expense');
    const total = groceryTx.reduce((s, t) => s + t.amount, 0);
    return `Total spent on Household Groceries is **Rs. ${total.toLocaleString('en-IN')}** (${groceryTx.length} orders).`;
  }

  // Person / Friend Loans (Rahul, etc.)
  if (lower.includes('rahul') || lower.includes('friend') || lower.includes('lent') || lower.includes('borrow')) {
    const rahulTx = transactions.filter(t => (t.person?.toLowerCase().includes('rahul') || t.title?.toLowerCase().includes('rahul')));
    if (!rahulTx.length) return `No pending debt/lent records found for Rahul.`;
    const lent = rahulTx.filter(t => t.type === 'lent').reduce((s, t) => s + t.amount, 0);
    const returned = rahulTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const net = lent - returned;
    return `Summary for **Rahul**:\n• Total Money Lent: Rs. ${lent}\n• Total Returned: Rs. ${returned}\n• **Net Pending to Receive**: Rs. ${net > 0 ? net : 0}`;
  }

  // Summary & Cashflow
  const totalExp = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalInc = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  return `📊 **Financial Summary**:\n• Total Income: Rs. ${totalInc.toLocaleString('en-IN')}\n• Total Expenses: Rs. ${totalExp.toLocaleString('en-IN')}\n• Current Balance: Rs. ${(totalInc - totalExp).toLocaleString('en-IN')}`;
}
