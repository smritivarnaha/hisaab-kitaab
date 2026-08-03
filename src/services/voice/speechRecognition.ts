// Robust voice recording service
// Strategy:
//   - MediaRecorder (primary): Native browser API, works on iOS Safari + Android Chrome.
//     Captures audio in webm/mp4 format — both accepted by OpenAI Whisper.
//   - Web Speech API (fallback): Used when no OpenAI key is configured.

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
  private currentTranscript = '';

  // MediaRecorder recording properties
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private liveLevelCallback: ((level: number) => void) | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelAnimFrame: number | null = null;

  constructor() {
    this.initSpeechRecognition();
  }

  private initSpeechRecognition() {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      // On mobile, continuous=true causes buggy loops.
      // On desktop, continuous=true allows natural pauses while speaking.
      const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      this.recognition.continuous = !isMobile;
      this.recognition.interimResults = true;
    }
  }

  public isSupported(): boolean {
    return !!this.recognition || !!(navigator?.mediaDevices?.getUserMedia);
  }

  // ─── MediaRecorder-based recording (for Whisper) ────────────────────────────
  public async startRecordingRaw(onAudioLevel?: (level: number) => void): Promise<boolean> {
    try {
      this.recordedChunks = [];
      this.liveLevelCallback = onAudioLevel || null;

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      // Pick the best supported MIME type
      const mimeType = this.getSupportedMimeType();

      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType,
        audioBitsPerSecond: 64000
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.start(250); // collect chunks every 250ms
      this.isListening = true;

      // Real audio level visualizer via AnalyserNode
      if (onAudioLevel) {
        this.startLevelMeter(this.mediaStream, onAudioLevel);
      }

      return true;
    } catch (err: any) {
      console.warn('MediaRecorder start failed:', err);
      this.cleanupRecording();
      return false;
    }
  }

  private getSupportedMimeType(): string {
    // Ordered by preference — Whisper accepts all of these
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return ''; // browser picks default
  }

  private startLevelMeter(stream: MediaStream, callback: (level: number) => void) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const data = new Uint8Array(this.analyser.frequencyBinCount);
      const tick = () => {
        if (!this.isListening || !this.analyser) return;
        this.analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const level = Math.min(100, Math.floor((avg / 128) * 100) + 5);
        callback(level);
        this.levelAnimFrame = requestAnimationFrame(tick);
      };
      this.levelAnimFrame = requestAnimationFrame(tick);
    } catch {
      // Level meter is optional — ignore failures
    }
  }

  public stopRecordingRaw(): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.isListening = false;
      this.stopLevelMeter();

      if (!this.mediaRecorder || this.recordedChunks.length === 0) {
        this.cleanupRecording();
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        this.cleanupRecording();
        resolve(blob);
      };

      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      } else {
        const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        this.cleanupRecording();
        resolve(blob);
      }
    });
  }

  private stopLevelMeter() {
    if (this.levelAnimFrame) {
      cancelAnimationFrame(this.levelAnimFrame);
      this.levelAnimFrame = null;
    }
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch {}
      this.analyser = null;
    }
    if (this.audioContext) {
      try { this.audioContext.close(); } catch {}
      this.audioContext = null;
    }
  }

  private cleanupRecording() {
    this.isListening = false;
    this.liveLevelCallback = null;
    this.recordedChunks = [];

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch {}
    }
    this.mediaRecorder = null;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => { try { t.stop(); } catch {} });
      this.mediaStream = null;
    }

    this.stopLevelMeter();
  }

  // ─── Web Speech API (fallback, Gemini-only mode) ────────────────────────────
  public async start(
    config: VoiceRecognitionConfig,
    onAudioLevel?: (level: number) => void,
    _forceRaw = false  // kept for API compat but ignored
  ): Promise<boolean> {
    if (this.isListening) return true;
    this.currentTranscript = '';

    // Ensure fresh recognition object to avoid "already started" errors on mobile
    this.initSpeechRecognition();

    if (!this.recognition) {
      config.onError('Speech recognition not supported. Add an OpenAI key in Settings for voice support.');
      return false;
    }

    this.recognition.lang = config.language || 'en-IN';

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let hasFinal = false;

      // Only iterate new results from resultIndex to avoid duplicates
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript.trim();
        if (event.results[i].isFinal) {
          this.currentTranscript += (this.currentTranscript ? ' ' : '') + transcript;
          hasFinal = true;
        } else {
          interimTranscript = transcript; // interim: just show latest, don't concat
        }
      }

      const display = (this.currentTranscript + (interimTranscript ? ' ' + interimTranscript : '')).trim();
      if (display) config.onResult(display, hasFinal);
    };

    this.recognition.onerror = (event: any) => {
      this.isListening = false;
      if (event.error === 'no-speech') return; // silent — user just didn't speak
      if (event.error === 'aborted') return;    // silent — we stopped it
      config.onError(`Voice error: ${event.error}`);
    };

    this.recognition.onend = () => {
      const text = this.currentTranscript.trim();
      this.isListening = false;
      config.onEnd(text);
    };

    try {
      this.recognition.start();
      this.isListening = true;
    } catch (err: any) {
      console.warn('SpeechRecognition start error:', err);
      config.onError('Could not start microphone. Try refreshing the page.');
      return false;
    }

    // Simulated audio level for native mode (no actual audio analysis needed)
    if (onAudioLevel) {
      const tick = () => {
        if (!this.isListening || this.useRawRecording) return;
        onAudioLevel(Math.floor(Math.random() * 55) + 30);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    return true;
  }

  public stop(): void {
    this.isListening = false;
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
    }
    this.cleanupRecording();
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
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('TTS failed:', e);
    }
  }
};

export const speechService = new VoiceRecognitionService();
