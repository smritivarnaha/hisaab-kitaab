import { GoogleGenAI, Modality, Behavior, Type, type FunctionDeclaration } from '@google/genai';
import {
  Transaction,
  Category,
  PaymentMethod,
  TransactionType,
  AIMemoryMap,
  AppUser,
  CATEGORIES_LIST,
  isBusinessPartner
} from '../../types/finance';
import { parseMultiInput } from './parser';
import { apiUrl } from '../../utils/apiUrl';
import { PcmMicrophoneStreamer, Pcm24kAudioPlayer } from '../voice/pcmAudioEngine';

export type LiveSessionEngine = 'gemini-3.8-live' | 'handsfree-local';
export type LiveVoiceStatus = 'connecting' | 'listening' | 'thinking' | 'speaking' | 'muted' | 'error' | 'closed';

export interface LiveTranscriptTurn {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  text: string;
  timestamp: number;
  isFinal?: boolean;
}

export interface LiveFinanceBridge {
  currentUser: AppUser | null;
  accountMode: 'personal' | 'business';
  transactions: Transaction[];
  aiMemory: AIMemoryMap;
  autoSaveInDrivingMode: boolean;
  voiceLanguage: 'en-IN' | 'hi-IN' | 'hinglish';
  geminiApiKey?: string;
  businessSettlement: {
    totalIncome: number;
    totalExpense: number;
    netProfit: number;
    praveenIncome: number;
    praveenExpense: number;
    praveenDirectGiven: number;
    sarthakIncome: number;
    sarthakExpense: number;
    sarthakDirectGiven: number;
    praveenOwesSarthak: number;
    sarthakOwesPraveen: number;
    settlementText: string;
  };
  addTransactionsBatch: (txList: Transaction[]) => void;
  confirmPendingItemsBatch: (clearedList: Transaction[]) => void;
  deleteTransaction: (id: string) => void;
  setAccountMode: (mode: 'personal' | 'business') => void;
}

export interface LiveAgentCallbacks {
  onStatusChange: (status: LiveVoiceStatus) => void;
  onEngineResolved: (engine: LiveSessionEngine, note?: string) => void;
  onAudioLevel: (level: number, source: 'mic' | 'speaker') => void;
  onTranscriptUpdate: (turn: LiveTranscriptTurn) => void;
  onTransactionsLogged: (items: Transaction[], autoSaved: boolean) => void;
  onTransactionUndone: (undoneTx: Transaction) => void;
  onError: (msg: string) => void;
  onRequestClose?: () => void;
}

/**
 * Normalizes spoken Indian English / Hinglish number phrases into digits
 * e.g. "panch sau" -> "500", "do hazaar" -> "2000", "13 thousand" -> "13000", "1.5 lakh" -> "150000"
 */
export function normalizeSpokenHinglishNumbers(raw: string): string {
  let s = raw;

  const wordMap: Record<string, number> = {
    ek: 1, one: 1,
    do: 2, two: 2,
    teen: 3, three: 3,
    chaar: 4, char: 4, four: 4,
    paanch: 5, panch: 5, five: 5,
    chhah: 6, cheh: 6, che: 6, six: 6,
    saat: 7, seven: 7,
    aath: 8, eight: 8,
    nau: 9, nine: 9,
    das: 10, ten: 10,
    gyarah: 11, barah: 12, terah: 13, chaudah: 14, pandrah: 15,
    bees: 20, pachees: 25, pachis: 25, tees: 30, chalees: 40, chalis: 40, pachaas: 50, pachas: 50,
    saath: 60, sattar: 70, assi: 80, nabbe: 90
  };

  // Replace "<word> lakh/lac/hazaar/hazar/thousand/sau/hundred"
  const wordPattern = new RegExp(
    `\\b(${Object.keys(wordMap).join('|')})\\s+(lakh|lac|lakhs|hazaar|hazar|thousand|sau|hundred)\\b`,
    'gi'
  );
  s = s.replace(wordPattern, (_, w: string, mult: string) => {
    const base = wordMap[w.toLowerCase()] || 1;
    const m = mult.toLowerCase();
    if (m.startsWith('lak') || m === 'lac') return String(base * 100000);
    if (m.startsWith('haz') || m === 'thousand') return String(base * 1000);
    return String(base * 100);
  });

  // Replace "dedh hazaar" (1500), "dhai hazaar" (2500), "dedh lakh" (150000), "dhai lakh" (250000)
  s = s.replace(/\bdedh\s+(hazaar|hazar|thousand)\b/gi, '1500');
  s = s.replace(/\bdhai\s+(hazaar|hazar|thousand)\b/gi, '2500');
  s = s.replace(/\bdedh\s+(lakh|lac|lakhs)\b/gi, '150000');
  s = s.replace(/\bdhai\s+(lakh|lac|lakhs)\b/gi, '250000');

  // Replace "<number> lakh/hazaar/thousand/hundred/sau"
  s = s.replace(/(\d+(?:\.\d+)?)\s*(lakh|lac|lakhs)\b/gi, (_, n) => String(Math.round(parseFloat(n) * 100000)));
  s = s.replace(/(\d+(?:\.\d+)?)\s*(hazaar|hazar|thousand)\b/gi, (_, n) => String(Math.round(parseFloat(n) * 1000)));
  s = s.replace(/(\d+(?:\.\d+)?)\s*(sau|hundred)\b/gi, (_, n) => String(Math.round(parseFloat(n) * 100)));

  return s;
}

