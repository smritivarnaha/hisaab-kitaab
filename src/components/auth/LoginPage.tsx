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
  const [selectedUser, setSelectedUser] = useState(PRESET_USERS[0]);
  const [usernameInput, setUsernameInput] = useState(PRESET_USERS[0].username);
  const [passwordInput, setPasswordInput] = useState(PRESET_USERS[0].defaultPass);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectUser = (user: typeof PRESET_USERS[0]) => {
    setSelectedUser(user);
    setUsernameInput(user.username);
    setPasswordInput(user.defaultPass);
    setErrorMsg(null);
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
    <div className="min-h-screen w-full bg-[#F3F5F1] text-[#0D2E14] font-outfit flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#E2E8E0] shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6">

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#0D2E14] text-white flex items-center justify-center mx-auto shadow-md">
            <Calculator className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-[#0D2E14] tracking-tight">Hisaab Kitab AI</h1>
          <p className="text-xs text-gray-500 font-medium">Select your account or enter credentials to sign in</p>
        </div>

        {/* Quick User Selection Pills */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block text-center">Select Account</label>
          <div className="grid grid-cols-3 gap-2">
            {PRESET_USERS.map(user => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelectUser(user)}
                className={`py-2.5 px-2 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                  selectedUser.id === user.id
                    ? 'border-[#0D2E14] bg-emerald-50/80 text-[#0D2E14] font-bold shadow-xs ring-2 ring-[#0D2E14]/20'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                  selectedUser.id === user.id ? 'bg-[#0D2E14] text-white' : 'bg-gray-200 text-gray-700'
                }`}>
                  {user.name[0]}
                </div>
                <span className="text-xs">{user.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
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
                placeholder="Username (e.g. nandini)"
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
                placeholder="Password (e.g. nandini9100)"
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
          <span>Multi-User Isolated Neon Database Buckets</span>
        </div>

      </div>
    </div>
  );
};
