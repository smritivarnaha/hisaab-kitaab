import React, { useState } from 'react';
import { ChatMessage } from '../../types/finance';
import { Bot, User, CheckCircle2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

interface Props {
  message: ChatMessage;
}

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