function canonicalUserName(uid?: string | null, fallback?: string | null): string {
  const c = (uid || '').toLowerCase().trim();
  if (c === 'praveen') return 'Praveen';
  if (c === 'sarthak') return 'Sarthak';
  if (c === 'nandini') return 'Nandini';
  return (fallback || '').trim() || 'Praveen';
}

const LIVE_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'log_transactions',
    behavior: Behavior.NON_BLOCKING,
    description:
      'Logs one or more expenses, incomes, or partner transfers (lent/borrowed) into the active ledger. Call this immediately whenever the user mentions spending, paying, receiving, lending, or borrowing any money.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        entries: {
          type: Type.ARRAY,
          description: 'List of financial entries extracted from what the user spoke.',
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: 'Clean merchant, client, or item title (e.g. Petrol, Dr Prince SEO, Vercel, Grocery)' },
              amount: { type: Type.NUMBER, description: 'Numeric amount in INR Rupees' },
              type: {
                type: Type.STRING,
                description: 'expense (default money spent), income (money received), lent (given to partner/friend), or borrowed (taken from partner/friend)'
              },
              category: {
                type: Type.STRING,
                description: `One of: ${CATEGORIES_LIST.join(', ')}`
              },
              paymentMethod: {
                type: Type.STRING,
                description: 'UPI, Cash, Bank Transfer, Credit Card, or Debit Card'
              },
              notes: { type: Type.STRING, description: 'Optional note or remark' }
            },
            required: ['title', 'amount', 'type']
          }
        }
      },
      required: ['entries']
    }
  },
  {
    name: 'confirm_pending_entries',
    behavior: Behavior.NON_BLOCKING,
    description: 'Confirms and saves any unconfirmed pending draft transactions for the active user into the Passbook.',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: 'undo_last_entry',
    behavior: Behavior.NON_BLOCKING,
    description: 'Deletes / undoes the most recently logged transaction from this voice session when the user says undo, cancel last, or galat ho gaya.',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: 'query_ledger',
    behavior: Behavior.NON_BLOCKING,
    description:
      'Queries the user full transaction ledger by keyword (client/merchant/title/category), transaction type, or recent days (e.g. today=1, week=7, month=30, all=0). Use this to answer any balance, spend, client retainer, or SaaS cost question.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        keyword: { type: Type.STRING, description: 'Optional client, tool, merchant, or category keyword to filter by (e.g. Dr Prince, Vercel, Petrol, Grocery)' },
        type: { type: Type.STRING, description: 'Optional filter: expense, income, lent, borrowed, or all' },
        daysBack: { type: Type.NUMBER, description: 'Number of days back to search (1 for today, 7 for week, 30 for month, 0 for all time)' }
      }
    }
  },
  {
    name: 'get_partner_settlement',
    behavior: Behavior.NON_BLOCKING,
    description: 'Returns the exact live 50-50 Business Partnership Settlement between Praveen and Sarthak, including income, expenses, direct transfers, and net amount owed.',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: 'switch_ledger_mode',
    behavior: Behavior.NON_BLOCKING,
    description: 'Switches the active ledger mode between personal and business.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        mode: { type: Type.STRING, description: 'Either "personal" or "business"' }
      },
      required: ['mode']
    }
  }
];

export class LiveVoiceAgentSession {
  private getBridge: () => LiveFinanceBridge;
  private callbacks: LiveAgentCallbacks;
  private engine: LiveSessionEngine = 'handsfree-local';

  // Gemini 3.8 Live WebSocket state
  private geminiSession: any = null;
  private micStreamer: PcmMicrophoneStreamer | null = null;
  private pcmPlayer: Pcm24kAudioPlayer | null = null;

  // Continuous Hands-Free Local Fallback state
  private recognition: any = null;
  private localMicStream: MediaStream | null = null;
  private localAudioCtx: AudioContext | null = null;
  private localAnimFrame: number | null = null;
  private isSpeakingLocalTTS = false;
  private restartTimer: any = null;

  // Shared session state
  private isClosed = false;
  private isMuted = false;
  private sessionLoggedStack: Transaction[] = [];

  constructor(getBridge: () => LiveFinanceBridge, callbacks: LiveAgentCallbacks) {
    this.getBridge = getBridge;
    this.callbacks = callbacks;
  }

