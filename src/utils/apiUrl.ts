/**
 * Resolves API & static version URLs so both the Web App and the standalone
 * Android APK (Capacitor WebView) always sync with the live Neon PostgreSQL
 * backend on Vercel (`https://hisaab-kitab-dusky.vercel.app`).
 */

export const LIVE_PROD_ORIGIN = 'https://hisaab-kitab-dusky.vercel.app';

export function isNativeCapacitorLocalOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  const { protocol, hostname, port } = window.location;
  if (protocol === 'capacitor:' || protocol === 'file:') return true;
  // Capacitor Android local asset server runs on https://localhost (with no port)
  if (hostname === 'localhost' && !port) return true;
  if ( Boolean((window as any).Capacitor?.isNativePlatform?.()) && hostname === 'localhost' ) return true;
  return false;
}

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (isNativeCapacitorLocalOrigin()) {
    return `${LIVE_PROD_ORIGIN}${cleanPath}`;
  }
  return cleanPath;
}
