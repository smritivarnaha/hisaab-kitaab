import React, { useState, useEffect } from 'react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { Header } from './components/layout/Header';
import { ChatContainer } from './components/chat/ChatContainer';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { ReceiptScannerModal } from './components/ocr/ReceiptScannerModal';
import { StatementImporterModal } from './components/import/StatementImporterModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { ExportDataModal } from './components/common/ExportDataModal';
import { UpdatePromptBanner } from './components/common/UpdatePromptBanner';
import { LoginPage } from './components/auth/LoginPage';
import ErrorBoundary from './components/ErrorBoundary';
import { X, Fingerprint, Lock, ShieldCheck } from 'lucide-react';
import {
  isSessionBiometricUnlocked,
  markSessionBiometricUnlocked,
  verifyDevicePasskey
} from './utils/biometricAuth';

const ACCENT_COLORS = {
  emerald: { primary: '#0D2E14', hover: '#12441d', light: '#F0F7EE', activeBg: '#E4ECE2', lime: '#93E044' },
  blue: { primary: '#0B57D0', hover: '#0842a0', light: '#E8F0FE', activeBg: '#D2E3FC', lime: '#38BDF8' },
  indigo: { primary: '#4F46E5', hover: '#4338CA', light: '#EEF2FF', activeBg: '#E0E7FF', lime: '#818CF8' },
  violet: { primary: '#7C3AED', hover: '#6D28D9', light: '#F5F3FF', activeBg: '#EDE9FE', lime: '#A78BFA' },
  rose: { primary: '#E11D48', hover: '#BE123C', light: '#FFF1F2', activeBg: '#FFE4E6', lime: '#FB7185' },
  amber: { primary: '#D97706', hover: '#B45309', light: '#FEF3C7', activeBg: '#FEF3C7', lime: '#FBBF24' }
};

