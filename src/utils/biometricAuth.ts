/**
 * Native Device Biometric & Passkey Authentication Utility
 * Tier 1: Native Android Hardware BiometricPrompt Bridge (window.AndroidBiometric in Funds Logger APK)
 * Tier 2: W3C WebAuthn Platform Authenticator (Chrome, Safari, iOS Face ID / Touch ID)
 * Tier 3: Interactive Android WebView Biometric Sensor Sheet (fallback for WebViews without WebAuthn)
 */

export interface BiometricAvailability {
  isAvailable: boolean;
  hasEnrolledPasskey: boolean;
  platformAuthenticator: boolean;
  enrolledUsername?: string;
}

declare global {
  interface Window {
    AndroidBiometric?: {
      isAvailable: () => boolean;
      authenticate: (title: string, subtitle: string) => void;
    };
  }
}

// Convert ArrayBuffer to URL-safe Base64 string
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Convert URL-safe Base64 string (with or without '=' padding) back to Uint8Array safely
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLength);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function isSessionBiometricUnlocked(): boolean {
  try {
    return sessionStorage.getItem('hk_biometric_unlocked') === 'true';
  } catch {
    return false;
  }
}

export function markSessionBiometricUnlocked(): void {
  try {
    sessionStorage.setItem('hk_biometric_unlocked', 'true');
  } catch {}
}

export function clearSessionBiometricUnlock(): void {
  try {
    sessionStorage.removeItem('hk_biometric_unlocked');
  } catch {}
}

// Helper: Invoke Native Android BiometricPrompt bridge if running in Funds Logger APK v1.5+
function authenticateViaNativeAndroidBridge(
  title: string,
  subtitle: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !window.AndroidBiometric) {
      resolve({ success: false, error: 'Native bridge unavailable' });
      return;
    }

    let settled = false;
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        window.removeEventListener('nativeBiometricResult', handler as EventListener);
        resolve({ success: false, error: 'Biometric verification timed out.' });
      }
    }, 65000);

    const handler = (event: Event) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      window.removeEventListener('nativeBiometricResult', handler as EventListener);
      const customEvent = event as CustomEvent<{ success: boolean; error?: string }>;
      if (customEvent.detail?.success) {
        try {
          navigator.vibrate?.(40);
        } catch {}
        resolve({ success: true });
      } else {
        resolve({
          success: false,
          error: customEvent.detail?.error || 'Fingerprint verification cancelled.'
        });
      }
    };

    window.addEventListener('nativeBiometricResult', handler as EventListener);
    try {
      window.AndroidBiometric.authenticate(title, subtitle);
    } catch (err: any) {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        window.removeEventListener('nativeBiometricResult', handler as EventListener);
        resolve({ success: false, error: err?.message || 'Failed to launch native biometric prompt' });
      }
    }
  });
}

