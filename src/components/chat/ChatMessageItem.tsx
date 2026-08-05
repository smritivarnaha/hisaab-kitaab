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
  const { updateTransaction, deleteTransaction, accountMode } = useFinance();
  const [title, setTitle] = useState(item.title === 'Reason Missing' ? '' : item.title);
  const [amount, setAmount] = useState(String(item.amount || ''));
  const [type, setType] = useState<Transaction['type']>(item.type || 'expense');
  const [notes, setNotes] = useState(item.notes || '');
  const [isConfirmed, setIsConfirmed] = useState(!item.isPending);
  const [isDiscarded, setIsDiscarded] = useState(false);

  if (isDiscarded || isConfirmed || !item.isPending) return null;

  const handleConfirm = () => {
    updateTransaction(item.id, {
      title: title.trim() || (type === 'income' ? 'Income' : type === 'lent' ? 'Lent Money' : 'Expense'),
      amount: Number(amount) || 0,
      type,
      notes: notes.trim() || undefined,
      isPending: false // Confirmed and added to Passbook!
    });
    setIsConfirmed(true);
  };

  const handleDiscard = () => {
    deleteTransaction(item.id);
    setIsDiscarded(true);
  };

  const getTypeStyle = (t: string) => {
    switch (t) {
      case 'income': return 'bg-green-100 text-green-800 border-green-200';
      case 'lent': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'borrowed': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  return (
    <div className="mt-2.5 p-3 bg-white rounded-xl border border-amber-200/90 shadow-xs space-y-2.5 text-left text-gray-900 font-outfit animate-fadeIn max-w-full">
      {/* Clean Header */}
      <div className="flex items-center justify-between gap-2 border-b border-amber-100 pb-1.5">
        <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
          ✏️ Verify & Edit Entry
        </span>
        <span className="text-[9px] text-gray-500 font-semibold flex-shrink-0">{formatGlobalDate(item.date || item.timestamp)}</span>
      </div>

      <div className="space-y-2.5">
        {/* Row 1: 2-Column Row with Entry Type Dropdown (Left) & Amount (Right) */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block mb-0.5">Entry Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as Transaction['type'])}
              className={`w-full text-xs font-bold rounded-lg p-2 outline-none border cursor-pointer ${getTypeStyle(type)}`}
            >
              <option value="expense">Spent 🔴</option>
              <option value="income">Income 🟢</option>
              {accountMode !== 'business' && <option value="lent">Lent 🤝</option>}
              {accountMode !== 'business' && <option value="borrowed">Borrowed 🤝</option>}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block mb-0.5">Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full bg-slate-50 border border-gray-200 text-xs font-bold text-emerald-700 rounded-lg p-2 outline-none focus:border-emerald-600 transition-all text-center"
            />
          </div>
        </div>

        {/* Row 2: Editable Title Input */}
        <div>
          <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block mb-0.5">Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Edit title or correct spelling..."
            className="w-full bg-slate-50 border border-gray-200 text-xs font-semibold text-gray-900 rounded-lg p-2 outline-none focus:border-emerald-600 transition-all"
          />
        </div>

        {/* Row 3: Optional Notes / Remark Input */}
        <div>
          <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block mb-0.5">Notes / Remark (Optional)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add note or remark..."
            className="w-full bg-slate-50 border border-gray-200 text-xs text-gray-700 rounded-lg p-1.5 outline-none focus:border-emerald-600 transition-all placeholder-gray-400"
          />
        </div>

        {/* Row 4: Confirm & Discard Action Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleConfirm}
            className="flex-1 py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Confirm & Add</span>
          </button>
          <button
            onClick={handleDiscard}
            className="py-1.5 px-2.5 border border-gray-200 text-gray-500 hover:text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
};

// Tabular & Card Editable Form for Multiple Entries
const MultiInlineTransactionEditor: React.FC<{ items: Transaction[] }> = ({ items }) => {
  const { confirmPendingItemsBatch, deleteTransaction, accountMode } = useFinance();
  const [drafts, setDrafts] = useState<Transaction[]>(items);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleUpdate = (id: string, field: 'title' | 'amount' | 'type' | 'notes', value: any) => {
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
      notes: item.notes?.trim() || undefined,
      isPending: false
    }));
    confirmPendingItemsBatch(ready);
    setIsConfirmed(true);
  };

  const handleDiscardAll = () => {
    drafts.forEach(d => deleteTransaction(d.id));
    setDrafts([]);
  };

  const getTypeStyle = (t: string) => {
    switch (t) {
      case 'income': return 'bg-green-100 text-green-800 border-green-200';
      case 'lent': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'borrowed': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  if (isConfirmed || drafts.length === 0) return null;

  return (
    <div className="mt-2.5 p-3 bg-white rounded-2xl border border-amber-200/90 shadow-xs space-y-3 text-left text-gray-900 font-outfit animate-fadeIn max-w-full overflow-hidden">
      {/* Clean Header */}
      <div className="flex items-center justify-between border-b border-amber-100 pb-2">
        <span className="text-xs font-extrabold text-amber-800 flex items-center gap-1.5">
          ✏️ Verify All {drafts.length} Entries Below
        </span>
      </div>

      {/* Itemized Stacked Cards (Spacious, Fully Responsive Everywhere) */}
      <div className="space-y-2.5">
        {drafts.map((row, idx) => (
          <div key={row.id} className="p-2.5 bg-slate-50 border border-gray-200/90 rounded-xl space-y-2 overflow-hidden">
            {/* Top Bar: #1 badge • Type Select • Amount (Centered) • Trash */}
            <div className="flex items-center gap-1.5 justify-between w-full min-w-0">
              {/* Darker Numbering Badge */}
              <span className="text-[11px] font-black text-slate-800 bg-slate-200/80 px-1.5 py-0.5 rounded-md flex-shrink-0">
                #{idx + 1}
              </span>

              {/* Type Select Dropdown */}
              <select
                value={row.type || 'expense'}
                onChange={e => handleUpdate(row.id, 'type', e.target.value)}
                className={`text-[10px] font-extrabold rounded-lg px-1.5 py-1 outline-none border cursor-pointer flex-1 min-w-0 max-w-[105px] ${getTypeStyle(row.type || 'expense')}`}
              >
                <option value="expense">Spent 🔴</option>
                <option value="income">Income 🟢</option>
                {accountMode !== 'business' && <option value="lent">Lent 🤝</option>}
                {accountMode !== 'business' && <option value="borrowed">Borrowed 🤝</option>}
              </select>

              {/* Amount Input Box (Centered Text) */}
              <div className="flex items-center justify-center gap-0.5 bg-white border border-gray-200 rounded-lg px-1.5 py-0.5 flex-1 min-w-0 max-w-[90px]">
                <span className="text-xs font-bold text-gray-400 flex-shrink-0">₹</span>
                <input
                  type="number"
                  value={row.amount}
                  onChange={e => handleUpdate(row.id, 'amount', e.target.value)}
                  placeholder="0"
                  className="w-full text-xs font-black text-emerald-700 outline-none text-center bg-transparent"
                />
              </div>

              {/* Delete Button */}
              <button
                onClick={() => handleDeleteRow(row.id)}
                className="p-1.5 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50 flex-shrink-0 transition-colors"
                title="Remove entry"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>

            {/* Title & Notes Inputs */}
            <div className="space-y-1 pt-0.5">
              <input
                type="text"
                value={row.title === 'Reason Missing' ? '' : row.title}
                onChange={e => handleUpdate(row.id, 'title', e.target.value)}
                placeholder="Title / description..."
                className="w-full text-xs font-semibold text-gray-900 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-600 shadow-2xs"
              />

              <input
                type="text"
                value={row.notes || ''}
                onChange={e => handleUpdate(row.id, 'notes', e.target.value)}
                placeholder="+ Add optional note or remark..."
                className="w-full text-[10px] text-gray-600 bg-white/70 border border-gray-200/80 rounded-lg px-2.5 py-1 outline-none focus:border-emerald-600 placeholder-gray-400"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons: Confirm & Add + Discard All */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleConfirmAll}
          className="flex-1 py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all"
        >
          <Check className="w-4 h-4" />
          <span>Confirm & Add</span>
        </button>
        <button
          onClick={handleDiscardAll}
          className="py-2 px-3 border border-gray-200 text-gray-500 hover:text-red-600 rounded-xl text-xs font-medium hover:bg-red-50 transition-colors flex-shrink-0"
        >
          Discard All
        </button>
      </div>
    </div>
  );
};

export const ChatMessageItem: React.FC<Props> = ({ message }) => {
  const { settings, transactions } = useFinance();
  const [avatarError, setAvatarError] = useState(false);
  const isUser = message.sender === 'user';

  // Only render pending items attached specifically to THIS message that are still pending in transactions state
  const messagePending = message.pendingReviewItems || [];
  const pendingItems = messagePending.filter(item => {
    const liveTx = transactions.find(t => t.id === item.id);
    return liveTx ? liveTx.isPending : item.isPending;
  });

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
        return <strong key={index} className="font-extrabold text-[#0D2E14]">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={index} className="italic text-slate-700">{part.slice(1, -1)}</em>;
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
      bubbleStyleClass = 'bg-[#0D2E14]/90 backdrop-blur-xs text-white rounded-tr-2xs border border-white/20 shadow-xs';
    } else if (settings.chatBubbleStyle === 'bordered') {
      bubbleStyleClass = 'bg-transparent border border-[#0D2E14] text-slate-900 rounded-tr-2xs';
    } else {
      bubbleStyleClass = 'bg-[#0D2E14] text-white rounded-tr-2xs shadow-xs'; // Default 'flat'
    }
  } else {
    // Light Assistant Bubble everywhere
    if (settings.chatBubbleStyle === 'glass') {
      bubbleStyleClass = 'bg-white/90 backdrop-blur-xs border border-slate-200 text-slate-900 rounded-tl-2xs shadow-xs';
    } else if (settings.chatBubbleStyle === 'bordered') {
      bubbleStyleClass = 'bg-white border-2 border-slate-200 text-slate-900 rounded-tl-2xs';
    } else {
      bubbleStyleClass = 'bg-white border border-[#E2E8E0] text-slate-900 rounded-tl-2xs shadow-2xs'; // Default 'flat'
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
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[90%] sm:max-w-[80%] min-w-0`}>
        {isUser && message.senderName && (
          <span className="text-[9px] font-black text-emerald-800 mb-0.5 px-2 py-0.5 bg-emerald-50 rounded-full border border-emerald-200">
            👤 {message.senderName}
          </span>
        )}
        <div className={`font-outfit shadow-2xs ${fontSizeClass} ${sizeClasses.bubble} ${bubbleStyleClass} w-full max-w-full overflow-hidden`}>
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