export const AppContent: React.FC = () => {
  const { settings, currentUser, login, logout, transactions } = useFinance();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isOCROpen, setIsOCROpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [botAvatarError, setBotAvatarError] = useState(false);

  // PhonePe-style Device Biometric Lock state on app launch
  const [isBiometricLocked, setIsBiometricLocked] = useState<boolean>(() => {
    try {
      const hasDevicePasskey = Boolean(localStorage.getItem('funds_logger_passkey_cred_id'));
      const passkeyEnabled = localStorage.getItem('funds_logger_passkey_enabled') !== 'false';
      return hasDevicePasskey && passkeyEnabled && !isSessionBiometricUnlocked();
    } catch {
      return false;
    }
  });
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  useEffect(() => {
    const accent = settings.accentColor || 'emerald';
    const colors = ACCENT_COLORS[accent as keyof typeof ACCENT_COLORS] || ACCENT_COLORS.emerald;
    const root = document.documentElement;
    root.style.setProperty('--accent-primary', colors.primary);
    root.style.setProperty('--accent-hover', colors.hover);
    root.style.setProperty('--accent-light', colors.light);
    root.style.setProperty('--accent-active-bg', colors.activeBg);
    root.style.setProperty('--accent-lime', colors.lime);
  }, [settings.accentColor]);

  const handleUnlockWithBiometric = async () => {
    setBiometricError(null);
    setBiometricBusy(true);
    const res = await verifyDevicePasskey();
    setBiometricBusy(false);
    if (res.success) {
      markSessionBiometricUnlocked();
      setIsBiometricLocked(false);
    } else if (res.error) {
      setBiometricError(res.error);
    }
  };

  // Auto-trigger fingerprint prompt when locked screen mounts for a logged-in user
  useEffect(() => {
    if (currentUser && isBiometricLocked) {
      const t = setTimeout(() => {
        handleUnlockWithBiometric();
      }, 250);
      return () => clearTimeout(t);
    }
  }, [currentUser, isBiometricLocked]);

  // If no user is logged in, show the Login Page
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={user => {
          markSessionBiometricUnlocked();
          setIsBiometricLocked(false);
          login(user);
        }}
      />
    );
  }

  // If logged in and Biometric Lock is active for this session, show the Biometric Unlock Screen
  if (isBiometricLocked) {
    return (
      <div className="min-h-screen w-full bg-[#F3F5F1] font-outfit flex items-center justify-center p-4 antialiased">
        <div className="w-full max-w-[380px] bg-white rounded-3xl border border-[#E2E8E0] shadow-2xl p-7 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-[#0D2E14] mx-auto flex items-center justify-center shadow-md p-2">
            <img src="/logo.png" alt="Funds Logger" className="w-12 h-12 object-contain" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-extrabold text-[#0D2E14]">Funds Logger Locked</h2>
            <p className="text-xs text-gray-500 font-medium">
              Welcome back, <span className="font-bold text-[#0D2E14]">{currentUser.name}</span>. Verify your fingerprint or Face ID to continue.
            </p>
          </div>

          {biometricError && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              ⚠️ {biometricError}
            </div>
          )}

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleUnlockWithBiometric}
              disabled={biometricBusy}
              className="w-full py-3 px-4 rounded-2xl bg-[#0D2E14] hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Fingerprint className="w-4 h-4 text-[#93E044]" />
              <span>{biometricBusy ? 'Verifying Fingerprint...' : 'Unlock with Fingerprint / Face ID'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsBiometricLocked(false);
                logout();
              }}
              className="w-full py-2.5 px-4 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-gray-500" />
              <span>Use Password Instead</span>
            </button>
          </div>

          <div className="pt-2 border-t border-gray-100 flex items-center justify-center gap-1.5 text-[10px] text-gray-400 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Protected by Device Hardware Biometrics</span>
          </div>
        </div>
      </div>
    );
  }

  const botAvatar = settings.botAvatarUrl;
  const bubbleSizeClass = 
    settings.floatingBubbleSize === 'sm' ? 'w-10 h-10' :
    settings.floatingBubbleSize === 'lg' ? 'w-16 h-16' :
    'w-14 h-14';

  return (
    <div className="min-h-screen w-full bg-[#F3F5F1] text-[#0D2E14] font-outfit antialiased flex flex-col justify-between">
      {/* Centered Application Shell */}
      <div className="w-full max-w-6xl mx-auto flex flex-col h-screen overflow-hidden shadow-2xl sm:border-x border-[#E2E8E0] bg-[#F3F5F1] relative">
        {/* Floating Live OTA Update Banner */}
        <UpdatePromptBanner />

        {/* Top Header Navbar */}
        <Header
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenExport={() => setIsExportOpen(true)}
        />

        {/* Main View Area — Dashboard by default */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          <DashboardOverview />
        </main>

        {/* Floating Chat Bubble Widget (Bottom-Right) — hidden when chat is open */}
        {!isChatOpen && (
          <button
            onClick={() => setIsChatOpen(true)}
            className={`fixed bottom-6 right-6 z-50 ${bubbleSizeClass} rounded-full bg-white flex items-center justify-center shadow-2xl active:scale-95 transition-all hover:scale-110 overflow-hidden ring-2 ring-white/90 p-0 cursor-pointer`}
            title={settings.aiAccountantName || 'My Accountant'}
          >
            {botAvatar && !botAvatarError ? (
              <img
                src={botAvatar}
                alt="Bot"
                className="w-full h-full object-cover rounded-full"
                onError={() => setBotAvatarError(true)}
              />
            ) : (
              <img src="/logo.png" alt="Logo" className="w-full h-full object-cover rounded-full" />
            )}
          </button>
        )}

        {/* Sliding Chat Accountant Drawer Panel (Right Side) */}
        <div
          className={`fixed inset-y-0 right-0 z-[60] w-full sm:w-[450px] max-w-full bg-white border-l border-gray-200/80 shadow-2xl flex flex-col transform transition-all duration-300 ease-out overflow-hidden ${
            isChatOpen ? 'translate-x-0 opacity-100 pointer-events-auto' : 'translate-x-full opacity-0 pointer-events-none'
          }`}
        >
          {/* Mini Drawer Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain rounded-full drop-shadow-xs" />
              <div>
                <h4 className="font-extrabold text-sm text-[#0D2E14] flex items-center gap-1.5 capitalize">
                  {settings.aiAccountantName || 'My Accountant'}
                </h4>
                <p className="text-[10px] text-gray-400 mt-0.5">Enter transaction or ask summary</p>
              </div>
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

        {/* OCR Scanner Modal */}
        {isOCROpen && (
          <ReceiptScannerModal onClose={() => setIsOCROpen(false)} />
        )}

        {/* Statement Importer Modal */}
        {isImportOpen && (
          <StatementImporterModal onClose={() => setIsImportOpen(false)} />
        )}

        {/* Settings Modal */}
        {isSettingsOpen && (
          <SettingsModal onClose={() => setIsSettingsOpen(false)} />
        )}

        {/* Export Data Modal */}
        <ExportDataModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          transactions={transactions}
        />
      </div>
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