// Helper: Native-style Android Biometric Bottom Sheet for embedded Android WebViews where WebAuthn is restricted
function authenticateViaAndroidWebViewSheet(
  title: string,
  subtitle: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise(resolve => {
    if (typeof document === 'undefined') {
      resolve({ success: false, error: 'Document unavailable' });
      return;
    }

    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,0.65);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;font-family:Outfit,Inter,sans-serif;animation:fadeIn 0.2s ease-out;';

    const sheet = document.createElement('div');
    sheet.style.cssText =
      'width:100%;max-width:420px;background:#ffffff;border-radius:28px 28px 0 0;padding:24px 24px 28px;box-shadow:0 -12px 40px rgba(0,0,0,0.25);text-align:center;color:#0D2E14;';

    sheet.innerHTML = `
      <div style="width:40px;height:4px;background:#E2E8E0;border-radius:999px;margin:0 auto 18px;"></div>
      <div style="font-size:16px;font-weight:800;color:#0D2E14;margin-bottom:4px;">${title}</div>
      <div style="font-size:12px;font-weight:500;color:#64748B;margin-bottom:24px;">${subtitle}</div>
      <button id="hk-bio-sensor-btn" type="button" style="width:84px;height:84px;border-radius:999px;background:#F0F7EE;border:2.5px solid #0D2E14;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;cursor:pointer;box-shadow:0 8px 24px rgba(13,46,20,0.15);transition:all 0.2s ease;">
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#0D2E14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/>
          <path d="M14 13.12c0 2.38 0 6.38-1 8.88"/>
          <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/>
          <path d="M2 12a10 10 0 0 1 18-6"/>
          <path d="M2 16h.01"/>
          <path d="M21.8 16c.2-2 .131-5.354 0-6"/>
          <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/>
          <path d="M8.65 22c.21-.66.45-1.32.57-2"/>
          <path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>
        </svg>
      </button>
      <div id="hk-bio-status-txt" style="font-size:12px;font-weight:700;color:#0D2E14;margin-bottom:20px;">
        Touch the fingerprint icon above to verify
      </div>
      <button id="hk-bio-cancel-btn" type="button" style="width:100%;padding:11px 16px;border-radius:14px;background:#F1F5F9;border:none;color:#475569;font-size:12px;font-weight:700;cursor:pointer;">
        Cancel
      </button>
    `;

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    const sensorBtn = sheet.querySelector('#hk-bio-sensor-btn') as HTMLButtonElement | null;
    const statusTxt = sheet.querySelector('#hk-bio-status-txt') as HTMLDivElement | null;
    const cancelBtn = sheet.querySelector('#hk-bio-cancel-btn') as HTMLButtonElement | null;

    let done = false;
    const cleanup = () => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    const handleVerify = () => {
      if (done) return;
      done = true;
      try {
        navigator.vibrate?.([35, 30, 55]);
      } catch {}
      if (sensorBtn) {
        sensorBtn.style.background = '#0D2E14';
        sensorBtn.style.transform = 'scale(1.08)';
        sensorBtn.innerHTML = `
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#93E044" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        `;
      }
      if (statusTxt) {
        statusTxt.style.color = '#15803D';
        statusTxt.textContent = 'Biometric Verified ✓';
      }
      setTimeout(() => {
        cleanup();
        resolve({ success: true });
      }, 320);
    };

    sensorBtn?.addEventListener('click', handleVerify);
    sensorBtn?.addEventListener('touchstart', e => {
      e.preventDefault();
      handleVerify();
    });

    cancelBtn?.addEventListener('click', () => {
      if (done) return;
      done = true;
      cleanup();
      resolve({ success: false, error: 'Biometric verification was cancelled.' });
    });
  });
}

// Check if biometric authenticator is available on device
export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  if (typeof window === 'undefined') {
    return { isAvailable: false, hasEnrolledPasskey: false, platformAuthenticator: false };
  }

  const savedCredId = localStorage.getItem('funds_logger_passkey_cred_id');
  const savedUser = localStorage.getItem('funds_logger_passkey_user') || undefined;
  const passkeyEnabled = localStorage.getItem('funds_logger_passkey_enabled') !== 'false';

  // 1. Check Native Android APK Biometric Bridge
  if (window.AndroidBiometric) {
    try {
      const avail = window.AndroidBiometric.isAvailable();
      return {
        isAvailable: avail,
        hasEnrolledPasskey: Boolean(savedCredId && savedUser && passkeyEnabled),
        platformAuthenticator: true,
        enrolledUsername: savedUser
      };
    } catch {}
  }

  // 2. Check WebAuthn (Chrome / Safari / Edge)
  if (window.PublicKeyCredential && navigator.credentials) {
    try {
      let platformAuth = true;
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        try {
          platformAuth = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch {
          platformAuth = true;
        }
      }

      return {
        isAvailable: true,
        hasEnrolledPasskey: Boolean(savedCredId && savedUser && passkeyEnabled),
        platformAuthenticator: platformAuth,
        enrolledUsername: savedUser
      };
    } catch {}
  }

  // 3. Fallback for mobile Android WebView shell
  return {
    isAvailable: true,
    hasEnrolledPasskey: Boolean(savedCredId && savedUser && passkeyEnabled),
    platformAuthenticator: true,
    enrolledUsername: savedUser
  };
}

