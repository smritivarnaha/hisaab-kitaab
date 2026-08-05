import React from 'react';
import { User, Building2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

export const Footer: React.FC = () => {
  const { accountMode, setAccountMode, currentUser } = useFinance();
  const userName = currentUser?.name || 'Praveen';

  return (
    <footer className="w-full bg-[#FAFBF9] border-t border-[#E2E8E0] px-3 py-2 sticky bottom-0 z-40 font-outfit shadow-md flex-shrink-0">
      <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
        <button
          onClick={() => setAccountMode('personal')}
          className={`w-full py-2.5 px-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 border ${
            accountMode === 'personal'
              ? 'bg-[#0D2E14] text-white border-[#0D2E14] shadow-xs'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <User className="w-4 h-4" />
          <span>{userName}</span>
        </button>

        <button
          onClick={() => setAccountMode('business')}
          className={`w-full py-2.5 px-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 border ${
            accountMode === 'business'
              ? 'bg-[#0D2E14] text-white border-[#0D2E14] shadow-xs'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Business</span>
        </button>
      </div>
    </footer>
  );
};
export default Footer;
