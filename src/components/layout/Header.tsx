import React from 'react';
import { Settings, Wifi, WifiOff, Loader2, LogOut, User, Download, Building2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

interface Props {
  onOpenSettings: () => void;
  onOpenExport?: () => void;
}

export const Header: React.FC<Props> = ({
  onOpenSettings,
  onOpenExport
}) => {
  const { dbStatus, currentUser, logout, accountMode, setAccountMode } = useFinance();
  const userName = currentUser?.name || 'Praveen';

  return (
    <header className="px-3 sm:px-5 py-2.5 bg-[#F3F5F1] border-b border-[#E2E8E0] flex items-center justify-between sticky top-0 z-30 font-outfit shadow-2xs">
      {/* Brand Title & Mode Switcher */}
      <div className="flex items-center gap-2">
        <h1 className="font-bold text-[#0D2E14] text-base sm:text-lg tracking-tight flex items-center gap-1 font-outfit">
          <span>Funds Log</span>
          {dbStatus === 'loading' && <Loader2 className="w-3 h-3 animate-spin text-amber-500" />}
          {dbStatus === 'ok' && <Wifi className="w-3 h-3 text-emerald-600" />}
          {dbStatus === 'error' && <WifiOff className="w-3 h-3 text-red-500" />}
        </h1>
      </div>

      {/* Center/Right Mode Switcher & Actions */}
      <div className="flex items-center gap-1.5">
        {/* Account Mode Switcher Pill */}
        <div className="flex items-center bg-white border border-[#E2E8E0] rounded-full p-0.5 shadow-2xs">
          <button
            onClick={() => setAccountMode('personal')}
            className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] font-black transition-all flex items-center gap-1 ${
              accountMode === 'personal'
                ? 'bg-[#0D2E14] text-white shadow-2xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <User className="w-3 h-3" />
            <span>{userName}</span>
          </button>

          <button
            onClick={() => setAccountMode('business')}
            className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] font-black transition-all flex items-center gap-1 ${
              accountMode === 'business'
                ? 'bg-indigo-900 text-white shadow-2xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Building2 className="w-3 h-3" />
            <span>Business</span>
          </button>
        </div>

        {/* Export Data Symbol Button */}
        {onOpenExport && (
          <button
            onClick={onOpenExport}
            title="Export Data to Excel Sheet"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#0D2E14] text-white flex items-center justify-center shadow-xs active:scale-95 hover:bg-emerald-900 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-white" />
          </button>
        )}

        <button
          onClick={onOpenSettings}
          title="Settings"
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#0D2E14] text-white flex items-center justify-center shadow-xs active:scale-95"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* Logout Action Button */}
        {currentUser && (
          <button
            onClick={() => logout()}
            title="Log out active session"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-red-50 border border-red-200 text-red-700 flex items-center justify-center shadow-2xs active:scale-95 hover:bg-red-100 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  );
};
export default Header;
