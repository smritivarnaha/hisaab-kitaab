import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  Zap,
  Sparkles,
  Building2,
  User,
  CheckCircle2,
  KeyRound,
  Volume2,
  Radio,
  Send
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Transaction, isBusinessPartner } from '../../types/finance';
import {
  LiveVoiceAgentSession,
  LiveVoiceStatus,
  LiveSessionEngine,
  LiveTranscriptTurn,
  LiveFinanceBridge
} from '../../services/ai/liveVoiceAgent';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const LiveVoiceDrivingModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    accountMode,
    setAccountMode,
    transactions,
    aiMemory,
    settings,
    businessSettlement,
    addTransactionsBatch,
    confirmPendingItemsBatch,
    deleteTransaction,
    updateSettings
  } = useFinance();

  const [status, setStatus] = useState<LiveVoiceStatus>('connecting');
  const [engine, setEngine] = useState<LiveSessionEngine>('handsfree-local');
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioSource, setAudioSource] = useState<'mic' | 'speaker'>('mic');
  const [turns, setTurns] = useState<LiveTranscriptTurn[]>([]);
  const [sessionEntries, setSessionEntries] = useState<Transaction[]>([]);
  const [autoSaveDriving, setAutoSaveDriving] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Inline Gemini 3.8 Neural Key quick-upgrade drawer
  const [showKeyBox, setShowKeyBox] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [reconnectNonce, setReconnectNonce] = useState(0);

  const sessionRef = useRef<LiveVoiceAgentSession | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Always keep a fresh ref of live finance state so tool calls mid-conversation read latest values
  const bridgeRef = useRef<LiveFinanceBridge>({
    currentUser,
    accountMode,
    transactions,
    aiMemory,
    autoSaveInDrivingMode: autoSaveDriving,
    voiceLanguage: settings.voiceLanguage || 'en-IN',
    geminiApiKey: settings.apiKey,
    businessSettlement,
    addTransactionsBatch,
    confirmPendingItemsBatch,
    deleteTransaction,
    setAccountMode
  });

  useEffect(() => {
    bridgeRef.current = {
      currentUser,
      accountMode,
      transactions,
      aiMemory,
      autoSaveInDrivingMode: autoSaveDriving,
      voiceLanguage: settings.voiceLanguage || 'en-IN',
      geminiApiKey: settings.apiKey,
      businessSettlement,
      addTransactionsBatch,
      confirmPendingItemsBatch,
      deleteTransaction,
      setAccountMode
    };
  }, [
    currentUser,
    accountMode,
    transactions,
    aiMemory,
    autoSaveDriving,
    settings.voiceLanguage,
    settings.apiKey,
    businessSettlement,
    addTransactionsBatch,
    confirmPendingItemsBatch,
    deleteTransaction,
    setAccountMode
  ]);

  // Keep phone screen awake while Driving Mode is open
  useEffect(() => {
    if (!isOpen) return;
    let wakeLock: any = null;

    const acquireWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch {}
    };

    acquireWakeLock();
    const onVis = () => {
      if (document.visibilityState === 'visible') acquireWakeLock();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (wakeLock) {
        try {
          wakeLock.release();
        } catch {}
      }
    };
  }, [isOpen]);

  // Start / Tear down Live Voice Session
  useEffect(() => {
    if (!isOpen) return;

    setErrorBanner(null);
    const agent = new LiveVoiceAgentSession(() => bridgeRef.current, {
      onStatusChange: nextStatus => setStatus(nextStatus),
      onEngineResolved: resolvedEngine => setEngine(resolvedEngine),
      onAudioLevel: (lvl, src) => {
        setAudioLevel(lvl);
        setAudioSource(src);
      },
      onTranscriptUpdate: turn => {
        setTurns(prev => {
          const idx = prev.findIndex(t => t.id === turn.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = turn;
            return copy.slice(-14);
          }
          return [...prev, turn].slice(-14);
        });
      },
      onTransactionsLogged: items => {
        setSessionEntries(prev => [...items, ...prev].slice(0, 12));
      },
      onTransactionUndone: undone => {
        setSessionEntries(prev => prev.filter(p => p.id !== undone.id));
      },
      onError: msg => setErrorBanner(msg),
      onRequestClose: () => onClose()
    });

    sessionRef.current = agent;
    agent.start();

    return () => {
      agent.stop();
      sessionRef.current = null;
    };
  }, [isOpen, reconnectNonce]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  if (!isOpen) return null;

  const isPartner = isBusinessPartner(currentUser);
  const orbScale = 1 + Math.min(0.28, (audioLevel / 100) * 0.28);
  const ringScaleOuter = 1 + Math.min(0.55, (audioLevel / 100) * 0.55);
  const activeLiveUserTurn = [...turns].reverse().find(t => t.role === 'user' && !t.isFinal);
  const finalizedTurns = turns.filter(t => t.id !== activeLiveUserTurn?.id);

  const handleOrbTap = () => {
    if (!sessionRef.current) return;
    if (status === 'speaking') {
      sessionRef.current.interruptSpeech();
      return;
    }
    sessionRef.current.toggleMute();
  };

  const handleSaveGeminiKeyAndUpgrade = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = keyInput.trim();
    if (!cleaned.startsWith('AIza')) {
      setErrorBanner('Please paste a valid Google AI Studio key starting with "AIza..."');
      return;
    }
    setErrorBanner(null);
    updateSettings({ apiKey: cleaned, aiProvider: 'gemini' });
    bridgeRef.current.geminiApiKey = cleaned;
    setShowKeyBox(false);
    setKeyInput('');
    setReconnectNonce(n => n + 1);
  };

  const statusHeadline =
    status === 'connecting'
      ? 'Connecting Live Voice...'
      : status === 'listening'
        ? 'Listening — Speak Anytime'
        : status === 'thinking'
          ? 'Updating Ledger...'
          : status === 'speaking'
            ? 'Speaking — Tap Orb to Interrupt'
            : status === 'muted'
              ? 'Mic Paused — Tap Orb to Resume'
              : status === 'error'
                ? 'Microphone Attention Needed'
                : 'Session Ended';

  return (
    <div className="fixed inset-0 z-[90] bg-gradient-to-b from-[#041308] via-[#092310] to-[#041308] text-white font-outfit flex flex-col justify-between overflow-hidden select-none">
      {/* Top Safe-Area Cockpit Bar */}
      <div className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 flex flex-col gap-2.5 z-20">
        <div className="flex items-center justify-between gap-2">
          {/* Engine Indicator Badge */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold border ${
                engine === 'gemini-3.8-live'
                  ? 'bg-emerald-500/20 border-[#93E044]/60 text-[#93E044]'
                  : 'bg-white/10 border-white/20 text-emerald-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5 animate-pulse text-[#93E044]" />
              {engine === 'gemini-3.8-live' ? 'Gemini 3.8 Neural Live' : 'Hands-Free Live'}
            </span>

            {engine !== 'gemini-3.8-live' && (
              <button
                type="button"
                onClick={() => setShowKeyBox(v => !v)}
                className="px-2.5 py-1 rounded-full bg-amber-400/15 hover:bg-amber-400/25 border border-amber-300/30 text-amber-200 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <KeyRound className="w-3 h-3" />
                <span>Neural Key</span>
              </button>
            )}
          </div>

          {/* Active User + Auto-Save Toggle */}
          <button
            type="button"
            onClick={() => setAutoSaveDriving(v => !v)}
            className={`px-3 py-1 rounded-full text-[11px] font-extrabold border flex items-center gap-1 transition-all cursor-pointer ${
              autoSaveDriving
                ? 'bg-[#93E044]/20 border-[#93E044]/60 text-[#93E044]'
                : 'bg-white/10 border-white/20 text-gray-300'
            }`}
            title="When ON, spoken expenses save directly to Passbook without needing manual confirmation"
          >
            <Zap className="w-3 h-3" />
            <span>{autoSaveDriving ? 'Auto-Save ON' : 'Draft Mode'}</span>
          </button>
        </div>

        {/* Optional Inline Gemini 3.8 Key Upgrade Drawer */}
        {showKeyBox && (
          <form
            onSubmit={handleSaveGeminiKeyAndUpgrade}
            className="p-3 rounded-2xl bg-black/50 border border-emerald-400/30 backdrop-blur-md space-y-2 animate-fadeIn"
          >
            <p className="text-[11px] text-emerald-100 font-medium leading-snug">
              Paste a free Google AI Studio key (<code className="text-[#93E044]">AIza...</code>) to upgrade from on-device speech to <b>Gemini 3.8 Live 24kHz Neural Audio</b>:
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-400 outline-none focus:border-[#93E044]"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-[#93E044] text-[#051609] text-xs font-black cursor-pointer"
              >
                Activate
              </button>
            </div>
          </form>
        )}

        {/* Driving Ledger Mode Switcher (Personal vs Business) */}
        <div className="flex items-center justify-center gap-2">
          <div className="inline-flex bg-white/10 p-1 rounded-2xl border border-white/15">
            <button
              type="button"
              onClick={() => setAccountMode('personal')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                accountMode === 'personal'
                  ? 'bg-[#93E044] text-[#051609] shadow-md'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{currentUser?.name || 'Personal'}</span>
            </button>

            {isPartner && (
              <button
                type="button"
                onClick={() => setAccountMode('business')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  accountMode === 'business'
                    ? 'bg-[#93E044] text-[#051609] shadow-md'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Business 50-50</span>
              </button>
            )}
          </div>
        </div>

        {errorBanner && (
          <div className="mx-auto max-w-md w-full px-3.5 py-2 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-100 text-xs font-bold text-center">
            {errorBanner}
          </div>
        )}
      </div>

      {/* Center Interactive Sonic Orb + Live Captions */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 min-h-0 gap-5">
        {/* Sonic Orb */}
        <div className="relative flex items-center justify-center my-2">
          {/* Outer Reactive Halo */}
          <div
            style={{ transform: `scale(${ringScaleOuter})` }}
            className={`absolute w-44 h-44 sm:w-52 sm:h-52 rounded-full transition-transform duration-100 pointer-events-none blur-md ${
              status === 'speaking'
                ? 'bg-cyan-400/20'
                : status === 'thinking'
                  ? 'bg-amber-400/25 animate-pulse'
                  : status === 'muted'
                    ? 'bg-slate-500/10'
                    : 'bg-[#93E044]/20'
            }`}
          />

          {/* Middle Pulse Ring */}
          <div
            style={{ transform: `scale(${1 + (orbScale - 1) * 0.65})` }}
            className={`absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full border transition-transform duration-100 pointer-events-none ${
              status === 'speaking'
                ? 'border-cyan-300/40 bg-cyan-400/10'
                : status === 'thinking'
                  ? 'border-amber-300/50 bg-amber-400/10'
                  : status === 'muted'
                    ? 'border-white/15 bg-white/5'
                    : 'border-[#93E044]/45 bg-[#93E044]/10'
            }`}
          />

          {/* Core Tap-Target Orb */}
          <button
            type="button"
            onClick={handleOrbTap}
            style={{ transform: `scale(${orbScale})` }}
            className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-100 cursor-pointer border-2 ${
              status === 'speaking'
                ? 'bg-gradient-to-br from-cyan-400 to-emerald-500 border-cyan-200 text-[#041308]'
                : status === 'thinking'
                  ? 'bg-gradient-to-br from-amber-300 to-emerald-500 border-amber-100 text-[#041308]'
                  : status === 'muted'
                    ? 'bg-slate-800 border-slate-600 text-slate-300'
                    : 'bg-gradient-to-br from-[#93E044] to-emerald-600 border-[#c9f59b] text-[#041308]'
            }`}
          >
            {status === 'muted' ? (
              <MicOff className="w-10 h-10" />
            ) : status === 'speaking' && audioSource === 'speaker' ? (
              <Volume2 className="w-10 h-10 animate-pulse" />
            ) : status === 'thinking' ? (
              <Sparkles className="w-10 h-10 animate-spin" />
            ) : (
              <Mic className="w-10 h-10" />
            )}
            <span className="text-[10px] font-black uppercase tracking-wider mt-1">
              {status === 'muted' ? 'Tap Resume' : status === 'speaking' ? 'Interrupt' : 'Live'}
            </span>
          </button>
        </div>

        {/* Status Headline & Voice Hints */}
        <div className="text-center space-y-1 max-w-md">
          <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
            {statusHeadline}
          </h2>
          <p className="text-xs text-emerald-200/75 font-medium">
            Try: <span className="text-[#93E044]">"Petrol 2200 aur Chai 60"</span> •{' '}
            <span className="text-[#93E044]">"Sarthak ka hisaab"</span> •{' '}
            <span className="text-[#93E044]">"Undo"</span>
          </p>
        </div>

        {/* Live Word-by-Word Speech Transcription Box */}
        <div className="w-full max-w-lg px-1">
          {activeLiveUserTurn?.text ? (
            <div className="rounded-2xl px-4 py-3 bg-emerald-950/90 border-2 border-[#93E044]/75 shadow-lg flex items-center justify-between gap-3 animate-fadeIn">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#93E044] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#93E044] animate-ping inline-block" />
                  Hearing Your Words Live
                </span>
                <p className="text-sm sm:text-base font-extrabold text-white mt-0.5 break-words leading-snug">
                  "{activeLiveUserTurn.text}"
                </p>
              </div>
              <button
                type="button"
                onClick={() => sessionRef.current?.commitCurrentSpeechNow()}
                className="flex-shrink-0 px-3 py-2 rounded-xl bg-[#93E044] hover:bg-[#a6ec5c] text-[#041308] text-xs font-black flex items-center gap-1 shadow-md cursor-pointer active:scale-95 transition-all"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : status === 'listening' ? (
            <div className="rounded-2xl px-4 py-2.5 bg-white/5 border border-white/15 text-center">
              <p className="text-xs text-emerald-200/85 font-semibold">
                🎙️ Mic active — speak naturally and watch every word appear here live...
              </p>
            </div>
          ) : null}
        </div>

        {/* Streaming Live Captions Feed */}
        <div className="w-full max-w-lg max-h-36 sm:max-h-44 overflow-y-auto no-scrollbar space-y-2 px-1">
          {finalizedTurns.slice(-4).map(t => (
            <div
              key={t.id}
              className={`rounded-2xl px-3.5 py-2 text-xs sm:text-sm font-semibold leading-snug animate-fadeIn ${
                t.role === 'user'
                  ? 'bg-white/10 text-white ml-8 text-right border border-white/15'
                  : t.role === 'tool'
                    ? 'bg-[#93E044]/20 text-[#93E044] text-center border border-[#93E044]/40 font-extrabold text-xs'
                    : 'bg-emerald-950/80 text-emerald-100 mr-8 border border-emerald-500/30'
              }`}
            >
              {t.role === 'user' && <span className="text-[10px] text-[#93E044] block font-black">YOU</span>}
              {t.role === 'assistant' && (
                <span className="text-[10px] text-cyan-300 block font-black">ACCOUNTANT</span>
              )}
              {t.text}
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      {/* Session Logged Entries Strip + Giant Driving Dock */}
      <div className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 space-y-3 z-20 bg-gradient-to-t from-black/50 to-transparent">
        {/* Recently Logged in This Session */}
        {sessionEntries.length > 0 && (
          <div className="max-w-lg mx-auto w-full flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {sessionEntries.slice(0, 4).map(tx => (
              <div
                key={tx.id}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-bold"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#93E044]" />
                <span className="truncate max-w-[110px]">{tx.title}</span>
                <span className={tx.type === 'income' ? 'text-[#93E044]' : 'text-rose-300'}>
                  {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Giant Thumb-Friendly Bottom Driving Controls */}
        <div className="max-w-md mx-auto w-full grid grid-cols-3 gap-3">
          {/* Mute / Resume */}
          <button
            type="button"
            onClick={() => sessionRef.current?.toggleMute()}
            className={`py-3.5 px-3 rounded-2xl font-extrabold text-xs flex flex-col items-center justify-center gap-1 border transition-all active:scale-95 cursor-pointer ${
              status === 'muted'
                ? 'bg-amber-400 text-[#041308] border-amber-300'
                : 'bg-white/10 hover:bg-white/15 text-white border-white/15'
            }`}
          >
            {status === 'muted' ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-[#93E044]" />}
            <span>{status === 'muted' ? 'Resume Mic' : 'Pause Mic'}</span>
          </button>

          {/* 1-Tap Undo Last */}
          <button
            type="button"
            onClick={() => sessionRef.current?.triggerManualUndo()}
            disabled={sessionEntries.length === 0}
            className="py-3.5 px-3 rounded-2xl bg-white/10 hover:bg-white/15 disabled:opacity-35 text-white border border-white/15 font-extrabold text-xs flex flex-col items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-5 h-5 text-amber-300" />
            <span>Undo Last</span>
          </button>

          {/* End Live Driving Session */}
          <button
            type="button"
            onClick={onClose}
            className="py-3.5 px-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white border border-rose-400/40 font-extrabold text-xs flex flex-col items-center justify-center gap-1 shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <PhoneOff className="w-5 h-5" />
            <span>End Live</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default LiveVoiceDrivingModal;
