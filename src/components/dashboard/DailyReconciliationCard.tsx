import React, { useState } from 'react';
import { Transaction } from '../../types/finance';
import { useFinance } from '../../context/FinanceContext';
import { speechService } from '../../services/voice/speechRecognition';
import { CheckCircle2, Clock, Mic, Send, Sparkles, Check } from 'lucide-react';

interface Props {
  transactions: Transaction[];
}

export const DailyReconciliationCard: React.FC<Props> = ({ transactions }) => {
  const { updateTransaction, confirmPendingItemsBatch } = useFinance();
  const [batchVoiceText, setBatchVoiceText] = useState('');
  const [rowInputs, setRowInputs] = useState<Record<string, string>>({});
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');

  // Find ALL pending transactions missing specific reasons/notes
  const pendingItems = transactions.filter(t => {
    const title = (t.title || '').toLowerCase();
    const note = (t.notes || '').toLowerCase();
    return t.isPending || title.includes('reason missing') || note.includes('imported') || note.includes('sms') || !t.title;
  });

  if (!pendingItems.length) {
    return (
      <div className="p-4 rounded-3xl font-outfit mb-3 bg-[#E4ECE2] border border-[#c4d6c1] shadow-2xs">
        <div className="flex items-center gap-2 text-[#0D2E14] font-extrabold text-xs uppercase tracking-wider mb-1">
          <CheckCircle2 className="w-4 h-4 text-[#0D2E14]" />
          <span>AI Daily Audit Complete</span>
        </div>
        <h4 className="text-sm sm:text-base font-extrabold text-[#0D2E14]">All Transactions Reconciled!</h4>
        <p className="text-xs text-gray-700 font-medium mt-0.5">
          100% of today's money movement has clear reasons and categories assigned.
        </p>
      </div>
    );
  }

  const quickReasonChips = [
    'Dinner / Food',
    'Vehicle Refill',
    'Personal Shopping',
    'Household Grocery',
    'Friend Transfer',
    'Office Work'
  ];

  const handleResolveSingleRow = (id: string, reason: string) => {
    if (!reason.trim()) return;
    updateTransaction(id, {
      title: reason.trim(),
      notes: reason.trim(),
      confidenceScore: 99,
      isPending: false
    });
    setRowInputs(prev => ({ ...prev, [id]: '' }));
  };

  const processBatchScript = (scriptText: string) => {
    if (!scriptText.trim() || !pendingItems.length) return;

    const lower = scriptText.toLowerCase();

    // Parse script sequentially or by keywords
    const updatedList = pendingItems.map((item, idx) => {
      const newItem = { ...item };
      const itemNumStr = `${idx + 1}`;

      // Check if user specifically referred to item number e.g. "1st petrol" or "item 1 petrol"
      if (lower.includes(`${itemNumStr}st`) || lower.includes(`${itemNumStr}nd`) || lower.includes(`${itemNumStr}rd`) || lower.includes(`${itemNumStr}th`) || lower.includes(`item ${itemNumStr}`)) {
        if (lower.includes('petrol') || lower.includes('fuel')) newItem.title = 'Petrol Refill';
        else if (lower.includes('swiggy') || lower.includes('zomato') || lower.includes('dinner') || lower.includes('food')) newItem.title = 'Food & Dining';
        else if (lower.includes('grocery') || lower.includes('blinkit') || lower.includes('milk')) newItem.title = 'Household Grocery';
        else if (lower.includes('loan') || lower.includes('friend') || lower.includes('rahul')) newItem.title = 'Friend Transfer';
      } else {
        // Fallback sequential matching
        if (idx === 0) {
          if (lower.includes('petrol') || lower.includes('fuel')) newItem.title = 'Petrol Refill';
          else if (lower.includes('swiggy') || lower.includes('zomato') || lower.includes('food') || lower.includes('dinner')) newItem.title = 'Food & Dining';
          else if (lower.includes('grocery') || lower.includes('blinkit')) newItem.title = 'Household Grocery';
        }
      }

      if (newItem.title !== 'Reason Missing') {
        newItem.notes = newItem.title;
        newItem.isPending = false;
      }
      return newItem;
    });

    const cleared = updatedList.filter(t => !t.isPending);
    if (cleared.length > 0) {
      confirmPendingItemsBatch(cleared);
    }
    setBatchVoiceText('');
  };

  const [micError, setMicError] = useState<string | null>(null);

  const handleToggleBatchVoice = () => {
    setMicError(null);
    if (isListening) {
      speechService.stop();
      setIsListening(false);
      if (liveTranscript.trim()) {
        processBatchScript(liveTranscript);
        setLiveTranscript('');
      }
    } else {
      setLiveTranscript('');
      const started = speechService.start(
        {
          language: 'en-IN',
          onResult: (transcript, isFinal) => {
            setLiveTranscript(transcript);
            if (isFinal) {
              speechService.stop();
              setIsListening(false);
              processBatchScript(transcript);
              setLiveTranscript('');
            }
          },
          onError: (err) => {
            console.warn('Voice error:', err);
            setIsListening(false);
            if (err === 'not-allowed' || err === 'service-not-allowed') {
              setMicError('Microphone permission blocked in browser settings.');
            } else {
              setMicError(`Voice error: ${err}`);
            }
          },
          onEnd: () => setIsListening(false)
        }
      );
      if (started) {
        setIsListening(true);
      } else {
        setIsListening(false);
      }
    }
  };

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processBatchScript(batchVoiceText);
  };

  return (
    <div className="p-4 sm:p-5 rounded-3xl border border-[#C8E0C4] bg-[#F0F7EE] shadow-2xs font-outfit mb-3 sm:mb-4 space-y-3">
      {/* Header Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#0D2E14] text-white flex items-center justify-center font-bold text-xs">
            <Clock className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-bold text-[#0D2E14] uppercase tracking-wider">Same-Day AI Audit</span>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#0D2E14] text-white">
          {pendingItems.length} Pending Reasons
        </span>
      </div>

      {/* Global Batch Voice & Text Script Bar */}
      <div className="p-3 bg-white rounded-2xl border border-[#C8E0C4] shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-[#0D2E14]">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#0D2E14]" />
            Batch Voice Script (Resolve All {pendingItems.length} Items Together):
          </span>
        </div>

        <form onSubmit={handleBatchSubmit} className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleBatchVoice}
            className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-all active:scale-95 flex-shrink-0 ${
              isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-[#0D2E14] text-white'
            }`}
            title="Speak continuous script"
          >
            <Mic className="w-3.5 h-3.5 text-white" />
            <span className="text-[11px] text-white">{isListening ? 'Listening Script...' : 'Speak Batch Script'}</span>
          </button>

          <input
            type="text"
            value={batchVoiceText}
            onChange={e => setBatchVoiceText(e.target.value)}
            placeholder="e.g. '1st was petrol refill, 2nd was swiggy dinner, 3rd was grocery'..."
            className="flex-1 bg-[#F3F5F1] border border-[#E2E8E0] rounded-full py-1.5 px-3 text-xs text-[#0D2E14] outline-none font-semibold placeholder-gray-400 focus:border-[#0D2E14]"
          />

          <button
            type="submit"
            disabled={!batchVoiceText.trim()}
            className="px-3.5 py-1.5 rounded-full bg-[#0D2E14] text-white text-xs font-bold flex items-center gap-1 disabled:opacity-30 transition-all active:scale-95 flex-shrink-0"
          >
            <Send className="w-3 h-3 text-white" />
            <span className="text-white">Analyze</span>
          </button>
        </form>

        {isListening && (
          <p className="text-[10px] text-emerald-800 font-bold italic animate-pulse pl-2">
            Script Transcript: {liveTranscript || 'Narrate all pending reasons in one sentence...'}
          </p>
        )}

        {micError && (
          <p className="text-[10px] text-red-600 font-bold pl-2 pt-1">
            ⚠️ {micError}
          </p>
        )}
      </div>

      {/* LINE-BY-LINE LIST OF ALL PENDING REASON ITEMS */}
      <div className="space-y-2 pt-1">
        <span className="text-[11px] font-bold text-gray-700 block">Or Answer One-by-One Below:</span>

        {pendingItems.map((item, index) => {
          const rowInputVal = rowInputs[item.id] || '';

          return (
            <div
              key={item.id}
              className="p-3 bg-white rounded-2xl border border-[#C8E0C4] shadow-2xs space-y-2 transition-all hover:border-[#0D2E14]"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="w-5 h-5 rounded-full bg-[#0D2E14] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    #{index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-semibold text-[#0D2E14] truncate">
                      What was reason for <span className="font-bold text-[#D93025]">₹{item.amount.toLocaleString('en-IN')}</span> ({item.category})?
                    </h5>
                    <span className="text-[10px] text-gray-500 font-medium truncate block">
                      {item.paymentMethod} • {item.date}
                    </span>
                  </div>
                </div>
              </div>

              {/* Inline Typing Input for Single Row */}
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={rowInputVal}
                  onChange={e => setRowInputs({ ...rowInputs, [item.id]: e.target.value })}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleResolveSingleRow(item.id, rowInputVal);
                    }
                  }}
                  placeholder="Type reason for this item..."
                  className="flex-1 bg-[#F3F5F1] border border-[#E2E8E0] rounded-full py-1 px-3 text-xs text-[#0D2E14] outline-none font-semibold placeholder-gray-400 focus:border-[#0D2E14]"
                />

                <button
                  type="button"
                  onClick={() => handleResolveSingleRow(item.id, rowInputVal)}
                  disabled={!rowInputVal.trim()}
                  className="px-3 py-1 rounded-full bg-[#0D2E14] text-white text-xs font-bold flex items-center gap-1 disabled:opacity-30 transition-all active:scale-95 flex-shrink-0"
                >
                  <Check className="w-3 h-3 text-white" />
                  <span>Save</span>
                </button>
              </div>

              {/* Quick 1-Tap Chips for Single Row */}
              <div className="flex flex-wrap gap-1 pt-1">
                {quickReasonChips.slice(0, 4).map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleResolveSingleRow(item.id, chip)}
                    className="px-2 py-0.5 rounded-full bg-[#F3F5F1] hover:bg-[#0D2E14] hover:text-white text-[#0D2E14] text-[10px] font-bold border border-[#E2E8E0] transition-all active:scale-95"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
