import React, { useState } from 'react';
import { ChatMessage, Transaction } from '../../types/finance';
import { Bot, User, CheckCircle2, Check, Trash2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatGlobalDate } from '../../utils/dateUtils';

interface Props {
  message: ChatMessage;
}

// Single Transaction Confirmation Card (Spelling & Details Editor)
const InlineTransactionEditor: React.FC<{ item: Transaction }> = ({ item }) => {
  const { updateTransaction, deleteTransaction } = useFinance();
  const [title, setTitle] = useState(item.title === 'Reason Missing' ? '' : item.title);
  const [amount, setAmount] = useState(String(item.amount || ''));
  const [isConfirmed, setIsConfirmed] = useState(!item.isPending);
  const [isDiscarded, setIsDiscarded] = useState(false);

  if (isDiscarded) return null;

  const handleConfirm = () => {
    updateTransaction(item.id, {
      title: title.trim() || 'Expense',
      amount: Number(amount) || 0,
      isPending: false // Confirmed and added to Passbook!
    });
    setIsConfirmed(true);
  };

  const handleDiscard = () => {
    deleteTransaction(item.id);
    setIsDiscarded(true);
  };

  return (
    <div className="mt-2.5 p-3 bg-white/95 dark:bg-slate-800/95 rounded-xl border border-amber-200/90 shadow-xs space-y-2.5 text-left text-gray-900 font-outfit">
      {/* Clean Un-congested Header */}
      <div className="flex items-center justify-between gap-2 border-b border-amber-100 pb-1.5">
        <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
          ✏️ Verify & Edit Entry
        </span>
        <span className="text-[9px] text-gray-500 font-semibold flex-shrink-0">{formatGlobalDate(item.date || item.timestamp)}</span>
      </div>

      {!isConfirmed ? (
        <div className="space-y-2">
          {/* Editable Description Input */}
          <div>
            <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block mb-0.5">Title / Spelling</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Edit title or correct spelling..."
              className="w-full bg-slate-50 border border-gray-200 text-xs font-semibold text-gray-900 rounded-lg p-2 outline-none focus:border-emerald-600 transition-all"
            />
          </div>

          {/* Editable Amount Input */}
          <div>
            <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block mb-0.5">Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full bg-slate-50 border border-gray-200 text-xs font-bold text-emerald-700 rounded-lg p-2 outline-none focus:border-emerald-600 transition-all"
            />
          </div>

          {/* Confirm & Discard Action Buttons */}
          <div className="flex items-center gap-1.5 pt-1">
            <button
              onClick={handleConfirm}
              className="flex-1 py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Yes, Confirm & Add to Passbook</span>
            </button>
            <button
              onClick={handleDiscard}
              className="py-1.5 px-2.5 border border-gray-200 text-gray-500 hover:text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      ) : (
        <div className="p-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Confirmed & Added to Passbook!</span>
        </div>
      )}
    </div>
  );
};

