import React from 'react';
import { Settings, Wifi, WifiOff, Loader2, LogOut, Download } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

interface Props {
  onOpenSettings: () => void;
  onOpenExport?: () => void;
}

export const Header: React.FC<Props> = ({
  onOpenSettings,
  onOpenExport
}) => {
  const { dbStatus, currentUser, logout } = useFinance();

  return (
    <header className="px-3 sm:px-5 py-2.5 bg-[#F3F5F1] border-b border-[#E2E8E0] flex items-center justify-between sticky top-0 z-30 font-outfit shadow-2xs">
      {/* Brand Title */}
      <div className="flex items-center gap-2">
        <h1 className="font-bold text-[#0D2E14] text-base sm:text-lg tracking-tight flex items-center gap-1.5 font-outfit">
          <span>Funds Log</span>
          {dbStatus === 'loading' && <Loader2 className="w-3 h-3 animate-spin text-amber-500" />}
          {dbStatus === 'ok' && <Wifi className="w-3 h-3 text-emerald-600" />}
          {dbStatus === 'error' && <WifiOff className="w-3 h-3 text-red-500" />}
        </h1>
      </div>

      {/* Top Action Controls */}
      <div className="flex items-center gap-1.5">
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
