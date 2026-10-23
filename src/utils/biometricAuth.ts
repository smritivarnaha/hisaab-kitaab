/**
 * Native Device Biometric & Passkey Authentication Utility
 * Uses W3C WebAuthn Platform Authenticator (Fingerprint, Face Unlock, Screen Lock PIN)
 * Compatible with Android Chrome, Google Password Manager, Samsung Pass, iOS Face ID / Touch ID, and Android WebView/APK.
 */

export interface BiometricAvailability {
  isAvailable: boolean;
  hasEnrolledPasskey: boolean;
  platformAuthenticator: boolean;
  enrolledUsername?: string;
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

// Check if WebAuthn platform authenticator (fingerprint/face) is available on device
export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) {
    return { isAvailable: false, hasEnrolledPasskey: false, platformAuthenticator: false };
  }

  try {
    let platformAuth = true;
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      try {
        platformAuth = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch {
        platformAuth = true;
      }
    }

    const savedCredId = localStorage.getItem('funds_logger_passkey_cred_id');
    const savedUser = localStorage.getItem('funds_logger_passkey_user') || undefined;

    return {
      isAvailable: true,
      hasEnrolledPasskey: Boolean(savedCredId && savedUser),
      platformAuthenticator: platformAuth,
      enrolledUsername: savedUser
    };
  } catch (err) {
    console.warn('Biometric availability check failed:', err);
    return { isAvailable: false, hasEnrolledPasskey: false, platformAuthenticator: false };
  }
}

// Register a new device passkey (Fingerprint / Face ID / Screen Lock)
export async function registerDevicePasskey(
  username: string,
  displayName: string
): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  if (typeof window === 'undefined' || !navigator.credentials || !window.PublicKeyCredential) {
    return {
      success: false,
      error: 'Biometric passkey is not supported on this browser. Please open in Chrome or Safari over HTTPS.'
    };
  }

  const cleanUsername = (username || 'praveen').toLowerCase().trim();
  const cleanDisplay = (displayName || username || 'Praveen').trim();

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
      // If user explicitly cancelled, don't retry immediately
      if (firstErr?.name === 'NotAllowedError') {
        throw firstErr;
      }
      // Retry without strict authenticatorAttachment for Android WebViews / hybrid managers
      credential = await createPasskeyWithAttachment(false);
    }

    if (!credential) {
      return { success: false, error: 'Biometric registration was cancelled.' };
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
    console.error('Biometric registration error:', err);
    if (err.name === 'NotAllowedError') {
      return {
        success: false,
        error: 'Fingerprint / Face ID prompt was cancelled or screen lock is not set up on this phone.'
      };
    }
    if (err.name === 'SecurityError') {
      return {
        success: false,
        error: 'Passkeys require a secure HTTPS connection.'
      };
    }
    return {
      success: false,
      error: err.message || 'Failed to register biometric passkey on this device.'
    };
  }
}

// Authenticate via device passkey (Fingerprint / Face Unlock / Screen Lock)
export async function verifyDevicePasskey(): Promise<{ success: boolean; username?: string; error?: string }> {
  if (typeof window === 'undefined' || !navigator.credentials || !window.PublicKeyCredential) {
    return { success: false, error: 'Biometric passkey is not supported on this browser.' };
  }

  const savedCredId = localStorage.getItem('funds_logger_passkey_cred_id');
  const savedUser = localStorage.getItem('funds_logger_passkey_user');

  if (!savedCredId || !savedUser) {
    return { success: false, error: 'No device passkey registered on this phone yet. Enable it in Settings → Security.' };
  }

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
            // Note: Do NOT restrict transports to ['internal'] only, as Android Google Password Manager uses ['internal', 'hybrid']
          }
        ],
        userVerification: 'required',
        timeout: 60000
      };

      assertion = (await navigator.credentials.get({
        publicKey: requestOptions
      })) as PublicKeyCredential | null;
    } catch (specificErr: any) {
      // If the specific credential ID lookup failed (e.g.,InvalidStateError or discoverable credential mismatch),
      // fall back to discoverable credential prompt for this rpId
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

    if (!assertion) {
      return { success: false, error: 'Biometric authentication was cancelled.' };
    }

    markSessionBiometricUnlocked();
    return { success: true, username: savedUser };
  } catch (err: any) {
    console.error('Biometric authentication error:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, error: 'Fingerprint / Face ID verification was cancelled.' };
    }
    return { success: false, error: err.message || 'Biometric authentication failed. Please use your password.' };
  }
}

// Remove biometric passkey from device
export function removeDevicePasskey(): void {
  localStorage.removeItem('funds_logger_passkey_cred_id');
  localStorage.removeItem('funds_logger_passkey_user');
  localStorage.removeItem('funds_logger_passkey_enabled');
  clearSessionBiometricUnlock();
}
