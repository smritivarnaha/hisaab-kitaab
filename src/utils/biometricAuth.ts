/**
 * Native Device Biometric & Passkey Authentication Utility
 * Uses W3C WebAuthn Platform Authenticator (Fingerprint, Face Unlock, Screen Lock PIN)
 * Matches standard banking/fintech app security (PhonePe, GPay).
 */

export interface BiometricAvailability {
  isAvailable: boolean;
  hasEnrolledPasskey: boolean;
  platformAuthenticator: boolean;
}

// Check if WebAuthn platform authenticator (fingerprint/face) is available on device
export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return { isAvailable: false, hasEnrolledPasskey: false, platformAuthenticator: false };
  }

  try {
    let platformAuth = false;
    if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      platformAuth = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }

    const savedCredId = localStorage.getItem('funds_logger_passkey_cred_id');

    return {
      isAvailable: platformAuth,
      hasEnrolledPasskey: !!savedCredId,
      platformAuthenticator: platformAuth
    };
  } catch (err) {
    console.warn('Biometric availability check failed:', err);
    return { isAvailable: false, hasEnrolledPasskey: false, platformAuthenticator: false };
  }
}

// Register a new device passkey (Fingerprint / Face ID / Screen Lock)
export async function registerDevicePasskey(username: string, displayName: string): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  if (typeof window === 'undefined' || !navigator.credentials || !window.PublicKeyCredential) {
    return { success: false, error: 'Biometric passkey is not supported on this device/browser.' };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userIdBytes = new TextEncoder().encode(username);

    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'Funds Logger',
        id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname
      },
      user: {
        id: userIdBytes,
        name: username,
        displayName: displayName || username
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Hardware device fingerprint / Face ID / PIN
        userVerification: 'required',
        residentKey: 'preferred'
      },
      timeout: 60000,
      attestation: 'none'
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyOptions
    })) as PublicKeyCredential;

    if (!credential) {
      return { success: false, error: 'Biometric registration was cancelled.' };
    }

    const credentialId = credential.id;
    localStorage.setItem('funds_logger_passkey_cred_id', credentialId);
    localStorage.setItem('funds_logger_passkey_user', username);

    return { success: true, credentialId };
  } catch (err: any) {
    console.error('Biometric registration error:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, error: 'Biometric verification was cancelled or timed out.' };
    }
    return { success: false, error: err.message || 'Failed to register biometric passkey.' };
  }
}

// Authenticate via device passkey (Fingerprint / Face Unlock / Screen Lock)
export async function verifyDevicePasskey(): Promise<{ success: boolean; username?: string; error?: string }> {
  if (typeof window === 'undefined' || !navigator.credentials || !window.PublicKeyCredential) {
    return { success: false, error: 'Biometric passkey is not supported.' };
  }

  const savedCredId = localStorage.getItem('funds_logger_passkey_cred_id');
  const savedUser = localStorage.getItem('funds_logger_passkey_user');

  if (!savedCredId || !savedUser) {
    return { success: false, error: 'No device passkey registered yet. Please enable in Settings.' };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    // Convert base64 / string ID to binary buffer
    const rawIdBuffer = Uint8Array.from(atob(savedCredId.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

    const requestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      rpId: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
      allowCredentials: [
        {
          id: rawIdBuffer,
          type: 'public-key',
          transports: ['internal']
        }
      ],
      userVerification: 'required',
      timeout: 60000
    };

    const assertion = (await navigator.credentials.get({
      publicKey: requestOptions
    })) as PublicKeyCredential;

    if (!assertion) {
      return { success: false, error: 'Biometric authentication was cancelled.' };
    }

    return { success: true, username: savedUser };
  } catch (err: any) {
    console.error('Biometric authentication error:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, error: 'Fingerprint / Face ID verification was cancelled.' };
    }
    return { success: false, error: err.message || 'Biometric authentication failed.' };
  }
}

// Remove biometric passkey from device
export function removeDevicePasskey(): void {
  localStorage.removeItem('funds_logger_passkey_cred_id');
  localStorage.removeItem('funds_logger_passkey_user');
}
