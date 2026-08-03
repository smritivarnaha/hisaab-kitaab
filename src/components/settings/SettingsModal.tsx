import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Settings, Sun, Moon, Trash2, Key, X, Save, Bot, Check, Mic, Volume2, Upload, User } from 'lucide-react';

interface Props {
  onClose: () => void;
}

type TabType = 'ai' | 'appearance' | 'avatars';

export const SettingsModal: React.FC<Props> = ({ onClose }) => {
  const { settings, updateSettings, toggleTheme, resetAllData } = useFinance();
  const [activeTab, setActiveTab] = useState<TabType>('ai');

  // Draft state — changes are NOT saved until the user hits "Save Settings"
  const [draft, setDraft] = useState({ ...settings });
  const [saved, setSaved] = useState(false);

  const updateDraft = (partial: Partial<typeof draft>) => {
    setDraft(prev => ({ ...prev, ...partial }));
    setSaved(false);
  };

  const handleSave = () => {
    updateSettings(draft as any);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'botAvatarUrl' | 'userAvatarUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      // Basic size limit check (e.g. 1MB for base64 storage string)
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

  const activeProvider = (draft as any).aiProvider || 'gemini';
  const geminiActive = !!(draft.apiKey?.trim());
  const openaiActive = !!((draft as any).openaiApiKey?.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn font-outfit">
      <div className="w-full sm:max-w-md bg-white sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#0D2E14] text-white flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Settings</h3>
              <p className="text-[11px] text-gray-400">Configure application preferences</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-100 bg-gray-50/50 px-4 py-2 flex-shrink-0 gap-1.5">
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 py-2 px-1 text-center text-xs font-bold rounded-xl transition-all ${
              activeTab === 'ai' ? 'bg-[#0D2E14] text-white' : 'text-gray-500 hover:text-[#0D2E14] hover:bg-gray-100'
            }`}
          >
            🤖 AI Settings
          </button>
          <button
            onClick={() => setActiveTab('avatars')}
            className={`flex-1 py-2 px-1 text-center text-xs font-bold rounded-xl transition-all ${
              activeTab === 'avatars' ? 'bg-[#0D2E14] text-white' : 'text-gray-500 hover:text-[#0D2E14] hover:bg-gray-100'
            }`}
          >
            👤 Profile & Avatars
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex-1 py-2 px-1 text-center text-xs font-bold rounded-xl transition-all ${
              activeTab === 'appearance' ? 'bg-[#0D2E14] text-white' : 'text-gray-500 hover:text-[#0D2E14] hover:bg-gray-100'
            }`}
          >
            🎨 Preferences
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4 bg-gray-50/80">

          {/* TAB 1: AI SETTINGS */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#0D2E14]" />
                  <span className="text-xs font-bold text-gray-800">AI Provider</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => updateDraft({ aiProvider: 'gemini' } as any)}
                    className={`flex-1 py-2.5 rounded-xl text-[10px] sm:text-xs font-bold border-2 transition-all ${activeProvider === 'gemini' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-gray-50 text-gray-500'}`}
                  >
                    🟢 Google Gemini
                  </button>
                  <button
                    onClick={() => updateDraft({ aiProvider: 'openai' } as any)}
                    className={`flex-1 py-2.5 rounded-xl text-[10px] sm:text-xs font-bold border-2 transition-all ${activeProvider === 'openai' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 bg-gray-50 text-gray-500'}`}
                  >
                    🔵 OpenAI GPT-4o
                  </button>
                </div>

                {/* Gemini Key */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-gray-700">Gemini API Key</label>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] text-emerald-600 hover:underline font-bold">Get Free Key ↗</a>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      value={draft.apiKey || ''}
                      onChange={e => updateDraft({ apiKey: e.target.value })}
                      placeholder="AIzaSy..."
                      className="w-full bg-gray-50 border border-gray-200 text-xs text-gray-900 rounded-xl py-2.5 pl-3 pr-8 outline-none focus:border-emerald-500 focus:bg-white placeholder-gray-400 font-mono transition-all"
                    />
                    {geminiActive && <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />}
                  </div>
                </div>

                {/* OpenAI Key */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-gray-700">OpenAI API Key</label>
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline font-bold">Get Key ↗</a>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      value={(draft as any).openaiApiKey || ''}
                      onChange={e => updateDraft({ openaiApiKey: e.target.value } as any)}
                      placeholder="sk-proj-..."
                      className="w-full bg-gray-50 border border-gray-200 text-xs text-gray-900 rounded-xl py-2.5 pl-3 pr-8 outline-none focus:border-blue-400 focus:bg-white placeholder-gray-400 font-mono transition-all"
                    />
                    {openaiActive && <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-500" />}
                  </div>
                </div>
              </section>

              {/* CUSTOM AI INSTRUCTIONS */}
              <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-[#0D2E14]" />
                  <span className="text-xs font-bold text-gray-800">Custom AI Instructions</span>
                </div>
                <textarea
                  value={(draft as any).customAIPrompt || ''}
                  onChange={e => updateDraft({ customAIPrompt: e.target.value } as any)}
                  rows={4}
                  placeholder={`e.g.\n- My wife's name is Priya\n- We are a family of 4\n- Always use Hindi confirmations`}
                  className="w-full bg-gray-50 border border-gray-200 text-xs text-gray-800 rounded-xl py-2.5 px-3 outline-none focus:border-[#0D2E14] focus:bg-white placeholder-gray-300 resize-none transition-all"
                />
              </section>
            </div>
          )}

          {/* TAB 2: PROFILE & AVATARS */}
          {activeTab === 'avatars' && (
            <div className="space-y-4">
              <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3.5">
                {/* AI Accountant Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">AI Accountant Name</label>
                  <input
                    type="text"
                    value={(draft as any).aiAccountantName || ''}
                    onChange={e => updateDraft({ aiAccountantName: e.target.value } as any)}
                    placeholder="AI Accountant"
                    className="w-full bg-gray-50 border border-gray-200 text-xs text-gray-900 rounded-xl py-2.5 px-3 outline-none focus:border-[#0D2E14] focus:bg-white transition-all font-semibold"
                  />
                </div>

                <div className="h-px bg-gray-100" />

                {/* User Avatar */}
                <div className="space-y-2.5">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">User Profile Picture</label>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {(draft as any).userAvatarUrl ? (
                        <img src={(draft as any).userAvatarUrl} alt="User Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <input
                        type="text"
                        value={(draft as any).userAvatarUrl || ''}
                        onChange={e => updateDraft({ userAvatarUrl: e.target.value } as any)}
                        placeholder="Or paste profile image URL..."
                        className="w-full bg-gray-50 border border-gray-200 text-[10px] rounded-lg py-1.5 px-2.5 outline-none focus:border-[#0D2E14]"
                      />
                      <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer text-[10px] font-bold transition-all">
                        <Upload className="w-3.5 h-3.5" />
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
                </div>

                <div className="h-px bg-gray-100" />

                {/* Bot Avatar */}
                <div className="space-y-2.5">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">AI Accountant Picture</label>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {(draft as any).botAvatarUrl ? (
                        <img src={(draft as any).botAvatarUrl} alt="Bot Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <Bot className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <input
                        type="text"
                        value={(draft as any).botAvatarUrl || ''}
                        onChange={e => updateDraft({ botAvatarUrl: e.target.value } as any)}
                        placeholder="Or paste bot image URL..."
                        className="w-full bg-gray-50 border border-gray-200 text-[10px] rounded-lg py-1.5 px-2.5 outline-none focus:border-[#0D2E14]"
                      />
                      <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer text-[10px] font-bold transition-all">
                        <Upload className="w-3.5 h-3.5" />
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
                </div>
              </section>
            </div>
          )}

          {/* TAB 3: PREFERENCES & APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
                <span className="text-xs font-bold text-gray-800">General Preferences</span>

                {/* Theme */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">Appearance</p>
                    <p className="text-[11px] text-gray-400">{settings.theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</p>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    {settings.theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-600" />}
                  </button>
                </div>

                <div className="h-px bg-gray-100" />

                {/* Auto TTS */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5 text-gray-500" /> AI Voice Reply</p>
                    <p className="text-[11px] text-gray-400">AI speaks back its answer after responding</p>
                  </div>
                  <button
                    onClick={() => updateDraft({ autoTTS: !draft.autoTTS })}
                    className="w-11 h-6 rounded-full transition-colors relative flex-shrink-0 bg-gray-200"
                    style={{ backgroundColor: draft.autoTTS ? '#0D2E14' : '' }}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${draft.autoTTS ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>

                <div className="h-px bg-gray-100" />

                {/* Voice Language */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"><Mic className="w-3.5 h-3.5 text-gray-500" /> Voice Recognition Language</p>
                  <div className="flex gap-2">
                    {(['en-IN', 'hi-IN', 'hinglish'] as const).map(lang => (
                      <button
                        key={lang}
                        onClick={() => updateDraft({ voiceLanguage: lang })}
                        className={`flex-1 py-2 rounded-xl text-[11px] font-bold border-2 transition-all ${draft.voiceLanguage === lang ? 'border-[#0D2E14] bg-[#0D2E14] text-white' : 'border-gray-200 bg-gray-50 text-gray-500'}`}
                      >
                        {lang === 'en-IN' ? '🇬🇧 English' : lang === 'hi-IN' ? '🇮🇳 Hindi' : '🔀 Hinglish'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-gray-100" />

                {/* Default Payment */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-gray-700">Default Payment Method</p>
                  <select
                    value={draft.defaultPaymentMethod}
                    onChange={e => updateDraft({ defaultPaymentMethod: e.target.value as any })}
                    className="w-full bg-gray-50 border border-gray-200 text-xs text-gray-800 rounded-xl py-2 px-3 outline-none focus:border-[#0D2E14]"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </section>

              {/* DANGER ZONE */}
              <section className="space-y-2">
                <button
                  onClick={() => {
                    if (window.confirm('This will permanently clear all your transactions and chat history. Are you sure?')) {
                      resetAllData();
                      onClose();
                    }
                  }}
                  className="w-full py-3 px-4 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All Transactions & History
                </button>
              </section>
            </div>
          )}
        </div>

        {/* Sticky Footer — Save Button */}
        <div className="px-5 py-4 border-t border-gray-100 bg-white flex-shrink-0 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 text-xs font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={`flex-1 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${saved ? 'bg-emerald-500 text-white' : 'bg-[#0D2E14] hover:bg-black text-white'}`}
          >
            {saved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Settings</>}
          </button>
        </div>
      </div>
    </div>
  );
};
export default SettingsModal;
