import React from 'react';
import { Mic } from 'lucide-react';

interface VoiceWaveformProps {
  isListening: boolean;
  audioLevel: number; // 0 to 100
  liveTranscript?: string;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({ isListening, audioLevel, liveTranscript }) => {
  if (!isListening) return null;

  // A symmetrical set of multipliers to form a bell-curve soundwave
  const barScales = [
    0.2, 0.4, 0.6, 0.9, 1.3, 1.8, 2.2, 2.5, 
    2.2, 1.8, 1.3, 0.9, 0.6, 0.4, 0.2
  ];

  return (
    <div className="w-full bg-[#FAFCF9] border border-[#E2E8E0] rounded-3xl p-4 shadow-sm flex flex-col gap-3 animate-slide-up mb-3 font-outfit">
      <style>{`
        @keyframes assistantPulse {
          0%, 100% {
            transform: scaleY(0.85);
            opacity: 0.85;
          }
          50% {
            transform: scaleY(1.35);
            opacity: 1;
          }
        }
        .assistant-bar {
          animation: assistantPulse 1.2s ease-in-out infinite;
          transform-origin: center;
        }
      `}</style>

      <div className="flex items-center justify-between gap-4 w-full">
        {/* Left: Dynamic Mic Icon & Status Text */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#0D2E14] text-white flex items-center justify-center shadow-xs flex-shrink-0 animate-pulse">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <div className="text-left leading-tight">
            <h4 className="text-xs sm:text-sm font-black text-[#0D2E14]">Listening...</h4>
            <p className="text-[10px] sm:text-xs text-gray-500 font-bold">Speak now, I'm listening</p>
          </div>
        </div>

        {/* Right: Dynamic Fluid Soundwave Dots/Bars */}
        <div className="flex items-center gap-1.5 h-10 pr-2">
          {barScales.map((scale, i) => {
            // Dynamic base height mapped to real-time audioLevel (30 to 90)
            const baseHeight = Math.max(4, Math.round((audioLevel / 100) * 14 * scale));
            
            return (
              <div
                key={i}
                className="w-1.5 bg-[#93E044] rounded-full transition-all duration-75 assistant-bar"
                style={{
                  height: `${baseHeight}px`,
                  animationDelay: `${i * 0.06}s`
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Live Transcript text under wave */}
      {liveTranscript && (
        <div className="text-xs text-[#0D2E14] italic font-bold bg-[#F3F5F1] p-2.5 rounded-2xl border border-[#E2E8E0]">
          "{liveTranscript}"
        </div>
      )}
    </div>
  );
};
export default VoiceWaveform;
