import React from 'react';
import { Bot, LayoutDashboard, Camera } from 'lucide-react';

interface Props {
  activeTab: 'chat' | 'dashboard';
  setActiveTab: (tab: 'chat' | 'dashboard') => void;
  onOpenOCR: () => void;
  onOpenImport: () => void;
  onOpenSettings: () => void;
}

export const BottomNav: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  onOpenOCR,
}) => {
  return (
    <div className="md:hidden fixed bottom-2 inset-x-0 z-40 px-3 pointer-events-none pb-[env(safe-area-inset-bottom)]">
      <nav className="pointer-events-auto max-w-sm mx-auto bg-[#0D2E14] text-white rounded-full p-1.5 shadow-2xl border border-gray-800 flex items-center justify-around font-outfit backdrop-blur-xl">
        {/* Chat Pill */}
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-1.5 px-3 rounded-full flex items-center justify-center gap-1.5 text-xs font-black transition-all active:scale-95 ${
            activeTab === 'chat'
              ? 'bg-[#93E044] text-[#0D2E14] shadow-sm'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Chat</span>
        </button>

        {/* Live Camera Button */}
        <button
          onClick={onOpenOCR}
          className="p-2 rounded-full bg-[#93E044] text-[#0D2E14] font-bold shadow-md hover:scale-105 transition-all active:scale-95 mx-1"
          title="Open Camera Scanner"
        >
          <Camera className="w-4 h-4" />
        </button>

        {/* Dashboard Pill */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 py-1.5 px-3 rounded-full flex items-center justify-center gap-1.5 text-xs font-black transition-all active:scale-95 ${
            activeTab === 'dashboard'
              ? 'bg-[#93E044] text-[#0D2E14] shadow-sm'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </button>
      </nav>
    </div>
  );
};
