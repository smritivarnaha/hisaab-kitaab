import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { DEFAULT_OPENAI_KEY } from '../../utils/aiKeys';
import { 
  Settings, 
  Sun, 
  Moon, 
  Monitor, 
  Trash2, 
  Key, 
  X, 
  Save, 
  Bot, 
  Check, 
  Upload, 
  User,
  Building2,
  Palette,
  Type,
  MessageSquare,
  Maximize2,
  Lock,
  ShieldCheck,
  Smartphone,
  Download
} from 'lucide-react';
import { UserSettings } from '../../types/finance';

interface Props {
  onClose: () => void;
}

type TabType = 'ai' | 'avatars' | 'appearance' | 'account';

const PRESET_BOT_AVATARS = [
  { name: 'Classic Bot', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Felix' },
  { name: 'Neon Robo', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Jack' },
  { name: 'Friendly AI', url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=Lola' },
  { name: 'Gradient Spark', url: 'https://api.dicebear.com/7.x/identicon/svg?seed=Helper' }
];

const PRESET_USER_AVATARS = [
  { name: 'Leo', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Leo' },
  { name: 'Sarah', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah' },
  { name: 'Mimi', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Mimi' },
  { name: 'Player 1', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Player1' }
];

const ACCENT_OPTIONS = [
  { id: 'emerald', name: 'Emerald', color: '#0D2E14' },
  { id: 'blue', name: 'Blue', color: '#0B57D0' },
  { id: 'indigo', name: 'Indigo', color: '#4F46E5' },
  { id: 'violet', name: 'Violet', color: '#7C3AED' },
  { id: 'rose', name: 'Rose', color: '#E11D48' },
  { id: 'amber', name: 'Amber', color: '#D97706' }
] as const;

export const SettingsModal: React.FC<Props> = ({ onClose }) => {
  const { settings, updateSettings, currentUser, resetAllData, changePassword, accountMode, setAccountMode } = useFinance();
  const [draft, setDraft] = useState<UserSettings>({ ...settings });
  const [activeTab, setActiveTab] = useState<TabType>('ai');
  const [saved, setSaved] = useState(false);

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passMsg, setPassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passLoading, setPassLoading] = useState(false);

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);

    if (newPassword !== confirmPassword) {
      setPassMsg({ type: 'error', text: 'New passwords do not match!' });
      return;
    }
    if (newPassword.length < 4) {
      setPassMsg({ type: 'error', text: 'Password must be at least 4 characters long.' });
      return;
    }

    setPassLoading(true);
    const res = await changePassword(oldPassword, newPassword);
    setPassLoading(false);

    if (res.success) {
      setPassMsg({ type: 'success', text: 'Password updated successfully!' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPassMsg({ type: 'error', text: res.error || 'Failed to update password' });
    }
  };

  const updateDraft = (partial: Partial<UserSettings>) => {
    setDraft(prev => ({ ...prev, ...partial }));
    setSaved(false);
  };

  const handleSave = () => {
    updateSettings(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'botAvatarUrl' | 'userAvatarUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1.2 * 1024 * 1024) {
        alert("Image file size is too big. Please select an image under 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        updateDraft({ [field]: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const activeProvider = draft.aiProvider || 'openai';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn font-outfit">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-gray-200/80 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">

        {/* Clean Professional Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#0D2E14] text-white flex items-center justify-center">
              <Settings className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-xs">Settings ({currentUser?.name})</h3>
              <p className="text-[10px] text-gray-400">Configure application preferences</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-100 bg-gray-50/60 px-2 py-1.5 flex-shrink-0 gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 py-1.5 px-2 text-center text-[11px] font-semibold rounded-lg transition-all ${
              activeTab === 'ai' ? 'bg-[#0D2E14] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            🤖 AI
          </button>
          <button
            onClick={() => setActiveTab('avatars')}
            className={`flex-1 py-1.5 px-2 text-center text-[11px] font-semibold rounded-lg transition-all ${
              activeTab === 'avatars' ? 'bg-[#0D2E14] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            👤 Avatars
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex-1 py-1.5 px-2 text-center text-[11px] font-semibold rounded-lg transition-all ${
              activeTab === 'appearance' ? 'bg-[#0D2E14] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            🎨 Theme
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`flex-1 py-1.5 px-2 text-center text-[11px] font-semibold rounded-lg transition-all ${
              activeTab === 'account' ? 'bg-[#0D2E14] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            🔐 Password
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3 bg-gray-50/50 no-scrollbar">

          {/* Account Mode & Profile Switcher Card */}
          <div className="bg-white border border-gray-200/90 rounded-2xl p-3.5 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">
                Active Account Ledger
              </label>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 capitalize">
                Mode: {accountMode}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccountMode('personal')}
                className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border ${
                  accountMode === 'personal'
                    ? 'bg-[#0D2E14] text-white border-[#0D2E14] shadow-xs'
                    : 'bg-slate-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <User className="w-4 h-4" />
                <span>{currentUser?.name || 'Praveen'}</span>
              </button>

              <button
                type="button"
                onClick={() => setAccountMode('business')}
                className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border ${
                  accountMode === 'business'
                    ? 'bg-[#0D2E14] text-white border-[#0D2E14] shadow-xs'
                    : 'bg-slate-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Business</span>
              </button>
            </div>
          </div>

          {/* TAB 1: AI SETTINGS */}
          {activeTab === 'ai' && (
            <div className="space-y-3">
              <section className="bg-white border border-gray-200/80 rounded-xl p-3.5 space-y-3 shadow-2xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Assistant Name</label>
                  <input
                    type="text"
                    value={draft.aiAccountantName || ''}
                    onChange={e => updateDraft({ aiAccountantName: e.target.value })}
                    placeholder="My Accountant"
                    className="w-full bg-slate-50 border border-gray-200 text-xs text-gray-900 rounded-lg py-2 px-3 outline-none focus:border-[#0D2E14] transition-all font-medium"
                  />
                </div>

                <div className="h-px bg-gray-100" />

                <div className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[#0D2E14]" />
                  <span className="text-xs font-semibold text-gray-800">AI Provider</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => updateDraft({ aiProvider: 'openai' })}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${activeProvider === 'openai' ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-gray-200 bg-gray-50 text-gray-600'}`}
                  >
                    🔵 OpenAI (Default)
                  </button>
                  <button
                    onClick={() => updateDraft({ aiProvider: 'gemini' })}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${activeProvider === 'gemini' ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-gray-200 bg-gray-50 text-gray-600'}`}
                  >
                    🟢 Gemini
                  </button>
                </div>

                <div className="h-px bg-gray-100" />

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">OpenAI API Key (Paid)</label>
                  <input
                    type="text"
                    value={draft.openaiApiKey || DEFAULT_OPENAI_KEY}
                    onChange={e => updateDraft({ openaiApiKey: e.target.value })}
                    placeholder="sk-proj-..."
                    className="w-full bg-slate-50 border border-gray-200 text-xs font-mono text-gray-900 rounded-lg py-2 px-3 outline-none focus:border-[#0D2E14] transition-all"
                  />
                  <span className="text-[9px] text-emerald-600 font-semibold flex items-center gap-1">
                    ✓ Default Paid OpenAI Key Active for All Users
                  </span>
                </div>
              </section>

              {/* CUSTOM AI INSTRUCTIONS */}
              <section className="bg-white border border-gray-200/80 rounded-xl p-3.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-[#0D2E14]" />
                  <span className="text-xs font-semibold text-gray-800">Custom AI Instructions</span>
                </div>
                <textarea
                  value={draft.customAIPrompt || ''}
                  onChange={e => updateDraft({ customAIPrompt: e.target.value })}
                  rows={3}
                  placeholder={`e.g. My family has 4 members. Always confirm entries in Hindi.`}
                  className="w-full bg-slate-50 border border-gray-200 text-xs text-gray-800 rounded-lg py-2 px-2.5 outline-none focus:border-[#0D2E14] placeholder-gray-400 resize-none transition-all"
                />
              </section>
            </div>
          )}

          {/* TAB 2: AVATARS */}
          {activeTab === 'avatars' && (
            <div className="space-y-3">
              {/* Bot Avatar Section */}
              <section className="bg-white border border-gray-200/80 rounded-xl p-3.5 space-y-3 shadow-2xs">
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Assistant Picture</label>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-2xs">
                    {draft.botAvatarUrl ? (
                      <img src={draft.botAvatarUrl} alt="Bot Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Bot className="w-6 h-6 text-[#0D2E14]" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      value={draft.botAvatarUrl || ''}
                      onChange={e => updateDraft({ botAvatarUrl: e.target.value })}
                      placeholder="Paste image URL..."
                      className="w-full bg-slate-50 border border-gray-200 text-[10px] rounded-md py-1 px-2 outline-none focus:border-[#0D2E14]"
                    />
                    <label className="flex items-center justify-center gap-1 px-2.5 py-1 rounded-md border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer text-[10px] font-semibold transition-all">
                      <Upload className="w-3 h-3" />
                      <span>Upload from device</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => handleFileUpload(e, 'botAvatarUrl')}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Floating Chat Bubble Size Controller */}
                <div className="pt-2 border-t border-gray-100 space-y-1.5">
                  <span className="text-[10px] font-semibold text-gray-600 flex items-center gap-1">
                    <Maximize2 className="w-3 h-3 text-[#0D2E14]" />
                    Floating Chat Bubble Size on Dashboard
                  </span>
                  <div className="flex bg-gray-100 p-0.5 rounded-lg gap-1">
                    {(['sm', 'md', 'lg'] as const).map(bSize => (
                      <button
                        key={bSize}
                        onClick={() => updateDraft({ floatingBubbleSize: bSize })}
                        className={`flex-1 py-1 text-center text-[10px] font-semibold rounded-md transition-all ${
                          draft.floatingBubbleSize === bSize ? 'bg-white text-[#0D2E14] shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        {bSize === 'sm' ? 'Small' : bSize === 'md' ? 'Medium' : 'Large'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Built-in Defaults Grid */}
                <div className="space-y-1 pt-1 border-t border-gray-100">
                  <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider block">Default Avatar Presets</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PRESET_BOT_AVATARS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => updateDraft({ botAvatarUrl: preset.url })}
                        className={`p-1 rounded-lg border flex flex-col items-center gap-0.5 transition-all hover:scale-105 ${
                          draft.botAvatarUrl === preset.url ? 'border-[#0D2E14] bg-emerald-50' : 'border-gray-100 bg-gray-50'
                        }`}
                      >
                        <img src={preset.url} alt={preset.name} className="w-7 h-7 rounded-full" />
                        <span className="text-[8px] font-medium text-gray-500 truncate w-full text-center">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* User Avatar Section */}
              <section className="bg-white border border-gray-200/80 rounded-xl p-3.5 space-y-3 shadow-2xs">
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">User Profile Avatar</label>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-2xs">
                    {draft.userAvatarUrl ? (
                      <img src={draft.userAvatarUrl} alt="User Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-[#0D2E14]" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      value={draft.userAvatarUrl || ''}
                      onChange={e => updateDraft({ userAvatarUrl: e.target.value })}
                      placeholder="Paste image URL..."
                      className="w-full bg-slate-50 border border-gray-200 text-[10px] rounded-md py-1 px-2 outline-none focus:border-[#0D2E14]"
                    />
                    <label className="flex items-center justify-center gap-1 px-2.5 py-1 rounded-md border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer text-[10px] font-semibold transition-all">
                      <Upload className="w-3 h-3" />
                      <span>Upload from device</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => handleFileUpload(e, 'userAvatarUrl')}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* User Defaults Grid */}
                <div className="space-y-1 pt-1 border-t border-gray-100">
                  <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider block">Default Avatar Presets</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PRESET_USER_AVATARS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => updateDraft({ userAvatarUrl: preset.url })}
                        className={`p-1 rounded-lg border flex flex-col items-center gap-0.5 transition-all hover:scale-105 ${
                          draft.userAvatarUrl === preset.url ? 'border-[#0D2E14] bg-emerald-50' : 'border-gray-100 bg-gray-50'
                        }`}
                      >
                        <img src={preset.url} alt={preset.name} className="w-7 h-7 rounded-full" />
                        <span className="text-[8px] font-medium text-gray-500 truncate w-full text-center">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 3: STYLE / APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-3">
              <section className="bg-white border border-gray-200/80 rounded-xl p-3.5 space-y-3 shadow-2xs">
                
                {/* Theme Configuration */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-gray-800 block">Theme</span>
                  <div className="flex bg-gray-100 p-0.5 rounded-lg gap-1">
                    {(['light', 'dark', 'system'] as const).map(themeOpt => (
                      <button
                        key={themeOpt}
                        onClick={() => updateDraft({ theme: themeOpt })}
                        className={`flex-1 py-1 text-center text-xs font-semibold rounded-md flex items-center justify-center gap-1 capitalize transition-all ${
                          draft.theme === themeOpt ? 'bg-white text-[#0D2E14] shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        {themeOpt === 'light' && <Sun className="w-3.5 h-3.5" />}
                        {themeOpt === 'dark' && <Moon className="w-3.5 h-3.5" />}
                        {themeOpt === 'system' && <Monitor className="w-3.5 h-3.5" />}
                        {themeOpt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-gray-100" />

                {/* Accent Color Customization */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-gray-800 flex items-center gap-1.5"><Palette className="w-3.5 h-3.5 text-gray-500" /> Accent Theme Color</span>
                  <div className="grid grid-cols-6 gap-1.5">
                    {ACCENT_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => updateDraft({ accentColor: opt.id })}
                        className={`h-8 rounded-lg relative flex items-center justify-center transition-all hover:scale-105 border ${
                          draft.accentColor === opt.id ? 'border-gray-900 scale-105 ring-2 ring-emerald-500/30' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: opt.color }}
                        title={opt.name}
                      >
                        {draft.accentColor === opt.id && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-gray-100" />

                {/* Font Size Customization */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-gray-800 flex items-center gap-1.5"><Type className="w-3.5 h-3.5 text-gray-500" /> Chat Text Size</span>
                  <div className="flex bg-gray-100 p-0.5 rounded-lg gap-1">
                    {(['sm', 'base', 'lg'] as const).map(fOpt => (
                      <button
                        key={fOpt}
                        onClick={() => updateDraft({ fontSize: fOpt })}
                        className={`flex-1 py-1 text-center text-xs font-semibold rounded-md transition-all capitalize ${
                          draft.fontSize === fOpt ? 'bg-white text-[#0D2E14] shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        {fOpt === 'sm' ? 'Small' : fOpt === 'base' ? 'Normal' : 'Large'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-gray-100" />

                {/* Chat Bubble Style */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-gray-800 flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-gray-500" /> Bubble Design</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['flat', 'glass', 'bordered'] as const).map(styleOpt => (
                      <button
                        key={styleOpt}
                        onClick={() => updateDraft({ chatBubbleStyle: styleOpt })}
                        className={`py-1.5 text-center text-xs font-semibold rounded-lg border capitalize transition-all ${
                          draft.chatBubbleStyle === styleOpt ? 'border-[#0D2E14] bg-emerald-50 text-[#0D2E14] font-bold' : 'border-gray-200 bg-gray-50 text-gray-600'
                        }`}
                      >
                        {styleOpt}
                      </button>
                    ))}
                  </div>
                </div>

              </section>

              {/* DANGER ZONE */}
              <section className="space-y-1.5 pt-1">
                <button
                  onClick={() => {
                    if (window.confirm('This will permanently clear all your transactions and chat history. Are you sure?')) {
                      resetAllData();
                      onClose();
                    }
                  }}
                  className="w-full py-2.5 px-3 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All Data & Ledger History
                </button>
              </section>
            </div>
          )}

          {/* TAB 4: ACCOUNT & SECURITY */}
          {activeTab === 'account' && (
            <div className="space-y-3">
              <section className="bg-white border border-gray-200/80 rounded-xl p-3.5 space-y-3 shadow-2xs font-outfit">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <ShieldCheck className="w-4 h-4 text-[#0D2E14]" />
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">Change Account Password</h4>
                    <p className="text-[10px] text-gray-400">Update security password for {currentUser?.name} ({currentUser?.username})</p>
                  </div>
                </div>

                {passMsg && (
                  <div className={`p-2.5 rounded-lg text-xs font-semibold ${
                    passMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {passMsg.type === 'success' ? '✅ ' : '⚠️ '}
                    {passMsg.text}
                  </div>
                )}

                <form onSubmit={handlePasswordChangeSubmit} className="space-y-2.5">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Current Password</label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={e => setOldPassword(e.target.value)}
                      placeholder="Enter current password..."
                      required
                      className="w-full bg-slate-50 border border-gray-200 text-xs font-mono rounded-lg py-2 px-3 outline-none focus:border-[#0D2E14]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Enter new password..."
                      required
                      className="w-full bg-slate-50 border border-gray-200 text-xs font-mono rounded-lg py-2 px-3 outline-none focus:border-[#0D2E14]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password..."
                      required
                      className="w-full bg-slate-50 border border-gray-200 text-xs font-mono rounded-lg py-2 px-3 outline-none focus:border-[#0D2E14]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={passLoading}
                    className="w-full py-2.5 rounded-lg bg-[#0D2E14] hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all disabled:opacity-50"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{passLoading ? 'Updating Password...' : 'Update Password'}</span>
                  </button>
                </form>
              </section>
            </div>
          )}

        </div>

        {/* Footer — Save Button */}
        <div className="px-4 py-3 border-t border-gray-100 bg-white flex-shrink-0 flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs ${saved ? 'bg-emerald-600 text-white' : 'bg-[#0D2E14] hover:bg-black text-white'}`}
          >
            {saved ? <><Check className="w-3.5 h-3.5" /> Saved!</> : <><Save className="w-3.5 h-3.5" /> Save Settings</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
