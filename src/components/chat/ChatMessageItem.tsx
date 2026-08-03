import React from 'react';
import { ChatMessage } from '../../types/finance';
import { Bot, User, CheckCircle2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

interface Props {
  message: ChatMessage;
}

export const ChatMessageItem: React.FC<Props> = ({ message }) => {
  const { settings } = useFinance();
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
        return <strong key={index} className="font-extrabold text-[#0D2E14]">{part.slice(2, -2)}</strong>;
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

  return (
    <div className={`flex items-start gap-2.5 my-3.5 max-w-2xl mx-auto w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      {customAvatarUrl ? (
        <img
          src={customAvatarUrl}
          alt={isUser ? 'User' : 'Assistant'}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0 shadow-2xs"
          onError={(e) => {
            // Fallback if image fails to load
            (e.target as any).style.display = 'none';
          }}
        />
      ) : (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 shadow-2xs ${
          isUser ? 'bg-[#93E044] text-[#0D2E14]' : 'bg-[#0D2E14] text-white'
        }`}>
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>
      )}

      {/* Bubble Container */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[75%]`}>
        <div className={`px-4 py-3 rounded-2xl text-xs sm:text-sm font-outfit shadow-2xs leading-relaxed ${
          isUser 
            ? 'bg-[#0D2E14] text-white rounded-tr-2xs' 
            : 'bg-white border border-[#E2E8E0] text-[#0D2E14] rounded-tl-2xs'
        }`}>
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
