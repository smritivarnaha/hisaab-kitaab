// Wrapper for Web Speech API with fallback simulation and live transcript support

export interface VoiceRecognitionConfig {
  language: string;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: (finalCapturedText: string) => void;
}

export class VoiceRecognitionService {
  private recognition: any = null;
  private isListening = false;
  private currentTranscript = '';
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private animFrameId: number | null = null;

  constructor() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
    }
  }

  public isSupported(): boolean {
    return !!this.recognition || !!(window as any).navigator?.mediaDevices;
  }

  public start(
    config: VoiceRecognitionConfig,
    onAudioLevel?: (level: number) => void
  ): boolean {
    if (this.isListening) return true;
    this.currentTranscript = '';

    if (!this.recognition) {
      // Re-try initialization just in case window properties loaded late
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.recognition.continuous = !isMobile; // Mobile speech engines freeze if continuous is true!
        this.recognition.interimResults = true;
      }
    }

    if (!this.recognition) {
      setTimeout(() => {
        const isHttpNotLocal = window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        if (isHttpNotLocal) {
          config.onError('Mobile browsers block Microphone/Speech API on HTTP! Please deploy to Vercel (HTTPS) to use Mobile Voice.');
        } else {
          config.onError('Speech Recognition is not supported in this browser. Please use Chrome or Edge.');
        }
      }, 200);
      return false;
    }

    this.recognition.lang = config.language || 'en-IN';

    this.recognition.onresult = (event: any) => {
      let fullTranscript = '';
      let hasFinal = false;

      for (let i = 0; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item && item[0]) {
          fullTranscript += item[0].transcript + ' ';
          if (item.isFinal) {
            hasFinal = true;
          }
        }
      }

      const trimmed = fullTranscript.trim();
      if (trimmed) {
        this.currentTranscript = trimmed;
        config.onResult(trimmed, hasFinal);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      this.stopAudioVisualizer(); // Ensure mic visualizer is stopped
      if (event.error === 'no-speech') {
        // Gracefully end session on no-speech timeout without throwing scary error banner!
        return;
      } else if (event.error === 'network') {
        config.onError('Speech recognition network error. Please check internet connection.');
      } else if (event.error !== 'aborted') {
        config.onError(`Voice recognition error: ${event.error}`);
      }
    };

    this.recognition.onend = () => {
      const textToDeliver = this.currentTranscript;
      this.isListening = false;
      this.stopAudioVisualizer();
      config.onEnd(textToDeliver);
    };

    try {
      this.recognition.start();
      this.isListening = true;
    } catch (err: any) {
      console.warn('Speech recognition start failed, attempting reset:', err);
      try {
        this.recognition.abort();
        setTimeout(() => {
          try {
            this.recognition.start();
            this.isListening = true;
          } catch (retryErr) {
            config.onError('Speech Recognition failed to start. Please check microphone settings.');
          }
        }, 150);
      } catch (e) {
        config.onError(err.message || 'Failed to start speech recognition');
      }
      return false;
    }

    // Start clean simulated visualizer ticker without opening competing getUserMedia stream!
    this.startAudioVisualizer(onAudioLevel);

    return true;
  }

  public stop(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.isListening = false;
    this.stopAudioVisualizer();
  }

  private startAudioVisualizer(onAudioLevel?: (level: number) => void) {
    if (!onAudioLevel) return;

    // Use dynamic simulated level updates while listening to prevent hardware mic locking conflicts
    const updateSimulatedLevel = () => {
      if (!this.isListening) return;
      const randomLevel = Math.floor(Math.random() * 60) + 30; // 30% - 90% dynamic level
      onAudioLevel(randomLevel);
      this.animFrameId = requestAnimationFrame(updateSimulatedLevel);
    };
    updateSimulatedLevel();
  }

  private stopAudioVisualizer() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const speakText = (text: string, lang = 'en-IN') => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const cleanText = text
        .replace(/[*_#•]/g, '')
        .replace(/Rs\./gi, 'Rupees')
        .replace(/₹/g, 'Rupees ');
      
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = lang;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Text to speech failed:', e);
    }
  }
};

export const speechService = new VoiceRecognitionService();
