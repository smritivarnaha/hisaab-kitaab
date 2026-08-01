import React from 'react';
import { AIClarificationQuestion } from '../../types/finance';
import { useFinance } from '../../context/FinanceContext';

interface Props {
  clarification: AIClarificationQuestion;
}

export const SmartClarificationChips: React.FC<Props> = ({ clarification }) => {
  const { processClarificationAnswer } = useFinance();

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 font-outfit">
      <p className="text-xs font-bold text-[#111827] mb-2 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[#c4f82a] animate-pulse" />
        Select Option:
      </p>
      <div className="flex flex-wrap gap-2">
        {clarification.options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => processClarificationAnswer(opt.value)}
            className="px-3.5 py-1.5 rounded-full bg-[#f3f4f1] hover:bg-[#c4f82a] hover:text-[#111827] text-[#111827] text-xs font-bold border border-gray-200 transition-all duration-150 active:scale-95 shadow-2xs"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};
