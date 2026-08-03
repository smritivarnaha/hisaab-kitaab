import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
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
  Mic, 
  Volume2, 
  Upload, 
  User,
  Palette,
  Type,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { UserSettings } from '../../types/finance';

interface Props {
  onClose: () => void;
}

type TabType = 'ai' | 'avatars' | 'appearance';

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
  const { settings, updateSettings, resetAllData } = useFinance();
  const [activeTab, setActiveTab] = useState<TabType>('ai');

  // Draft state — changes are NOT saved until the user hits "Save Settings"
  const [draft, setDraft] = useState<UserSettings>({ ...settings });
  const [saved, setSaved] = useState(false);

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

  const activeProvider = draft.aiProvider || 'gemini';
  const geminiActive = !!(draft.apiKey?.trim());
  const openaiActive = !!(draft.openaiApiKey?.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn font-outfit">
      <div className="w-full sm:max-w-md bg-white sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-accent-primary text-white flex items-center justify-center transition-colors">
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
              activeTab === 'ai' ? 'bg-accent-primary text-white' : 'text-gray-500 hover:text-accent-primary hover:bg-gray-100'
            }`}
          >
            🤖 AI Settings
          </button>
          <button
            onClick={() => setActiveTab('avatars')}
            className={`flex-1 py-2 px-1 text-center text-xs font-bold rounded-xl transition-all ${
              activeTab === 'avatars' ? 'bg-accent-primary text-white' : 'text-gray-500 hover:text-accent-primary hover:bg-gray-100'
            }`}
          >
            👤 Avatars
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex-1 py-2 px-1 text-center text-xs font-bold rounded-xl transition-all ${
              activeTab === 'appearance' ? 'bg-accent-primary text-white' : 'text-gray-500 hover:text-accent-primary hover:bg-gray-100'
            }`}
          >
            🎨 Style
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4 bg-gray-50/80 no-scrollbar">

          {/* TAB 1: AI SETTINGS */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3.5 shadow-2xs">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">AI Accountant Name</label>
                  <input
                    type="text"
                    value={draft.aiAccountantName || ''}
                    onChange={e => updateDraft({ aiAccountantName: e.target.value })}
                    placeholder="AI Accountant"
                    className="w-full bg-gray-50 border border-gray-200 text-xs text-gray-900 rounded-xl py-2.5 px-3 outline-none focus:border-accent-primary focus:bg-white transition-all font-semibold"
                  />
                </div>

                <div className="h-px bg-gray-100" />

                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-accent-primary" />
                  <span className="text-xs font-bold text-gray-800">AI Provider</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => updateDraft({ aiProvider: 'gemini' })}
                    className={`flex-1 py-2.5 rounded-xl text-[10px] sm:text-xs font-bold border-2 transition-all ${activeProvider === 'gemini' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-gray-50 text-gray-500'}`}
                  >
                    🟢 Google Gemini
                  </button>
                  <button
                    onClick={() => updateDraft({ aiProvider: 'openai' })}
                    className={`flex-1 py-2.5 rounded-xl text-[10px] sm:text-xs font-bold border-2 transition-all ${activeProvider === 'openai' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 bg-gray-50 text-gray-500'}`}
                  >
                    🔵 OpenAI GPT-4o
                  </button>
                </div>

                {/* Gemini Key */}
                {activeProvider === 'gemini' && (
                  <div className="space-y-1.5 animate-fadeIn">
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
                )}

                {/* OpenAI Key */}
                {activeProvider === 'openai' && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-gray-700">OpenAI API Key</label>
                      <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline font-bold">Get Key ↗</a>
                    </div>
                    <div className="relative">
                      <input
                        type="password"
                        value={draft.openaiApiKey || ''}
                        onChange={e => updateDraft({ openaiApiKey: e.target.value })}
                        placeholder="sk-proj-..."
                        className="w-full bg-gray-50 border border-gray-200 text-xs text-gray-900 rounded-xl py-2.5 pl-3 pr-8 outline-none focus:border-blue-400 focus:bg-white placeholder-gray-400 font-mono transition-all"
                      />
                      {openaiActive && <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-500" />}
                    </div>
                  </div>
                )}
              </section>

              {/* CUSTOM AI INSTRUCTIONS */}
              <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2 shadow-2xs">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-accent-primary" />
                  <span className="text-xs font-bold text-gray-800">Custom AI Instructions</span>
                </div>
                <textarea
                  value={draft.customAIPrompt || ''}
                  onChange={e => updateDraft({ customAIPrompt: e.target.value })}
                  rows={4}
                  placeholder={`e.g.\n- My wife's name is Priya\n- We are a family of 4\n- Always use Hindi confirmations`}
                  className="w-full bg-gray-50 border border-gray-200 text-xs text-gray-800 rounded-xl py-2.5 px-3 outline-none focus:border-accent-primary focus:bg-white placeholder-gray-300 resize-none transition-all"
                />
              </section>
            </div>
          )}

          {/* TAB 2: AVATARS */}
          {activeTab === 'avatars' && (
            <div className="space-y-4">
              {/* Bot Avatar Section */}
              <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">AI Assistant Avatar</label>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full border-2 border-accent-primary bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-2xs">
                    {draft.botAvatarUrl ? (
                      <img src={draft.botAvatarUrl} alt="Bot Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Bot className="w-8 h-8 text-accent-primary" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={draft.botAvatarUrl || ''}
                      onChange={e => updateDraft({ botAvatarUrl: e.target.value })}
                      placeholder="Paste bot avatar URL..."
                      className="w-full bg-gray-50 border border-gray-200 text-[10px] rounded-lg py-1.5 px-2.5 outline-none focus:border-accent-primary"
                    />
                    <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer text-[10px] font-bold transition-all">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload picture from device</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => handleFileUpload(e, 'botAvatarUrl')}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Built-in Defaults Grid */}
                <div className="space-y-1.5 pt-1.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Select Default Bot Avatar Preset</span>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_BOT_AVATARS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => updateDraft({ botAvatarUrl: preset.url })}
                        className={`p-1.5 rounded-xl border-2 flex flex-col items-center gap-1 transition-all hover:scale-105 ${
                          draft.botAvatarUrl === preset.url ? 'border-accent-primary bg-accent-light' : 'border-gray-100 bg-gray-50'
                        }`}
                      >
                        <img src={preset.url} alt={preset.name} className="w-8 h-8 rounded-full" />
                        <span className="text-[8px] font-bold text-gray-500 truncate w-full text-center">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* User Avatar Section */}
              <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">User Profile Avatar</label>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full border-2 border-accent-primary bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-2xs">
                    {draft.userAvatarUrl ? (
                      <img src={draft.userAvatarUrl} alt="User Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-accent-primary" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={draft.userAvatarUrl || ''}
                      onChange={e => updateDraft({ userAvatarUrl: e.target.value })}
                      placeholder="Paste user avatar URL..."
                      className="w-full bg-gray-50 border border-gray-200 text-[10px] rounded-lg py-1.5 px-2.5 outline-none focus:border-accent-primary"
                    />
                    <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer text-[10px] font-bold transition-all">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload picture from device</span>
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
                <div className="space-y-1.5 pt-1.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Select Default User Avatar Preset</span>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_USER_AVATARS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => updateDraft({ userAvatarUrl: preset.url })}
                        className={`p-1.5 rounded-xl border-2 flex flex-col items-center gap-1 transition-all hover:scale-105 ${
                          draft.userAvatarUrl === preset.url ? 'border-accent-primary bg-accent-light' : 'border-gray-100 bg-gray-50'
                        }`}
                      >
                        <img src={preset.url} alt={preset.name} className="w-8 h-8 rounded-full" />
                        <span className="text-[8px] font-bold text-gray-500 truncate w-full text-center">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 3: STYLE / APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4 shadow-2xs">
                
                {/* 1. Theme Configuration (Light, Dark, System) */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-800 block">System Theme</span>
                  <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                    {(['light', 'dark', 'system'] as const).map(themeOpt => (
                      <button
                        key={themeOpt}
                        onClick={() => updateDraft({ theme: themeOpt })}
                        className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg flex items-center justify-center gap-1 capitalize transition-all ${
                          draft.theme === themeOpt ? 'bg-white text-accent-primary shadow-2xs' : 'text-gray-500 hover:text-gray-700'
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

                {/* 2. Accent Color Customization */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5"><Palette className="w-4 h-4 text-gray-500" /> Accent Color</span>
                  <div className="grid grid-cols-6 gap-2">
                    {ACCENT_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => updateDraft({ accentColor: opt.id })}
                        className={`w-10 h-10 rounded-xl relative flex items-center justify-center transition-all hover:scale-110 shadow-3xs border-2 ${
                          draft.accentColor === opt.id ? 'border-gray-900 scale-105' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: opt.color }}
                        title={opt.name}
                      >
                        {draft.accentColor === opt.id && <Check className="w-4 h-4 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-gray-100" />

                {/* 3. Font Size Customization */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5"><Type className="w-4 h-4 text-gray-500" /> Font Size</span>
                  <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                    {(['sm', 'base', 'lg'] as const).map(fOpt => (
                      <button
                        key={fOpt}
                        onClick={() => updateDraft({ fontSize: fOpt })}
                        className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all capitalize ${
                          draft.fontSize === fOpt ? 'bg-white text-accent-primary shadow-2xs' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {fOpt === 'sm' ? 'Small' : fOpt === 'base' ? 'Normal' : 'Large'}
                      </button>
                    ))}
                  </div>
                  {/* Font Size Preview Box */}
                  <div className="p-2.5 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center text-center">
                    <p className={`font-medium text-gray-600 transition-all ${
                      draft.fontSize === 'sm' ? 'text-[11px]' : draft.fontSize === 'lg' ? 'text-base' : 'text-xs sm:text-sm'
                    }`}>
                      Aa Bb Cc - Sample Chat Font Size
                    </p>
                  </div>
                </div>

                <div className="h-px bg-gray-100" />

                {/* 4. Chat Bubble Style */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5"><MessageSquare className="w-4 h-4 text-gray-500" /> Chat Bubble Style</span>
                  <div className="grid grid-cols-3 gap-2">
                    {(['flat', 'glass', 'bordered'] as const).map(styleOpt => (
                      <button
                        key={styleOpt}
                        onClick={() => updateDraft({ chatBubbleStyle: styleOpt })}
                        className={`py-2 text-center text-xs font-bold rounded-xl border-2 capitalize transition-all ${
                          draft.chatBubbleStyle === styleOpt ? 'border-accent-primary bg-accent-light text-accent-primary font-extrabold' : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        {styleOpt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-gray-100" />

                {/* 5. Chat Bubble Size Density */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-gray-500" /> Chat Bubble Padding</span>
                  <div className="grid grid-cols-3 gap-2">
                    {(['compact', 'normal', 'spacious'] as const).map(densityOpt => (
                      <button
                        key={densityOpt}
                        onClick={() => updateDraft({ chatBubbleSize: densityOpt })}
                        className={`py-2 text-center text-xs font-bold rounded-xl border-2 capitalize transition-all ${
                          draft.chatBubbleSize === densityOpt ? 'border-accent-primary bg-accent-light text-accent-primary font-extrabold' : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        {densityOpt === 'compact' ? 'Compact' : densityOpt === 'normal' ? 'Normal' : 'Spacious'}
                      </button>
                    ))}
                  </div>
                </div>

              </section>

              {/* VOICE PREFERENCES */}
              <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                <span className="text-xs font-bold text-gray-800">Voice Configuration</span>

                {/* Auto TTS */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5 text-gray-500" /> AI Voice Reply</p>
                    <p className="text-[11px] text-gray-400">AI speaks back its answer after responding</p>
                  </div>
                  <button
                    onClick={() => updateDraft({ autoTTS: !draft.autoTTS })}
                    className="w-11 h-6 rounded-full transition-colors relative flex-shrink-0 bg-gray-200"
                    style={{ backgroundColor: draft.autoTTS ? 'var(--accent-primary)' : '' }}
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
                        className={`flex-1 py-2 rounded-xl text-[11px] font-bold border-2 transition-all ${draft.voiceLanguage === lang ? 'border-accent-primary bg-accent-primary text-white' : 'border-gray-200 bg-gray-50 text-gray-500'}`}
                      >
                        {lang === 'en-IN' ? '🇬🇧 English' : lang === 'hi-IN' ? '🇮🇳 Hindi' : '🔀 Hinglish'}
                      </button>
                    ))}
                  </div>
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
            className={`flex-1 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${saved ? 'bg-emerald-500 text-white' : 'bg-accent-primary hover:bg-black text-white'}`}
          >
            {saved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Settings</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
