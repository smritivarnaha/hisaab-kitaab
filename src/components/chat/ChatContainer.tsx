import React, { useState, useEffect, useRef } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { ChatMessageItem } from './ChatMessageItem';
import { transcribeWithWhisper } from '../../services/ai/openai';
import { speechService } from '../../services/voice/speechRecognition';
import { VoiceWaveform } from '../voice/VoiceWaveform';
import { Mic, Send, Camera, Sparkles, Loader2 } from 'lucide-react';

interface Props {
  onOpenOCR: () => void;
  onOpenImport: () => void;
}

export const ChatContainer: React.FC<Props> = ({ onOpenOCR }) => {
  const { chatMessages, settings, isProcessingAI, processUserInputText } = useFinance();
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const liveTranscriptRef = useRef(liveTranscript);

  useEffect(() => {
    liveTranscriptRef.current = liveTranscript;
  }, [liveTranscript]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isProcessingAI]);

  useEffect(() => {
    return () => {
      speechService.stop();
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    processUserInputText(inputText.trim());
    setInputText('');
  };

  const handleToggleVoice = async () => {
    setMicPermissionError(null);
    const openaiKey = (settings as any).openaiApiKey?.trim();
    const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const useWhisper = isMobile && !!openaiKey;

    if (isListening) {
      if (useWhisper) {
        const audioBlob = await speechService.stopRecordingRaw();
        speechService.stop();
        setLiveTranscript('');
        setIsListening(false);

        if (audioBlob) {
          setIsTranscribing(true);
          setLiveTranscript('Transcribing with Whisper...');
          try {
            const whisperText = await transcribeWithWhisper(audioBlob, openaiKey);
            setIsTranscribing(false);
            if (whisperText?.trim()) {
              setLiveTranscript(whisperText);
              setTimeout(() => {
                processUserInputText(whisperText, true);
                setLiveTranscript('');
              }, 500);
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
        speechService.stop();
        setIsListening(false);
        setLiveTranscript('');
      }
    } else {
      if (useWhisper) {
        const started = await speechService.startRecordingRaw((level) => setAudioLevel(level));
        if (started) {
          setIsListening(true);
          setLiveTranscript('🎙️ Listening... tap Mic again to Stop');
        } else {
          setMicPermissionError('Microphone permission blocked. Allow mic in browser settings.');
        }
      } else {
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
                setLiveTranscript('');
              }
            }
          },
          (level) => setAudioLevel(level)
        );
        if (started) {
          setIsListening(true);
        } else {
          setMicPermissionError('Speech recognition not available. Add OpenAI key in Settings for better voice support.');
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F3F5F1] relative overflow-hidden font-outfit">
      
      {/* Messages Feed Container */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32 md:pb-28 no-scrollbar">
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

      {/* Floating Centered ChatGPT/Claude Style Input Control Bar */}
      <div className="absolute bottom-4 inset-x-0 z-30 px-4">
        <div className="max-w-3xl mx-auto bg-white border border-[#E2E8E0] rounded-3xl p-2.5 shadow-xl backdrop-blur-xl space-y-1.5">
          
          <VoiceWaveform isListening={isListening} audioLevel={audioLevel} liveTranscript={liveTranscript} />

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
            <div className="flex-1 flex items-center bg-[#F3F5F1] border border-[#E2E8E0] rounded-full focus-within:border-[#0D2E14] focus-within:bg-white transition-all px-3 py-1.5 gap-2">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={
                  isTranscribing ? '⏳ Transcribing voice with Whisper...' :
                  isListening ? '🎙️ Listening... speak now' : 'Type or ask anything...'
                }
                className="flex-1 bg-transparent text-xs sm:text-sm text-[#0D2E14] placeholder-gray-400 font-semibold outline-none font-outfit"
              />

              {/* Controls inside the input bar on the right side */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Clean Mic Icon Only */}
                <button
                  type="button"
                  onClick={isTranscribing ? undefined : handleToggleVoice}
                  disabled={isTranscribing}
                  title={isTranscribing ? 'Transcribing...' : isListening ? 'Stop' : 'Speak'}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                    isTranscribing
                      ? 'bg-amber-500 text-white cursor-not-allowed'
                      : isListening
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-[#0D2E14] text-white hover:bg-black'
                  }`}
                >
                  {isTranscribing ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Mic className="w-3.5 h-3.5 text-white" />
                  )}
                </button>

                {/* Send Button inside bar */}
                {inputText.trim() && (
                  <button
                    type="submit"
                    className="w-7 h-7 rounded-full bg-[#0D2E14] hover:bg-black text-white flex items-center justify-center transition-all"
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
