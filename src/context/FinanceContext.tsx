import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  Transaction, 
  ChatMessage, 
  UserSettings, 
  AIMemoryMap, 
  AIClarificationQuestion,
  Category,
  PaymentMethod,
  AppUser
} from '../types/finance';
import { parseMultiInput, buildClarification, applySelfCorrection } from '../services/ai/parser';
import { getAIMemory, learnMerchantCategory, learnPaymentPreference, saveUserFact, saveGoal, saveMonthlyBudget } from '../services/ai/memory';
import { speakText } from '../services/voice/speechRecognition';
import { processWithGeminiAgent } from '../services/ai/gemini';
import { processWithOpenAIAgent } from '../services/ai/openai';

interface FinanceContextType {
  currentUser: AppUser | null;
  transactions: Transaction[];
  chatMessages: ChatMessage[];
  aiMemory: AIMemoryMap;
  settings: UserSettings;
  pendingReviewItems: Transaction[];
  activeClarification: AIClarificationQuestion | null;
  isProcessingAI: boolean;
  dbStatus: 'loading' | 'ok' | 'error';
  
  // Actions
  login: (user: AppUser) => void;
  logout: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
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

import { DEFAULT_OPENAI_KEY, getActiveOpenAIKey } from '../utils/aiKeys';

const DEFAULT_SETTINGS: UserSettings = {
  autoSaveHighConfidence: false,
  currency: 'Rs.',
  defaultPaymentMethod: 'UPI',
  theme: 'system',
  voiceLanguage: 'en-IN',
  autoTTS: false,
  apiKey: 'AQ.Ab8RN6Ie0wYTm7AqZrmWDg0LJfeu3IP-k9IKFAC8PPlgl7Yv5A-',
  openaiApiKey: DEFAULT_OPENAI_KEY,
  aiProvider: 'openai',
  customAIPrompt: '',
  botAvatarUrl: '',
  userAvatarUrl: '',
  aiAccountantName: 'My Accountant',
  accentColor: 'emerald',
  fontSize: 'base',
  chatBubbleStyle: 'flat',
  chatBubbleSize: 'normal',
  floatingBubbleSize: 'md',
};

const INITIAL_WELCOME_MESSAGES: ChatMessage[] = [
  {
    id: 'msg_welcome',
    sender: 'assistant',
    text: 'Namaste! 🙏 I am your **Hisaab Kitab AI Accountant**.\n\nYou don\'t need to fill complex forms — just talk or type naturally in English, Hindi, or Hinglish!\n\nExamples:\n• *"I spent 2200 for petrol refill today"* \n• *"Rahul returned my 500"*\n• *"Kal grocery mein 1800 kharch hue"*',
    timestamp: Date.now() - 1000
  }
];

// ─── Neon DB API helpers (scoped by userId) ─────────────────────────────────
const fetchTransactions = async (userId: string): Promise<Transaction[] | null> => {
  try {
    const res = await fetch(`/api/transactions?userId=${userId}`);
    if (!res.ok) throw new Error(`DB fetch failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Neon DB fetch error:', err);
    return null;
  }
};

const fetchSettingsFromDb = async (userId: string): Promise<Partial<UserSettings> | null> => {
  try {
    const res = await fetch(`/api/settings?userId=${userId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

const saveSettingsToDb = async (s: UserSettings, userId: string) => {
  try {
    await fetch(`/api/settings?userId=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...s, userId })
    });
  } catch (err) {
    console.warn('Failed to save settings to Neon:', err);
  }
};

const saveTransactionToDb = async (tx: Transaction, userId: string) => {
  await fetch(`/api/transactions?userId=${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...tx, userId })
  });
};

const saveTransactionsBatchToDb = async (txList: Transaction[], userId: string) => {
  await fetch(`/api/transactions?userId=${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(txList.map(t => ({ ...t, userId })))
  });
};

const deleteTransactionFromDb = async (id: string, userId: string) => {
  await fetch(`/api/transactions?id=${id}&userId=${userId}`, { method: 'DELETE' });
};

const fetchMessagesFromDb = async (userId: string): Promise<ChatMessage[] | null> => {
  try {
    const res = await fetch(`/api/messages?userId=${userId}`);
    if (!res.ok) return null;
    const rows = await res.json();
    return rows.length > 0 ? rows : null;
  } catch { return null; }
};

const saveMessageToDb = async (msg: ChatMessage, userId: string) => {
  try {
    await fetch(`/api/messages?userId=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...msg, userId })
    });
  } catch (e) { console.warn('Failed to save message:', e); }
};

