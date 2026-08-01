// Wrapper for Web Speech API with fallback simulation and live transcript support

export interface VoiceRecognitionConfig {
  language: string;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: (finalCapturedText: string) => void;
}

export class VoiceRecognitionService {
  private recognition: any = null;
  public isListening = false;
  private useRawRecording = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
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

  public async startRecordingRaw(): Promise<boolean> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
          if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
          } else {
            mimeType = '';
          }
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      this.mediaRecorder = new MediaRecorder(this.mediaStream, options);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
      this.isListening = true;
      return true;
    } catch (err) {
      console.warn('Failed to start raw audio recording:', err);
      return false;
    }
  }

  public stopRecordingRaw(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mime = this.mediaRecorder?.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mime });
        this.stopAudioVisualizer();
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
      this.isListening = false;
    });
  }

  public async start(
    config: VoiceRecognitionConfig,
    onAudioLevel?: (level: number) => void,
    forceRawRecording = false
  ): Promise<boolean> {
    if (this.isListening) return true;
    this.currentTranscript = '';
    this.audioChunks = [];

    if (forceRawRecording || !this.recognition) {
      // If native SpeechRecognition is missing (e.g. Firefox/Brave) or forced (Gemini API key is active), we run raw audio recording!
      this.useRawRecording = true;
      const ok = await this.startRecordingRaw();
      if (!ok) {
        if (this.recognition) {
          console.warn('Raw recording failed (likely HTTP block on mobile), falling back to native SpeechRecognition');
          this.useRawRecording = false;
        } else {
          config.onError('Microphone permission blocked or unavailable.');
          return false;
        }
      } else {
        this.startAudioVisualizer(onAudioLevel);
        return true;
      }
    }

    // Native Speech Recognition exists -> Use it exclusively (no concurrent MediaRecorder to prevent mic lock conflicts)
    this.useRawRecording = false;
    
    if (!this.recognition) {
      // Re-try initialization just in case window properties loaded late
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.recognition.continuous = !isMobile;
        this.recognition.interimResults = true;
      }
    }

    if (!this.recognition) {
      config.onError('Speech Recognition not supported on this browser.');
      return false;
    }

    this.recognition.lang = config.language || 'en-IN';
    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let hasFinal = false;

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          this.currentTranscript += (this.currentTranscript ? ' ' : '') + transcript.trim();
          hasFinal = true;
        } else {
          interimTranscript += (interimTranscript ? ' ' : '') + transcript.trim();
        }
      }

      const displayTranscript = (this.currentTranscript + (interimTranscript ? ' ' + interimTranscript : '')).trim();
      if (displayTranscript) {
        config.onResult(displayTranscript, hasFinal);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      this.stopAudioVisualizer(); // Ensure mic visualizer is stopped
      if (event.error === 'no-speech') {
        // Gracefully end session on no-speech timeout
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
    if (this.useRawRecording) {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        try {
          this.mediaRecorder.stop();
        } catch (e) {}
      }
    } else {
      if (this.recognition && this.isListening) {
        try {
          this.recognition.stop();
        } catch (e) {}
      }
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
