import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  X,
  RotateCcw,
  Zap,
  FileCheck2,
  Sparkles,
  Building2,
  User,
  CheckCircle2,
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
    deleteTransaction
  } = useFinance();

  const [status, setStatus] = useState<LiveVoiceStatus>('connecting');
  const [engine, setEngine] = useState<LiveSessionEngine>('gemini-3.8-live');
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioSource, setAudioSource] = useState<'mic' | 'speaker'>('mic');
  const [turns, setTurns] = useState<LiveTranscriptTurn[]>([]);
  const [sessionEntries, setSessionEntries] = useState<Transaction[]>([]);
  const [autoSaveDriving, setAutoSaveDriving] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const sessionRef = useRef<LiveVoiceAgentSession | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Keep fresh ref of live finance state so option switches (Personal/Business, Auto-Save/Draft) apply instantaneously with zero reconnect or chatter
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

  // Keep phone screen awake while Live Voice Mode is open
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

  // Start / Tear down Live Voice Session cleanly once per open
  useEffect(() => {
    if (!isOpen) return;

    setErrorBanner(null);
    setTurns([]);
    setSessionEntries([]);

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
            return copy.slice(-16);
          }
          return [...prev, turn].slice(-16);
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
  }, [isOpen]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  if (!isOpen) return null;

  const isPartner = isBusinessPartner(currentUser);
  const orbScale = 1 + Math.min(0.22, (audioLevel / 100) * 0.22);
  const ringScaleOuter = 1 + Math.min(0.45, (audioLevel / 100) * 0.45);

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

  const handleSwitchLedger = (nextMode: 'personal' | 'business') => {
    if (accountMode === nextMode) return;
    bridgeRef.current.accountMode = nextMode;
    setAccountMode(nextMode);
  };

  const handleSwitchSaveMode = (autoSave: boolean) => {
    if (autoSaveDriving === autoSave) return;
    bridgeRef.current.autoSaveInDrivingMode = autoSave;
    setAutoSaveDriving(autoSave);
  };

  const statusHeadline =
    status === 'connecting'
      ? 'Connecting Live Voice...'
      : status === 'listening'
        ? 'Listening — Speak Anytime'
        : status === 'thinking'
          ? 'Updating Ledger...'
          : status === 'speaking'
            ? 'Speaking — Tap Mic to Interrupt'
            : status === 'muted'
              ? 'Mic Paused — Tap to Resume'
              : status === 'error'
                ? 'Microphone Attention Needed'
                : 'Session Ended';

  return (
    <div className="fixed inset-0 z-[90] sm:bg-black/25 sm:backdrop-blur-xs flex items-center justify-center font-outfit select-none">
      <div className="w-full h-[100dvh] sm:h-[min(90dvh,740px)] sm:max-w-[460px] bg-[#F3F5F1] text-[#0D2E14] sm:rounded-3xl sm:border sm:border-[#E2E8E0] sm:shadow-2xl flex flex-col overflow-hidden">
        {/* Top Light Header (matches global app Header & Modals) */}
        <div className="bg-white border-b border-[#E2E8E0] px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3.5 pb-3 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0D2E14] flex items-center justify-center p-1.5 shadow-2xs flex-shrink-0">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain rounded-full" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-extrabold text-sm text-[#0D2E14] truncate">Live Voice Accountant</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F0F7EE] border border-emerald-200 text-[10px] font-extrabold text-[#0D2E14]">
                  <Radio className="w-2.5 h-2.5 text-emerald-700 animate-pulse" />
                  <span>{engine === 'gemini-3.8-live' ? 'Gemini 3.8' : 'Live'}</span>
                </span>
              </div>
              <p className="text-[10px] text-gray-500 font-medium truncate">
                Hands-free voice logging & instant balance answers
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Close Live Voice"
            className="w-8 h-8 rounded-full bg-[#F3F5F1] hover:bg-gray-200 text-gray-600 hover:text-[#0D2E14] flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fixed-Grid Responsive Option Switchers (zero wrapping or layout shift on switch) */}
        <div className="px-3.5 pt-2.5 pb-1 flex-shrink-0 space-y-2">
          <div className="bg-white border border-[#E2E8E0] rounded-2xl p-2 shadow-2xs space-y-1.5">
            {/* Row 1: Personal vs Business Ledger */}
            {isPartner ? (
              <div className="grid grid-cols-2 gap-1 bg-[#F3F5F1] p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleSwitchLedger('personal')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate ${
                    accountMode === 'personal'
                      ? 'bg-[#0D2E14] text-white shadow-2xs'
                      : 'text-gray-600 hover:text-[#0D2E14]'
                  }`}
                >
                  <User className={`w-3.5 h-3.5 flex-shrink-0 ${accountMode === 'personal' ? 'text-[#93E044]' : 'text-gray-500'}`} />
                  <span className="truncate">{currentUser?.name || 'Personal'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchLedger('business')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate ${
                    accountMode === 'business'
                      ? 'bg-[#0D2E14] text-white shadow-2xs'
                      : 'text-gray-600 hover:text-[#0D2E14]'
                  }`}
                >
                  <Building2 className={`w-3.5 h-3.5 flex-shrink-0 ${accountMode === 'business' ? 'text-[#93E044]' : 'text-gray-500'}`} />
                  <span className="truncate">Business 50-50</span>
                </button>
              </div>
            ) : (
              <div className="bg-[#F3F5F1] px-3 py-1.5 rounded-xl flex items-center justify-center gap-1.5 text-xs font-extrabold text-[#0D2E14]">
                <User className="w-3.5 h-3.5 text-emerald-700" />
                <span>{currentUser?.name || 'Personal'} Ledger</span>
              </div>
            )}

            {/* Row 2: Auto-Save Passbook vs Review Drafts */}
            <div className="grid grid-cols-2 gap-1 bg-[#F3F5F1] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleSwitchSaveMode(true)}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer truncate ${
                  autoSaveDriving
                    ? 'bg-white text-[#0D2E14] border border-[#E2E8E0] shadow-2xs'
                    : 'text-gray-500 hover:text-[#0D2E14]'
                }`}
              >
                <Zap className={`w-3 h-3 flex-shrink-0 ${autoSaveDriving ? 'text-emerald-600' : 'text-gray-400'}`} />
                <span className="truncate">Auto-Save ON</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchSaveMode(false)}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer truncate ${
                  !autoSaveDriving
                    ? 'bg-white text-[#0D2E14] border border-[#E2E8E0] shadow-2xs'
                    : 'text-gray-500 hover:text-[#0D2E14]'
                }`}
              >
                <FileCheck2 className={`w-3 h-3 flex-shrink-0 ${!autoSaveDriving ? 'text-amber-600' : 'text-gray-400'}`} />
                <span className="truncate">Review Drafts</span>
              </button>
            </div>
          </div>

          {errorBanner && (
            <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center justify-between gap-2">
              <span>{errorBanner}</span>
              <button onClick={() => setErrorBanner(null)} className="underline text-[11px] flex-shrink-0">
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Center Light Sonic Mic + Live Word Transcription + Scrollable Feed */}
        <div className="flex-1 min-h-0 flex flex-col items-center px-4 py-2 gap-3 overflow-hidden">
          {/* Sonic Mic Button (Light Palette) */}
          <div className="relative flex items-center justify-center my-1 flex-shrink-0">
            <div
              style={{ transform: `scale(${ringScaleOuter})` }}
              className={`absolute w-32 h-32 sm:w-36 sm:h-36 rounded-full transition-transform duration-100 pointer-events-none ${
                status === 'muted'
                  ? 'bg-gray-200/50'
                  : status === 'thinking'
                    ? 'bg-amber-200/50 animate-pulse'
                    : 'bg-[#93E044]/25'
              }`}
            />

            <div
              style={{ transform: `scale(${1 + (orbScale - 1) * 0.65})` }}
              className={`absolute w-28 h-28 sm:w-32 sm:h-32 rounded-full border transition-transform duration-100 pointer-events-none ${
                status === 'muted'
                  ? 'border-gray-300 bg-white/60'
                  : 'border-[#0D2E14]/15 bg-[#E4ECE2]/70'
              }`}
            />

            <button
              type="button"
              onClick={handleOrbTap}
              style={{ transform: `scale(${orbScale})` }}
              className={`relative w-[88px] h-[88px] sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center shadow-lg transition-all duration-100 cursor-pointer border-4 ${
                status === 'muted'
                  ? 'bg-white border-gray-300 text-gray-500'
                  : status === 'thinking'
                    ? 'bg-[#0D2E14] border-amber-400 text-[#93E044]'
                    : status === 'speaking'
                      ? 'bg-emerald-800 border-[#93E044] text-white'
                      : 'bg-[#0D2E14] border-[#93E044] text-white'
              }`}
            >
              {status === 'muted' ? (
                <MicOff className="w-8 h-8 text-gray-500" />
              ) : status === 'speaking' && audioSource === 'speaker' ? (
                <Volume2 className="w-8 h-8 text-[#93E044] animate-pulse" />
              ) : status === 'thinking' ? (
                <Sparkles className="w-8 h-8 text-[#93E044] animate-spin" />
              ) : (
                <Mic className="w-8 h-8 text-[#93E044]" />
              )}
              <span className="text-[9px] font-black uppercase tracking-wider mt-1">
                {status === 'muted' ? 'Resume' : status === 'speaking' ? 'Interrupt' : 'Live'}
              </span>
            </button>
          </div>

          {/* Headline & Hints */}
          <div className="text-center space-y-0.5 max-w-sm flex-shrink-0">
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-[#0D2E14]">
              {statusHeadline}
            </h2>
            <p className="text-[11px] text-gray-500 font-medium">
              Say <span className="font-bold text-[#0D2E14]">"Petrol 2200 aur Chai 60"</span>,{' '}
              <span className="font-bold text-[#0D2E14]">"Partner hisaab"</span>, or{' '}
              <span className="font-bold text-[#0D2E14]">"Undo"</span>
            </p>
          </div>

          {/* Live Word-by-Word Transcription Box (Light Card) */}
          <div className="w-full flex-shrink-0">
            {activeLiveUserTurn?.text ? (
              <div className="rounded-2xl px-3.5 py-2.5 bg-white border-2 border-[#0D2E14] shadow-sm flex items-center justify-between gap-2.5 animate-fadeIn">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                    Hearing Your Words Live
                  </span>
                  <p className="text-xs sm:text-sm font-extrabold text-[#0D2E14] mt-0.5 break-words leading-snug">
                    "{activeLiveUserTurn.text}"
                  </p>
                </div>
                {engine === 'handsfree-local' && (
                  <button
                    type="button"
                    onClick={() => sessionRef.current?.commitCurrentSpeechNow()}
                    className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-[#0D2E14] hover:bg-black text-[#93E044] text-xs font-extrabold flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all"
                  >
                    <span className="text-white">Send</span>
                    <Send className="w-3 h-3" />
                  </button>
                )}
              </div>
            ) : status === 'listening' ? (
              <div className="rounded-2xl px-3.5 py-2 bg-white border border-[#E2E8E0] text-center shadow-2xs">
                <p className="text-[11px] text-gray-600 font-semibold">
                  🎙️ Microphone active — speak naturally and watch your words transcribe here
                </p>
              </div>
            ) : null}
          </div>

          {/* Scrollable Light Conversation Feed */}
          <div className="w-full flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2 py-1">
            {finalizedTurns.slice(-6).map(t => (
              <div
                key={t.id}
                className={`rounded-2xl px-3.5 py-2 text-xs font-semibold leading-snug animate-fadeIn ${
                  t.role === 'user'
                    ? 'bg-[#0D2E14] text-white ml-8 text-right shadow-2xs'
                    : t.role === 'tool'
                      ? 'bg-[#F0F7EE] text-[#0D2E14] text-center border border-emerald-200 font-extrabold text-[11px]'
                      : 'bg-white text-[#0D2E14] mr-8 border border-[#E2E8E0] shadow-2xs'
                }`}
              >
                {t.role === 'user' && (
                  <span className="text-[9px] text-[#93E044] block font-black uppercase tracking-wider">You</span>
                )}
                {t.role === 'assistant' && (
                  <span className="text-[9px] text-emerald-700 block font-black uppercase tracking-wider">Accountant</span>
                )}
                {t.text}
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* Bottom Light Dock: Session Entries + Action Controls */}
        <div className="bg-white border-t border-[#E2E8E0] px-3.5 pt-2.5 pb-[max(0.85rem,env(safe-area-inset-bottom))] sm:pb-3.5 space-y-2.5 flex-shrink-0">
          {sessionEntries.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {sessionEntries.slice(0, 5).map(tx => (
                <div
                  key={tx.id}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#F3F5F1] border border-[#E2E8E0] text-[11px] font-bold text-[#0D2E14]"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span className="truncate max-w-[100px]">{tx.title}</span>
                  <span className={tx.type === 'income' ? 'text-emerald-700' : 'text-rose-600'}>
                    {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {/* Pause / Resume Mic */}
            <button
              type="button"
              onClick={() => sessionRef.current?.toggleMute()}
              className={`py-2.5 px-2 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-1.5 border transition-all active:scale-95 cursor-pointer ${
                status === 'muted'
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-[#F3F5F1] hover:bg-gray-200 text-[#0D2E14] border-[#E2E8E0]'
              }`}
            >
              {status === 'muted' ? (
                <MicOff className="w-4 h-4 text-amber-700 flex-shrink-0" />
              ) : (
                <Mic className="w-4 h-4 text-emerald-700 flex-shrink-0" />
              )}
              <span className="truncate">{status === 'muted' ? 'Resume' : 'Pause Mic'}</span>
            </button>

            {/* Undo Last */}
            <button
              type="button"
              onClick={() => sessionRef.current?.triggerManualUndo()}
              disabled={sessionEntries.length === 0}
              className="py-2.5 px-2 rounded-2xl bg-[#F3F5F1] hover:bg-gray-200 disabled:opacity-40 text-[#0D2E14] border border-[#E2E8E0] font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4 text-[#0D2E14] flex-shrink-0" />
              <span className="truncate">Undo Last</span>
            </button>

            {/* End Live */}
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-2 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <X className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">End Live</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default LiveVoiceDrivingModal;
