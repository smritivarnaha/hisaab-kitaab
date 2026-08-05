import React from 'react';
import { User, Building2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

export const Footer: React.FC = () => {
  const { accountMode, setAccountMode, currentUser } = useFinance();
  const userName = currentUser?.name || 'Praveen';

  return (
    <footer className="px-4 py-2.5 bg-[#FAFBF9] border-t border-[#E2E8E0] flex items-center justify-between sticky bottom-0 z-30 font-outfit text-xs text-[#0D2E14] shadow-2xs">
      {/* Left: Active Account Context Label */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="w-2 h-2 rounded-full bg-emerald-600 flex-shrink-0 animate-pulse" />
        <span className="font-semibold text-gray-600 truncate">
          {accountMode === 'business' ? 'Shared Business Ledger' : `${userName}'s Personal Ledger`}
        </span>
      </div>

      {/* Right: Clean Professional Account Switcher Pill */}
      <div className="flex items-center bg-white border border-[#E2E8E0] rounded-full p-0.5 shadow-2xs">
        <button
          onClick={() => setAccountMode('personal')}
          className={`px-3 py-1 rounded-full text-[10px] font-black transition-all flex items-center gap-1.5 ${
            accountMode === 'personal'
              ? 'bg-[#0D2E14] text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <User className="w-3 h-3" />
          <span>{userName}</span>
        </button>

        <button
          onClick={() => setAccountMode('business')}
          className={`px-3 py-1 rounded-full text-[10px] font-black transition-all flex items-center gap-1.5 ${
            accountMode === 'business'
              ? 'bg-[#0D2E14] text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Building2 className="w-3 h-3" />
          <span>Business</span>
        </button>
      </div>
    </footer>
  );
};
export default Footer;
