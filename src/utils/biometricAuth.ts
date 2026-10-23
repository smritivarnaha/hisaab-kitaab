/**
 * Native Device Biometric & Passkey Authentication Utility
 * - In Funds Logger Android App (APK): Uses 100% Native Android OS `androidx.biometric.BiometricPrompt`
 *   (exact same hardware fingerprint / Face Unlock / Device PIN prompt used by WhatsApp & PhonePe).
 * - In Chrome / Safari Browser: Uses W3C WebAuthn Platform Authenticator hardware passkeys.
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
      isLockEnabled?: () => boolean;
      setLockEnabled?: (enabled: boolean) => void;
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
    if (typeof window !== 'undefined' && window.AndroidBiometric) {
      // Native MainActivity handles session lock/relock at the Android OS Activity level
      return true;
    }
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

// Helper: Invoke Native Android OS BiometricPrompt (WhatsApp-style hardware sensor)
function authenticateViaNativeAndroidBridge(
  title: string,
  subtitle: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !window.AndroidBiometric) {
      resolve({ success: false, error: 'Native Android biometric bridge unavailable' });
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
        resolve({ success: false, error: err?.message || 'Failed to launch Android BiometricPrompt' });
      }
    }
  });
}

// Check if hardware biometric authenticator is available on device
export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  if (typeof window === 'undefined') {
    return { isAvailable: false, hasEnrolledPasskey: false, platformAuthenticator: false };
  }

  const savedCredId = localStorage.getItem('funds_logger_passkey_cred_id');
  const savedUser = localStorage.getItem('funds_logger_passkey_user') || undefined;
  const passkeyEnabled = localStorage.getItem('funds_logger_passkey_enabled') !== 'false';

  // 1. Check Native Android APK Biometric Bridge (androidx.biometric.BiometricPrompt)
  if (window.AndroidBiometric) {
    try {
      const avail = window.AndroidBiometric.isAvailable();
      const nativeLocked =
        typeof window.AndroidBiometric.isLockEnabled === 'function'
          ? window.AndroidBiometric.isLockEnabled()
          : Boolean(savedCredId && passkeyEnabled);
      return {
        isAvailable: avail,
        hasEnrolledPasskey: Boolean(nativeLocked || (savedCredId && savedUser && passkeyEnabled)),
        platformAuthenticator: true,
        enrolledUsername: savedUser
      };
    } catch {}
  }

  // 2. Check W3C WebAuthn (Chrome / Safari / Edge)
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

  return {
    isAvailable: false,
    hasEnrolledPasskey: false,
    platformAuthenticator: false
  };
}

// Register & enable hardware biometric lock (Android Native BiometricPrompt or WebAuthn)
export async function registerDevicePasskey(
  username: string,
  displayName: string
): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Window environment unavailable.' };
  }

  const cleanUsername = (username || 'praveen').toLowerCase().trim();
  const cleanDisplay = (displayName || username || 'Praveen').trim();

  // 1. Native Android Hardware BiometricPrompt (WhatsApp-style OS fingerprint dialog)
  if (window.AndroidBiometric) {
    const res = await authenticateViaNativeAndroidBridge(
      'Confirm Fingerprint Lock',
      `Touch the fingerprint sensor or enter PIN for ${cleanDisplay}`
    );
    if (!res.success) {
      return { success: false, error: res.error || 'Fingerprint verification was cancelled.' };
    }
    try {
      window.AndroidBiometric.setLockEnabled?.(true);
    } catch {}
    const credentialId = `native_android_bio_${cleanUsername}_${Date.now()}`;
    localStorage.setItem('funds_logger_passkey_cred_id', credentialId);
    localStorage.setItem('funds_logger_passkey_user', cleanUsername);
    localStorage.setItem('funds_logger_passkey_enabled', 'true');
    markSessionBiometricUnlocked();
    return { success: true, credentialId };
  }

  // 2. W3C WebAuthn Hardware Passkey (Chrome / Safari / Edge)
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

      if (!credential) {
        return { success: false, error: 'Fingerprint registration was cancelled.' };
      }

      const credentialId = credential.rawId
        ? arrayBufferToBase64Url(credential.rawId)
        : credential.id;

      localStorage.setItem('funds_logger_passkey_cred_id', credentialId);
      localStorage.setItem('funds_logger_passkey_user', cleanUsername);
      localStorage.setItem('funds_logger_passkey_enabled', 'true');
      markSessionBiometricUnlocked();

      return { success: true, credentialId };
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        return {
          success: false,
          error: 'Fingerprint / Face ID prompt was cancelled.'
        };
      }
      return {
        success: false,
        error: err?.message || 'Failed to register hardware passkey.'
      };
    }
  }

  // 3. Running inside older APK WebView before native AndroidBiometric bridge was installed
  return {
    success: false,
    error: 'Please tap "Download Latest Native APK (v1.6)" right below and install the updated APK to activate native Android WhatsApp-style hardware fingerprint lock!'
  };
}

// Authenticate via hardware biometric sensor (Native Android BiometricPrompt or WebAuthn)
export async function verifyDevicePasskey(): Promise<{ success: boolean; username?: string; error?: string }> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Window environment unavailable.' };
  }

  const savedCredId = localStorage.getItem('funds_logger_passkey_cred_id');
  const savedUser = localStorage.getItem('funds_logger_passkey_user') || 'praveen';

  // 1. Native Android Hardware BiometricPrompt (inside Funds Logger APK)
  if (window.AndroidBiometric) {
    const res = await authenticateViaNativeAndroidBridge(
      'Funds Logger Locked',
      `Touch the fingerprint sensor or enter PIN for ${savedUser.charAt(0).toUpperCase() + savedUser.slice(1)}`
    );
    if (res.success) {
      markSessionBiometricUnlocked();
      return { success: true, username: savedUser };
    }
    return { success: false, error: res.error || 'Fingerprint verification cancelled.' };
  }

  if (!savedCredId) {
    return { success: false, error: 'No biometric lock enabled yet. Enable it in Settings → Security.' };
  }

  // 2. W3C WebAuthn (Chrome / Safari)
  if (navigator.credentials && window.PublicKeyCredential && !savedCredId.startsWith('native_android_bio_')) {
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
      return { success: false, error: err?.message || 'Hardware biometric verification failed.' };
    }
  }

  return {
    success: false,
    error: 'Please install the latest FundsLogger.apk (v1.6) to use native Android hardware fingerprint unlock.'
  };
}

// Remove biometric passkey from device
export function removeDevicePasskey(): void {
  try {
    if (typeof window !== 'undefined' && window.AndroidBiometric?.setLockEnabled) {
      window.AndroidBiometric.setLockEnabled(false);
    }
  } catch {}
  localStorage.removeItem('funds_logger_passkey_cred_id');
  localStorage.removeItem('funds_logger_passkey_user');
  localStorage.removeItem('funds_logger_passkey_enabled');
  clearSessionBiometricUnlock();
}
