import React, { useState } from 'react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { Header } from './components/layout/Header';
import { ChatContainer } from './components/chat/ChatContainer';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { ReceiptScannerModal } from './components/ocr/ReceiptScannerModal';
import { StatementImporterModal } from './components/import/StatementImporterModal';
import { SettingsModal } from './components/settings/SettingsModal';
import ErrorBoundary from './components/ErrorBoundary';
import { MessageSquare, X, Bot } from 'lucide-react';

export const AppContent: React.FC = () => {
  const { settings } = useFinance();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isOCROpen, setIsOCROpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [botAvatarError, setBotAvatarError] = useState(false);

  const botAvatar = settings.botAvatarUrl;

  return (
    <div className="min-h-screen w-full bg-[#F3F5F1] text-[#0D2E14] font-outfit antialiased flex flex-col justify-between">
      {/* Centered Application Shell */}
      <div className="w-full max-w-6xl mx-auto flex flex-col h-screen overflow-hidden shadow-2xl sm:border-x border-[#E2E8E0] bg-[#F3F5F1] relative">
        {/* Top Header Navbar */}
        <Header
          onOpenOCR={() => setIsOCROpen(true)}
          onOpenImport={() => setIsImportOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Main View Area — Dashboard by default */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          <DashboardOverview />
        </main>

        {/* Floating Chat Bubble Widget (Bottom-Right) — hidden when chat is open */}
        {!isChatOpen && (
          <button
            onClick={() => setIsChatOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#0D2E14] text-white flex items-center justify-center shadow-xl active:scale-95 transition-all hover:scale-105 overflow-hidden border-2 border-white"
            title="Chat Accountant"
          >
            {botAvatar && !botAvatarError ? (
              <img
                src={botAvatar}
                alt="Bot"
                className="w-full h-full object-cover"
                onError={() => setBotAvatarError(true)}
              />
            ) : (
              <Bot className="w-6 h-6 text-white" />
            )}
          </button>
        )}

        {/* Sliding Chat Accountant Drawer Panel (Right Side) */}
        <div
          className={`fixed inset-y-0 right-0 z-40 w-full sm:w-[450px] bg-white border-l border-gray-200/80 shadow-2xl flex flex-col transform transition-transform duration-300 ease-out ${
            isChatOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Mini Drawer Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
            <div>
              <h4 className="font-extrabold text-sm text-[#0D2E14] flex items-center gap-1.5 capitalize">
                <MessageSquare className="w-4 h-4 text-[#0D2E14]" />
                {settings.aiAccountantName || 'AI Accountant'}
              </h4>
              <p className="text-[10px] text-gray-400 mt-0.5">Enter transaction or ask summary</p>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Body — Chat Accountant */}
          <div className="flex-1 overflow-hidden">
            {isChatOpen && (
              <ChatContainer
                onOpenOCR={() => setIsOCROpen(true)}
                onOpenImport={() => setIsImportOpen(true)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Modals & Overlays */}
      {isOCROpen && <ReceiptScannerModal onClose={() => setIsOCROpen(false)} />}
      {isImportOpen && <StatementImporterModal onClose={() => setIsImportOpen(false)} />}
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <FinanceProvider>
        <AppContent />
      </FinanceProvider>
    </ErrorBoundary>
  );
}

export default App;

