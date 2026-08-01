import React from 'react';

interface VoiceWaveformProps {
  isListening: boolean;
  audioLevel: number; // 0 to 100
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({ isListening, audioLevel }) => {
  if (!isListening) return null;

  // Generate 7 animated frequency bars whose heights scale dynamically with audio level
  const bars = [0.4, 0.7, 1.0, 0.8, 0.9, 0.6, 0.3];

  return (
    <div className="flex items-center justify-center gap-1.5 py-2 px-4 bg-emerald-950/60 border border-emerald-500/30 rounded-full backdrop-blur-md animate-slide-up">
      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping mr-1" />
      <span className="text-xs font-medium text-emerald-300 tracking-wide mr-2">Listening...</span>
      <div className="flex items-center gap-1 h-6">
        {bars.map((scale, i) => {
          const height = Math.max(6, Math.min(24, Math.round((audioLevel / 100) * 24 * scale)));
          return (
            <div
              key={i}
              className="w-1 bg-gradient-to-t from-emerald-500 to-green-300 rounded-full transition-all duration-75"
              style={{
                height: `${height}px`,
                animationDelay: `${i * 0.1}s`
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
