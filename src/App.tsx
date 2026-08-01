import React, { useState } from 'react';
import { FinanceProvider } from './context/FinanceContext';
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { ChatContainer } from './components/chat/ChatContainer';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { ReceiptScannerModal } from './components/ocr/ReceiptScannerModal';
import { StatementImporterModal } from './components/import/StatementImporterModal';
import { SettingsModal } from './components/settings/SettingsModal';

export const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'dashboard'>('chat');
  const [isOCROpen, setIsOCROpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-[#F3F5F1] text-[#0D2E14] font-outfit antialiased flex flex-col justify-between">
      {/* Centered Application Shell (Constrained Max-Width on Desktop, 100% Fluid on Mobile) */}
      <div className="w-full max-w-6xl mx-auto flex flex-col h-screen overflow-hidden shadow-2xl sm:border-x border-[#E2E8E0] bg-[#F3F5F1] relative">
        {/* Top Header Navbar */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenOCR={() => setIsOCROpen(true)}
          onOpenImport={() => setIsImportOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Main View Area */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          {activeTab === 'chat' ? (
            <ChatContainer
              onOpenOCR={() => setIsOCROpen(true)}
              onOpenImport={() => setIsImportOpen(true)}
            />
          ) : (
            <DashboardOverview />
          )}
        </main>

        {/* Mobile Floating Bottom Dock */}
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenOCR={() => setIsOCROpen(true)}
          onOpenImport={() => setIsImportOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
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
    <FinanceProvider>
      <AppContent />
    </FinanceProvider>
  );
}

export default App;
