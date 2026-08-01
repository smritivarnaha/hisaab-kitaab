// Wrapper for Web Speech API with fallback simulation and live transcript support

export interface VoiceRecognitionConfig {
  language: string;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

export class VoiceRecognitionService {
  private recognition: any = null;
  private isListening = false;
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

    if (!this.recognition) {
      // Re-try initialization just in case window properties loaded late
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
      }
    }

    if (!this.recognition) {
      setTimeout(() => {
        config.onError('Speech Recognition (Web Speech API) is not supported in this browser. Please use Chrome/Edge or ensure HTTPS connection.');
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
        config.onResult(trimmed, hasFinal);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      this.stopAudioVisualizer(); // Ensure mic is closed on error!
      if (event.error !== 'no-speech') {
        config.onError(event.error);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.stopAudioVisualizer(); // Ensure mic is closed on timeout/end!
      config.onEnd();
    };

    try {
      this.recognition.start();
      this.isListening = true;
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      config.onError(err.message || 'Failed to start speech recognition');
      return false;
    }

    // Start Audio Visualizer analyser if microphone access works
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

  private async startAudioVisualizer(onAudioLevel?: (level: number) => void) {
    if (!onAudioLevel) return;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const checkVolume = () => {
          if (!this.analyser) return;
          this.analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const normalized = Math.min(100, Math.round((average / 128) * 100));
          onAudioLevel(normalized);
          this.animFrameId = requestAnimationFrame(checkVolume);
        };
        checkVolume();
      }
    } catch (e) {
      console.warn('Audio visualization fallback enabled:', e);
    }
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
