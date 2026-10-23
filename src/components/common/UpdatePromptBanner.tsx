import React, { useState, useEffect } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { apiUrl, isNativeCapacitorLocalOrigin, LIVE_PROD_ORIGIN } from '../../utils/apiUrl';

function extractBundleHash(html: string): string | null {
  const match = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
  return match ? match[0] : null;
}

function getCurrentLoadedBundleHash(): string | null {
  if (typeof document === 'undefined') return null;
  const script = document.querySelector('script[src*="/assets/index-"]');
  return script ? script.getAttribute('src') : null;
}

export const UpdatePromptBanner: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Record current bundle hash on startup
    const currentBundle = getCurrentLoadedBundleHash();
    if (currentBundle) {
      try {
        localStorage.setItem('funds_logger_bundle_hash', currentBundle);
      } catch {}
    }

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
      }).catch(() => {});
    }

    // 2. Live Build / Deployment bundle hash polling every 30 seconds
    const checkVersion = async () => {
      try {
        const res = await fetch(apiUrl('/index.html?_t=' + Date.now()), { cache: 'no-store' });
        if (res.ok) {
          const html = await res.text();
          const remoteBundle = extractBundleHash(html);
          const loadedBundle = getCurrentLoadedBundleHash() || localStorage.getItem('funds_logger_bundle_hash');
          if (remoteBundle && loadedBundle && remoteBundle !== loadedBundle) {
            setUpdateAvailable(true);
          } else if (remoteBundle && !loadedBundle) {
            localStorage.setItem('funds_logger_bundle_hash', remoteBundle);
          }
        }
      } catch {}
    };

    const initialCheck = setTimeout(checkVersion, 5000);
    const interval = setInterval(checkVersion, 30000);
    return () => {
      clearTimeout(initialCheck);
      clearInterval(interval);
    };
  }, []);

  const handleApplyUpdate = async () => {
    setIsUpdating(true);
    try {
      // Clear browser / WebView caches & update service worker
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.update();
        }
      }
    } catch {}

    setTimeout(() => {
      if (isNativeCapacitorLocalOrigin()) {
        window.location.href = `${LIVE_PROD_ORIGIN}/?_t=${Date.now()}`;
      } else {
        window.location.reload();
      }
    }, 300);
  };

  if (!updateAvailable || isDismissed) return null;

  return (
    <div className="fixed top-12 sm:top-3 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-md animate-bounce-short font-outfit">
      <div className="bg-[#0D2E14] text-white p-3 sm:p-3.5 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center justify-between gap-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center flex-shrink-0 text-emerald-300">
            <Sparkles className="w-4 h-4 text-[#93E044]" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-extrabold text-white truncate flex items-center gap-1.5">
              New App Update Ready!
            </h4>
            <p className="text-[10px] text-emerald-200 truncate">Tap Update to apply latest changes instantly</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleApplyUpdate}
            disabled={isUpdating}
            className="px-3 py-1.5 bg-[#93E044] hover:bg-[#82cc39] text-[#0D2E14] rounded-xl font-extrabold text-xs shadow-xs active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'Updating...' : 'Update Now'}</span>
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