  public async start(): Promise<void> {
    this.isClosed = false;
    this.isMuted = false;
    this.callbacks.onStatusChange('connecting');

    const bridge = this.getBridge();
    const uid = bridge.currentUser?.id || 'praveen';
    const inlineGeminiKey = bridge.geminiApiKey?.trim() || '';

    // 1. Check if Gemini 3.8 Live Neural WebSocket can be initialized via /api/live-token
    try {
      const tokenRes = await fetch(apiUrl(`/api/live-token?userId=${encodeURIComponent(uid)}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid,
          apiKey: inlineGeminiKey.startsWith('AIza') ? inlineGeminiKey : undefined
        })
      });

      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        if (tokenData?.available && tokenData?.token) {
          const connected = await this.startGemini38Live(tokenData.token);
          if (connected) {
            this.engine = 'gemini-3.8-live';
            this.callbacks.onEngineResolved('gemini-3.8-live');
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Gemini Live token check fell back to hands-free local loop:', err);
    }

    // 2. Fallback seamlessly to Zero-Key Continuous Hands-Free Driving Loop (works 100% immediately!)
    this.engine = 'handsfree-local';
    this.callbacks.onEngineResolved(
      'handsfree-local',
      'Continuous Hands-Free Mode active (add a Gemini AIza... key anytime for Neural Audio)'
    );
    await this.startContinuousHandsFreeLoop();
  }

  // ─── Shared Agentic Tool Execution ─────────────────────────────────────────
  private executeTool(name: string, args: Record<string, any> = {}): { result: any; spokenSummary: string } {
    const bridge = this.getBridge();
    const uid = bridge.currentUser?.id || 'praveen';
    const authorName = canonicalUserName(uid, bridge.currentUser?.name);
    const todayIso = new Date().toISOString().split('T')[0];

    if (name === 'log_transactions') {
      const rawEntries = Array.isArray(args.entries) ? args.entries : [];
      if (!rawEntries.length) {
        return { result: { logged: 0 }, spokenSummary: 'I did not catch the amount. Please repeat the amount and item.' };
      }

      const now = Date.now();
      const autoSave = bridge.autoSaveInDrivingMode;
      const validTypes: TransactionType[] = ['expense', 'income', 'lent', 'borrowed'];

      const created: Transaction[] = rawEntries
        .filter((e: any) => Number(e.amount) > 0)
        .map((e: any, idx: number) => {
          const cleanType: TransactionType = validTypes.includes(e.type) ? e.type : 'expense';
          const cleanCategory: Category = CATEGORIES_LIST.includes(e.category as Category)
            ? (e.category as Category)
            : 'Others';
          const cleanTitle = String(e.title || (cleanType === 'income' ? 'Income' : 'Expense')).trim();
          const cleanMethod: PaymentMethod =
            (['UPI', 'Cash', 'Bank Transfer', 'Credit Card', 'Debit Card'] as PaymentMethod[]).includes(e.paymentMethod)
              ? e.paymentMethod
              : 'UPI';

          return {
            id: `tx_live_${now}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
            amount: Number(e.amount),
            currency: '₹',
            type: cleanType,
            category: cleanCategory,
            title: cleanTitle,
            shortDisplayTitle: cleanTitle,
            paymentMethod: cleanMethod,
            date: todayIso,
            relativeDateText: 'Today',
            timestamp: now + idx,
            confidenceScore: 98,
            rawInput: `[Live Voice] ${cleanTitle} ${e.amount}`,
            notes: e.notes ? String(e.notes) : undefined,
            isPending: !autoSave,
            userId: uid,
            mode: bridge.accountMode,
            enteredBy: authorName
          };
        });

      if (!created.length) {
        return { result: { logged: 0 }, spokenSummary: 'Please mention a valid rupee amount.' };
      }

      bridge.addTransactionsBatch(created);
      created.forEach(t => this.sessionLoggedStack.push(t));
      this.callbacks.onTransactionsLogged(created, autoSave);

      const desc = created
        .map(c => `Rupees ${c.amount.toLocaleString('en-IN')} for ${c.title} (${c.type})`)
        .join(' and ');
      const ledgerLabel = bridge.accountMode === 'business' ? 'Business' : 'Personal';
      const spokenSummary = autoSave
        ? `Saved ${desc} in ${ledgerLabel} Passbook under ${authorName}.`
        : `Drafted ${desc} in ${ledgerLabel}. Say confirm to save to Passbook.`;

      this.emitToolChip(`✓ ${autoSave ? 'Saved' : 'Drafted'}: ${created.map(c => `${c.title} ₹${c.amount.toLocaleString('en-IN')}`).join(', ')}`);

      return {
        result: {
          success: true,
          autoSaved: autoSave,
          accountMode: bridge.accountMode,
          enteredBy: authorName,
          entries: created.map(c => ({ id: c.id, title: c.title, amount: c.amount, type: c.type }))
        },
        spokenSummary
      };
    }

    if (name === 'confirm_pending_entries') {
      const myPending = bridge.transactions.filter(
        t =>
          t.isPending &&
          (!t.userId || t.userId === uid) &&
          (bridge.accountMode === 'business' ? t.mode === 'business' : t.mode !== 'business')
      );
      if (!myPending.length) {
        return {
          result: { confirmed: 0 },
          spokenSummary: 'All your entries are already confirmed in the Passbook.'
        };
      }
      bridge.confirmPendingItemsBatch(myPending.map(t => ({ ...t, isPending: false })));
      this.emitToolChip(`✓ Confirmed ${myPending.length} pending ${myPending.length === 1 ? 'entry' : 'entries'}`);
      return {
        result: { confirmed: myPending.length },
        spokenSummary: `Confirmed and saved ${myPending.length} ${myPending.length === 1 ? 'entry' : 'entries'} to your Passbook.`
      };
    }