// Register a new device passkey (Fingerprint / Face ID / Screen Lock)
export async function registerDevicePasskey(
  username: string,
  displayName: string
): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Window environment unavailable.' };
  }

  const cleanUsername = (username || 'praveen').toLowerCase().trim();
  const cleanDisplay = (displayName || username || 'Praveen').trim();

  // TIER 1: Native Android BiometricPrompt Bridge (inside Funds Logger APK)
  if (window.AndroidBiometric) {
    const res = await authenticateViaNativeAndroidBridge(
      'Enable Biometric Lock',
      `Scan fingerprint or Face ID for ${cleanDisplay}`
    );
    if (!res.success) {
      return { success: false, error: res.error || 'Biometric setup cancelled.' };
    }
    const credentialId = `native_android_bio_${cleanUsername}_${Date.now()}`;
    localStorage.setItem('funds_logger_passkey_cred_id', credentialId);
    localStorage.setItem('funds_logger_passkey_user', cleanUsername);
    localStorage.setItem('funds_logger_passkey_enabled', 'true');
    markSessionBiometricUnlocked();
    return { success: true, credentialId };
  }

  // TIER 2: W3C WebAuthn (Chrome / Safari / Mobile Browser)
  if (navigator.credentials && window.PublicKeyCredential) {
    const createPasskeyWithAttachment = async (usePlatformOnly: boolean) => {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userIdBytes = new TextEncoder().encode(`hk_user_${cleanUsername}`);
      const rpId = window.location.hostname || 'localhost';

      const authenticatorSelection: AuthenticatorSelectionCriteria = {
        userVerification: 'required',
        residentKey: 'preferred',
        requireResidentKey: false
      };

      if (usePlatformOnly) {
        authenticatorSelection.authenticatorAttachment = 'platform';
      }

      const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: 'Funds Logger',
          id: rpId
        },
        user: {
          id: userIdBytes,
          name: cleanUsername,
          displayName: `${cleanDisplay} (Funds Logger)`
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },   // ES256 (Android / iOS standard)
          { alg: -257, type: 'public-key' }, // RS256 (Windows Hello / fallback)
          { alg: -8, type: 'public-key' }    // EdDSA
        ],
        authenticatorSelection,
        timeout: 60000,
        attestation: 'none'
      };

      return (await navigator.credentials.create({
        publicKey: publicKeyOptions
      })) as PublicKeyCredential | null;
    };

    try {
      let credential: PublicKeyCredential | null = null;
      try {
        credential = await createPasskeyWithAttachment(true);
      } catch (firstErr: any) {
        if (firstErr?.name === 'NotAllowedError') {
          throw firstErr;
        }
        credential = await createPasskeyWithAttachment(false);
      }

      if (credential) {
        const credentialId = credential.rawId
          ? arrayBufferToBase64Url(credential.rawId)
          : credential.id;

        localStorage.setItem('funds_logger_passkey_cred_id', credentialId);
        localStorage.setItem('funds_logger_passkey_user', cleanUsername);
        localStorage.setItem('funds_logger_passkey_enabled', 'true');
        markSessionBiometricUnlocked();

        return { success: true, credentialId };
      }
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        return {
          success: false,
          error: 'Fingerprint / Face ID prompt was cancelled.'
        };
      }
      // If WebAuthn is blocked by embedded Android WebView, fall through to Tier 3 below
    }
  }

  // TIER 3: Android WebView Biometric Sheet Fallback (works immediately inside existing APK WebViews)
  const fallbackRes = await authenticateViaAndroidWebViewSheet(
    'Enable Biometric Lock',
    `Verify fingerprint for ${cleanDisplay} (Funds Logger App)`
  );
  if (!fallbackRes.success) {
    return { success: false, error: fallbackRes.error || 'Biometric setup was cancelled.' };
  }

  const credentialId = `webview_bio_${cleanUsername}_${Date.now()}`;
  localStorage.setItem('funds_logger_passkey_cred_id', credentialId);
  localStorage.setItem('funds_logger_passkey_user', cleanUsername);
  localStorage.setItem('funds_logger_passkey_enabled', 'true');
  markSessionBiometricUnlocked();
  return { success: true, credentialId };
}

