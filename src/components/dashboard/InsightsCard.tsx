import React from 'react';
import { generateInsights } from '../../services/ai/insights';
import { Transaction } from '../../types/finance';
import { Sparkles, AlertTriangle, TrendingUp, Info } from 'lucide-react';

interface Props {
  transactions: Transaction[];
}

export const InsightsCard: React.FC<Props> = ({ transactions }) => {
  const insights = generateInsights(transactions);

  return (
    <div className="font-outfit space-y-2.5">
      <div className="flex items-center gap-1.5 px-1">
        <Sparkles className="w-3.5 h-3.5 text-[#0D2E14]" />
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">AI Financial Intelligence</h3>
      </div>

      <div className="space-y-2">
        {insights.map(ins => (
          <div
            key={ins.id}
            className="p-3.5 rounded-2xl border border-[#E2E8E0] bg-white shadow-2xs transition-all hover:border-[#0D2E14]"
          >
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-xl bg-[#F3F5F1] text-[#0D2E14] flex-shrink-0 mt-0.5 border border-[#E2E8E0]">
                {ins.type === 'alert' && <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />}
                {ins.type === 'positive' && <TrendingUp className="w-3.5 h-3.5 text-green-700" />}
                {ins.type === 'warning' && <Sparkles className="w-3.5 h-3.5 text-[#0D2E14]" />}
                {ins.type === 'info' && <Info className="w-3.5 h-3.5 text-[#0D2E14]" />}
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-[#0D2E14] leading-snug">{ins.title}</h4>
                <p className="text-[11px] text-gray-600 font-medium leading-snug mt-0.5">{ins.description}</p>
                {ins.actionText && (
                  <button className="mt-2 text-[10px] font-bold px-3 py-1 rounded-full bg-[#0D2E14] text-white hover:bg-[#12441d] transition-colors shadow-2xs">
                    {ins.actionText}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
