import React, { useState, useRef, useEffect } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { ChatMessageItem } from './ChatMessageItem';
import { VoiceWaveform } from '../voice/VoiceWaveform';
import { speechService } from '../../services/voice/speechRecognition';
import { transcribeWithWhisper } from '../../services/ai/openai';
import { AIReviewModal } from './AIReviewModal';
import { Mic, Send, Sparkles, Camera, Loader2 } from 'lucide-react';

interface Props {
  onOpenOCR: () => void;
  onOpenImport: () => void;
}

export const ChatContainer: React.FC<Props> = ({ onOpenOCR, onOpenImport }) => {
  const { 
    chatMessages, 
    processUserInputText, 
    isProcessingAI, 
    pendingReviewItems, 
    clearPendingReview,
    settings
  } = useFinance();

  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isProcessingAI, liveTranscript]);

  useEffect(() => {
    return () => {
      speechService.stop();
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    processUserInputText(inputText);
    setInputText('');
  };

  const liveTranscriptRef = useRef(liveTranscript);
  useEffect(() => {
    liveTranscriptRef.current = liveTranscript;
  }, [liveTranscript]);

  const handleToggleVoice = async () => {
    setMicPermissionError(null);

    // Use Whisper if OpenAI key is set (regardless of aiProvider for text)
    const openaiKey = (settings as any).openaiApiKey?.trim();
    const useWhisper = !!openaiKey;

    if (isListening) {
      setIsListening(false);
      setAudioLevel(0);

      if (useWhisper) {
        // Stop WAV recording, transcribe with Whisper
        const audioBlob = await speechService.stopRecordingRaw();
        speechService.stop();
        setLiveTranscript('');

        if (audioBlob) {
          setIsTranscribing(true);
          setLiveTranscript('Transcribing with Whisper...');
          try {
            const whisperText = await transcribeWithWhisper(audioBlob, openaiKey);
            setIsTranscribing(false);
            if (whisperText?.trim()) {
              setLiveTranscript(whisperText);
              // Auto-submit with the Whisper transcription
              setTimeout(() => {
                processUserInputText(whisperText, true);
                setLiveTranscript('');
              }, 500); // brief pause so user sees what was transcribed
            } else {
              setLiveTranscript('');
              setMicPermissionError('Could not transcribe audio. Please speak clearly and try again.');
            }
          } catch {
            setIsTranscribing(false);
            setLiveTranscript('');
            setMicPermissionError('Whisper transcription failed. Check your OpenAI key.');
          }
        }
      } else {
        // Native Web Speech API mode — text captured via onEnd callback
        speechService.stop();
        setLiveTranscript('');
      }
    } else {
      // Start listening
      if (useWhisper) {
        // Record raw WAV for Whisper
        const started = await speechService.startRecordingRaw((level) => setAudioLevel(level));
        if (started) {
          setIsListening(true);
          setLiveTranscript('🎙️ Listening... tap Stop when done speaking');
        } else {
          setMicPermissionError('Microphone permission blocked. Allow mic in browser settings.');
        }
      } else {
        // Native Web Speech API (Gemini mode, no OpenAI key)
        const lang = (settings.voiceLanguage === 'hi-IN') ? 'hi-IN' : 'en-IN';
        const started = await speechService.start(
          {
            language: lang,
            onResult: (transcript) => {
              setLiveTranscript(transcript);
            },
            onError: (err) => {
              console.warn('Voice error:', err);
              setIsListening(false);
              setAudioLevel(0);
              if (err.includes('not-allowed') || err.includes('permission')) {
                setMicPermissionError('Microphone permission blocked. Allow mic in browser settings.');
              } else if (!err.includes('no-speech')) {
                setMicPermissionError(`Voice error: ${err}. Try Chrome/Edge browser.`);
              }
            },
            onEnd: (finalCapturedText) => {
              setIsListening(false);
              setAudioLevel(0);
              const textToSubmit = (finalCapturedText || liveTranscriptRef.current).trim();
              if (textToSubmit) {
                processUserInputText(textToSubmit, true);
              }
              setLiveTranscript('');
            }
          },
          (level) => setAudioLevel(level),
          false
        );

        if (started) {
          setIsListening(true);
        } else {
          setMicPermissionError('Speech recognition not available. Add OpenAI key in Settings for better voice support.');
        }
      }
    }
  };

  const sampleSuggestions = [
    'Petrol 2200 UPI',
    'Rahul returned 500',
    'Kal grocery 1800',
    'Salary 50000',
    'Coffee 180 cash'
  ];

  const openaiKey = (settings as any).openaiApiKey?.trim();
  // Whisper is only used on mobile where browser Speech API is unreliable.
  // Desktop uses the browser's native Speech Recognition API (fast, free, real-time).
  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const useWhisper = isMobile && !!openaiKey;

  return (
    <div className="flex flex-col h-full bg-[#F3F5F1] relative overflow-hidden font-outfit">
      {/* Top Status Banner */}
      <div className="px-4 py-2 bg-[#E4ECE2]/80 border-b border-[#E2E8E0] backdrop-blur-md flex items-center justify-between text-xs font-bold text-[#0D2E14] flex-shrink-0">
        <div className="flex items-center gap-2 max-w-3xl mx-auto w-full justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#93E044] animate-pulse" />
            <span className="text-xs">Conversational Voice & Text AI Accountant</span>
          </div>
          <span className="text-[11px] text-gray-600 font-semibold">Hindi • Hinglish • English</span>
        </div>
      </div>

      {/* Messages Feed Container (Centered max-w-3xl like ChatGPT/Claude) */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-52 md:pb-44 no-scrollbar">
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
            <div className="my-2 p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 font-bold flex items-center justify-between max-w-2xl mx-auto">
              <span>{micPermissionError}</span>
              <button onClick={() => setMicPermissionError(null)} className="text-xs underline ml-2">Dismiss</button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Centered Input Control Bar (ChatGPT / Claude Desktop Style) */}
      <div className="fixed md:absolute bottom-16 md:bottom-3 inset-x-0 z-30 px-3 sm:px-4">
        <div className="max-w-3xl mx-auto bg-white border border-[#E2E8E0] rounded-3xl p-3 shadow-xl backdrop-blur-xl space-y-2">
          {/* Quick Suggestion Pills */}
          <div className="pb-1 overflow-x-auto no-scrollbar flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider whitespace-nowrap">Try:</span>
            {sampleSuggestions.map((sug, i) => (
              <button
                key={i}
                onClick={() => processUserInputText(sug)}
                className="px-3 py-1 rounded-full bg-[#F3F5F1] hover:bg-[#93E044] hover:text-[#0D2E14] border border-[#E2E8E0] text-[#0D2E14] text-[11px] font-bold whitespace-nowrap transition-all duration-150 active:scale-95 shadow-2xs"
              >
                {sug}
              </button>
            ))}
          </div>

          <VoiceWaveform isListening={isListening} audioLevel={audioLevel} liveTranscript={liveTranscript} />

          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            {/* Attachment Actions */}
            <button
              type="button"
              onClick={onOpenOCR}
              title="Scan Receipt OCR"
              className="p-2.5 rounded-full bg-[#F3F5F1] hover:bg-gray-200 text-[#0D2E14] transition-colors shadow-2xs flex-shrink-0"
            >
              <Camera className="w-4 h-4" />
            </button>

            {/* Prominent Mic Speak Button + voice mode badge */}
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={isTranscribing ? undefined : handleToggleVoice}
              disabled={isTranscribing}
              title={isTranscribing ? 'Transcribing...' : isListening ? 'Stop listening' : 'Tap to Speak'}
              className={`px-4 py-2.5 rounded-full font-extrabold text-xs transition-all shadow-xs flex items-center gap-1.5 active:scale-95 flex-shrink-0 ${
                isTranscribing
                  ? 'bg-amber-500 text-white cursor-not-allowed'
                  : isListening
                    ? 'bg-red-500 text-white qor-mic-pulse'
                    : 'bg-[#0D2E14] hover:bg-black text-white'
              }`}
            >
              {isTranscribing
                ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                : <Mic className={`w-4 h-4 text-white ${isListening ? 'animate-bounce' : ''}`} />}
              <span className="text-white">
                {isTranscribing ? 'Processing...' : isListening ? 'Stop' : 'Speak'}
              </span>
            </button>
            {/* Voice mode badge */}
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              useWhisper ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {useWhisper ? '🎯 Whisper' : '🌐 Browser'}
            </span>
            </div>

            {/* Input Box */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={
                  isTranscribing ? '⏳ Transcribing your voice with Whisper...' :
                  isListening ? (
                    (settings as any).openaiApiKey?.trim() ? '🎙️ Recording... tap Stop when done' : '🎙️ Listening... speak now'
                  ) : 'Type here or tap Speak...'
                }
                className="w-full bg-[#F3F5F1] border border-[#E2E8E0] rounded-full py-2.5 pl-4 pr-10 text-xs sm:text-sm text-[#0D2E14] placeholder-gray-400 font-semibold outline-none focus:border-[#0D2E14] focus:bg-white transition-all font-outfit"
              />
            </div>

            {/* Send Button */}
            {inputText.trim() && (
              <button
                type="submit"
                className="p-2.5 rounded-full bg-[#0D2E14] hover:bg-black text-white font-bold shadow-sm active:scale-95 transition-all flex-shrink-0"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Multi-Transaction Review Modal */}
      {pendingReviewItems.length > 0 && (
        <AIReviewModal
          items={pendingReviewItems}
          onClose={clearPendingReview}
        />
      )}
    </div>
  );
};
