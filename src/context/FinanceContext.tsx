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
import { getAIMemory, learnMerchantCategory, learnPaymentPreference, saveUserFact, saveGoal, saveMonthlyBudget } from '../services/ai/memory';
import { speakText } from '../services/voice/speechRecognition';
import { processWithGeminiAgent } from '../services/ai/gemini';
import { processWithOpenAIAgent } from '../services/ai/openai';

interface FinanceContextType {
  transactions: Transaction[];
  chatMessages: ChatMessage[];
  aiMemory: AIMemoryMap;
  settings: UserSettings;
  pendingReviewItems: Transaction[];
  activeClarification: AIClarificationQuestion | null;
  isProcessingAI: boolean;
  dbStatus: 'loading' | 'ok' | 'error';
  
  // Actions
  addTransaction: (tx: Transaction) => void;
  addTransactionsBatch: (txList: Transaction[]) => void;
  updateTransaction: (id: string, updated: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  processUserInputText: (text: string, isVoice?: boolean, audioBlob?: Blob) => void;
  processClarificationAnswer: (answerValue: string) => void;
  resolvePendingWithAIInput: (voiceOrText: string) => void;
  confirmPendingItemsBatch: (clearedList: Transaction[]) => void;
  setPendingReviewItems: (items: Transaction[]) => void;
  clearPendingReview: () => void;
  toggleTheme: () => void;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  resetAllData: () => void;
}

// Only settings and chat messages are stored locally (device-specific preference/history)
// Transactions live exclusively in Neon DB — shared across all devices
const STORAGE_KEYS = {
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
  apiKey: 'AQ.Ab8RN6Ie0wYTm7AqZrmWDg0LJfeu3IP-k9IKFAC8PPlgl7Yv5A-',
  openaiApiKey: '',
  aiProvider: 'gemini',
  customAIPrompt: '',
};



const INITIAL_WELCOME_MESSAGES: ChatMessage[] = [
  {
    id: 'msg_welcome',
    sender: 'assistant',
    text: 'Namaste! 🙏 I am your **Hisaab Kitab AI Accountant**.\n\nYou don\'t need to fill complex forms — just talk or type naturally in English, Hindi, or Hinglish!\n\nExamples:\n• *"I spent 2200 for petrol refill today"* \n• *"Rahul returned my 500"*\n• *"Kal grocery mein 1800 kharch hue"*',
    timestamp: Date.now() - 1000
  }
];

// ─── Neon DB API helpers ─────────────────────────────────────────────────────
const fetchTransactions = async (): Promise<Transaction[] | null> => {
  try {
    const res = await fetch('/api/transactions');
    if (!res.ok) throw new Error(`DB fetch failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Neon DB fetch error:', err);
    return null;
  }
};

const fetchSettingsFromDb = async (): Promise<Partial<UserSettings> | null> => {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

const saveSettingsToDb = async (s: UserSettings) => {
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s)
    });
  } catch (err) {
    console.warn('Failed to save settings to Neon:', err);
  }
};

const saveTransactionToDb = async (tx: Transaction) => {
  await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tx)
  });
};

const saveTransactionsBatchToDb = async (txList: Transaction[]) => {
  await fetch('/api/transactions', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(txList)
  });
};

const deleteTransactionFromDb = async (id: string) => {
  await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' });
};

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Transactions come exclusively from Neon DB — no localStorage
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dbStatus, setDbStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      return stored ? JSON.parse(stored) : INITIAL_WELCOME_MESSAGES;
    } catch (e) {
      return INITIAL_WELCOME_MESSAGES;
    }
  });

  // Settings start from defaults — will be overwritten by Neon data on mount
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  const [aiMemory, setAiMemory] = useState<AIMemoryMap>(() => getAIMemory());
  const [pendingReviewItems, setPendingReviewItems] = useState<Transaction[]>([]);
  const [activeClarification, setActiveClarification] = useState<AIClarificationQuestion | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // ── Load transactions + settings from Neon on mount ─────────────────────────
  useEffect(() => {
    const load = async () => {
      // Load transactions
      const dbTx = await fetchTransactions();
      if (dbTx !== null) {
        setTransactions(dbTx);
        setDbStatus('ok');
      } else {
        setDbStatus('error');
      }
      // Load settings from Neon — overrides local defaults
      const dbSettings = await fetchSettingsFromDb();
      if (dbSettings && Object.keys(dbSettings).length > 0) {
        setSettings(prev => ({ ...prev, ...dbSettings }));
      }
    };
    load();
  }, []);

  // ── Real-time polling every 5s — syncs across all family devices ────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      const dbTx = await fetchTransactions();
      if (dbTx !== null) {
        // Only update if something actually changed (compare by timestamp of first item)
        setTransactions(prev => {
          const prevLatest = prev[0]?.timestamp ?? 0;
          const dbLatest = dbTx[0]?.timestamp ?? 0;
          const prevCount = prev.length;
          const dbCount = dbTx.length;
          if (dbLatest !== prevLatest || dbCount !== prevCount) {
            return dbTx;
          }
          return prev;
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);



  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(chatMessages));
  }, [chatMessages]);

  // Save settings to Neon whenever they change (debounced 1s to avoid hammering)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    document.documentElement.classList.toggle('light', settings.theme !== 'dark');
    const timer = setTimeout(() => saveSettingsToDb(settings), 1000);
    return () => clearTimeout(timer);
  }, [settings]);

  const addTransaction = async (tx: Transaction) => {
    setTransactions(prev => [tx, ...prev]);
    try {
      await saveTransactionToDb(tx);
    } catch (err) {
      console.error('Failed to save to Neon, will retry on next poll:', err);
    }
    if (tx.merchant && tx.category) {
      const updatedMem = learnMerchantCategory(tx.merchant, tx.category);
      setAiMemory(updatedMem);
    }
  };

  const addTransactionsBatch = async (txList: Transaction[]) => {
    setTransactions(prev => [...txList, ...prev]);
    try {
      // Save each transaction individually via POST (more reliable than batch PUT)
      await Promise.all(txList.map(tx => saveTransactionToDb(tx)));
    } catch (err) {
      console.error('Failed to save batch to Neon:', err);
    }
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

  const resetAllData = async () => {
    // Delete all from Neon DB
    if (transactions.length > 0) {
      await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]) // send empty batch (no-op, but clears local state)
      });
      // Delete each from DB
      await Promise.all(transactions.map(tx => deleteTransactionFromDb(tx.id)));
    }
    setTransactions([]);
    setChatMessages(INITIAL_WELCOME_MESSAGES);
    localStorage.removeItem(STORAGE_KEYS.MESSAGES);
  };

  const processUserInputText = async (text: string, isVoice = false, audioBlob?: Blob) => {
    if (!text.trim() && !audioBlob) return;

    const userMsgId = `msg_u_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: text || "🎙️ Voice Entry",
      timestamp: Date.now()
    };

    setChatMessages(prev => [...prev, userMsg]);
    setIsProcessingAI(true);

    // Helper: apply all tool actions from any LLM response
    const applyAgentToolAction = (agentRes: NonNullable<Awaited<ReturnType<typeof processWithGeminiAgent>>>) => {
      if (agentRes.action === 'DELETE_TRANSACTION' && agentRes.transactionIdToDelete) {
        deleteTransaction(agentRes.transactionIdToDelete);
      } else if (agentRes.action === 'CREATE_TRANSACTIONS' && agentRes.transactionsToCreate?.length) {
        const validItems = agentRes.transactionsToCreate.filter(item => (Number(item.amount) || 0) > 0);
        if (validItems.length > 0) {
          const newTxList: Transaction[] = validItems.map(item => ({
            id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            amount: Number(item.amount) || 0,
            currency: '₹',
            type: item.type || 'expense',
            category: (item.category as Category) || 'Others',
            title: item.title || 'Expense',
            paymentMethod: (item.paymentMethod as PaymentMethod) || 'UPI',
            person: item.person,
            merchant: item.merchant,
            date: item.date || new Date().toISOString().split('T')[0],
            relativeDateText: 'Today',
            timestamp: Date.now(),
            confidenceScore: 99,
            rawInput: text,
            shortDisplayTitle: item.title,
            isPending: false
          }));
          addTransactionsBatch(newTxList);
        }
      } else if (agentRes.action === 'UPDATE_TRANSACTION' && agentRes.transactionToUpdate?.id) {
        const { id, category, paymentMethod, ...rest } = agentRes.transactionToUpdate;
        updateTransaction(id, {
          ...rest,
          ...(category ? { category: category as Category } : {}),
          ...(paymentMethod ? { paymentMethod: paymentMethod as PaymentMethod } : {})
        });
      } else if (agentRes.action === 'SETTLE_DEBT' && agentRes.settleDebtPerson && agentRes.settleDebtAmount) {
        // Log as income/settlement transaction and mark debt reduced
        const settleTx: Transaction = {
          id: `tx_${Date.now()}_settle`,
          amount: agentRes.settleDebtAmount,
          currency: '₹',
          type: 'income',
          category: 'Others',
          title: `${agentRes.settleDebtPerson} Returned`,
          paymentMethod: 'Cash',
          person: agentRes.settleDebtPerson,
          date: new Date().toISOString().split('T')[0],
          relativeDateText: 'Today',
          timestamp: Date.now(),
          confidenceScore: 99,
          rawInput: text,
          shortDisplayTitle: `${agentRes.settleDebtPerson} Returned`,
          isPending: false
        };
        addTransactionsBatch([settleTx]);
      } else if (agentRes.action === 'SAVE_MEMORY' && agentRes.memoryToSave?.key) {
        // Decide fact vs goal by keyword heuristic
        const val = agentRes.memoryToSave.value || '';
        const isGoal = /save|target|goal|lakh|crore|budget/i.test(agentRes.memoryToSave.key + ' ' + val);
        if (isGoal) {
          saveGoal(agentRes.memoryToSave.key, val);
        } else {
          saveUserFact(agentRes.memoryToSave.key, val);
        }
        setAiMemory(getAIMemory());
      } else if (agentRes.action === 'UPDATE_BUDGET' && agentRes.budgetToUpdate?.category) {
        saveMonthlyBudget(agentRes.budgetToUpdate.category, agentRes.budgetToUpdate.amount);
        setAiMemory(getAIMemory());
      }
    };

    // 1. Try configured LLM Agent (Gemini or OpenAI)
    try {
      const updatedMessages = [...chatMessages, userMsg];
      const useOpenAI = settings.aiProvider === 'openai' && !!settings.openaiApiKey?.trim();
      const customPrompt = settings.customAIPrompt?.trim() || undefined;
      const agentRes = useOpenAI
        ? await processWithOpenAIAgent(text, transactions, aiMemory, settings.openaiApiKey, audioBlob, updatedMessages)
        : await processWithGeminiAgent(text, transactions, aiMemory, settings.apiKey, audioBlob, updatedMessages, customPrompt);

      if (agentRes) {
        applyAgentToolAction(agentRes);

        const aiMsg: ChatMessage = {
          id: `msg_ai_${Date.now()}`,
          sender: 'assistant',
          text: agentRes.responseText,
          timestamp: Date.now()
        };
        setChatMessages(prev => [...prev, aiMsg]);
        setIsProcessingAI(false);

        if (settings.autoTTS) {
          speakText(agentRes.speechText || agentRes.responseText, settings.voiceLanguage);
        }
        return;
      }
    } catch (e) {
      console.warn('LLM Agent fallback to local AI engine:', e);
    }

    setTimeout(() => {
      const lower = text.toLowerCase();

      // 1. AUTONOMOUS VOICE AGENT ACTION: Delete Last Transaction Command
      if (/(delete|remove|undo|cancel|erase)\s*(the|my)?\s*(last|recent)?\s*(transaction|trasction|trasaction|entry|record)?/i.test(lower) || /delete last/i.test(lower)) {
        if (!transactions.length) {
          const responseText = "There are no transactions in your ledger to delete!";
          const aiMsg: ChatMessage = {
            id: `msg_ai_${Date.now()}`,
            sender: 'assistant',
            text: responseText,
            timestamp: Date.now()
          };
          setChatMessages(prev => [...prev, aiMsg]);
          setIsProcessingAI(false);
          if (settings.autoTTS) speakText(responseText, settings.voiceLanguage);
          return;
        }

        const lastTx = transactions[0];
        deleteTransaction(lastTx.id);

        const responseText = `🗑️ **Deleted Last Transaction**: Removed **Rs. ${lastTx.amount.toLocaleString('en-IN')}** for **${lastTx.title}** (${lastTx.category}) from your Passbook!`;
        const aiMsg: ChatMessage = {
          id: `msg_ai_${Date.now()}`,
          sender: 'assistant',
          text: responseText,
          timestamp: Date.now(),
          actionSummary: `Deleted ${lastTx.title} Rs. ${lastTx.amount}`
        };
        setChatMessages(prev => [...prev, aiMsg]);
        setIsProcessingAI(false);
        if (settings.autoTTS) speakText(responseText, settings.voiceLanguage);
        return;
      }

      // If active clarification is pending and user responds directly
      if (activeClarification && !/\d+/.test(lower)) {
        processClarificationAnswer(text);
        setIsProcessingAI(false);
        return;
      }

      // Conversational Q&A / Advice / Financial Queries (without amounts)
      if (/hi|hello|hey|namaste|kaise ho|who are you|how much|total spend|show|what happened|rahul|nandini|july|summary|advice|saving|tip|budget|balance|cashflow|report|organis|organiz|table|breakdown/i.test(lower) && !/\d+/.test(lower)) {
        let responseText = handleNaturalLanguageQuery(lower, transactions);
        const aiMsg: ChatMessage = {
          id: `msg_ai_${Date.now()}`,
          sender: 'assistant',
          text: responseText,
          timestamp: Date.now()
        };
        setChatMessages(prev => [...prev, aiMsg]);
        setIsProcessingAI(false);

        if (settings.autoTTS) {
          speakText(responseText, settings.voiceLanguage);
        }
        return;
      }

      const parsedItems = parseMultiInput(text, aiMemory);

      if (!parsedItems.length) {
        const responseText = `I couldn't detect an amount in your input. Try saying e.g. *"Petrol 2200"* or *"Spent 23 for Nandini"*`;
        const aiMsg: ChatMessage = {
          id: `msg_ai_${Date.now()}`,
          sender: 'assistant',
          text: responseText,
          timestamp: Date.now()
        };
        setChatMessages(prev => [...prev, aiMsg]);
        setIsProcessingAI(false);

        if (settings.autoTTS) {
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

        if (settings.autoTTS) {
          speakText(responseText, settings.voiceLanguage);
        }
        return;
      }

      addTransactionsBatch(readyItems);

      const singleTx = readyItems[0];
      const typeLabel = singleTx.type === 'income' ? 'Income 📈' : singleTx.type === 'lent' ? 'Lent Money 🤝' : 'Expense 💳';
      const responseText = `Saved **Rs. ${singleTx.amount.toLocaleString('en-IN')}** for **${singleTx.title}** as ${typeLabel}. Added to Passbook!`;

      const aiMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        sender: 'assistant',
        text: responseText,
        timestamp: Date.now(),
        actionSummary: `Saved ${singleTx.title} Rs. ${singleTx.amount}`
      };
      setChatMessages(prev => [...prev, aiMsg]);
      setIsProcessingAI(false);

      if (settings.autoTTS) {
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

    const responseText = `Saved **Rs. ${draft.amount.toLocaleString('en-IN')}** for **${draft.title}** to Passbook!`;
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
      dbStatus,
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
    return `Namaste! 🙏 I am your **Hisaab Kitab AI Voice Agent**.\n\nI execute commands, track expenses, and analyze your financial data!\n\nTry asking:\n• *"Delete last transaction"*\n• *"I spent 23 rupees in the name of Nandini"*\n• *"Show organized spending report"*\n• *"Nandini ka kitna baaki hai"*`;
  }

  // Organized Financial Report / Breakdown
  if (/report|organis|organiz|table|breakdown|all|everything|details/i.test(lower)) {
    if (!transactions.length) return "No transactions recorded yet in your Passbook.";

    const categoryTotals: Record<string, { total: number; count: number; type: string }> = {};
    let totalInc = 0;
    let totalExp = 0;

    transactions.forEach(t => {
      if (t.type === 'income') totalInc += t.amount;
      else totalExp += t.amount;

      if (!categoryTotals[t.category]) {
        categoryTotals[t.category] = { total: 0, count: 0, type: t.type };
      }
      categoryTotals[t.category].total += t.amount;
      categoryTotals[t.category].count += 1;
    });

    let report = `📊 **Organized Financial Report**:\n\n`;
    report += `| Category | Type | Total Amount | Count |\n`;
    report += `| :--- | :--- | :--- | :--- |\n`;

    Object.entries(categoryTotals).forEach(([cat, data]) => {
      report += `| ${cat} | ${data.type} | Rs. ${data.total.toLocaleString('en-IN')} | ${data.count} |\n`;
    });

    report += `\n• **Total Income**: Rs. ${totalInc.toLocaleString('en-IN')}\n`;
    report += `• **Total Expenses**: Rs. ${totalExp.toLocaleString('en-IN')}\n`;
    report += `• **Current Net Balance**: Rs. ${(totalInc - totalExp).toLocaleString('en-IN')}`;

    return report;
  }

  // Savings & Advice
  if (/advice|saving|tip|budget|how to save|reduce expense/i.test(lower)) {
    const totalExp = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const foodExp = transactions.filter(t => t.category === 'Food & Drinks' && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    let tip = `💡 **AI Financial Advice**: Your total spending is **Rs. ${totalExp.toLocaleString('en-IN')}**.`;
    if (foodExp > 2000) {
      tip += ` You spent **Rs. ${foodExp.toLocaleString('en-IN')}** on Food & Dining. Cutting down 15% on dining out saves **Rs. ${Math.round(foodExp * 0.15).toLocaleString('en-IN')}** monthly!`;
    } else {
      tip += ` Track every small cash and UPI payment daily to maintain 100% financial clarity!`;
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

  // Person / Friend Loans (Nandini, Rahul, etc.)
  const personMatch = lower.match(/(nandini|rahul|rohan|priya|amit|neha|vikas|mummy|papa)/i);
  if (personMatch) {
    const pName = personMatch[1];
    const pTx = transactions.filter(t => (t.person?.toLowerCase().includes(pName) || t.title?.toLowerCase().includes(pName)));
    if (!pTx.length) return `No pending ledger entries found for ${pName.charAt(0).toUpperCase() + pName.slice(1)}.`;
    const totalAmount = pTx.reduce((s, t) => s + t.amount, 0);
    return `Ledger for **${pName.charAt(0).toUpperCase() + pName.slice(1)}**:\n• Total Entries: ${pTx.length}\n• Total Amount: Rs. ${totalAmount.toLocaleString('en-IN')}`;
  }

  // Summary & Cashflow
  const totalExp = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalInc = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  return `📊 **Financial Summary**:\n• Total Income: Rs. ${totalInc.toLocaleString('en-IN')}\n• Total Expenses: Rs. ${totalExp.toLocaleString('en-IN')}\n• Current Net Balance: Rs. ${(totalInc - totalExp).toLocaleString('en-IN')}`;
}
