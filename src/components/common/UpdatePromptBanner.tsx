import React, { useState, useEffect } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';

export const UpdatePromptBanner: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // 1. Service Worker update event
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });
      });
    }

    // 2. Build / Deployment version polling every 60 seconds
    const checkVersion = async () => {
      try {
        const res = await fetch('/manifest.json?_t=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const storedVersion = localStorage.getItem('funds_logger_app_version');
          if (storedVersion && data.name && storedVersion !== data.name) {
            setUpdateAvailable(true);
          }
          if (data.name) {
            localStorage.setItem('funds_logger_app_version', data.name);
          }
        }
      } catch {}
    };

    const interval = setInterval(checkVersion, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleApplyUpdate = () => {
    setIsUpdating(true);
    // Clear cache & activate new worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        for (const reg of regs) {
          reg.update();
        }
      });
    }

    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  if (!updateAvailable || isDismissed) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-md animate-bounce-short font-outfit">
      <div className="bg-[#0D2E14] text-white p-3 sm:p-3.5 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center justify-between gap-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center flex-shrink-0 text-emerald-300">
            <Sparkles className="w-4 h-4 text-[#93E044]" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-extrabold text-white truncate flex items-center gap-1.5">
              New Update Available!
            </h4>
            <p className="text-[10px] text-emerald-200 truncate">Tap to install latest improvements</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleApplyUpdate}
            disabled={isUpdating}
            className="px-3 py-1.5 bg-[#93E044] hover:bg-[#82cc39] text-[#0D2E14] rounded-xl font-extrabold text-xs shadow-xs active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'Updating...' : 'Update'}</span>
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 text-emerald-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
