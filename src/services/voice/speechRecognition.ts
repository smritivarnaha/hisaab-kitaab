// Wrapper for Web Speech API and Web Audio API mono WAV recorder for 100% robust transcription
// Provides real-time microphone volume calculation and fallback settings.

export interface VoiceRecognitionConfig {
  language: string;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: (finalCapturedText: string) => void;
}

// WAV encoding helper functions
function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM) */
  view.setUint16(20, 1, true);
  /* channel count (Mono) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample (16-bit) */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  floatTo16BitPCM(view, 44, samples);

  return new Blob([view], { type: 'audio/wav' });
}

export class VoiceRecognitionService {
  private recognition: any = null;
  public isListening = false;
  private useRawRecording = false;
  private currentTranscript = '';

  // Web Audio WAV recording properties
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private pcmSamples: Float32Array[] = [];
  private totalSampleCount = 0;
  private liveLevelCallback: ((level: number) => void) | null = null;

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

  public async startRecordingRaw(onAudioLevel?: (level: number) => void): Promise<boolean> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.pcmSamples = [];
      this.totalSampleCount = 0;
      this.liveLevelCallback = onAudioLevel || null;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      // Initialize AudioContext at 16000Hz (highly optimized for speech, small files)
      this.audioContext = new AudioContextClass({ sampleRate: 16000 });
      
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.scriptProcessor.onaudioprocess = (event) => {
        if (!this.isListening) return;
        const inputBuffer = event.inputBuffer.getChannelData(0);
        this.pcmSamples.push(new Float32Array(inputBuffer));
        this.totalSampleCount += inputBuffer.length;

        // Calculate actual microphone volume level (RMS)
        let sum = 0;
        for (let i = 0; i < inputBuffer.length; i++) {
          sum += inputBuffer[i] * inputBuffer[i];
        }
        const rms = Math.sqrt(sum / inputBuffer.length);
        // Map typical speech RMS volume ranges to 10% - 100% visually
        const level = Math.min(100, Math.floor(rms * 350) + 10);
        if (this.liveLevelCallback) {
          this.liveLevelCallback(level);
        }
      };

      this.sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);

      this.isListening = true;
      return true;
    } catch (err) {
      console.warn('Failed to start raw WAV audio recording:', err);
      this.cleanupRecording();
      return false;
    }
  }

  public stopRecordingRaw(): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.isListening = false;
      
      if (this.pcmSamples.length === 0) {
        this.cleanupRecording();
        resolve(null);
        return;
      }

      // Merge Float32 PCM sample arrays into a single flat array
      const flatSamples = new Float32Array(this.totalSampleCount);
      let offset = 0;
      for (const chunk of this.pcmSamples) {
        flatSamples.set(chunk, offset);
        offset += chunk.length;
      }

      // Encode the flat PCM array as a standard 16-bit WAV file
      const sampleRate = this.audioContext?.sampleRate || 16000;
      const wavBlob = encodeWAV(flatSamples, sampleRate);

      this.cleanupRecording();
      resolve(wavBlob);
    });
  }

  private cleanupRecording() {
    this.isListening = false;
    this.liveLevelCallback = null;

    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch (e) {}
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        try {
          track.stop();
          track.enabled = false;
        } catch (e) {}
      });
      this.mediaStream = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }
    
    this.pcmSamples = [];
    this.totalSampleCount = 0;
  }

  public async start(
    config: VoiceRecognitionConfig,
    onAudioLevel?: (level: number) => void,
    forceRawRecording = false
  ): Promise<boolean> {
    if (this.isListening) return true;
    this.currentTranscript = '';
    this.pcmSamples = [];
    this.totalSampleCount = 0;

    if (forceRawRecording || !this.recognition) {
      // Use raw recording (e.g. Gemini API key is configured or browser does not support SpeechRecognition)
      this.useRawRecording = true;
      const ok = await this.startRecordingRaw(onAudioLevel);
      if (!ok) {
        if (this.recognition) {
          console.warn('Raw recording failed (mic permission or secure context block), falling back to browser SpeechRecognition');
          this.useRawRecording = false;
        } else {
          config.onError('Microphone permission blocked or unavailable.');
          return false;
        }
      } else {
        return true;
      }
    }

    // Native Speech Recognition mode (used as a fallback)
    this.useRawRecording = false;
    
    if (!this.recognition) {
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
      this.isListening = false;
      if (event.error === 'no-speech') {
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

    // Start clean simulated visualizer ticker for browser-native mode
    if (onAudioLevel) {
      const updateSimulatedLevel = () => {
        if (!this.isListening || this.useRawRecording) return;
        const randomLevel = Math.floor(Math.random() * 60) + 30; // 30% - 90% dynamic level
        onAudioLevel(randomLevel);
        requestAnimationFrame(updateSimulatedLevel);
      };
      updateSimulatedLevel();
    }

    return true;
  }

  public stop(): void {
    this.isListening = false;
    if (this.useRawRecording) {
      this.cleanupRecording();
    } else {
      if (this.recognition) {
        try {
          this.recognition.stop();
        } catch (e) {}
      }
      this.cleanupRecording();
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
