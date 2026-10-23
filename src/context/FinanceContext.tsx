import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  Transaction, 
  ChatMessage, 
  UserSettings, 
  AIMemoryMap, 
  AIClarificationQuestion,
  Category,
  PaymentMethod,
  AppUser,
  isBusinessPartner
} from '../types/finance';
import { parseMultiInput, buildClarification, applySelfCorrection } from '../services/ai/parser';
import { getAIMemory, learnMerchantCategory, learnPaymentPreference, saveUserFact, saveGoal, saveMonthlyBudget } from '../services/ai/memory';
import { speakText } from '../services/voice/speechRecognition';
import { processWithGeminiAgent } from '../services/ai/gemini';
import { processWithOpenAIAgent } from '../services/ai/openai';
import { getStartOfTodayTimestamp } from '../utils/dateUtils';

interface BusinessSettlement {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  fairSharePerPartner: number;
  praveenIncome: number;
  praveenExpense: number;
  praveenCashHeld: number;
  praveenDirectGiven: number;
  sarthakIncome: number;
  sarthakExpense: number;
  sarthakCashHeld: number;
  sarthakDirectGiven: number;
  praveenOperatingDue: number;
  sarthakOperatingDue: number;
  praveenNetDue: number;
  sarthakNetDue: number;
  praveenOwesSarthak: number;
  sarthakOwesPraveen: number;
  praveenCurrentAmount: number;
  sarthakCurrentAmount: number;
  settlementText: string;
  payerName?: string;
  payeeName?: string;
  amountDue: number;
}

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
  accountMode: 'personal' | 'business';
  businessSettlement: BusinessSettlement;
  
  // Actions
  setAccountMode: (mode: 'personal' | 'business') => void;
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
import { 
  queueOfflineTransaction, 
  queueOfflineDelete, 
  syncOfflineQueueWithServer,
  getOfflineTransactionQueue 
} from '../utils/syncService';
import { 
  sendPartnerBusinessAlert, 
  checkAndTriggerDailyRecap 
} from '../utils/notificationService';

const DEFAULT_SETTINGS: UserSettings = {
  autoSaveHighConfidence: false,
  currency: 'Rs.',
  defaultPaymentMethod: 'UPI',
  theme: 'system',
  voiceLanguage: 'en-IN',
  autoTTS: false,
  apiKey: '',
  openaiApiKey: DEFAULT_OPENAI_KEY,
  aiProvider: 'openai',
  customAIPrompt: '',
  botAvatarUrl: '/logo.png',
  userAvatarUrl: '',
  aiAccountantName: 'My Accountant',
  accentColor: 'emerald',
  fontSize: 'base',
  chatBubbleStyle: 'flat',
  chatBubbleSize: 'normal',
  floatingBubbleSize: 'md',
  dailyRecapEnabled: true,
  dailyRecapTime: '21:00',
  partnerAlertsEnabled: true,
  notificationSoundEnabled: true,
  biometricPasskeyEnabled: false,
};

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
  const enteredBy = tx.enteredBy || (userId === 'sarthak' ? 'Sarthak' : 'Praveen');
  const enriched = { ...tx, userId, enteredBy };
  try {
    const res = await fetch(`/api/transactions?userId=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enriched)
    });
    if (!res.ok) throw new Error('Network error');
  } catch (err) {
    console.warn('Network issue: queued transaction offline', err);
    queueOfflineTransaction(enriched);
  }
};

const saveTransactionsBatchToDb = async (txList: Transaction[], userId: string) => {
  const enrichedList = txList.map(t => ({ ...t, userId, enteredBy: t.enteredBy || (userId === 'sarthak' ? 'Sarthak' : 'Praveen') }));
  try {
    const res = await fetch(`/api/transactions?userId=${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrichedList)
    });
    if (!res.ok) throw new Error('Network error');
  } catch (err) {
    enrichedList.forEach(t => queueOfflineTransaction(t));
  }
};

