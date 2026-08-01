import React, { useState, useEffect, useRef } from 'react';
import { Transaction, Category, CATEGORIES_LIST } from '../../types/finance';
import { useFinance } from '../../context/FinanceContext';
import { speechService } from '../../services/voice/speechRecognition';
import { Check, Trash2, Mic, Send, Bot, Sparkles, Tag } from 'lucide-react';

interface Props {
  items: Transaction[];
  onClose: () => void;
}

export const AIReviewModal: React.FC<Props> = ({ items, onClose }) => {
  const { confirmPendingItemsBatch } = useFinance();
  const [reviewItems, setReviewItems] = useState<Transaction[]>(items);
  const [voiceText, setVoiceText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');

  useEffect(() => {
    return () => {
      speechService.stop();
    };
  }, []);

  const handleUpdateItem = (id: string, updates: Partial<Transaction>) => {
    setReviewItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          const updated = { ...item, ...updates };
          // If title was "Reason Missing" and category is chosen, update title
          if (updated.title === 'Reason Missing' && updates.category) {
            updated.title = `${updates.category} Expense`;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleDeleteItem = (id: string) => {
    setReviewItems(prev => prev.filter(item => item.id !== id));
  };

  const handleConfirmAll = () => {
    confirmPendingItemsBatch(reviewItems);
    onClose();
  };

  const liveTranscriptRef = useRef(liveTranscript);
  useEffect(() => {
    liveTranscriptRef.current = liveTranscript;
  }, [liveTranscript]);

  const handleToggleVoice = () => {
    if (isListening) {
      speechService.stop();
      setIsListening(false);
      if (liveTranscript.trim()) {
        processVoiceResolution(liveTranscript);
        setLiveTranscript('');
      }
    } else {
      setLiveTranscript('');
      const started = speechService.start(
        {
          language: 'en-IN',
          onResult: (transcript) => {
            setLiveTranscript(transcript);
          },
          onError: () => setIsListening(false),
          onEnd: () => {
            setIsListening(false);
            if (liveTranscriptRef.current.trim()) {
              processVoiceResolution(liveTranscriptRef.current);
              setLiveTranscript('');
            }
          }
        }
      );
      if (started) setIsListening(true);
    }
  };

  const processVoiceResolution = (inputStr: string) => {
    const lower = inputStr.toLowerCase();
    setReviewItems(prev =>
      prev.map(item => {
        const newItem = { ...item };
        if (lower.includes('petrol') || lower.includes('fuel')) {
          newItem.category = 'Fuel';
          if (newItem.title === 'Reason Missing') newItem.title = 'Petrol Refill';
        } else if (lower.includes('swiggy') || lower.includes('zomato') || lower.includes('food') || lower.includes('dinner')) {
          newItem.category = 'Food & Drinks';
          if (newItem.title === 'Reason Missing') newItem.title = 'Food & Dining';
        } else if (lower.includes('grocery') || lower.includes('milk') || lower.includes('blinkit')) {
          newItem.category = 'Grocery';
          if (newItem.title === 'Reason Missing') newItem.title = 'Groceries';
        }
        return newItem;
      })
    );
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiceText.trim()) return;
    processVoiceResolution(voiceText);
    setVoiceText('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 font-outfit">
      <div className="bg-[#F3F5F1] w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-[#E2E8E0] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="px-4 py-3 bg-[#0D2E14] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[#93E044] text-[#0D2E14] flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Pending Transactions Review</h3>
              <p className="text-[10px] text-[#93E044]">Clear reasons & categories to add to Passbook</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xs font-bold px-2 py-1">
            Cancel
          </button>
        </div>

        {/* AI Voice & Text Assistant Input Bar */}
        <div className="p-3 bg-[#E4ECE2]/90 border-b border-[#E2E8E0]">
          <div className="flex items-center justify-between text-[11px] font-extrabold text-[#0D2E14] mb-1.5">
            <span className="flex items-center gap-1">
              <Bot className="w-3.5 h-3.5 text-[#0D2E14]" />
              Voice/Text Assistant (Coordinate All Items):
            </span>
          </div>

          <form onSubmit={handleTextSubmit} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1 transition-all active:scale-95 flex-shrink-0 ${
                isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-[#0D2E14] text-[#93E044]'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{isListening ? 'Listening...' : 'Speak'}</span>
            </button>

            <input
              type="text"
              value={voiceText}
              onChange={e => setVoiceText(e.target.value)}
              placeholder="e.g. '1st was petrol, 2nd was swiggy'..."
              className="flex-1 bg-white border border-[#E2E8E0] rounded-full py-1.5 px-3 text-xs text-[#0D2E14] outline-none font-semibold placeholder-gray-400"
            />

            {voiceText.trim() && (
              <button
                type="submit"
                className="p-1.5 rounded-full bg-[#0D2E14] text-[#93E044] font-bold"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {isListening && (
            <p className="text-[10px] text-[#0D2E14] font-bold italic mt-1 animate-pulse">
              Transcript: {liveTranscript || 'Listening to your voice command...'}
            </p>
          )}
        </div>

        {/* Pending Items List */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-3 flex-1 no-scrollbar">
          {reviewItems.map((item, index) => {
            const isMissingReason = item.title === 'Reason Missing';

            return (
              <div
                key={item.id}
                className={`p-3 bg-white rounded-2xl border ${
                  isMissingReason ? 'border-amber-300 shadow-amber-50/50' : 'border-[#E2E8E0]'
                } shadow-2xs space-y-2`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#0D2E14] text-[#93E044] text-[10px] font-extrabold flex items-center justify-center">
                      #{index + 1}
                    </span>
                    <div>
                      {/* Name / Reason Input */}
                      <input
                        type="text"
                        value={item.title}
                        onChange={e => handleUpdateItem(item.id, { title: e.target.value })}
                        placeholder="Specify reason / item name..."
                        className="text-xs font-extrabold text-[#0D2E14] bg-[#F3F5F1] border border-[#E2E8E0] rounded-md px-2 py-0.5 outline-none focus:border-[#0D2E14] w-48 sm:w-60"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#D93025]">
                      Rs. {item.amount}
                    </span>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-gray-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Category Selection Chips */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
                  <Tag className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <span className="text-[10px] text-gray-500 font-bold flex-shrink-0">Category:</span>
                  {CATEGORIES_LIST.slice(0, 6).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleUpdateItem(item.id, { category: cat })}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap border transition-all ${
                        item.category === cat
                          ? 'bg-[#0D2E14] text-[#93E044] border-[#0D2E14]'
                          : 'bg-[#F3F5F1] text-gray-700 border-[#E2E8E0] hover:bg-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {reviewItems.length === 0 && (
            <p className="text-xs text-center text-gray-500 font-bold py-6">All pending items cleared!</p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-white border-t border-[#E2E8E0] flex items-center justify-between">
          <span className="text-xs font-bold text-[#0D2E14]">
            {reviewItems.length} Pending Item(s)
          </span>

          <button
            onClick={handleConfirmAll}
            disabled={reviewItems.length === 0}
            className="px-5 py-2 rounded-full bg-[#93E044] hover:bg-[#84D137] text-[#0D2E14] font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            Clear & Add to Passbook
          </button>
        </div>
      </div>
    </div>
  );
};
