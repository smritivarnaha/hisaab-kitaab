import React, { useState } from 'react';
import { ChatMessage, Transaction, Category, CATEGORIES_LIST, PaymentMethod } from '../../types/finance';
import { Bot, User, CheckCircle2, Check, Trash2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

interface Props {
  message: ChatMessage;
}

const InlineTransactionEditor: React.FC<{ item: Transaction }> = ({ item }) => {
  const { updateTransaction, deleteTransaction } = useFinance();
  const [title, setTitle] = useState(item.title === 'Reason Missing' ? '' : item.title);
  const [amount, setAmount] = useState(String(item.amount || ''));
  const [category, setCategory] = useState<Category>(item.category);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(item.paymentMethod || 'UPI');
  const [isConfirmed, setIsConfirmed] = useState(!item.isPending);
  const [isDiscarded, setIsDiscarded] = useState(false);

  if (isDiscarded) return null;

  const handleConfirm = () => {
    updateTransaction(item.id, {
      title: title.trim() || 'Expense',
      amount: Number(amount) || 0,
      category,
      paymentMethod,
      isPending: false // Confirmed and added to Passbook!
    });
    setIsConfirmed(true);
  };

  const handleDiscard = () => {
    deleteTransaction(item.id);
    setIsDiscarded(true);
  };

  return (
    <div className="mt-3 p-3 bg-white/95 dark:bg-slate-800/95 rounded-xl border border-amber-200 shadow-xs space-y-2.5 text-left text-gray-900 font-outfit">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase text-amber-700 tracking-wider flex items-center gap-1">
          ✏️ Verify Spelling & Details Before Saving
        </span>
        <span className="text-[9px] text-gray-400 font-semibold">{item.date}</span>
      </div>

      {!isConfirmed ? (
        <div className="space-y-2">
          {/* Title / Reason Field */}
          <div>
            <label className="text-[9px] font-bold text-gray-500 uppercase block mb-0.5">Spelling / Description</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Correct title or spelling..."
              className="w-full bg-slate-50 border border-gray-200 text-xs font-bold text-gray-900 rounded-lg p-2 outline-none focus:border-emerald-600 transition-all"
            />
          </div>

          {/* Amount & Category */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-bold text-gray-500 uppercase block mb-0.5">Amount (₹)</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full bg-slate-50 border border-gray-200 text-xs font-extrabold text-emerald-700 rounded-lg p-2 outline-none focus:border-emerald-600 transition-all"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-gray-500 uppercase block mb-0.5">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as Category)}
                className="w-full bg-slate-50 border border-gray-200 text-xs font-bold text-gray-900 rounded-lg p-2 outline-none focus:border-emerald-600 transition-all"
              >
                {CATEGORIES_LIST.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="text-[9px] font-bold text-gray-500 uppercase block mb-0.5">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full bg-slate-50 border border-gray-200 text-xs font-bold text-gray-900 rounded-lg p-2 outline-none focus:border-emerald-600 transition-all"
            >
              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Debit Card">Debit Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>

          {/* Confirm & Discard Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleConfirm}
              className="flex-1 py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Yes, Confirm & Add to Passbook</span>
            </button>
            <button
              onClick={handleDiscard}
              className="py-2 px-2.5 border border-gray-200 text-gray-500 hover:text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      ) : (
        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Confirmed & Added to Passbook!</span>
        </div>
      )}
    </div>
  );
};

export const ChatMessageItem: React.FC<Props> = ({ message }) => {
  const { settings } = useFinance();
  const [avatarError, setAvatarError] = useState(false);
  const isUser = message.sender === 'user';

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

          {/* Inline Editable Confirmation Cards */}
          {message.pendingReviewItems && message.pendingReviewItems.length > 0 && (
            <div className="space-y-2 mt-2">
              {message.pendingReviewItems.map(item => (
                <InlineTransactionEditor key={item.id} item={item} />
              ))}
            </div>
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
