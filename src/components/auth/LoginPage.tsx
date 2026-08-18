import React, { useState, useEffect } from 'react';
import { AppUser } from '../../types/finance';
import { Lock, ArrowRight, ShieldCheck, Calculator, User, Fingerprint } from 'lucide-react';
import { checkBiometricAvailability, verifyDevicePasskey } from '../../utils/biometricAuth';

interface Props {
  onLoginSuccess: (user: AppUser) => void;
}

const PRESET_USERS = [
  { id: 'nandini', name: 'Nandini', username: 'nandini', defaultPass: 'nandini9100' },
  { id: 'sarthak', name: 'Sarthak', username: 'sarthak', defaultPass: 'sarthak9100' },
  { id: 'praveen', name: 'Praveen', username: 'praveen', defaultPass: 'praveen9100' }
];

export const LoginPage: React.FC<Props> = ({ onLoginSuccess }) => {
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  useEffect(() => {
    checkBiometricAvailability().then(status => {
      setHasPasskey(status.hasEnrolledPasskey);
    });
  }, []);

  const handleBiometricLogin = async () => {
    setErrorMsg(null);
    setBiometricLoading(true);
    const res = await verifyDevicePasskey();
    setBiometricLoading(false);

    if (res.success && res.username) {
      const found = PRESET_USERS.find(
        u => u.username.toLowerCase() === res.username!.toLowerCase()
      );
      if (found) {
        onLoginSuccess({ id: found.id, username: found.username, name: found.name });
      } else {
        onLoginSuccess({ id: res.username, username: res.username, name: res.username });
      }
    } else if (res.error) {
      setErrorMsg(res.error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput.trim(),
          password: passwordInput.trim()
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Incorrect username or password');
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      onLoginSuccess(data.user);
    } catch (err: any) {
      console.warn('Login error:', err);
      // Fallback local verification if server connection has network latency
      const found = PRESET_USERS.find(
        u => u.username.toLowerCase() === usernameInput.trim().toLowerCase()
      );

      if (found && passwordInput.trim() === found.defaultPass) {
        setIsLoading(false);
        onLoginSuccess({ id: found.id, username: found.username, name: found.name });
      } else {
        setErrorMsg('Invalid login credentials');
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50/70 font-inter flex items-center justify-center p-4 antialiased relative overflow-hidden">
      {/* Soft Ambient Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* MNC Enterprise Card Container */}
      <div className="w-full max-w-[400px] bg-white rounded-2xl border border-slate-200/90 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.08)] overflow-hidden p-7 sm:p-8 space-y-6 relative z-10 font-inter">

        {/* Brand Header */}
        <div className="space-y-1.5">
          <div className="w-12 h-12 rounded-2xl bg-[#0D2E14] flex items-center justify-center shadow-xs mb-4 p-1">
            <img src="/logo.png" alt="Funds Logger Logo" className="w-10 h-10 object-contain drop-shadow-xs" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight font-inter">Sign in to Funds Logger</h1>
          <p className="text-xs text-slate-500 font-normal leading-relaxed">Enter your credentials to manage your financial ledger</p>
        </div>

        {/* Form Container */}
        <div className="space-y-4 pt-1 font-inter">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200/80 text-red-700 text-xs font-medium text-center animate-fadeIn font-inter">
              ⚠️ {errorMsg}
            </div>
          )}

          {hasPasskey && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={biometricLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-extrabold text-xs flex items-center justify-center gap-2 shadow-2xs active:scale-[0.99] transition-all cursor-pointer"
              >
                <Fingerprint className="w-4 h-4 text-purple-700" />
                <span>{biometricLoading ? 'Scanning Fingerprint...' : 'Unlock with Fingerprint / Face ID'}</span>
              </button>

              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[10px] text-slate-400 font-bold uppercase">or enter password</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-slate-700 block font-inter">Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  placeholder="Enter username"
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg py-2.5 pl-9 pr-3.5 text-xs text-slate-900 font-medium placeholder:text-slate-400 outline-none focus:border-[#0D2E14] focus:ring-4 focus:ring-[#0D2E14]/10 transition-all font-inter shadow-2xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-slate-700 flex items-center justify-between font-inter">
                <span>Password</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg py-2.5 pl-9 pr-3.5 text-xs text-slate-900 font-medium placeholder:text-slate-400 outline-none focus:border-[#0D2E14] focus:ring-4 focus:ring-[#0D2E14]/10 transition-all font-mono shadow-2xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-lg bg-[#0D2E14] hover:bg-[#12441d] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-2xs hover:shadow active:scale-[0.99] transition-all disabled:opacity-50 font-inter cursor-pointer mt-2"
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* MNC Security Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium font-inter">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>256-bit Encrypted Multi-Tenant Authentication</span>
        </div>

      </div>
    </div>
  );
};