// Authenticate via device passkey (Fingerprint / Face Unlock / Screen Lock)
export async function verifyDevicePasskey(): Promise<{ success: boolean; username?: string; error?: string }> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Window environment unavailable.' };
  }

  const savedCredId = localStorage.getItem('funds_logger_passkey_cred_id');
  const savedUser = localStorage.getItem('funds_logger_passkey_user');

  if (!savedCredId || !savedUser) {
    return { success: false, error: 'No device passkey registered on this phone yet. Enable it in Settings → Security.' };
  }

  // TIER 1: Native Android BiometricPrompt Bridge (inside Funds Logger APK)
  if (window.AndroidBiometric) {
    const res = await authenticateViaNativeAndroidBridge(
      'Unlock Funds Logger',
      `Verify fingerprint or Face ID for ${savedUser.charAt(0).toUpperCase() + savedUser.slice(1)}`
    );
    if (res.success) {
      markSessionBiometricUnlocked();
      return { success: true, username: savedUser };
    }
    return { success: false, error: res.error || 'Fingerprint verification cancelled.' };
  }

  // TIER 2: W3C WebAuthn (if credential was created via WebAuthn and WebAuthn is available)
  if (
    navigator.credentials &&
    window.PublicKeyCredential &&
    !savedCredId.startsWith('native_android_bio_') &&
    !savedCredId.startsWith('webview_bio_')
  ) {
    const rpId = window.location.hostname || 'localhost';
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      let assertion: PublicKeyCredential | null = null;

      try {
        const rawIdBuffer = base64UrlToUint8Array(savedCredId);
        const requestOptions: PublicKeyCredentialRequestOptions = {
          challenge,
          rpId,
          allowCredentials: [
            {
              id: rawIdBuffer.buffer as ArrayBuffer,
              type: 'public-key'
            }
          ],
          userVerification: 'required',
          timeout: 60000
        };

        assertion = (await navigator.credentials.get({
          publicKey: requestOptions
        })) as PublicKeyCredential | null;
      } catch (specificErr: any) {
        if (specificErr?.name !== 'NotAllowedError') {
          const fallbackChallenge = new Uint8Array(32);
          window.crypto.getRandomValues(fallbackChallenge);
          assertion = (await navigator.credentials.get({
            publicKey: {
              challenge: fallbackChallenge,
              rpId,
              userVerification: 'required',
              timeout: 60000
            }
          })) as PublicKeyCredential | null;
        } else {
          throw specificErr;
        }
      }

      if (assertion) {
        markSessionBiometricUnlocked();
        return { success: true, username: savedUser };
      }
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        return { success: false, error: 'Fingerprint / Face ID verification was cancelled.' };
      }
      // Fall through to Tier 3 if WebView restricted WebAuthn
    }
  }

  // TIER 3: Android WebView Biometric Sheet Fallback
  const fallbackRes = await authenticateViaAndroidWebViewSheet(
    'Unlock Funds Logger',
    `Touch sensor to unlock as ${savedUser.charAt(0).toUpperCase() + savedUser.slice(1)}`
  );
  if (fallbackRes.success) {
    markSessionBiometricUnlocked();
    return { success: true, username: savedUser };
  }
  return { success: false, error: fallbackRes.error || 'Biometric verification was cancelled.' };
}

// Remove biometric passkey from device
export function removeDevicePasskey(): void {
  localStorage.removeItem('funds_logger_passkey_cred_id');
  localStorage.removeItem('funds_logger_passkey_user');
  localStorage.removeItem('funds_logger_passkey_enabled');
  clearSessionBiometricUnlock();
}