// Tabular Editable Form for Multiple Entries
const MultiInlineTransactionEditor: React.FC<{ items: Transaction[] }> = ({ items }) => {
  const { confirmPendingItemsBatch } = useFinance();
  const [drafts, setDrafts] = useState<Transaction[]>(items);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleUpdate = (id: string, field: 'title' | 'amount', value: any) => {
    setDrafts(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleDeleteRow = (id: string) => {
    setDrafts(prev => prev.filter(item => item.id !== id));
  };

  const handleConfirmAll = () => {
    const ready = drafts.map(item => ({
      ...item,
      title: item.title.trim() || 'Expense',
      amount: Number(item.amount) || 0,
      isPending: false
    }));
    confirmPendingItemsBatch(ready);
    setIsConfirmed(true);
  };

  if (drafts.length === 0) return null;

  return (
    <div className="mt-2.5 p-3 bg-white/95 dark:bg-slate-800/95 rounded-xl border border-amber-200/90 shadow-xs space-y-2.5 text-left text-gray-900 font-outfit">
      <div className="flex items-center justify-between border-b border-amber-100 pb-1.5">
        <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
          ✏️ Verify All {drafts.length} Entries Below
        </span>
      </div>

      {!isConfirmed ? (
        <div className="space-y-2">
          {/* Tabular Table Form */}
          <div className="overflow-x-auto border border-gray-200 rounded-lg bg-slate-50">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-100/80 text-[8px] sm:text-[9px] uppercase font-bold text-gray-500">
                  <th className="p-1 w-4 text-center">#</th>
                  <th className="p-1">Description / Title</th>
                  <th className="p-1 w-16 sm:w-20 text-right">Amount (₹)</th>
                  <th className="p-1 text-center w-6">Action</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((row, idx) => (
                  <tr key={row.id} className="border-b border-gray-100 bg-white">
                    <td className="p-1 text-[9px] font-semibold text-gray-400 text-center">{idx + 1}</td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={row.title === 'Reason Missing' ? '' : row.title}
                        onChange={e => handleUpdate(row.id, 'title', e.target.value)}
                        placeholder="Title / description..."
                        className="w-full text-[10px] sm:text-xs font-semibold text-gray-900 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-emerald-600 truncate"
                      />
                    </td>
                    <td className="p-1 text-right">
                      <input
                        type="number"
                        value={row.amount}
                        onChange={e => handleUpdate(row.id, 'amount', e.target.value)}
                        className="w-16 sm:w-20 text-[10px] sm:text-xs font-bold text-emerald-700 bg-gray-50 border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-emerald-600 text-right"
                      />
                    </td>
                    <td className="p-1 text-center">
                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                        title="Remove row"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleConfirmAll}
            className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all mt-2"
          >
            <Check className="w-4 h-4" />
            <span>Yes, Confirm All & Add to Passbook</span>
          </button>
        </div>
      ) : (
        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>All {drafts.length} Entries Confirmed & Added!</span>
        </div>
      )}
    </div>
  );
};

export const ChatMessageItem: React.FC<Props> = ({ message }) => {
  const { settings, transactions } = useFinance();
  const [avatarError, setAvatarError] = useState(false);
  const isUser = message.sender === 'user';

  // Robust pending items resolution:
  // Use message.pendingReviewItems if available, otherwise check transactions context for unconfirmed (isPending) entries
  const messagePending = message.pendingReviewItems || [];
  const contextPending = transactions.filter(t => t.isPending);

  const pendingItems = messagePending.length > 0
    ? messagePending
    : (!isUser && contextPending.length > 0 ? contextPending : []);

  const formatTime = (ts: any) => {
    const numericTs = typeof ts === 'string' ? parseInt(ts, 10) : ts;
    const date = new Date(numericTs);
    return isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Simple Markdown parser for **bold** and *italics*
  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|\n)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-extrabold text-accent-primary">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={index} className="italic">{part.slice(1, -1)}</em>;
      }
      if (part === '\n') {
        return <br key={index} />;
      }
      return part;
    });
  };

  const customAvatarUrl = isUser ? settings.userAvatarUrl : settings.botAvatarUrl;

  // Resolve font sizes
  const fontSizeClass = 
    settings.fontSize === 'sm' ? 'text-[11px] leading-snug' :
    settings.fontSize === 'lg' ? 'text-sm sm:text-base leading-relaxed' :
    'text-xs sm:text-sm leading-relaxed'; // Default 'base'

  // Resolve bubble padding and gaps
  const sizeClasses = 
    settings.chatBubbleSize === 'compact' ? { container: 'my-1.5 gap-1.5', bubble: 'px-3 py-1.5 rounded-xl' } :
    settings.chatBubbleSize === 'spacious' ? { container: 'my-5 gap-3.5', bubble: 'px-5 py-4 rounded-3xl' } :
    { container: 'my-3.5 gap-2.5', bubble: 'px-4 py-3 rounded-2xl' }; // Default 'normal'

  // Resolve bubble style coloring/borders
  let bubbleStyleClass = '';
  if (isUser) {
    if (settings.chatBubbleStyle === 'glass') {
      bubbleStyleClass = 'bg-accent-primary/85 backdrop-blur-xs text-white rounded-tr-2xs border border-white/20';
    } else if (settings.chatBubbleStyle === 'bordered') {
      bubbleStyleClass = 'bg-transparent border border-accent-primary text-gray-800 dark:text-gray-100 rounded-tr-2xs';
    } else {
      bubbleStyleClass = 'bg-accent-primary text-white rounded-tr-2xs'; // Default 'flat'
    }
  } else {
    if (settings.chatBubbleStyle === 'glass') {
      bubbleStyleClass = 'bg-white/40 backdrop-blur-xs border border-gray-200/40 text-accent-primary rounded-tl-2xs';
    } else if (settings.chatBubbleStyle === 'bordered') {
      bubbleStyleClass = 'bg-transparent border-2 border-dashed border-gray-300 text-accent-primary rounded-tl-2xs';
    } else {
      bubbleStyleClass = 'bg-white border border-[#E2E8E0] text-accent-primary rounded-tl-2xs dark:bg-slate-900 dark:border-slate-800'; // Default 'flat'
    }
  }

  return (
    <div className={`flex items-start max-w-2xl mx-auto w-full ${isUser ? 'flex-row-reverse' : 'flex-row'} ${sizeClasses.container}`}>
      {/* Avatar */}
      {customAvatarUrl && !avatarError ? (
        <img
          src={customAvatarUrl}
          alt={isUser ? 'User' : 'Assistant'}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0 shadow-2xs border border-gray-200"
          onError={() => setAvatarError(true)}
        />
      ) : (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 shadow-2xs ${
          isUser ? 'bg-accent-lime text-accent-primary' : 'bg-accent-primary text-white'
        }`}>
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>
      )}

      {/* Bubble Container */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[75%]`}>
        <div className={`font-outfit shadow-2xs ${fontSizeClass} ${sizeClasses.bubble} ${bubbleStyleClass}`}>
          {renderFormattedText(message.text)}

          {/* Inline Confirmation Editor Card */}
          {pendingItems.length === 1 && (
            <InlineTransactionEditor item={pendingItems[0]} />
          )}

          {pendingItems.length > 1 && (
            <MultiInlineTransactionEditor items={pendingItems} />
          )}

          {/* Action Summary Pill */}
          {message.actionSummary && (
            <div className="mt-2 pt-2 border-t border-gray-200/40 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{message.actionSummary}</span>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-[10px] text-gray-400 font-medium mt-1 px-1">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
};