    if (name === 'undo_last_entry') {
      const lastTx = this.sessionLoggedStack.pop();
      if (!lastTx) {
        return {
          result: { undone: false },
          spokenSummary: 'No recent voice entry from this session to undo.'
        };
      }
      bridge.deleteTransaction(lastTx.id);
      this.callbacks.onTransactionUndone(lastTx);
      this.emitToolChip(`↩ Undid ${lastTx.title} (₹${lastTx.amount.toLocaleString('en-IN')})`);
      return {
        result: { undone: true, title: lastTx.title, amount: lastTx.amount },
        spokenSummary: `Removed ${lastTx.title} of Rupees ${lastTx.amount.toLocaleString('en-IN')}.`
      };
    }

    if (name === 'get_partner_settlement') {
      if (!isBusinessPartner(bridge.currentUser)) {
        return {
          result: { allowed: false },
          spokenSummary: 'Partner settlement is only available for Business partners.'
        };
      }
      const s = bridge.businessSettlement;
      const summary =
        s.praveenOwesSarthak > 0
          ? `Praveen owes Sarthak Rupees ${s.praveenOwesSarthak.toLocaleString('en-IN')}. Total business income is Rupees ${s.totalIncome.toLocaleString('en-IN')} and expenses are Rupees ${s.totalExpense.toLocaleString('en-IN')}.`
          : s.sarthakOwesPraveen > 0
            ? `Sarthak owes Praveen Rupees ${s.sarthakOwesPraveen.toLocaleString('en-IN')}. Total business income is Rupees ${s.totalIncome.toLocaleString('en-IN')} and expenses are Rupees ${s.totalExpense.toLocaleString('en-IN')}.`
            : `Both Praveen and Sarthak ledgers are completely balanced at zero dues.`;
      this.emitToolChip(`🤝 ${s.settlementText}`);
      return { result: s, spokenSummary: summary };
    }

    if (name === 'switch_ledger_mode') {
      const target = String(args.mode || '').toLowerCase() === 'business' ? 'business' : 'personal';
      if (target === 'business' && !isBusinessPartner(bridge.currentUser)) {
        return {
          result: { switched: false, activeMode: 'personal' },
          spokenSummary: 'Your account only uses Personal ledger mode.'
        };
      }
      bridge.setAccountMode(target);
      this.emitToolChip(`⇄ Switched to ${target === 'business' ? 'Business' : 'Personal'} Ledger`);
      return {
        result: { switched: true, activeMode: target },
        spokenSummary: `Switched to ${target === 'business' ? 'Business' : 'Personal'} ledger.`
      };
    }

    if (name === 'query_ledger') {
      const keyword = String(args.keyword || '').trim().toLowerCase();
      const typeFilter = String(args.type || 'all').toLowerCase();
      const daysBack = Number(args.daysBack || 0);
      const cutoffTs =
        daysBack === 1
          ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
          : daysBack > 1
            ? Date.now() - daysBack * 24 * 60 * 60 * 1000
            : 0;

      const filtered = bridge.transactions.filter(t => {
        if (t.isPending) return false;
        const inMode = bridge.accountMode === 'business' ? t.mode === 'business' : t.mode !== 'business';
        if (!inMode) return false;
        if (cutoffTs > 0 && Number(t.timestamp) < cutoffTs) return false;
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (keyword) {
          const hay = `${t.title || ''} ${t.category || ''} ${t.merchant || ''} ${t.notes || ''} ${t.enteredBy || ''}`.toLowerCase();
          if (!hay.includes(keyword)) return false;
        }
        return true;
      });

      const income = filtered.filter(t => t.type === 'income').reduce((a, b) => a + Number(b.amount || 0), 0);
      const expense = filtered.filter(t => t.type === 'expense').reduce((a, b) => a + Number(b.amount || 0), 0);
      const lent = filtered.filter(t => t.type === 'lent').reduce((a, b) => a + Number(b.amount || 0), 0);

      const periodLabel = daysBack === 1 ? 'today' : daysBack > 1 ? `in the last ${daysBack} days` : 'overall';
      let spokenSummary = '';
      if (keyword) {
        spokenSummary =
          filtered.length === 0
            ? `No confirmed entries found matching ${keyword} ${periodLabel}.`
            : `Found ${filtered.length} entries for ${keyword} ${periodLabel}: Income Rupees ${income.toLocaleString('en-IN')}, Spent Rupees ${expense.toLocaleString('en-IN')}.`;
      } else {
        spokenSummary = `In ${bridge.accountMode} ledger ${periodLabel}: Total Income is Rupees ${income.toLocaleString('en-IN')}, Total Spent is Rupees ${expense.toLocaleString('en-IN')}${lent > 0 ? `, and Direct Transfers are Rupees ${lent.toLocaleString('en-IN')}` : ''} across ${filtered.length} entries.`;
      }

      this.emitToolChip(
        `📊 ${keyword ? `"${keyword}"` : bridge.accountMode.toUpperCase()}: +₹${income.toLocaleString('en-IN')} / -₹${expense.toLocaleString('en-IN')} (${filtered.length})`
      );

      return {
        result: {
          count: filtered.length,
          totalIncome: income,
          totalExpense: expense,
          totalLent: lent,
          recentMatches: filtered.slice(0, 6).map(t => ({
            title: t.title,
            amount: t.amount,
            type: t.type,
            date: t.date,
            enteredBy: t.enteredBy
          }))
        },
        spokenSummary
      };
    }

