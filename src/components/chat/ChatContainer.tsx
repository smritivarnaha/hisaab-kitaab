import React, { useState, useEffect, useRef } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { ChatMessageItem } from './ChatMessageItem';
import { transcribeWithWhisper } from '../../services/ai/openai';
import { speechService } from '../../services/voice/speechRecognition';
import { Mic, Square, Send, Camera, Sparkles, Loader2, Radio } from 'lucide-react';

interface Props {
  onOpenOCR: () => void;
  onOpenImport: () => void;
  onOpenLiveVoice?: () => void;
}

export const ChatContainer: React.FC<Props> = ({ onOpenOCR, onOpenLiveVoice }) => {
  const { chatMessages, settings, isProcessingAI, processUserInputText } = useFinance();
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [wasDictated, setWasDictated] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputElRef = useRef<HTMLInputElement>(null);
  const baseInputBeforeMicRef = useRef('');
  const usingRawFallbackRef = useRef(false);
  const prevLastMsgIdRef = useRef<string | null>(null);

  const lastMsgId = chatMessages[chatMessages.length - 1]?.id || null;

  useEffect(() => {
    if (lastMsgId && lastMsgId !== prevLastMsgIdRef.current) {
      prevLastMsgIdRef.current = lastMsgId;
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else if (isProcessingAI) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [lastMsgId, isProcessingAI]);

  useEffect(() => {
    return () => {
      speechService.stop();
    };
  }, []);

  const stopMicCleanly = () => {
    speechService.stop();
    usingRawFallbackRef.current = false;
    setIsListening(false);
    setLiveTranscript('');
    setAudioLevel(0);
  };

  const submitCurrentInput = (forceText?: string) => {
    const finalText = (forceText ?? inputText).trim();
    if (isListening) {
      stopMicCleanly();
    }
    if (!finalText) return;
    processUserInputText(finalText, wasDictated || isListening);
    setInputText('');
    setWasDictated(false);
    baseInputBeforeMicRef.current = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitCurrentInput();
  };

  const handleInputFocus = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 150);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 320);
  };

  const handleOpenLiveMode = () => {
    if (isListening) {
      stopMicCleanly();
    }
    onOpenLiveVoice?.();
  };

  const handleToggleVoice = async () => {
    setMicPermissionError(null);

    // 1. If already listening -> stop and leave the transcribed words ready in inputText!
    if (isListening) {
      if (usingRawFallbackRef.current) {
        const openaiKey = (settings as any).openaiApiKey?.trim();
        const audioBlob = await speechService.stopRecordingRaw();
        stopMicCleanly();

        if (audioBlob && openaiKey) {
          setIsTranscribing(true);
          try {
            const whisperText = await transcribeWithWhisper(audioBlob, openaiKey);
            setIsTranscribing(false);
            if (whisperText?.trim()) {
              const merged = [baseInputBeforeMicRef.current, whisperText.trim()].filter(Boolean).join(' ');
              setInputText(merged);
              setWasDictated(true);
            } else {
              setMicPermissionError('Could not transcribe audio. Speak clearly or use Chrome / updated Android APK.');
            }
          } catch {
            setIsTranscribing(false);
            setMicPermissionError('Cloud audio transcription failed. Update Android APK (v2.0) in Settings → Security for instant offline/OS voice typing.');
          }
        }
        return;
      }

      stopMicCleanly();
      return;
    }

    // 2. Start Real-Time Speech-to-Words (Priority 1: Native AndroidSpeech in APK, Priority 2: Web Speech API)
    const hasRealtimeSpeech = speechService.hasNativeAndroidSpeech() || speechService.hasWebSpeech();
    baseInputBeforeMicRef.current = inputText.trim();

    if (hasRealtimeSpeech) {
      usingRawFallbackRef.current = false;
      const lang = settings.voiceLanguage === 'hi-IN' ? 'hi-IN' : 'en-IN';

      const started = await speechService.start(
        {
          language: lang,
          keepAliveAcrossPauses: true,
          onResult: (transcript) => {
            setLiveTranscript(transcript);
            const combined = [baseInputBeforeMicRef.current, transcript].filter(Boolean).join(' ');
            setInputText(combined);
            setWasDictated(true);
            // Keep end of dictated sentence visible inside input field
            requestAnimationFrame(() => {
              if (inputElRef.current) {
                inputElRef.current.scrollLeft = inputElRef.current.scrollWidth;
              }
            });
          },
          onError: (err) => {
            console.warn('Voice error:', err);
            setIsListening(false);
            setLiveTranscript('');
            setAudioLevel(0);
            setMicPermissionError(err);
          },
          onEnd: (finalCapturedText) => {
            setIsListening(false);
            setLiveTranscript('');
            setAudioLevel(0);
            if (finalCapturedText) {
              const combined = [baseInputBeforeMicRef.current, finalCapturedText].filter(Boolean).join(' ');
              setInputText(combined);
              setWasDictated(true);
            }
          }
        },
        (level) => setAudioLevel(level)
      );

      if (started) {
        setIsListening(true);
        setAudioLevel(25);
      }
      return;
    }

    // 3. Fallback ONLY when neither Native Android Speech nor Web Speech exists
    const openaiKey = (settings as any).openaiApiKey?.trim();
    if (openaiKey) {
      usingRawFallbackRef.current = true;
      const started = await speechService.startRecordingRaw((level) => setAudioLevel(level));
      if (started) {
        setIsListening(true);
        setLiveTranscript('Recording audio... tap Stop when finished');
      } else {
        usingRawFallbackRef.current = false;
        setMicPermissionError('Microphone permission blocked. Please allow microphone access.');
      }
    } else {
      setMicPermissionError('Live voice typing requires Chrome or the updated Android App (v2.0 in Settings → Security).');
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#F3F5F1] relative overflow-hidden font-outfit">
      {/* Messages Feed Container */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-4 pt-3 pb-4 no-scrollbar">
        <div className="max-w-3xl mx-auto w-full">
          {chatMessages.map(msg => (
            <ChatMessageItem key={msg.id} message={msg} />
          ))}

          {/* AI Processing Indicator */}
          {isProcessingAI && (
            <div className="flex items-center gap-2 text-xs text-gray-600 font-semibold my-3 max-w-2xl mx-auto px-2 animate-pulse">
              <Sparkles className="w-4 h-4 text-[#0D2E14]" />
              <span>AI Accountant is processing...</span>
            </div>
          )}

          {micPermissionError && (
            <div className="my-2 p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 font-bold flex items-center justify-between gap-2 max-w-2xl mx-auto">
              <span>{micPermissionError}</span>
              <button onClick={() => setMicPermissionError(null)} className="text-xs underline flex-shrink-0">
                Dismiss
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom Docked Input Control Bar — stays directly above mobile keyboard */}
      <div className="flex-shrink-0 px-3 sm:px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[#F3F5F1] border-t border-[#E2E8E0]/80 z-30">
        <div className="max-w-3xl mx-auto bg-white border border-[#E2E8E0] rounded-3xl p-2 shadow-lg space-y-2">
          {/* Live Real-Time Word Transcription Banner (visible whenever speaking) */}
          {(isListening || isTranscribing) && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-emerald-50/90 border border-emerald-200 animate-fadeIn">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  style={{ transform: `scale(${1 + Math.min(0.35, audioLevel / 180)})` }}
                  className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse flex-shrink-0 transition-transform"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                    {isTranscribing ? 'Transcribing Audio...' : 'Listening Live — Transcribing to Words'}
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-[#0D2E14] truncate">
                    {liveTranscript || 'Speak naturally (e.g. "Petrol 2200" or "Dr Prince 13000")...'}
                  </p>
                </div>
              </div>

              {isListening && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    className="px-2.5 py-1 rounded-full bg-white hover:bg-gray-100 border border-gray-300 text-[11px] font-extrabold text-gray-700 cursor-pointer"
                  >
                    Done
                  </button>
                  {inputText.trim() && (
                    <button
                      type="button"
                      onClick={() => submitCurrentInput()}
                      className="px-3 py-1 rounded-full bg-[#0D2E14] hover:bg-black text-[11px] font-extrabold text-[#93E044] flex items-center gap-1 cursor-pointer"
                    >
                      <span>Send</span>
                      <Send className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            {/* Attachment/OCR Actions on Left */}
            <button
              type="button"
              onClick={onOpenOCR}
              title="Scan Receipt OCR"
              className="p-2 rounded-full bg-[#F3F5F1] hover:bg-gray-200 text-[#0D2E14] transition-colors shadow-2xs flex-shrink-0"
            >
              <Camera className="w-4 h-4" />
            </button>

            {/* Input Box with Inside-Right Controls (Mic + Send) */}
            <div
              className={`flex-1 flex items-center border rounded-full transition-all px-3 py-1.5 gap-2 ${
                isListening
                  ? 'bg-white border-rose-400 ring-2 ring-rose-100'
                  : 'bg-[#F3F5F1] border-[#E2E8E0] focus-within:border-[#0D2E14] focus-within:bg-white'
              }`}
            >
              <input
                ref={inputElRef}
                type="text"
                data-chat-main-input="true"
                value={inputText}
                onFocus={handleInputFocus}
                onChange={e => {
                  setInputText(e.target.value);
                  if (!isListening) setWasDictated(false);
                }}
                placeholder={
                  isTranscribing
                    ? '⏳ Transcribing voice...'
                    : isListening
                      ? '🎙️ Speak now — words appear here live...'
                      : 'Type or tap mic to speak...'
                }
                className="flex-1 bg-transparent text-xs sm:text-sm text-[#0D2E14] placeholder-gray-400 font-semibold outline-none font-outfit min-w-0"
              />

              {/* Controls inside the input bar on the right side */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Hands-Free Live Voice Mode Quick Pill */}
                {onOpenLiveVoice && !inputText.trim() && !isListening && (
                  <button
                    type="button"
                    onClick={handleOpenLiveMode}
                    title="Hands-Free Live Voice Mode"
                    className="h-7 px-2.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[#0D2E14] text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Radio className="w-3 h-3 text-emerald-700 animate-pulse" />
                    <span>Live</span>
                  </button>
                )}

                {/* Mic / Stop Voice Typing Button */}
                <button
                  type="button"
                  onClick={isTranscribing ? undefined : handleToggleVoice}
                  disabled={isTranscribing}
                  title={isTranscribing ? 'Transcribing...' : isListening ? 'Stop listening (keep words)' : 'Voice to words'}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    isTranscribing
                      ? 'bg-amber-500 text-white cursor-not-allowed'
                      : isListening
                        ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                        : 'bg-[#0D2E14] text-white hover:bg-black'
                  }`}
                >
                  {isTranscribing ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : isListening ? (
                    <Square className="w-3 h-3 text-white fill-white" />
                  ) : (
                    <Mic className="w-3.5 h-3.5 text-white" />
                  )}
                </button>

                {/* Send Button inside bar */}
                {inputText.trim() && (
                  <button
                    type="submit"
                    title="Send message"
                    className="w-7 h-7 rounded-full bg-[#0D2E14] hover:bg-black text-white flex items-center justify-center transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 text-white" />
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
export default ChatContainer;