const deleteTransactionFromDb = async (id: string, userId: string) => {
  try {
    const res = await fetch(`/api/transactions?id=${id}&userId=${userId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Network error');
  } catch {
    queueOfflineDelete(id);
  }
};

const fetchMessagesFromDb = async (userId: string): Promise<ChatMessage[] | null> => {
  try {
    const startOfToday = getStartOfTodayTimestamp();
    const res = await fetch(`/api/messages?userId=${userId}&since=${startOfToday}`);
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;
    const todayRows = rows.filter((r: any) => Number(r.timestamp) >= startOfToday);
    return todayRows;
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

  // Instant 0ms cache-first state initialization
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const user = localStorage.getItem('hk_active_user');
      const uid = user ? JSON.parse(user)?.id : 'nandini';
      const cached = localStorage.getItem(`hk_cached_tx_${uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [dbStatus, setDbStatus] = useState<'loading' | 'ok' | 'error'>(() => {
    try {
      const user = localStorage.getItem('hk_active_user');
      const uid = user ? JSON.parse(user)?.id : 'nandini';
      const cached = localStorage.getItem(`hk_cached_tx_${uid}`);
      return cached ? 'ok' : 'loading';
    } catch {
      return 'loading';
    }
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const user = localStorage.getItem('hk_active_user');
      const uid = user ? JSON.parse(user)?.id : 'nandini';
      const cached = localStorage.getItem(`hk_cached_msgs_${uid}`);
      if (!cached) return [];
      const parsed: ChatMessage[] = JSON.parse(cached);
      const startOfToday = getStartOfTodayTimestamp();
      return parsed.filter(
        m => Number(m.timestamp) >= startOfToday && m.id !== 'msg_welcome' && m.id !== 'welcome_business_msg'
      );
    } catch {
      return [];
    }
  });

  // Track recent local mutations so background polls NEVER revert optimistic updates ("goes away and comes with jerk")
  const inFlightMutationsRef = React.useRef<number>(0);
  const lastMutationTsRef = React.useRef<number>(0);
  const localTxOverridesRef = React.useRef<Map<string, { tx: Transaction; updatedAt: number }>>(new Map());
  const deletedTxIdsRef = React.useRef<Map<string, number>>(new Map());
  const localMsgOverridesRef = React.useRef<Map<string, { msg: ChatMessage; updatedAt: number }>>(new Map());

  const persistLocalChatMessages = useCallback((list: ChatMessage[], uid: string) => {
    try {
      localStorage.setItem(`hk_cached_msgs_${uid}`, JSON.stringify(list));
    } catch {}
  }, []);

  const mergeDbTransactions = useCallback((prev: Transaction[], dbTx: Transaction[], uid: string): Transaction[] => {
    const now = Date.now();
    const OVERRIDE_TTL = 20000; // Protect local changes for 20 seconds against stale DB reads

    // Clean expired overrides
    localTxOverridesRef.current.forEach((v, k) => {
      if (now - v.updatedAt > OVERRIDE_TTL) localTxOverridesRef.current.delete(k);
    });
    deletedTxIdsRef.current.forEach((ts, k) => {
      if (now - ts > OVERRIDE_TTL) deletedTxIdsRef.current.delete(k);
    });

    // Apply local overrides to DB rows and filter out recently deleted IDs
    const processedDb = dbTx
      .filter(t => !deletedTxIdsRef.current.has(t.id))
      .map(t => {
        const override = localTxOverridesRef.current.get(t.id);
        return override ? override.tx : t;
      });

    const dbIds = new Set(processedDb.map(t => t.id));

    // Include any local override items or unsynced pending items not yet in DB response
    const missingLocal: Transaction[] = [];
    localTxOverridesRef.current.forEach(({ tx }) => {
      if (!dbIds.has(tx.id) && !deletedTxIdsRef.current.has(tx.id)) {
        missingLocal.push(tx);
        dbIds.add(tx.id);
      }
    });

    prev.forEach(t => {
      if (!dbIds.has(t.id) && !deletedTxIdsRef.current.has(t.id) && t.isPending) {
        missingLocal.push(t);
        dbIds.add(t.id);
      }
    });

    const merged = [...missingLocal, ...processedDb];

    // Deep check if anything actually changed to prevent unnecessary re-renders / scroll jumps
    const isSame =
      prev.length === merged.length &&
      prev.every((p, i) => {
        const m = merged[i];
        return (
          p.id === m?.id &&
          p.amount === m?.amount &&
          p.title === m?.title &&
          Boolean(p.isPending) === Boolean(m?.isPending) &&
          p.type === m?.type &&
          p.category === m?.category
        );
      });

    if (isSame) return prev;

    try {
      localStorage.setItem(`hk_cached_tx_${uid}`, JSON.stringify(merged));
    } catch {}
    return merged;
  }, []);

  const mergeDbMessages = useCallback((prev: ChatMessage[], dbMsgs: ChatMessage[], uid: string): ChatMessage[] => {
    const now = Date.now();
    const startOfToday = getStartOfTodayTimestamp();
    const OVERRIDE_TTL = 20000;

    localMsgOverridesRef.current.forEach((v, k) => {
      if (now - v.updatedAt > OVERRIDE_TTL) localMsgOverridesRef.current.delete(k);
    });

    const todayDbMsgs = dbMsgs.filter(
      m => Number(m.timestamp) >= startOfToday && m.id !== 'msg_welcome' && m.id !== 'welcome_business_msg'
    );

    const prevMap = new Map(prev.map(m => [m.id, m]));
    const merged = todayDbMsgs.map(dbMsg => {
      const override = localMsgOverridesRef.current.get(dbMsg.id);
      if (override) return override.msg;
      const existing = prevMap.get(dbMsg.id);
      return {
        ...dbMsg,
        pendingReviewItems: existing?.pendingReviewItems ?? (dbMsg as any).pendingReviewItems,
        actionSummary: existing?.actionSummary ?? (dbMsg as any).actionSummary,
        clarification: existing?.clarification ?? (dbMsg as any).clarification
      };
    });

    const dbMsgIds = new Set(merged.map(m => m.id));

    // Preserve local messages created or updated recently that haven't appeared in DB poll yet
    const localUnsynced: ChatMessage[] = [];
    prev.forEach(m => {
      if (
        !dbMsgIds.has(m.id) &&
        m.id !== 'msg_welcome' &&
        m.id !== 'welcome_business_msg' &&
        Number(m.timestamp) >= startOfToday
      ) {
        localUnsynced.push(m);
        dbMsgIds.add(m.id);
      }
    });

    const fullList = [...merged, ...localUnsynced].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

    const isSame =
      prev.length === fullList.length &&
      prev.every((p, i) => {
        const f = fullList[i];
        return (
          p.id === f?.id &&
          p.text === f?.text &&
          JSON.stringify(p.pendingReviewItems || []) === JSON.stringify(f?.pendingReviewItems || [])
        );
      });

    if (isSame) return prev;

    persistLocalChatMessages(fullList, uid);
    return fullList;
  }, [persistLocalChatMessages]);

  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const user = localStorage.getItem('hk_active_user');
      const uid = user ? JSON.parse(user)?.id : 'nandini';
      const cached = localStorage.getItem(`hk_cached_settings_${uid}`);
      return cached ? { ...DEFAULT_SETTINGS, ...JSON.parse(cached) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [aiMemory, setAiMemory] = useState<AIMemoryMap>(() => {
    try {
      const user = localStorage.getItem('hk_active_user');
      const uid = user ? JSON.parse(user)?.id : 'nandini';
      const cached = localStorage.getItem(`hk_cached_memory_${uid}`);
      return cached ? { ...getAIMemory(), ...JSON.parse(cached) } : getAIMemory();
    } catch {
      return getAIMemory();
    }
  });

  const [pendingReviewItems, setPendingReviewItems] = useState<Transaction[]>([]);
  const [activeClarification, setActiveClarification] = useState<AIClarificationQuestion | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // ── Parallel high-speed background synchronization with smart diffing ───────
  const loadUserBucket = useCallback(async (uid: string) => {
    try {
      const [dbTx, dbSettings, dbMsgs, dbMemory] = await Promise.all([
        fetchTransactions(uid),
        fetchSettingsFromDb(uid),
        fetchMessagesFromDb(uid),
        fetchMemoryFromDb(uid)
      ]);

      // 1. Transactions — merge safely with local overrides
      if (dbTx !== null) {
        setTransactions(prev => mergeDbTransactions(prev, dbTx, uid));
        setDbStatus('ok');
      } else {
        setDbStatus(prev => (prev === 'ok' ? 'ok' : 'error'));
      }

      // 2. Settings
      if (dbSettings) {
        const mergedSettings = { ...DEFAULT_SETTINGS, ...dbSettings };
        setSettings(prev => {
          if (JSON.stringify(prev) === JSON.stringify(mergedSettings)) return prev;
          try {
            localStorage.setItem(`hk_cached_settings_${uid}`, JSON.stringify(mergedSettings));
          } catch {}
          return mergedSettings;
        });
      }

      // 3. Chat Messages (today only, no welcome bubble)
      if (dbMsgs !== null) {
        setChatMessages(prev => mergeDbMessages(prev, dbMsgs, uid));
      }

      // 4. Memory
      if (dbMemory && Object.keys(dbMemory).length > 0) {
        setAiMemory(prev => {
          const merged = {
            ...prev,
            ...dbMemory,
            merchants: { ...prev.merchants, ...(dbMemory.merchants || {}) },
            contacts: { ...prev.contacts, ...(dbMemory.contacts || {}) },
            paymentPreferences: { ...prev.paymentPreferences, ...(dbMemory.paymentPreferences || {}) }
          };
          try {
            localStorage.setItem(`hk_cached_memory_${uid}`, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
    } catch (err) {
      console.warn('Background sync error:', err);
      setDbStatus(prev => (prev === 'ok' ? 'ok' : 'error'));
    }
  }, [mergeDbTransactions, mergeDbMessages]);

  useEffect(() => {
    if (currentUser) {
      loadUserBucket(currentUser.id);
    }
  }, [currentUser, loadUserBucket]);

  const knownBusinessTxIdsRef = React.useRef<Set<string>>(new Set());
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Online / Offline auto-sync event listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueueWithServer((syncedTx) => {
        setTransactions(prev => [syncedTx, ...prev.filter(t => t.id !== syncedTx.id)]);
      });
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── Real-time polling every 5s — syncs user's transactions + chat messages ──
  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(async () => {
      // Skip background poll if a local mutation is currently in flight or completed < 3s ago
      if (inFlightMutationsRef.current > 0 || Date.now() - lastMutationTsRef.current < 3000) {
        return;
      }

      const uid = currentUser.id;
      const [dbTx, dbMsgs] = await Promise.all([
        fetchTransactions(uid),
        fetchMessagesFromDb(uid)
      ]);

      // Re-check after network await in case user submitted/confirmed while poll was in flight!
      if (inFlightMutationsRef.current > 0 || Date.now() - lastMutationTsRef.current < 3000) {
        return;
      }

      if (dbTx !== null) {
        // Check for new partner business transactions to trigger instant alert
        if (settings.partnerAlertsEnabled !== false) {
          const isCurrentPraveen = (currentUser.name || '').toLowerCase().includes('praveen');
          dbTx.forEach(t => {
            if (t.mode === 'business' && !t.isPending) {
              const isEntryPraveen = (t.enteredBy || '').toLowerCase().includes('praveen');
              if (isEntryPraveen !== isCurrentPraveen && !knownBusinessTxIdsRef.current.has(t.id)) {
                if (Date.now() - (t.timestamp || 0) < 15 * 60 * 1000) {
                  sendPartnerBusinessAlert(t.enteredBy || 'Partner', t.type, t.amount, t.title);
                }
              }
              knownBusinessTxIdsRef.current.add(t.id);
            }
          });
        }

        // Daily 9:00 PM reconciliation recap trigger
        if (settings.dailyRecapEnabled !== false) {
          const startOfToday = getStartOfTodayTimestamp();
          const todayExpenses = dbTx.filter(t => t.type === 'expense' && Number(t.timestamp) >= startOfToday && !t.isPending);
          const todayExpenseTotal = todayExpenses.reduce((sum, t) => sum + Number(t.amount || 0), 0);
          checkAndTriggerDailyRecap(todayExpenses.length, todayExpenseTotal);
        }

        setTransactions(prev => mergeDbTransactions(prev, dbTx, uid));
      }

      if (dbMsgs !== null) {
        setChatMessages(prev => mergeDbMessages(prev, dbMsgs, uid));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [currentUser, settings.partnerAlertsEnabled, settings.dailyRecapEnabled, mergeDbTransactions, mergeDbMessages]);

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

  const [accountMode, setAccountModeState] = useState<'personal' | 'business'>(() => {
    try {
      const saved = localStorage.getItem('hisaab_account_mode');
      return saved === 'business' ? 'business' : 'personal';
    } catch {
      return 'personal';
    }
  });

  // Guard accountMode: Non-partners (like Nandini) can NEVER view or remain in business mode
  useEffect(() => {
    if (currentUser && !isBusinessPartner(currentUser) && accountMode === 'business') {
      setAccountModeState('personal');
      try {
        localStorage.setItem('hisaab_account_mode', 'personal');
      } catch {}
    }
  }, [currentUser, accountMode]);

  const setAccountMode = (mode: 'personal' | 'business') => {
    if (mode === 'business' && !isBusinessPartner(currentUser)) {
      setAccountModeState('personal');
      try {
        localStorage.setItem('hisaab_account_mode', 'personal');
      } catch {}
      return;
    }
    setAccountModeState(mode);
    try {
      localStorage.setItem('hisaab_account_mode', mode);
    } catch (e) {
      console.error('Failed to save account mode', e);
    }
  };

  // Compute 50-50 Business Settlement with Priority Offset for Direct Partner Transfers
  const businessSettlement = React.useMemo<BusinessSettlement>(() => {
    const bTxList = transactions.filter(t => t.mode === 'business' && !t.isPending);

    let totalIncome = 0;
    let totalExpense = 0;
    let praveenIncome = 0;
    let praveenExpense = 0;
    let sarthakIncome = 0;
    let sarthakExpense = 0;
    let praveenDirectGiven = 0;
    let sarthakDirectGiven = 0;

    bTxList.filter(t => !t.title?.startsWith('Settlement:')).forEach(t => {
      const amt = Number(t.amount || 0);
      const isPraveen = (t.enteredBy || '').toLowerCase().includes('praveen') || (!t.enteredBy && currentUser?.name?.toLowerCase().includes('praveen'));
      
      if (t.type === 'income') {
        totalIncome += amt;
        if (isPraveen) praveenIncome += amt;
        else sarthakIncome += amt;
      } else if (t.type === 'expense') {
        totalExpense += amt;
        if (isPraveen) praveenExpense += amt;
        else sarthakExpense += amt;
      } else if (t.type === 'lent') {
        // Direct Partner / Family Transfer Given (100% not halved!)
        if (isPraveen) praveenDirectGiven += amt;
        else sarthakDirectGiven += amt;
      } else if (t.type === 'borrowed') {
        // Direct Partner / Family Transfer Taken (100% not halved!)
        if (isPraveen) sarthakDirectGiven += amt;
        else praveenDirectGiven += amt;
      }
    });

    const netProfit = totalIncome - totalExpense;
    const fairSharePerPartner = netProfit / 2;

    const praveenCashHeld = praveenIncome - praveenExpense;
    const sarthakCashHeld = sarthakIncome - sarthakExpense;

    // ── SYMMETRICAL PARTNERSHIP FORMULA (INCOME + EXPENSE + DIRECT LOANS) ──
    // 1. 50% Income Split:
    const incomeDuePtoS = (praveenIncome - sarthakIncome) / 2;
    // 2. 50% Expense Equalization:
    const expenseDeficitStoP = (praveenExpense - sarthakExpense) / 2;
    // 3. Operating Balance (Income share minus Expense deficit offset):
    const operatingNetPtoS = incomeDuePtoS - expenseDeficitStoP;
    // 4. Direct Partner Transfers (Pure Loans):
    const netDirectLoanPtoS = sarthakDirectGiven - praveenDirectGiven;
    // 5. Final Net Payable from Praveen to Sarthak:
    const finalNetPtoS = Math.round(operatingNetPtoS + netDirectLoanPtoS);

    const praveenOwesSarthak = Math.max(0, finalNetPtoS);
    const sarthakOwesPraveen = Math.max(0, -finalNetPtoS);

    const praveenOperatingDue = Math.round(operatingNetPtoS);
    const sarthakOperatingDue = Math.round(-operatingNetPtoS);

    const praveenNetDue = -praveenOwesSarthak;
    const sarthakNetDue = -sarthakOwesPraveen;

    let settlementText = 'No transactions recorded yet in Business Mode.';
    if (bTxList.length > 0) {
      if (finalNetPtoS === 0) {
        settlementText = '✅ Both partner ledgers are fully balanced!';
      } else if (finalNetPtoS > 0) {
        settlementText = `🤝 Praveen owes Sarthak: ₹${praveenOwesSarthak.toLocaleString('en-IN')}`;
      } else {
        settlementText = `🤝 Sarthak owes Praveen: ₹${sarthakOwesPraveen.toLocaleString('en-IN')}`;
      }
    }

    // Compute Settled Settlements (transactions with title starting with "Settlement:")
    let praveenSettlementReceived = 0;
    let praveenSettlementPaid = 0;
    let sarthakSettlementReceived = 0;
    let sarthakSettlementPaid = 0;

    bTxList.filter(t => t.title && t.title.startsWith('Settlement:')).forEach(t => {
      const amt = Number(t.amount || 0);
      if (t.title.includes('Sarthak paid Praveen')) {
        sarthakSettlementPaid += amt;
        praveenSettlementReceived += amt;
      } else if (t.title.includes('Praveen paid Sarthak')) {
        praveenSettlementPaid += amt;
        sarthakSettlementReceived += amt;
      }
    });

    // Praveen Current Amount: Praveen Income - Praveen Expense - praveenDirectGiven + sarthakDirectGiven
    const praveenCurrentAmount = Math.round(praveenIncome - praveenExpense - praveenDirectGiven + sarthakDirectGiven);

    // Sarthak Current Amount: Sarthak Income - Sarthak Expense - sarthakDirectGiven + praveenDirectGiven
    const sarthakCurrentAmount = Math.round(sarthakIncome - sarthakExpense - sarthakDirectGiven + praveenDirectGiven);

    return {
      totalIncome,
      totalExpense,
      netProfit,
      fairSharePerPartner,
      praveenIncome,
      praveenExpense,
      praveenCashHeld,
      praveenDirectGiven,
      sarthakIncome,
      sarthakExpense,
      sarthakCashHeld,
      sarthakDirectGiven,
      praveenOperatingDue,
      sarthakOperatingDue,
      praveenNetDue,
      sarthakNetDue,
      praveenOwesSarthak,
      sarthakOwesPraveen,
      praveenCurrentAmount,
      sarthakCurrentAmount,
      settlementText,
      payerName: undefined,
      payeeName: undefined,
      amountDue: praveenOwesSarthak + sarthakOwesPraveen
    };
  }, [transactions, currentUser]);

  const persistLocalTransactions = (list: Transaction[]) => {
    try {
      localStorage.setItem(`hk_cached_tx_${activeUserId}`, JSON.stringify(list));
    } catch {}
  };

  const trackTxSave = (tx: Transaction, uid: string) => {
    const now = Date.now();
    lastMutationTsRef.current = now;
    localTxOverridesRef.current.set(tx.id, { tx, updatedAt: now });
    deletedTxIdsRef.current.delete(tx.id);
    inFlightMutationsRef.current++;
    saveTransactionToDb(tx, uid).finally(() => {
      inFlightMutationsRef.current = Math.max(0, inFlightMutationsRef.current - 1);
      lastMutationTsRef.current = Date.now();
    });
  };

  const trackTxBatchSave = (txList: Transaction[], uid: string) => {
    if (!txList.length) return;
    const now = Date.now();
    lastMutationTsRef.current = now;
    txList.forEach(tx => {
      localTxOverridesRef.current.set(tx.id, { tx, updatedAt: now });
      deletedTxIdsRef.current.delete(tx.id);
    });
    inFlightMutationsRef.current++;
    saveTransactionsBatchToDb(txList, uid).finally(() => {
      inFlightMutationsRef.current = Math.max(0, inFlightMutationsRef.current - 1);
      lastMutationTsRef.current = Date.now();
    });
  };

  const trackTxDelete = (id: string, uid: string) => {
    const now = Date.now();
    lastMutationTsRef.current = now;
    localTxOverridesRef.current.delete(id);
    deletedTxIdsRef.current.set(id, now);
    inFlightMutationsRef.current++;
    deleteTransactionFromDb(id, uid).finally(() => {
      inFlightMutationsRef.current = Math.max(0, inFlightMutationsRef.current - 1);
      lastMutationTsRef.current = Date.now();
    });
  };

  const trackMsgSave = (msg: ChatMessage, uid: string) => {
    const now = Date.now();
    lastMutationTsRef.current = now;
    localMsgOverridesRef.current.set(msg.id, { msg, updatedAt: now });
    inFlightMutationsRef.current++;
    saveMessageToDb(msg, uid).finally(() => {
      inFlightMutationsRef.current = Math.max(0, inFlightMutationsRef.current - 1);
      lastMutationTsRef.current = Date.now();
    });
  };

  const addTransaction = (tx: Transaction) => {
    const enriched: Transaction = {
      ...tx,
      userId: activeUserId,
      mode: tx.mode || accountMode,
      enteredBy: tx.enteredBy || currentUser?.name || 'Praveen'
    };
    setTransactions(prev => {
      const updated = [enriched, ...prev.filter(t => t.id !== enriched.id)];
      persistLocalTransactions(updated);
      return updated;
    });
    trackTxSave(enriched, activeUserId);

    if (tx.merchant) learnMerchantCategory(tx.merchant, tx.category);
    if (tx.paymentMethod) learnPaymentPreference(tx.title, tx.paymentMethod);
    setAiMemory(getAIMemory());
    saveMemoryToDb(getAIMemory(), activeUserId);
  };

  const addTransactionsBatch = (txList: Transaction[]) => {
    if (!txList.length) return;
    const enrichedList: Transaction[] = txList.map(tx => ({
      ...tx,
      userId: activeUserId,
      mode: tx.mode || accountMode,
      enteredBy: tx.enteredBy || currentUser?.name || 'Praveen'
    }));
    const newIds = new Set(enrichedList.map(t => t.id));
    setTransactions(prev => {
      const updated = [...enrichedList, ...prev.filter(t => !newIds.has(t.id))];
      persistLocalTransactions(updated);
      return updated;
    });
    trackTxBatchSave(enrichedList, activeUserId);

    enrichedList.forEach(tx => {
      if (tx.merchant) learnMerchantCategory(tx.merchant, tx.category);
      if (tx.paymentMethod) learnPaymentPreference(tx.title, tx.paymentMethod);
    });
    setAiMemory(getAIMemory());
    saveMemoryToDb(getAIMemory(), activeUserId);
  };

  const getEffectiveUserName = (txEnteredBy?: string) => {
    if (txEnteredBy && txEnteredBy.trim()) return txEnteredBy.trim();
    if (currentUser?.name && currentUser.name.trim()) return currentUser.name.trim();
    if (currentUser?.id === 'sarthak' || activeUserId === 'sarthak') return 'Sarthak';
    return 'Praveen';
  };

  const updateTransaction = (id: string, updated: Partial<Transaction>) => {
    setTransactions(prev => {
      let updatedList: Transaction[];
      const exists = prev.some(t => t.id === id);
      if (exists) {
        updatedList = prev.map(t => {
          if (t.id === id) {
            const originalEnteredBy = t.enteredBy || updated.enteredBy || getEffectiveUserName();
            const full: Transaction = { 
              ...t, 
              ...updated, 
              isPending: false,
              userId: activeUserId,
              mode: updated.mode || t.mode || accountMode,
              enteredBy: originalEnteredBy
            };
            trackTxSave(full, activeUserId);
            return full;
          }
          return t;
        });
      } else {
        const creatorName = updated.enteredBy || getEffectiveUserName();
        const full: Transaction = {
          id: id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          amount: Number(updated.amount || 0),
          currency: '₹',
          type: updated.type || 'expense',
          category: updated.category || 'Others',
          title: updated.title || 'Expense',
          date: updated.date || new Date().toISOString().split('T')[0],
          relativeDateText: 'Today',
          timestamp: updated.timestamp || Date.now(),
          confidenceScore: 100,
          paymentMethod: updated.paymentMethod || 'UPI',
          mode: updated.mode || accountMode,
          enteredBy: creatorName,
          ...updated,
          isPending: false
        };
        trackTxSave(full, activeUserId);
        updatedList = [full, ...prev];
      }
      persistLocalTransactions(updatedList);
      return updatedList;
    });

    // Permanently mark confirmed in chat messages state so the verification form auto-removes cleanly
    setChatMessages(prev => {
      const next = prev.map(msg => {
        if (!msg.pendingReviewItems || !msg.pendingReviewItems.some(i => i.id === id)) return msg;
        const updatedItems = msg.pendingReviewItems.map(i => i.id === id ? { ...i, ...updated, isPending: false } : i);
        const updatedMsg = { ...msg, pendingReviewItems: updatedItems };
        trackMsgSave(updatedMsg, activeUserId);
        return updatedMsg;
      });
      persistLocalChatMessages(next, activeUserId);
      return next;
    });
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => {
      const updated = prev.filter(t => t.id !== id);
      persistLocalTransactions(updated);
      return updated;
    });
    trackTxDelete(id, activeUserId);
    setChatMessages(prev => {
      const next = prev.map(msg => {
        if (!msg.pendingReviewItems || !msg.pendingReviewItems.some(i => i.id === id)) return msg;
        const updatedItems = msg.pendingReviewItems.filter(i => i.id !== id);
        const updatedMsg = { ...msg, pendingReviewItems: updatedItems.length ? updatedItems : undefined };
        trackMsgSave(updatedMsg, activeUserId);
        return updatedMsg;
      });
      persistLocalChatMessages(next, activeUserId);
      return next;
    });
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
    setChatMessages([]);
    setPendingReviewItems([]);
    setActiveClarification(null);
    persistLocalChatMessages([], activeUserId);
    deleteAllMessagesFromDb(activeUserId);
  };

  const confirmPendingItemsBatch = (clearedList: Transaction[]) => {
    if (!clearedList.length) return;
    const clearedIds = new Set(clearedList.map(c => c.id));
    const clearedMap = new Map(clearedList.map(c => [c.id, c]));

    setTransactions(prev => {
      const updatedList = prev.map(t => {
        const cleared = clearedMap.get(t.id);
        if (!cleared) return t;
        const full: Transaction = {
          ...t,
          ...cleared,
          isPending: false,
          userId: activeUserId,
          mode: cleared.mode || t.mode || accountMode,
          enteredBy: cleared.enteredBy || t.enteredBy || getEffectiveUserName()
        };
        return full;
      });
      const savedBatch = updatedList.filter(t => clearedIds.has(t.id));
      trackTxBatchSave(savedBatch, activeUserId);
      persistLocalTransactions(updatedList);
      return updatedList;
    });

    setPendingReviewItems(prev => prev.filter(p => !clearedIds.has(p.id)));

    // Synchronize chat messages so verification tables are removed immediately
    setChatMessages(prev => {
      const next = prev.map(msg => {
        if (!msg.pendingReviewItems || !msg.pendingReviewItems.some(i => clearedIds.has(i.id))) return msg;
        const updatedItems = msg.pendingReviewItems.map(i => {
          const cleared = clearedMap.get(i.id);
          return cleared ? { ...i, ...cleared, isPending: false } : i;
        });
        const updatedMsg = { ...msg, pendingReviewItems: updatedItems };
        trackMsgSave(updatedMsg, activeUserId);
        return updatedMsg;
      });
      persistLocalChatMessages(next, activeUserId);
      return next;
    });
  };

  // Helper to remove any previous unconfirmed pending items when new ones are submitted
  const cleanupStalePendingItems = () => {
    const staleIds: string[] = [];
    setTransactions(prev => {
      const stale = prev.filter(t => t.isPending && (accountMode === 'business' ? t.mode === 'business' : t.mode !== 'business'));
      if (!stale.length) return prev;
      stale.forEach(s => {
        staleIds.push(s.id);
        trackTxDelete(s.id, activeUserId);
      });
      const staleSet = new Set(staleIds);
      const updated = prev.filter(t => !staleSet.has(t.id));
      persistLocalTransactions(updated);
      return updated;
    });
    setPendingReviewItems([]);
  };

  const processUserInputText = async (text: string, isVoice = false, audioBlob?: Blob) => {
    if (!text.trim() && !audioBlob) return;

    const effectiveSender = getEffectiveUserName();
    const nowTs = Date.now();
    const userMsg: ChatMessage = {
      id: `msg_user_${nowTs}`,
      sender: 'user',
      text: text || '🎤 Spoken Voice Command',
      timestamp: nowTs,
      isVoice,
      mode: accountMode,
      senderName: effectiveSender
    };

    const lower = text.toLowerCase().trim();
    const isConversationalQuery = /^(hello|hi|namaste|hey|who are you|what|how|why|show|total|summary|balance|help|clear|delete|remove|update|change|set budget)/i.test(lower);

    // ── FAST PATH (0ms INSTANT): Local transaction parser for any entry with numbers ──
    if (!audioBlob && !isConversationalQuery && /\d+/.test(text)) {
      const parsedItems: Transaction[] = parseMultiInput(text, aiMemory).map((tx, idx) => ({
        ...tx,
        id: `tx_${nowTs}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: nowTs + idx,
        isPending: true,
        userId: activeUserId,
        mode: accountMode,
        enteredBy: effectiveSender,
        type: tx.type || 'expense'
      }));

      if (parsedItems.length > 0) {
        cleanupStalePendingItems();
        addTransactionsBatch(parsedItems);
        setPendingReviewItems(parsedItems);

        const responseText = `I extracted these entries from your input. Please verify spellings and details below before saving to your Passbook:`;
        const aiMsg: ChatMessage = {
          id: `msg_ai_${nowTs + 1}`,
          sender: 'assistant',
          text: responseText,
          timestamp: nowTs + 1,
          pendingReviewItems: parsedItems,
          mode: accountMode
        };

        // Single atomic state update — zero layout jerk, zero delay!
        setChatMessages(prev => {
          const cleanedPrev = prev.map(m => {
            if (!m.pendingReviewItems?.some(i => i.isPending)) return m;
            const remaining = m.pendingReviewItems.filter(i => !i.isPending);
            const cleanedMsg = { ...m, pendingReviewItems: remaining.length ? remaining : undefined };
            trackMsgSave(cleanedMsg, activeUserId);
            return cleanedMsg;
          });
          const next = [...cleanedPrev, userMsg, aiMsg];
          persistLocalChatMessages(next, activeUserId);
          return next;
        });

        trackMsgSave(userMsg, activeUserId);
        trackMsgSave(aiMsg, activeUserId);

        if (settings.autoTTS) speakText(responseText, settings.voiceLanguage);
        return;
      }
    }

    // Check if user actually has a valid custom LLM API key configured
    const activeOpenAIKey = getActiveOpenAIKey(settings.openaiApiKey);
    const validGeminiKey = settings.apiKey && !settings.apiKey.startsWith('AQ.') ? settings.apiKey.trim() : '';
    const hasValidLLMKey = Boolean(activeOpenAIKey || validGeminiKey);

    if (hasValidLLMKey) {
      setIsProcessingAI(true);
      setChatMessages(prev => {
        const next = [...prev, userMsg];
        persistLocalChatMessages(next, activeUserId);
        return next;
      });
      trackMsgSave(userMsg, activeUserId);

      const applyAgentToolAction = (agentRes: any): Transaction[] => {
        if (agentRes.action === 'CREATE_TRANSACTIONS' && agentRes.transactionsToCreate && agentRes.transactionsToCreate.length > 0) {
          cleanupStalePendingItems();
          const newTxList: Transaction[] = agentRes.transactionsToCreate.map((t: any, idx: number) => ({
            id: `tx_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
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
            mode: accountMode,
            enteredBy: effectiveSender
          }));

          addTransactionsBatch(newTxList);
          setPendingReviewItems(newTxList);
          return newTxList;
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
        return [];
      };

      try {
        const modeFilteredTx = transactions.filter(t => !t.isPending && (accountMode === 'business' ? t.mode === 'business' : t.mode !== 'business'));
        const useOpenAI = Boolean(activeOpenAIKey && (settings.aiProvider === 'openai' || !validGeminiKey));
        const customPrompt = settings.customAIPrompt?.trim() || undefined;
        const recentChatMessages = chatMessages.filter(m => accountMode === 'business' ? m.mode === 'business' : m.mode !== 'business');

        const agentRes = useOpenAI
          ? await processWithOpenAIAgent(text, modeFilteredTx, aiMemory, activeOpenAIKey, audioBlob, [...recentChatMessages, userMsg])
          : await processWithGeminiAgent(text, modeFilteredTx, aiMemory, validGeminiKey, audioBlob, [...recentChatMessages, userMsg], customPrompt);

        const isConnectionError = 
          agentRes?.responseText?.includes('Connection Error') || 
          agentRes?.responseText?.includes('Failed to fetch') ||
          agentRes?.responseText?.includes('Service Notice');

        if (agentRes && !isConnectionError) {
          let createdItems = applyAgentToolAction(agentRes);

          if (!createdItems.length && /\d+/.test(text)) {
            const fallbackExtracted: Transaction[] = parseMultiInput(text, aiMemory).map((tx, idx) => ({
              ...tx,
              id: `tx_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
              isPending: true,
              userId: activeUserId,
              mode: accountMode,
              enteredBy: effectiveSender,
              type: tx.type || 'expense'
            }));
            if (fallbackExtracted.length) {
              cleanupStalePendingItems();
              addTransactionsBatch(fallbackExtracted);
              setPendingReviewItems(fallbackExtracted);
              createdItems = fallbackExtracted;
            }
          }

          const aiMsg: ChatMessage = {
            id: `msg_ai_${Date.now()}`,
            sender: 'assistant',
            text: agentRes.responseText,
            timestamp: Date.now(),
            pendingReviewItems: createdItems.length ? createdItems : undefined,
            mode: accountMode
          };
          setChatMessages(prev => {
            const next = [...prev, aiMsg];
            persistLocalChatMessages(next, activeUserId);
            return next;
          });
          trackMsgSave(aiMsg, activeUserId);
          setIsProcessingAI(false);

          if (settings.autoTTS) {
            speakText(agentRes.speechText || agentRes.responseText, settings.voiceLanguage);
          }
          return;
        }
      } catch (e) {
        console.warn('LLM Agent fallback to local AI engine:', e);
      }
      setIsProcessingAI(false);
    }

    // ── Instant Local Conversational / Fallback Response (0ms) ──
    let responseText = `I couldn't detect an amount in your input. Try saying e.g. *"Petrol 2200"* or *"Spent 23 for Nandini"*`;

    if (/hello|hi|namaste|hey|who are you/i.test(lower)) {
      responseText = `Namaste! 🙏 I am your Funds Log Accountant. You can dictate expenses like *"Spent 500 for Grocery"* or ask me about your balances!`;
    } else if (/total|spent|summary|balance|expenses|income/i.test(lower)) {
      const modeTx = transactions.filter(t => !t.isPending && (accountMode === 'business' ? t.mode === 'business' : t.mode !== 'business'));
      const totalSpent = modeTx.filter(t => t.type === 'expense' || t.type === 'lent').reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const totalInc = modeTx.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount || 0), 0);
      responseText = `📊 **Funds Log Summary**:\n• Total Income: **₹${totalInc.toLocaleString('en-IN')}**\n• Total Spent: **₹${totalSpent.toLocaleString('en-IN')}**\n• Total Recorded Entries: **${modeTx.length}**`;
    }

    const aiMsg: ChatMessage = {
      id: `msg_ai_${nowTs + 1}`,
      sender: 'assistant',
      text: responseText,
      timestamp: nowTs + 1,
      mode: accountMode
    };

    setChatMessages(prev => {
      const hasUserMsg = prev.some(m => m.id === userMsg.id);
      const next = hasUserMsg ? [...prev, aiMsg] : [...prev, userMsg, aiMsg];
      persistLocalChatMessages(next, activeUserId);
      return next;
    });
    if (!hasValidLLMKey) {
      trackMsgSave(userMsg, activeUserId);
    }
    trackMsgSave(aiMsg, activeUserId);

    if (settings.autoTTS) speakText(responseText, settings.voiceLanguage);
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
      timestamp: Date.now(),
      mode: accountMode
    };
    setChatMessages(prev => {
      const next = [...prev, aiMsg];
      persistLocalChatMessages(next, activeUserId);
      return next;
    });
    trackMsgSave(aiMsg, activeUserId);
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

  const filteredChatMessages = React.useMemo(() => {
    return chatMessages.filter(
      m =>
        m.id !== 'msg_welcome' &&
        m.id !== 'welcome_business_msg' &&
        (accountMode === 'business' ? m.mode === 'business' : m.mode !== 'business')
    );
  }, [chatMessages, accountMode]);

  return (
    <FinanceContext.Provider value={{
      currentUser,
      transactions,
      chatMessages: filteredChatMessages,
      aiMemory,
      settings,
      pendingReviewItems,
      activeClarification,
      isProcessingAI,
      dbStatus,
      accountMode,
      setAccountMode,
      businessSettlement,
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