    return { result: { ok: true }, spokenSummary: 'Done.' };
  }

  private emitToolChip(text: string) {
    this.callbacks.onTranscriptUpdate({
      id: `tool_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      role: 'tool',
      text,
      timestamp: Date.now(),
      isFinal: true
    });
  }

  // ─── Engine 1: Gemini 3.8 Live Bidirectional WebSocket ─────────────────────
  private async startGemini38Live(ephemeralToken: string): Promise<boolean> {
    try {
      const bridge = this.getBridge();
      const userName = canonicalUserName(bridge.currentUser?.id, bridge.currentUser?.name);
      const partnerName = userName === 'Sarthak' ? 'Praveen' : 'Sarthak';

      const ai = new GoogleGenAI({
        apiKey: ephemeralToken,
        httpOptions: { apiVersion: 'v1alpha' }
      });

      this.pcmPlayer = new Pcm24kAudioPlayer((speaking, level) => {
        if (this.isClosed) return;
        if (speaking) {
          this.callbacks.onStatusChange('speaking');
          this.callbacks.onAudioLevel(level, 'speaker');
        } else if (!this.isMuted) {
          this.callbacks.onStatusChange('listening');
          this.callbacks.onAudioLevel(0, 'speaker');
        }
      });

      const systemPrompt = `You are Funds Logger Live — an ultra-fast, warm, street-smart Indian voice accountant for ${userName}.
Current active ledger mode: ${bridge.accountMode.toUpperCase()}.
${isBusinessPartner(bridge.currentUser) ? `${userName}'s 50-50 business partner is ${partnerName}.` : ''}
Driving Mode Rules:
1. Keep every spoken answer SHORT, CRISP, and EYES-FREE (1 to 2 short sentences max) because ${userName} may be driving.
2. Understand English, Hindi, and Hinglish seamlessly (e.g. "Petrol 2200 aur chai 60", "Dr Prince se 13 hazaar aaye", "Sarthak ka hisaab batao").
3. Whenever the user mentions ANY expense, income, client payment, or transfer, IMMEDIATELY call log_transactions. Money received from a client is type="income"; money paid/spent is type="expense"; money given directly to ${partnerName} is type="lent".
4. When asked about balances, client totals, SaaS spend, or partner settlement, call query_ledger or get_partner_settlement rather than guessing.
5. Speak amounts naturally in Indian style (e.g. "13 thousand rupees" or "13 hazaar rupaye").`;

      let currentUserTranscriptId = '';
      let currentUserTranscriptAcc = '';
      let currentAiTranscriptId = '';
      let currentAiTranscriptAcc = '';

      this.geminiSession = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          contextWindowCompression: { slidingWindow: {} },
          sessionResumption: {},
          tools: [{ functionDeclarations: LIVE_TOOL_DECLARATIONS }]
        },
        callbacks: {
          onopen: () => {
            if (!this.isClosed) {
              this.callbacks.onStatusChange('listening');
            }
          },
          onmessage: (message: any) => {
            if (this.isClosed) return;

            const content = message.serverContent;
            if (content) {
              // 1. Handle instant barge-in interruption
              if (content.interrupted === true) {
                this.pcmPlayer?.interrupt();
                currentAiTranscriptId = '';
                currentAiTranscriptAcc = '';
              }

              // 2. Process ALL parts in modelTurn
              if (content.modelTurn?.parts) {
                for (const part of content.modelTurn.parts) {
                  if (part.inlineData?.data) {
                    this.pcmPlayer?.enqueuePcm24kBase64(part.inlineData.data);
                  }
                }
              }

              // 3. Stream live user input transcription
              if (content.inputTranscription?.text) {
                if (!currentUserTranscriptId) {
                  currentUserTranscriptId = `u_${Date.now()}`;
                  currentUserTranscriptAcc = '';
                }
                currentUserTranscriptAcc += content.inputTranscription.text;
                this.callbacks.onTranscriptUpdate({
                  id: currentUserTranscriptId,
                  role: 'user',
                  text: currentUserTranscriptAcc.trim(),
                  timestamp: Date.now(),
                  isFinal: false
                });
              }

              // 4. Stream live assistant output transcription
              if (content.outputTranscription?.text) {
                if (!currentAiTranscriptId) {
                  currentAiTranscriptId = `a_${Date.now()}`;
                  currentAiTranscriptAcc = '';
                }
                currentAiTranscriptAcc += content.outputTranscription.text;
                this.callbacks.onTranscriptUpdate({
                  id: currentAiTranscriptId,
                  role: 'assistant',
                  text: currentAiTranscriptAcc.trim(),
                  timestamp: Date.now(),
                  isFinal: false
                });
              }

              if (content.turnComplete) {
                currentUserTranscriptId = '';
                currentUserTranscriptAcc = '';
                currentAiTranscriptId = '';
                currentAiTranscriptAcc = '';
              }
            }

            // 5. Execute NON_BLOCKING tool calls asynchronously while audio continues
            if (message.toolCall?.functionCalls?.length) {
              this.callbacks.onStatusChange('thinking');
              const responses = message.toolCall.functionCalls.map((call: any) => {
                const { result, spokenSummary } = this.executeTool(call.name, call.args || {});
                return {
                  id: call.id,
                  name: call.name,
                  response: { ...result, summary: spokenSummary }
                };
              });
              try {
                this.geminiSession?.sendToolResponse({ functionResponses: responses });
              } catch (e) {
                console.warn('Failed to send tool response:', e);
              }
            }
          },
          onerror: (err: any) => {
            console.warn('Gemini Live WebSocket error:', err);
          },
          onclose: () => {
            if (!this.isClosed) {
              this.callbacks.onStatusChange('closed');
            }
          }
        }
      });

      // Start streaming 16kHz PCM microphone audio
      this.micStreamer = new PcmMicrophoneStreamer();
      await this.micStreamer.start(
        base64Chunk => {
          if (this.isClosed || this.isMuted || !this.geminiSession) return;
          try {
            this.geminiSession.sendRealtimeInput({
              audio: {
                data: base64Chunk,
                mimeType: 'audio/pcm;rate=16000'
              }
            });
          } catch {}
        },
        level => {
          if (!this.isClosed && !this.isMuted) {
            this.callbacks.onAudioLevel(level, 'mic');
          }
        }
      );

      // Prompt initial crisp voice greeting
      try {
        this.geminiSession.sendRealtimeInput({
          text: `Greet ${userName} in 1 short energetic sentence confirming ${bridge.accountMode} Live Driving Mode is ready.`
        });
      } catch {}

      return true;
    } catch (err: any) {
      console.warn('Could not start Gemini 3.8 Live session:', err);
      this.cleanupGemini();
      return false;
    }
  }

  // ─── Engine 2: Zero-Key Continuous Hands-Free Hinglish Loop ────────────────
  private async startContinuousHandsFreeLoop(): Promise<void> {
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      this.callbacks.onStatusChange('error');
      this.callbacks.onError('Hands-free speech recognition requires Chrome/Android or a Gemini API key in Settings.');
      return;
    }

    // Start ambient mic level meter so the Driving Orb pulses smoothly to user's voice
    try {
      this.localMicStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.localAudioCtx = new AudioCtx();
      const source = this.localAudioCtx.createMediaStreamSource(this.localMicStream);
      const analyser = this.localAudioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const freq = new Uint8Array(analyser.frequencyBinCount);

      const pumpLevel = () => {
        if (this.isClosed) return;
        if (!this.isMuted && !this.isSpeakingLocalTTS) {
          analyser.getByteFrequencyData(freq);
          const avg = freq.reduce((a, b) => a + b, 0) / freq.length;
          this.callbacks.onAudioLevel(Math.min(100, Math.round((avg / 110) * 100)), 'mic');
        }
        this.localAnimFrame = requestAnimationFrame(pumpLevel);
      };
      this.localAnimFrame = requestAnimationFrame(pumpLevel);
    } catch {
      // Optional visual meter; SpeechRecognition still runs cleanly if AudioContext was skipped
    }

    const bridge = this.getBridge();
    const userName = canonicalUserName(bridge.currentUser?.id, bridge.currentUser?.name);
    const modeLabel = bridge.accountMode === 'business' ? 'Business' : 'Personal';

    await this.speakAndResume(
      `Live Driving Mode ready for ${userName} in ${modeLabel} ledger. Speak expenses, ask settlement, or say undo anytime.`
    );
  }

  private launchSingleRecognitionCycle() {
    if (this.isClosed || this.isMuted || this.isSpeakingLocalTTS) return;
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;
    if (!SpeechRecognition) return;

    try {
      if (this.recognition) {
        try {
          this.recognition.onend = null;
          this.recognition.stop();
        } catch {}
      }

      const bridge = this.getBridge();
      const rec = new SpeechRecognition();
      this.recognition = rec;
      rec.lang = bridge.voiceLanguage === 'hi-IN' ? 'hi-IN' : 'en-IN';
      rec.continuous = false; // Single-utterance cycles prevent Android Chrome duplicate-loop bugs!
      rec.interimResults = true;

      const turnId = `u_local_${Date.now()}`;
      let latestTranscript = '';

      this.callbacks.onStatusChange('listening');

      rec.onresult = (event: any) => {
        if (this.isClosed || this.isMuted || this.isSpeakingLocalTTS) return;
        let combined = '';
        for (let i = 0; i < event.results.length; i++) {
          combined += (combined ? ' ' : '') + event.results[i][0].transcript.trim();
        }
        latestTranscript = combined.trim();
        if (latestTranscript) {
          this.callbacks.onTranscriptUpdate({
            id: turnId,
            role: 'user',
            text: latestTranscript,
            timestamp: Date.now(),
            isFinal: false
          });
        }
      };

      rec.onerror = (event: any) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.callbacks.onStatusChange('error');
          this.callbacks.onError('Microphone permission blocked. Please allow microphone access.');
        }
      };

      rec.onend = () => {
        if (this.isClosed || this.isMuted || this.isSpeakingLocalTTS) return;
        const spoken = latestTranscript.trim();
        if (spoken) {
          this.callbacks.onTranscriptUpdate({
            id: turnId,
            role: 'user',
            text: spoken,
            timestamp: Date.now(),
            isFinal: true
          });
          this.handleLocalSpokenTurn(spoken);
        } else {
          // Silence timeout — seamlessly restart listening cycle for continuous hands-free driving!
          this.scheduleNextCycle(220);
        }
      };

      rec.start();
    } catch {
      this.scheduleNextCycle(500);
    }
  }

  private scheduleNextCycle(delayMs = 250) {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    if (this.isClosed || this.isMuted) return;
    this.restartTimer = setTimeout(() => {
      this.launchSingleRecognitionCycle();
    }, delayMs);
  }

  private async handleLocalSpokenTurn(rawSpoken: string) {
    if (this.isClosed) return;
    this.callbacks.onStatusChange('thinking');

    const normalized = normalizeSpokenHinglishNumbers(rawSpoken);
    const lower = normalized.toLowerCase().trim();
    const bridge = this.getBridge();

    // 1. Voice Exit / Stop command
    if (/^(stop|exit|close|bye|band karo|live band karo|stop listening)$/i.test(lower)) {
      await this.speakAndResume('Closing Live Driving Mode. Drive safe!', false);
      this.callbacks.onRequestClose?.();
      return;
    }

    // 2. Undo / Cancel last
    if (/\b(undo|cancel last|delete last|hatao|hata do|galat ho gaya|remove last)\b/i.test(lower)) {
      const { spokenSummary } = this.executeTool('undo_last_entry');
      await this.speakAndResume(spokenSummary);
      return;
    }

    // 3. Confirm pending drafts
    if (/^(confirm|save|confirm kar do|haan save karo|save kar do|yes confirm|done|approve)$/i.test(lower)) {
      const { spokenSummary } = this.executeTool('confirm_pending_entries');
      await this.speakAndResume(spokenSummary);
      return;
    }

    // 4. Switch Personal / Business mode
    if (/\b(switch to business|business mode|business ledger|business account kholo)\b/i.test(lower)) {
      const { spokenSummary } = this.executeTool('switch_ledger_mode', { mode: 'business' });
      await this.speakAndResume(spokenSummary);
      return;
    }
    if (/\b(switch to personal|personal mode|personal ledger|personal account kholo)\b/i.test(lower)) {
      const { spokenSummary } = this.executeTool('switch_ledger_mode', { mode: 'personal' });
      await this.speakAndResume(spokenSummary);
      return;
    }

    // 5. Partner Settlement query
    if (/\b(settlement|hisaab|hisab|partner balance|kitna dena|kitna lena|owes|split)\b/i.test(lower)) {
      const { spokenSummary } = this.executeTool('get_partner_settlement');
      await this.speakAndResume(spokenSummary);
      return;
    }

    // 6. Ledger / Summary / Client query (when no new expense number OR explicit query words)
    const isExplicitQuery = /\b(total|summary|balance|kitna|how much|spent on|income from|status of)\b/i.test(lower);
    if (isExplicitQuery && !/\b(spent|paid|gave|received|got)\s+\d+/i.test(lower)) {
      const daysBack = /\b(today|aaj)\b/i.test(lower)
        ? 1
        : /\b(week|hafte)\b/i.test(lower)
          ? 7
          : /\b(month|mahine)\b/i.test(lower)
            ? 30
            : 0;
      const cleanedKeyword = lower
        .replace(/\b(what|is|the|total|summary|balance|kitna|hua|hai|aaya|gaya|kharcha|how|much|spent|on|for|in|from|today|aaj|this|week|month|mahine|ka|ki|ke|batao|show)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const { spokenSummary } = this.executeTool('query_ledger', {
        keyword: cleanedKeyword.length >= 2 ? cleanedKeyword : '',
        daysBack
      });
      await this.speakAndResume(spokenSummary);
      return;
    }

    // 7. Transaction Logging (single or multiple items with numbers, e.g. "Petrol 2200 and Chai 60")
    if (/\d+/.test(normalized)) {
      const parsed = parseMultiInput(normalized, bridge.aiMemory);
      if (parsed.length > 0) {
        const { spokenSummary } = this.executeTool('log_transactions', {
          entries: parsed.map(p => ({
            title: p.title,
            amount: p.amount,
            type: p.type,
            category: p.category,
            paymentMethod: p.paymentMethod,
            notes: p.notes
          }))
        });
        await this.speakAndResume(spokenSummary);
        return;
      }
    }

    await this.speakAndResume(
      'Say an item and amount like Petrol 2200, ask partner settlement, or say undo.'
    );
  }

  private speakAndResume(text: string, resumeAfter = true): Promise<void> {
    return new Promise(resolve => {
      if (this.isClosed) {
        resolve();
        return;
      }

      this.callbacks.onTranscriptUpdate({
        id: `a_local_${Date.now()}`,
        role: 'assistant',
        text,
        timestamp: Date.now(),
        isFinal: true
      });

      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        if (resumeAfter) this.scheduleNextCycle(300);
        resolve();
        return;
      }

      // Pause recognition while speaking so mic never picks up speaker TTS echo
      this.isSpeakingLocalTTS = true;
      if (this.recognition) {
        try {
          this.recognition.onend = null;
          this.recognition.stop();
        } catch {}
      }

      try {
        window.speechSynthesis.cancel();
        const bridge = this.getBridge();
        const cleanSpeech = text.replace(/[*_#•₹]/g, '');
        const utter = new SpeechSynthesisUtterance(cleanSpeech);
        utter.lang = bridge.voiceLanguage === 'hi-IN' ? 'hi-IN' : 'en-IN';
        utter.rate = 1.04;

        this.callbacks.onStatusChange('speaking');
        this.callbacks.onAudioLevel(65, 'speaker');

        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          this.isSpeakingLocalTTS = false;
          this.callbacks.onAudioLevel(0, 'speaker');
          if (!this.isClosed && !this.isMuted && resumeAfter) {
            this.scheduleNextCycle(260);
          }
          resolve();
        };

        // Safety timeout in case mobile WebView omits utterance.onend
        const maxWait = Math.max(2500, cleanSpeech.length * 85);
        const timer = setTimeout(finish, maxWait);

        utter.onend = () => {
          clearTimeout(timer);
          finish();
        };
        utter.onerror = () => {
          clearTimeout(timer);
          finish();
        };

        window.speechSynthesis.speak(utter);
      } catch {
        this.isSpeakingLocalTTS = false;
        if (resumeAfter) this.scheduleNextCycle(300);
        resolve();
      }
    });
  }

  // ─── Controls: Barge-In, Mute/Resume, Undo, Stop ───────────────────────────
  public interruptSpeech() {
    if (this.engine === 'gemini-3.8-live') {
      this.pcmPlayer?.interrupt();
      if (!this.isMuted) this.callbacks.onStatusChange('listening');
    } else {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
      this.isSpeakingLocalTTS = false;
      if (!this.isMuted) {
        this.scheduleNextCycle(150);
      }
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;

    if (this.engine === 'gemini-3.8-live') {
      this.micStreamer?.setMuted(this.isMuted);
      if (this.isMuted) {
        try {
          this.geminiSession?.sendRealtimeInput({ audioStreamEnd: true });
        } catch {}
        this.callbacks.onAudioLevel(0, 'mic');
        this.callbacks.onStatusChange('muted');
      } else {
        this.callbacks.onStatusChange('listening');
      }
    } else {
      if (this.isMuted) {
        if (this.restartTimer) clearTimeout(this.restartTimer);
        if (this.recognition) {
          try {
            this.recognition.onend = null;
            this.recognition.stop();
          } catch {}
        }
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          try {
            window.speechSynthesis.cancel();
          } catch {}
        }
        this.isSpeakingLocalTTS = false;
        this.callbacks.onAudioLevel(0, 'mic');
        this.callbacks.onStatusChange('muted');
      } else {
        this.scheduleNextCycle(120);
      }
    }

    return this.isMuted;
  }

  public triggerManualUndo() {
    const { spokenSummary } = this.executeTool('undo_last_entry');
    if (this.engine === 'gemini-3.8-live' && this.geminiSession) {
      try {
        this.geminiSession.sendRealtimeInput({
          text: `System note: User tapped Undo button. ${spokenSummary}. Acknowledge briefly.`
        });
      } catch {}
    } else {
      this.speakAndResume(spokenSummary);
    }
  }

  private cleanupGemini() {
    if (this.micStreamer) {
      this.micStreamer.stop();
      this.micStreamer = null;
    }
    if (this.pcmPlayer) {
      this.pcmPlayer.destroy();
      this.pcmPlayer = null;
    }
    if (this.geminiSession) {
      try {
        this.geminiSession.close();
      } catch {}
      this.geminiSession = null;
    }
  }

  public stop() {
    this.isClosed = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.cleanupGemini();

    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }
    if (this.localAnimFrame) {
      cancelAnimationFrame(this.localAnimFrame);
      this.localAnimFrame = null;
    }
    if (this.localAudioCtx) {
      try {
        this.localAudioCtx.close();
      } catch {}
      this.localAudioCtx = null;
    }
    if (this.localMicStream) {
      this.localMicStream.getTracks().forEach(t => {
        try {
          t.stop();
        } catch {}
      });
      this.localMicStream = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.callbacks.onStatusChange('closed');
  }
}
