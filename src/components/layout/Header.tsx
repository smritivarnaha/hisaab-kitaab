import React from 'react';
import { Camera, FileText, Settings, Wifi, WifiOff, Loader2, LogOut, User, FileSpreadsheet } from 'lucide-react';
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
        <h1 className="font-bold text-[#0D2E14] text-lg tracking-tight flex items-center gap-1.5 font-outfit">
          <span>Funds Log</span>
          {/* Live DB sync status dot */}
          {dbStatus === 'loading' && (
            <span title="Connecting to database..." className="flex items-center gap-1 text-[9px] font-bold text-amber-500">
              <Loader2 className="w-3 h-3 animate-spin" />
            </span>
          )}
          {dbStatus === 'ok' && (
            <span title="Live sync active" className="flex items-center gap-1 text-[9px] font-bold text-emerald-600">
              <Wifi className="w-3 h-3" />
            </span>
          )}
          {dbStatus === 'error' && (
            <span title="Database offline" className="flex items-center gap-1 text-[9px] font-bold text-red-500">
              <WifiOff className="w-3 h-3" />
            </span>
          )}
        </h1>
      </div>

      {/* Top Action Controls */}
      <div className="flex items-center gap-1.5">
        {/* Export Data Symbol Button */}
        {onOpenExport && (
          <button
            onClick={onOpenExport}
            title="Export Data to Excel Sheet"
            className="w-8 h-8 rounded-full bg-[#0D2E14] text-white flex items-center justify-center shadow-xs active:scale-95 hover:bg-emerald-900 transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
          </button>
        )}

        <button
          onClick={onOpenSettings}
          title="Settings"
          className="w-8 h-8 rounded-full bg-[#0D2E14] text-white flex items-center justify-center shadow-xs active:scale-95 ml-0.5"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* Logout Action Button */}
        {currentUser && (
          <button
            onClick={() => logout()}
            title="Log out active session"
            className="w-8 h-8 rounded-full bg-red-50 border border-red-200 text-red-700 flex items-center justify-center shadow-2xs active:scale-95 hover:bg-red-100 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  );
};
export default Header;
