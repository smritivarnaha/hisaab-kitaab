import React from 'react';
import { Camera, FileText, Settings, Bot, LayoutDashboard, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

interface Props {
  activeTab: 'chat' | 'dashboard';
  setActiveTab: (tab: 'chat' | 'dashboard') => void;
  onOpenOCR: () => void;
  onOpenImport: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  onOpenOCR,
  onOpenImport,
  onOpenSettings
}) => {
  const { dbStatus } = useFinance();

  return (
    <header className="px-3 sm:px-5 py-2.5 bg-[#F3F5F1] border-b border-[#E2E8E0] flex items-center justify-between sticky top-0 z-30 font-outfit shadow-2xs">
      {/* Brand Title */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-[#93E044] text-[#0D2E14] font-black text-xs flex items-center justify-center shadow-xs flex-shrink-0">
          ⇥
        </div>
        <div className="leading-tight">
          <h1 className="font-extrabold text-[#0D2E14] text-base tracking-tight font-outfit flex items-center gap-1.5">
            HisaabKitab <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-[#93E044] text-[#0D2E14]">AI</span>
            {/* Live DB sync status dot */}
            {dbStatus === 'loading' && (
              <span title="Connecting to database..." className="flex items-center gap-1 text-[9px] font-bold text-amber-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="hidden sm:inline">syncing</span>
              </span>
            )}
            {dbStatus === 'ok' && (
              <span title="Live sync active — data shared across all devices" className="flex items-center gap-1 text-[9px] font-bold text-emerald-600">
                <Wifi className="w-3 h-3" />
                <span className="hidden sm:inline">live</span>
              </span>
            )}
            {dbStatus === 'error' && (
              <span title="Database unreachable — check Vercel env vars" className="flex items-center gap-1 text-[9px] font-bold text-red-500">
                <WifiOff className="w-3 h-3" />
                <span className="hidden sm:inline">offline</span>
              </span>
            )}
          </h1>
        </div>
      </div>

      {/* Desktop Navigation Pill Switcher */}
      <div className="hidden md:flex items-center p-1 bg-[#E4ECE2]/80 rounded-full border border-[#E2E8E0]">
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-all flex items-center gap-1.5 ${
            activeTab === 'chat'
              ? 'bg-white text-[#0D2E14] shadow-xs border border-[#E2E8E0]'
              : 'text-gray-600 hover:text-[#0D2E14]'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          Chat Accountant
        </button>
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-all flex items-center gap-1.5 ${
            activeTab === 'dashboard'
              ? 'bg-white text-[#0D2E14] shadow-xs border border-[#E2E8E0]'
              : 'text-gray-600 hover:text-[#0D2E14]'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          Dashboard
        </button>
      </div>

      {/* Mobile Top Action Controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onOpenOCR}
          title="Scan Receipt OCR"
          className="w-8 h-8 rounded-full bg-white border border-[#E2E8E0] text-[#0D2E14] flex items-center justify-center shadow-2xs active:scale-95 hover:bg-[#E4ECE2]"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onOpenImport}
          title="Import CSV Bank Statement"
          className="w-8 h-8 rounded-full bg-white border border-[#E2E8E0] text-[#0D2E14] flex items-center justify-center shadow-2xs active:scale-95 hover:bg-[#E4ECE2]"
        >
          <FileText className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onOpenSettings}
          title="Settings"
          className="w-8 h-8 rounded-full bg-[#0D2E14] text-[#93E044] flex items-center justify-center shadow-xs active:scale-95 ml-0.5"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
