import React from 'react';
import { Settings, Wifi, WifiOff, Loader2, LogOut, Download } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { isBusinessPartner } from '../../types/finance';

interface Props {
  onOpenSettings: () => void;
  onOpenExport?: () => void;
}

export const Header: React.FC<Props> = ({
  onOpenSettings,
  onOpenExport
}) => {
  const { dbStatus, currentUser, logout, accountMode, syncNow } = useFinance();
  const isPartner = isBusinessPartner(currentUser);

  return (
    <header className="px-3 sm:px-5 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 bg-[#F3F5F1] border-b border-[#E2E8E0] flex items-center justify-between gap-2 sticky top-0 z-30 font-outfit shadow-2xs select-none">
      {/* Brand Title & Instant Cloud Sync Trigger */}
      <button
        type="button"
        onClick={() => syncNow()}
        title="Tap to sync all data with cloud"
        className="flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform flex-shrink-0"
      >
        <img src="/logo.png" alt="Funds Logger" className="w-6 h-6 object-contain rounded-full drop-shadow-2xs flex-shrink-0" />
        <h1 className="font-bold text-[#0D2E14] text-sm sm:text-lg tracking-tight flex items-center gap-1 font-outfit whitespace-nowrap">
          <span>Funds Log</span>
          {dbStatus === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500 flex-shrink-0" />}
          {dbStatus === 'ok' && <Wifi className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />}
          {dbStatus === 'error' && <WifiOff className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
        </h1>
      </button>

      {/* Centered Faded Account Name — flex-1 prevents collision with brand or buttons on mobile */}
      <div className="flex-1 min-w-0 text-center pointer-events-none px-1">
        <span className="text-[10px] sm:text-xs font-bold text-gray-400 font-outfit uppercase tracking-wider block truncate">
          {currentUser?.name || 'Personal'} {isPartner ? (accountMode === 'business' ? '(Business)' : '(Personal)') : ''}
        </span>
      </div>

      {/* Top Action Controls */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Export Data Symbol Button */}
        {onOpenExport && (
          <button
            onClick={onOpenExport}
            title="Export Data to Excel Sheet"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#0D2E14] text-white flex items-center justify-center shadow-xs active:scale-95 hover:bg-emerald-900 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-white" />
          </button>
        )}

        <button
          onClick={onOpenSettings}
          title="Settings"
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#0D2E14] text-white flex items-center justify-center shadow-xs active:scale-95 cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* Logout Action Button */}
        {currentUser && (
          <button
            onClick={() => logout()}
            title="Log out active session"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-red-50 border border-red-200 text-red-700 flex items-center justify-center shadow-2xs active:scale-95 hover:bg-red-100 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  );
};
export default Header;
