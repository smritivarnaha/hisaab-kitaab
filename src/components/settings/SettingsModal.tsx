import React from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Settings, Sun, Moon, Trash2, Key, X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ onClose }) => {
  const { settings, updateSettings, toggleTheme, resetAllData } = useFinance();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn font-poppins">
      <div className="w-full max-w-md bg-white border border-[#dadce0] rounded-3xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#f1f3f4] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#f1f3f4] text-[#202124] flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-[#202124] text-sm">App Preferences</h3>
              <p className="text-[11px] text-[#5f6368]">Configure Hisaab Kitab AI preferences</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#5f6368] hover:text-[#202124] rounded-full hover:bg-[#f1f3f4]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="p-5 space-y-4 bg-[#f8f9fa]">
          {/* Appearance Mode */}
          <div className="flex items-center justify-between p-4 bg-white border border-[#dadce0] rounded-2xl shadow-2xs">
            <div>
              <p className="text-xs font-semibold text-[#202124]">Appearance Mode</p>
              <p className="text-[11px] text-[#5f6368]">Current: {settings.theme === 'dark' ? 'Dark Theme' : 'Light Theme'}</p>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-full bg-[#f1f3f4] hover:bg-[#e8eaed] text-google-blue transition-colors"
            >
              {settings.theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>
          </div>

          {/* Auto-Save Confidence Toggle */}
          <div className="flex items-center justify-between p-4 bg-white border border-[#dadce0] rounded-2xl shadow-2xs">
            <div>
              <p className="text-xs font-semibold text-[#202124]">Auto-Save High Confidence</p>
              <p className="text-[11px] text-[#5f6368]">Auto-saves entries with &ge;95% confidence</p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoSaveHighConfidence}
              onChange={e => updateSettings({ autoSaveHighConfidence: e.target.checked })}
              className="w-5 h-5 accent-google-blue rounded cursor-pointer"
            />
          </div>

          {/* Default Payment Method */}
          <div className="p-4 bg-white border border-[#dadce0] rounded-2xl shadow-2xs space-y-1.5">
            <label className="text-xs font-semibold text-[#202124] block">Default Payment Method</label>
            <select
              value={settings.defaultPaymentMethod}
              onChange={e => updateSettings({ defaultPaymentMethod: e.target.value as any })}
              className="w-full bg-[#f8f9fa] border border-[#dadce0] text-xs text-[#202124] rounded-xl py-2 px-3 outline-none focus:border-google-blue"
            >
              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Debit Card">Debit Card</option>
            </select>
          </div>

          {/* AI Provider Selection */}
          <div className="p-4 bg-white border border-[#dadce0] rounded-2xl shadow-2xs space-y-3">
            <label className="text-xs font-bold text-[#202124] flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-emerald-700" />
              AI Provider & API Keys
            </label>

            {/* Provider Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => updateSettings({ aiProvider: 'gemini' })}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${(settings as any).aiProvider === 'openai' ? 'border-[#dadce0] text-[#5f6368] bg-[#f8f9fa]' : 'border-emerald-600 text-emerald-700 bg-emerald-50'}`}
              >
                🟢 Google Gemini
              </button>
              <button
                onClick={() => updateSettings({ aiProvider: 'openai' })}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${(settings as any).aiProvider === 'openai' ? 'border-blue-500 text-blue-700 bg-blue-50' : 'border-[#dadce0] text-[#5f6368] bg-[#f8f9fa]'}`}
              >
                🔵 OpenAI (GPT-4o)
              </button>
            </div>

            {/* Gemini Key */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#202124]">Google Gemini API Key</span>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] text-emerald-700 hover:underline font-bold">Get Free Key ↗</a>
              </div>
              <input
                type="password"
                value={settings.apiKey || ''}
                onChange={e => updateSettings({ apiKey: e.target.value })}
                placeholder="AIzaSy..."
                className="w-full bg-[#f8f9fa] border border-[#dadce0] text-xs text-[#202124] rounded-xl py-2 px-3 outline-none focus:border-emerald-700 placeholder-[#5f6368] font-mono"
              />
              <p className="text-[10px] text-[#5f6368]">
                {settings.apiKey?.trim() ? '🟢 Gemini 1.5 Flash LLM is ACTIVE' : 'Uses Gemini for both text + voice audio analysis'}
              </p>
            </div>

            {/* OpenAI Key */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#202124]">OpenAI API Key</span>
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline font-bold">Get Key ↗</a>
              </div>
              <input
                type="password"
                value={(settings as any).openaiApiKey || ''}
                onChange={e => updateSettings({ openaiApiKey: e.target.value } as any)}
                placeholder="sk-..."
                className="w-full bg-[#f8f9fa] border border-[#dadce0] text-xs text-[#202124] rounded-xl py-2 px-3 outline-none focus:border-blue-500 placeholder-[#5f6368] font-mono"
              />
              <p className="text-[10px] text-[#5f6368]">
                {(settings as any).openaiApiKey?.trim() ? '🔵 GPT-4o + Whisper voice transcription is ACTIVE' : 'Uses GPT-4o for text + OpenAI Whisper for best-in-class voice accuracy'}
              </p>
            </div>
          </div>

          {/* Reset All Data */}
          <div className="pt-2">
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to reset all transactions and history?')) {
                  resetAllData();
                  onClose();
                }
              }}
              className="w-full py-2.5 px-3 rounded-full border border-red-200 bg-google-redLight hover:bg-red-100 text-google-red text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Reset All Transactions & History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