const deleteAllMessagesFromDb = async (userId: string) => {
  try { await fetch(`/api/messages?userId=${userId}`, { method: 'DELETE' }); } catch {}
};

const fetchMemoryFromDb = async (userId: string) => {
  try {
    const res = await fetch(`/api/memory?userId=${userId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
};

const saveMemoryToDb = async (mem: AIMemoryMap, userId: string) => {
  try {
    await fetch(`/api/memory?userId=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...mem, userId })
    });
  } catch (e) { console.warn('Failed to save memory:', e); }
};

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem('hk_active_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const activeUserId = currentUser?.id || 'nandini';

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dbStatus, setDbStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_WELCOME_MESSAGES);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [aiMemory, setAiMemory] = useState<AIMemoryMap>(() => getAIMemory());
  const [pendingReviewItems, setPendingReviewItems] = useState<Transaction[]>([]);
  const [activeClarification, setActiveClarification] = useState<AIClarificationQuestion | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // ── Load user bucket from Neon on mount or activeUserId change ──────────────
  const loadUserBucket = useCallback(async (uid: string) => {
    setDbStatus('loading');

    // 1. Transactions
    const dbTx = await fetchTransactions(uid);
    if (dbTx !== null) { setTransactions(dbTx); setDbStatus('ok'); }
    else setDbStatus('error');

    // 2. Settings
    const dbSettings = await fetchSettingsFromDb(uid);
    setSettings({
      ...DEFAULT_SETTINGS,
      ...(dbSettings || {})
    });

    // 3. Chat messages
    const dbMsgs = await fetchMessagesFromDb(uid);
    if (dbMsgs && dbMsgs.length > 0) {
      setChatMessages(dbMsgs);
    } else {
      setChatMessages(INITIAL_WELCOME_MESSAGES);
    }

    // 4. AI memory
    const dbMemory = await fetchMemoryFromDb(uid);
    if (dbMemory && Object.keys(dbMemory).length > 0) {
      setAiMemory(prev => ({
        ...prev,
        ...dbMemory,
        merchants: { ...prev.merchants, ...(dbMemory.merchants || {}) },
        contacts: { ...prev.contacts, ...(dbMemory.contacts || {}) },
        paymentPreferences: { ...prev.paymentPreferences, ...(dbMemory.paymentPreferences || {}) }
      }));
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadUserBucket(currentUser.id);
    }
  }, [currentUser, loadUserBucket]);

  // ── Real-time polling every 5s — syncs user's transactions + chat messages ──
  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(async () => {
      const uid = currentUser.id;

      // Poll Transactions
      const dbTx = await fetchTransactions(uid);
      if (dbTx !== null) {
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

      // Poll Chat Messages
      const dbMsgs = await fetchMessagesFromDb(uid);
      if (dbMsgs !== null) {
        setChatMessages(prev => {
          const prevMap = new Map(prev.map(m => [m.id, m]));
          const merged = dbMsgs.map(dbMsg => {
            const existing = prevMap.get(dbMsg.id);
            return {
              ...dbMsg,
              pendingReviewItems: existing?.pendingReviewItems || (dbMsg as any).pendingReviewItems,
              actionSummary: existing?.actionSummary || (dbMsg as any).actionSummary,
              clarification: existing?.clarification || (dbMsg as any).clarification
            };
          });

          const prevLatest = prev[prev.length - 1]?.id ?? '';
          const dbLatest = dbMsgs[dbMsgs.length - 1]?.id ?? '';
          if (dbLatest !== prevLatest || prev.length !== dbMsgs.length) {
            return merged;
          }
          return prev;
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [currentUser]);

  // Apply theme styling dynamically
  useEffect(() => {
    const applyTheme = () => {
      const isDark = 
        settings.theme === 'dark' || 
        (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.classList.toggle('light', !isDark);
    };
    applyTheme();

    if (settings.theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [settings.theme]);

  // Auth Functions
  const login = (user: AppUser) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('hk_active_user', JSON.stringify(user));
    } catch {}
  };

  const logout = async () => {
    try {
      await fetch('/api/auth?action=logout', { method: 'POST' });
    } catch {}
    setCurrentUser(null);
    try {
      localStorage.removeItem('hk_active_user');
    } catch {}
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    if (!currentUser) return { success: false, error: 'No active session' };
    try {
      const res = await fetch('/api/auth?action=change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          oldPassword,
          newPassword
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update password' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const addTransaction = (tx: Transaction) => {
    const enriched = { ...tx, userId: activeUserId };
    setTransactions(prev => [enriched, ...prev]);
    saveTransactionToDb(enriched, activeUserId);

    if (tx.merchant) learnMerchantCategory(tx.merchant, tx.category);
    if (tx.paymentMethod) learnPaymentPreference(tx.title, tx.paymentMethod);
    setAiMemory(getAIMemory());
    saveMemoryToDb(getAIMemory(), activeUserId);
  };

  const addTransactionsBatch = (txList: Transaction[]) => {
    const enrichedList = txList.map(tx => ({ ...tx, userId: activeUserId }));
    setTransactions(prev => [...enrichedList, ...prev]);
    saveTransactionsBatchToDb(enrichedList, activeUserId);

    enrichedList.forEach(tx => {
      if (tx.merchant) learnMerchantCategory(tx.merchant, tx.category);
      if (tx.paymentMethod) learnPaymentPreference(tx.title, tx.paymentMethod);
    });
    setAiMemory(getAIMemory());
    saveMemoryToDb(getAIMemory(), activeUserId);
  };

  const updateTransaction = (id: string, updated: Partial<Transaction>) => {
    setTransactions(prev => prev.map(t => {
      if (t.id === id) {
        const full = { ...t, ...updated, userId: activeUserId };
        saveTransactionToDb(full, activeUserId);
        return full;
      }
      return t;
    }));
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    deleteTransactionFromDb(id, activeUserId);
  };

  const clearPendingReview = () => setPendingReviewItems([]);

  const toggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: nextTheme });
  };

  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      saveSettingsToDb(updated, activeUserId);
      return updated;
    });
  };

  const resetAllData = () => {
    setTransactions([]);
    setChatMessages(INITIAL_WELCOME_MESSAGES);
    setPendingReviewItems([]);
    setActiveClarification(null);
    deleteAllMessagesFromDb(activeUserId);
  };

  const confirmPendingItemsBatch = (clearedList: Transaction[]) => {
    clearedList.forEach(tx => {
      updateTransaction(tx.id, { ...tx, isPending: false });
    });
    setPendingReviewItems(prev => prev.filter(p => !clearedList.some(c => c.id === p.id)));
  };

  const processUserInputText = async (text: string, isVoice = false, audioBlob?: Blob) => {
    if (!text.trim() && !audioBlob) return;
    setIsProcessingAI(true);

    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text: text || '🎤 Spoken Voice Command',
      timestamp: Date.now(),
      isVoice
    };

    setChatMessages(prev => [...prev, userMsg]);
    saveMessageToDb(userMsg, activeUserId);

    const applyAgentToolAction = (agentRes: any) => {
      if (agentRes.action === 'CREATE_TRANSACTIONS' && agentRes.transactionsToCreate?.length) {
        const newTxList: Transaction[] = agentRes.transactionsToCreate.map((t: any, idx: number) => ({
          id: `tx_${Date.now()}_${idx}`,
          amount: Number(t.amount || 0),
          currency: '₹',
          type: t.type || 'expense',
          category: (t.category as Category) || 'Others',
          title: t.title || 'Expense',
          merchant: t.merchant,
          paymentMethod: (t.paymentMethod as PaymentMethod) || 'UPI',
          date: new Date().toISOString().split('T')[0],
          relativeDateText: 'Today',
          timestamp: Date.now() + idx,
          confidenceScore: 95,
          isPending: true,
          person: t.person,
          userId: activeUserId
        }));

        addTransactionsBatch(newTxList);
        setPendingReviewItems(prev => [...prev, ...newTxList]);
      } else if (agentRes.action === 'DELETE_TRANSACTION' && agentRes.transactionIdToDelete) {
        deleteTransaction(agentRes.transactionIdToDelete);
      } else if (agentRes.action === 'UPDATE_TRANSACTION' && agentRes.transactionToUpdate?.id) {
        updateTransaction(agentRes.transactionToUpdate.id, agentRes.transactionToUpdate);
      } else if (agentRes.action === 'SAVE_MEMORY' && agentRes.memoryToSave?.key) {
        const val = agentRes.memoryToSave.value;
        if (/birthday|anniversary|date/i.test(agentRes.memoryToSave.key)) {
          saveUserFact(agentRes.memoryToSave.key, val);
        } else if (/budget|target|limit/i.test(agentRes.memoryToSave.key)) {
          const amt = parseFloat(val) || 10000;
          saveMonthlyBudget('Overall', amt);
        } else {
          saveUserFact(agentRes.memoryToSave.key, val);
        }
        setAiMemory(getAIMemory());
        saveMemoryToDb(getAIMemory(), activeUserId);
      } else if (agentRes.action === 'UPDATE_BUDGET' && agentRes.budgetToUpdate?.category) {
        saveMonthlyBudget(agentRes.budgetToUpdate.category, agentRes.budgetToUpdate.amount);
        setAiMemory(getAIMemory());
        saveMemoryToDb(getAIMemory(), activeUserId);
      }
    };

    // 1. Try configured LLM Agent (Gemini or OpenAI)
    try {
      const updatedMessages = [...chatMessages, userMsg];
      const activeOpenAIKey = getActiveOpenAIKey(settings.openaiApiKey);
      const useOpenAI = settings.aiProvider === 'openai' || !settings.aiProvider || !settings.apiKey;
      const customPrompt = settings.customAIPrompt?.trim() || undefined;

      const agentRes = useOpenAI
        ? await processWithOpenAIAgent(text, transactions, aiMemory, activeOpenAIKey, audioBlob, updatedMessages)
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
        saveMessageToDb(aiMsg, activeUserId);
        setIsProcessingAI(false);

        if (settings.autoTTS) {
          speakText(agentRes.speechText || agentRes.responseText, settings.voiceLanguage);
        }
        return;
      }
    } catch (e) {
      console.warn('LLM Agent fallback to local AI engine:', e);
    }

    // Fallback local engine
    setTimeout(() => {
      const lower = text.toLowerCase().trim();
      const parsedItems = parseMultiInput(text, aiMemory).map(tx => ({ ...tx, isPending: true, userId: activeUserId }));
      
      if (!parsedItems.length) {
        let responseText = `I couldn't detect an amount in your input. Try saying e.g. *"Petrol 2200"* or *"Spent 23 for Nandini"*`;

        if (/hello|hi|namaste|hey|who are you/i.test(lower)) {
          responseText = `Namaste! 🙏 I am your Funds Log Accountant. You can dictate expenses like *"Spent 500 for Grocery"* or ask me about your balances!`;
        } else if (/total|spent|summary|balance|expenses|income/i.test(lower)) {
          const totalSpent = transactions.filter(t => !t.isPending && (t.type === 'expense' || t.type === 'lent')).reduce((sum, t) => sum + Number(t.amount || 0), 0);
          const totalInc = transactions.filter(t => !t.isPending && t.type === 'income').reduce((sum, t) => sum + Number(t.amount || 0), 0);
          responseText = `📊 **Funds Log Summary**:\n• Total Income: **₹${totalInc.toLocaleString('en-IN')}**\n• Total Spent: **₹${totalSpent.toLocaleString('en-IN')}**\n• Total Recorded Entries: **${transactions.length}**`;
        }

        const aiMsg: ChatMessage = {
          id: `msg_ai_${Date.now()}`,
          sender: 'assistant',
          text: responseText,
          timestamp: Date.now()
        };
        setChatMessages(prev => [...prev, aiMsg]);
        saveMessageToDb(aiMsg, activeUserId);
        setIsProcessingAI(false);
        return;
      }

      addTransactionsBatch(parsedItems);
      setPendingReviewItems(prev => [...prev, ...parsedItems]);

      const responseText = `I extracted these entries from your input. Please verify spellings and details below before saving to your Passbook:`;
      const aiMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        sender: 'assistant',
        text: responseText,
        timestamp: Date.now(),
        pendingReviewItems: parsedItems
      };
      setChatMessages(prev => [...prev, aiMsg]);
      saveMessageToDb(aiMsg, activeUserId);
      setIsProcessingAI(false);

      if (settings.autoTTS) speakText(responseText, settings.voiceLanguage);
    }, 300);
  };

  const processClarificationAnswer = (answerValue: string) => {
    if (!activeClarification) return;
    const draft = { ...activeClarification.draftTransaction, userId: activeUserId };
    const field = activeClarification.field;

    if (field === 'category') draft.category = answerValue as Category;
    if (field === 'paymentMethod') draft.paymentMethod = answerValue as PaymentMethod;
    if (field === 'amount') draft.amount = parseFloat(answerValue) || 100;
    if (field === 'reason') draft.title = answerValue;

    draft.confidenceScore = 98;
    draft.isPending = false;

    updateTransaction(draft.id, draft);
    setActiveClarification(null);
    setPendingReviewItems(prev => prev.filter(p => p.id !== draft.id));

    const responseText = `Saved **Rs. ${Number(draft.amount || 0).toLocaleString('en-IN')}** for **${draft.title}** to Passbook!`;
    const aiMsg: ChatMessage = {
      id: `msg_ai_${Date.now()}`,
      sender: 'assistant',
      text: responseText,
      timestamp: Date.now()
    };
    setChatMessages(prev => [...prev, aiMsg]);
    saveMessageToDb(aiMsg, activeUserId);
  };

  const resolvePendingWithAIInput = (voiceOrText: string) => {
    if (!pendingReviewItems.length || !voiceOrText.trim()) return;
    const lower = voiceOrText.toLowerCase();

    const cleared: Transaction[] = [];
    const remaining = pendingReviewItems.filter((item, idx) => {
      const isFirst = idx === 0;
      let matchedReason = '';

      if (lower.includes('petrol') || lower.includes('fuel')) matchedReason = 'Petrol Refill';
      else if (lower.includes('swiggy') || lower.includes('food') || lower.includes('dinner')) matchedReason = 'Food & Dining';
      else if (lower.includes('grocery') || lower.includes('milk')) matchedReason = 'Household Grocery';

      if (matchedReason && isFirst) {
        cleared.push({ ...item, title: matchedReason, notes: matchedReason, isPending: false });
        return false;
      }
      return true;
    });

    if (cleared.length > 0) {
      confirmPendingItemsBatch(cleared);
      setPendingReviewItems(remaining);
    }
  };

  return (
    <FinanceContext.Provider value={{
      currentUser,
      transactions,
      chatMessages,
      aiMemory,
      settings,
      pendingReviewItems,
      activeClarification,
      isProcessingAI,
      dbStatus,
      login,
      logout,
      changePassword,
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
      resetAllData
    }}>
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) throw new Error('useFinance must be used within FinanceProvider');
  return context;
};
