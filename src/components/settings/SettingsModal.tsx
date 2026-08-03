import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Settings, Sun, Moon, Trash2, Key, X, Save, Bot, Check, Mic, Volume2 } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ onClose }) => {
  const { settings, updateSettings, toggleTheme, resetAllData } = useFinance();

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

  const activeProvider = (draft as any).aiProvider || 'gemini';
  const geminiActive = !!(draft.apiKey?.trim());
  const openaiActive = !!((draft as any).openaiApiKey?.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn font-outfit">
      <div className="w-full sm:max-w-lg bg-white sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#0D2E14] text-white flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Settings</h3>
              <p className="text-[11px] text-gray-400">Hisaab Kitab AI preferences</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4 bg-gray-50">

          {/* ── AI PROVIDER ── */}
          <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-[#0D2E14]" />
              <span className="text-xs font-bold text-gray-800">AI Provider</span>
            </div>

            {/* Toggle pills */}
            <div className="flex gap-2">
              <button
                onClick={() => updateDraft({ aiProvider: 'gemini' } as any)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${activeProvider === 'gemini' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-gray-50 text-gray-500'}`}
              >
                🟢 Google Gemini
              </button>
              <button
                onClick={() => updateDraft({ aiProvider: 'openai' } as any)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${activeProvider === 'openai' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 bg-gray-50 text-gray-500'}`}
              >
                🔵 OpenAI GPT-4o
              </button>
            </div>

            {/* Gemini Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-gray-700">Google Gemini API Key</label>
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
              <p className={`text-[10px] font-semibold ${geminiActive ? 'text-emerald-600' : 'text-gray-400'}`}>
                {geminiActive ? '✅ Gemini 1.5 Flash active — voice audio analysis enabled' : 'Free key for text + audio analysis'}
              </p>
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
              <p className={`text-[10px] font-semibold ${openaiActive ? 'text-blue-600' : 'text-gray-400'}`}>
                {openaiActive ? '✅ GPT-4o + Whisper active — best multilingual voice accuracy' : 'GPT-4o for text reasoning + Whisper for Hindi/Hinglish voice'}
              </p>
            </div>
          </section>

          {/* ── CUSTOM AI INSTRUCTIONS ── */}
          <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#0D2E14]" />
              <span className="text-xs font-bold text-gray-800">Custom AI Instructions</span>
              <span className="ml-auto text-[10px] bg-[#0D2E14] text-white px-2 py-0.5 rounded-full font-bold">New</span>
            </div>
            <p className="text-[11px] text-gray-400">Tell the AI about your family, habits, preferences, or any rules it should always follow.</p>
            <textarea
              value={(draft as any).customAIPrompt || ''}
              onChange={e => updateDraft({ customAIPrompt: e.target.value } as any)}
              rows={4}
              placeholder={`e.g.\n- My wife's name is Priya\n- We are a family of 4\n- Always use Hindi confirmations\n- Petrol is always paid via UPI\n- Our monthly grocery budget is ₹8000`}
              className="w-full bg-gray-50 border border-gray-200 text-xs text-gray-800 rounded-xl py-2.5 px-3 outline-none focus:border-[#0D2E14] focus:bg-white placeholder-gray-300 resize-none transition-all"
            />
            <p className="text-[10px] text-gray-400">These instructions are sent to the AI with every request and override defaults.</p>
          </section>

          {/* ── PROFILE AVATARS ── */}
          <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-800">Profile Avatars</span>
            </div>
            
            {/* User Avatar */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-700">User Profile Picture URL</label>
              <input
                type="text"
                value={(draft as any).userAvatarUrl || ''}
                onChange={e => updateDraft({ userAvatarUrl: e.target.value } as any)}
                placeholder="https://example.com/user.png"
                className="w-full bg-gray-50 border border-gray-200 text-xs text-gray-900 rounded-xl py-2 px-3 outline-none focus:border-[#0D2E14] focus:bg-white placeholder-gray-400"
              />
            </div>

            {/* Bot Avatar */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-700">Assistant Bot Picture URL</label>
              <input
                type="text"
                value={(draft as any).botAvatarUrl || ''}
                onChange={e => updateDraft({ botAvatarUrl: e.target.value } as any)}
                placeholder="https://example.com/bot.png"
                className="w-full bg-gray-50 border border-gray-200 text-xs text-gray-900 rounded-xl py-2 px-3 outline-none focus:border-[#0D2E14] focus:bg-white placeholder-gray-400"
              />
            </div>
          </section>

          {/* ── VOICE LANGUAGE ── */}
          <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-[#0D2E14]" />
              <span className="text-xs font-bold text-gray-800">Voice Language</span>
            </div>
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
          </section>

          {/* ── GENERAL PREFERENCES ── */}
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
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${draft.autoTTS ? 'bg-[#0D2E14]' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${draft.autoTTS ? 'right-0.5' : 'left-0.5'}`} />
              </button>
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

          {/* ── DANGER ZONE ── */}
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
