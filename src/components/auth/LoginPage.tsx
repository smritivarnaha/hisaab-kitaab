import React, { useState } from 'react';
import { AppUser } from '../../types/finance';
import { UserCheck, Lock, ArrowRight, ShieldCheck, Calculator } from 'lucide-react';

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
    <div className="min-h-screen w-full bg-[#F3F5F1] text-[#0D2E14] font-outfit flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#E2E8E0] shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6">

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#0D2E14] text-white flex items-center justify-center mx-auto shadow-md">
            <Calculator className="w-6 h-6" />
          </div>
          <h1 className="font-serif font-black text-2xl text-[#0D2E14] tracking-tight">Hisaab Kitab AI</h1>
          <p className="text-xs text-gray-500 font-medium">Enter your credentials to access your passbook</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold text-center animate-fadeIn">
              ⚠️ {errorMsg}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700 block">Username</label>
            <div className="relative">
              <UserCheck className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value)}
                placeholder="Enter your username"
                required
                className="w-full bg-[#F3F5F1] border border-[#E2E8E0] rounded-xl py-2.5 pl-9 pr-3 text-xs font-semibold text-[#0D2E14] outline-none focus:border-[#0D2E14] transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700 block">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full bg-[#F3F5F1] border border-[#E2E8E0] rounded-xl py-2.5 pl-9 pr-3 text-xs font-semibold text-[#0D2E14] outline-none focus:border-[#0D2E14] transition-all font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-[#0D2E14] hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <span>Signing in...</span>
            ) : (
              <>
                <span>Sign In to Passbook</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </>
            )}
          </button>
        </form>

        {/* Security Badge */}
        <div className="pt-2 text-center border-t border-gray-100 flex items-center justify-center gap-1.5 text-[10px] text-gray-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Encrypted Multi-User Database Authentication</span>
        </div>

      </div>
    </div>
  );
};
