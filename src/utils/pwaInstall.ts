/**
 * Captures the browser's native PWA install prompt (Android WebAPK / Desktop)
 * and detects whether the user is running inside the standalone Native Android APK.
 */

let deferredInstallPrompt: any = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    listeners.forEach(cb => cb());
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    listeners.forEach(cb => cb());
  });
}

export function isRunningInNativeAndroidApk(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    Boolean((window as any).AndroidBiometric) ||
    Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
    /; wv\)|Capacitor/i.test(ua)
  );
}

export function isAppInstalledStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    isRunningInNativeAndroidApk() ||
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export function hasInstallPrompt(): boolean {
  return Boolean(deferredInstallPrompt);
}

export function subscribeInstallPrompt(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export async function triggerNativeAppInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredInstallPrompt) return 'unavailable';
  try {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredInstallPrompt = null;
      listeners.forEach(cb => cb());
      return 'accepted';
    }
    return 'dismissed';
  } catch {
    return 'unavailable';
  }
}
