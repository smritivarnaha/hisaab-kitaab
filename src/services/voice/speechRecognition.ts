// Unified Real-Time Speech-to-Words Service for Funds Logger
// Priority 1: Native Android OS SpeechRecognizer bridge (`window.AndroidSpeech` in APK v2.0+)
// Priority 2: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) with Android duplicate-word deduplication
// Priority 3: Raw MediaRecorder fallback (only when explicitly requested with a verified cloud key)

declare global {
  interface Window {
    AndroidSpeech?: {
      isAvailable: () => boolean;
      startListening: (lang: string) => void;
      stopListening: () => void;
      cancel: () => void;
    };
  }
}

export interface VoiceRecognitionConfig {
  language: string;
  /** If true, keeps accumulating spoken words across natural pauses until stop() is called */
  keepAliveAcrossPauses?: boolean;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: (finalCapturedText: string) => void;
}

/**
 * Converts spoken Hinglish / Indian English number words into clean digits while preserving all surrounding words.
 * Examples:
 *  "Dr Prince se terah hazaar aaye" -> "Dr Prince se 13000 aaye"
 *  "Petrol do hazaar do sau" -> "Petrol 2200"
 *  "Chai pachaas rupaye" -> "Chai 50 rupaye"
 */
export function normalizeSpokenWordsAndNumbers(raw: string): string {
  if (!raw) return '';
  let s = raw.trim();

  // 0. Normalize Devanagari digits (०-९) to standard ASCII digits (0-9) and common Hindi number words
  const devanagariDigits = '०१२३४५६७८९';
  s = s.replace(/[०-९]/g, ch => String(devanagariDigits.indexOf(ch)));
  const hindiWordReplacements: Array<[RegExp, string]> = [
    [/हज़ार|हजार/g, 'hazaar'],
    [/सौ/g, 'sau'],
    [/लाख/g, 'lakh'],
    [/डेढ़/g, 'dedh'],
    [/ढाई/g, 'dhai'],
    [/रुपये|रुपए|रुपया/g, 'rupaye'],
    [/(^|\s)एक(?=\s|$)/g, '$1ek'],
    [/(^|\s)दो(?=\s|$)/g, '$1do'],
    [/(^|\s)तीन(?=\s|$)/g, '$1teen'],
    [/(^|\s)चार(?=\s|$)/g, '$1chaar'],
    [/(^|\s)(पांच|पाँच)(?=\s|$)/g, '$1paanch'],
    [/(^|\s)छह(?=\s|$)/g, '$1chhah'],
    [/(^|\s)सात(?=\s|$)/g, '$1saat'],
    [/(^|\s)आठ(?=\s|$)/g, '$1aath'],
    [/(^|\s)नौ(?=\s|$)/g, '$1nau'],
    [/(^|\s)दस(?=\s|$)/g, '$1das'],
    [/(^|\s)ग्यारह(?=\s|$)/g, '$1gyarah'],
    [/(^|\s)बारह(?=\s|$)/g, '$1barah'],
    [/(^|\s)तेरह(?=\s|$)/g, '$1terah'],
    [/(^|\s)पंद्रह(?=\s|$)/g, '$1pandrah'],
    [/(^|\s)बीस(?=\s|$)/g, '$1bees'],
    [/(^|\s)पच्चीस(?=\s|$)/g, '$1pachees'],
    [/(^|\s)तीस(?=\s|$)/g, '$1tees'],
    [/(^|\s)चालीस(?=\s|$)/g, '$1chalees'],
    [/(^|\s)पचास(?=\s|$)/g, '$1pachaas'],
    [/(^|\s)साठ(?=\s|$)/g, '$1saath'],
    [/(^|\s)सत्तर(?=\s|$)/g, '$1sattar'],
    [/(^|\s)अस्सी(?=\s|$)/g, '$1assi'],
    [/(^|\s)नब्बे(?=\s|$)/g, '$1nabbe']
  ];
  for (const [pattern, rep] of hindiWordReplacements) {
    s = s.replace(pattern, rep);
  }
  // Remove Indian comma formatting inside spoken digit strings like "13,000" or "1,50,000" -> "13000" / "150000"
  s = s.replace(/(\d),(?=\d)/g, '$1');

  const unitMap: Record<string, number> = {
    ek: 1, one: 1,
    do: 2, two: 2,
    teen: 3, three: 3,
    chaar: 4, char: 4, four: 4,
    paanch: 5, panch: 5, five: 5,
    chhah: 6, cheh: 6, che: 6, six: 6,
    saat: 7, seven: 7,
    aath: 8, eight: 8,
    nau: 9, nine: 9,
    das: 10, ten: 10,
    gyarah: 11, barah: 12, terah: 13, chaudah: 14, pandrah: 15,
    solah: 16, satrah: 17, atharah: 18, unnis: 19,
    bees: 20, pachees: 25, pachis: 25, tees: 30, paintees: 35, paintis: 35, paitis: 35,
    chalees: 40, chalis: 40, pachaas: 50, pachas: 50,
    saath: 60, sattar: 70, assi: 80, nabbe: 90
  };

  // Handle compound Hindi phrases like "do hazaar do sau" -> 2200
  const compoundRegex = new RegExp(
    `\\b(${Object.keys(unitMap).join('|')}|\\d+)\\s+(hazaar|hazar|thousand)\\s+(${Object.keys(unitMap).join('|')}|\\d+)\\s+(sau|hundred)\\b`,
    'gi'
  );
  s = s.replace(compoundRegex, (_, th: string, _m1: string, hu: string) => {
    const thVal = unitMap[th.toLowerCase()] ?? parseInt(th, 10);
    const huVal = unitMap[hu.toLowerCase()] ?? parseInt(hu, 10);
    if (!isNaN(thVal) && !isNaN(huVal)) {
      return String(thVal * 1000 + huVal * 100);
    }
    return _;
  });

  // Handle "dedh" (1.5x) and "dhai" (2.5x)
  s = s.replace(/\bdedh\s+(hazaar|hazar|thousand)\b/gi, '1500');
  s = s.replace(/\bdhai\s+(hazaar|hazar|thousand)\b/gi, '2500');
  s = s.replace(/\bsaadhe\s+teen\s+(hazaar|hazar|thousand)\b/gi, '3500');
  s = s.replace(/\bdedh\s+(lakh|lac|lakhs)\b/gi, '150000');
  s = s.replace(/\bdhai\s+(lakh|lac|lakhs)\b/gi, '250000');
  s = s.replace(/\bdedh\s+(sau|hundred)\b/gi, '150');
  s = s.replace(/\bdhai\s+(sau|hundred)\b/gi, '250');

  // Handle "<word> lakh / hazaar / thousand / sau / hundred"
  const wordMultRegex = new RegExp(
    `\\b(${Object.keys(unitMap).join('|')})\\s+(lakh|lac|lakhs|hazaar|hazar|thousand|sau|hundred)\\b`,
    'gi'
  );
  s = s.replace(wordMultRegex, (_, w: string, mult: string) => {
    const base = unitMap[w.toLowerCase()] || 1;
    const m = mult.toLowerCase();
    if (m.startsWith('lak') || m === 'lac') return String(base * 100000);
    if (m.startsWith('haz') || m === 'thousand') return String(base * 1000);
    return String(base * 100);
  });

  // Handle "<digits> lakh / hazaar / thousand / sau / hundred"
  s = s.replace(/(\d+(?:\.\d+)?)\s*(lakh|lac|lakhs)\b/gi, (_, n) => String(Math.round(parseFloat(n) * 100000)));
  s = s.replace(/(\d+(?:\.\d+)?)\s*(hazaar|hazar|thousand)\b/gi, (_, n) => String(Math.round(parseFloat(n) * 1000)));
  s = s.replace(/(\d+(?:\.\d+)?)\s*(sau|hundred)\b/gi, (_, n) => String(Math.round(parseFloat(n) * 100)));

  // Standalone Hindi number words when followed by currency/item context (e.g. "chai pachaas rupaye")
  const standaloneCurrencyRegex = new RegExp(
    `\\b(${Object.keys(unitMap).join('|')})\\s+(rupaye|rupees|rs|rupee)\\b`,
    'gi'
  );
  s = s.replace(standaloneCurrencyRegex, (_, w: string, cur: string) => {
    const val = unitMap[w.toLowerCase()];
    return val ? `${val} ${cur}` : _;
  });

  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Fixes Android Chrome's cumulative Web Speech result duplication bug
 * where event.results contains ["Petrol", "Petrol 2200"] instead of disjoint segments.
 */
export function stitchWebSpeechResults(results: SpeechRecognitionResultList | any): {
  finalSegment: string;
  interimSegment: string;
  combined: string;
} {
  const finals: string[] = [];
  let interim = '';

  for (let i = 0; i < results.length; i++) {
    const piece = String(results[i]?.[0]?.transcript || '').trim();
    if (!piece) continue;

    if (results[i].isFinal) {
      if (finals.length > 0) {
        const prev = finals[finals.length - 1];
        const prevLower = prev.toLowerCase();
        const pieceLower = piece.toLowerCase();
        // Android Chrome cumulative prefix check
        if (pieceLower.startsWith(prevLower)) {
          finals[finals.length - 1] = piece;
          continue;
        }
        if (prevLower.startsWith(pieceLower)) {
          continue;
        }
      }
      finals.push(piece);
    } else {
      interim = piece;
    }
  }

  const finalJoined = finals.join(' ').replace(/\s+/g, ' ').trim();

  // Also check if interim already repeats finalJoined prefix on Android Chrome
  if (finalJoined && interim) {
    const fLower = finalJoined.toLowerCase();
    const iLower = interim.toLowerCase();
    if (iLower.startsWith(fLower)) {
      return {
        finalSegment: finalJoined,
        interimSegment: interim.slice(finalJoined.length).trim(),
        combined: interim
      };
    }
  }

  const combined = [finalJoined, interim].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return { finalSegment: finalJoined, interimSegment: interim, combined };
}

/**
 * Appends new speech to previously committed speech without duplicating overlapping boundary words.
 */
export function mergeCommittedAndCurrentSpeech(committed: string, current: string): string {
  const a = committed.trim();
  const b = current.trim();
  if (!a) return b;
  if (!b) return a;
  if (b.toLowerCase().startsWith(a.toLowerCase())) return b;
  return `${a} ${b}`.replace(/\s+/g, ' ').trim();
}

export class VoiceRecognitionService {
  private recognition: any = null;
  public isListening = false;
  private manualStopRequested = false;
  private committedTranscript = '';
  private latestCycleTranscript = '';
  private nativeEventListener: ((e: Event) => void) | null = null;

  // Optional raw MediaRecorder fallback properties
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelAnimFrame: number | null = null;

  public hasNativeAndroidSpeech(): boolean {
    try {
      return typeof window !== 'undefined' && Boolean(window.AndroidSpeech && window.AndroidSpeech.isAvailable());
    } catch {
      return false;
    }
  }

  public hasWebSpeech(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public isSupported(): boolean {
    return this.hasNativeAndroidSpeech() || this.hasWebSpeech() || Boolean(navigator?.mediaDevices?.getUserMedia);
  }

  // ─── Primary Real-Time Speech-to-Words (Native Android OR Web Speech) ───────
  public async start(
    config: VoiceRecognitionConfig,
    onAudioLevel?: (level: number) => void
  ): Promise<boolean> {
    this.stop();

    this.manualStopRequested = false;
    this.committedTranscript = '';
    this.latestCycleTranscript = '';
    const lang = config.language === 'hi-IN' ? 'hi-IN' : 'en-IN';

    // 1. NATIVE ANDROID SPEECH RECOGNIZER (100% reliable inside Android APK!)
    if (this.hasNativeAndroidSpeech()) {
      this.isListening = true;

      const startNativeCycle = () => {
        if (!this.isListening || this.manualStopRequested) return;
        try {
          window.AndroidSpeech?.startListening(lang);
        } catch (err: any) {
          this.isListening = false;
          config.onError(err?.message || 'Could not start Android microphone');
        }
      };

      this.nativeEventListener = (evt: Event) => {
        const detail = (evt as CustomEvent)?.detail || {};
        const type = detail.type;
        const rawText = String(detail.text || '').trim();

        if (type === 'rms' && onAudioLevel) {
          onAudioLevel(Number(detail.level || 15));
          return;
        }

        if (type === 'partial' && rawText) {
          this.latestCycleTranscript = rawText;
          const fullRaw = mergeCommittedAndCurrentSpeech(this.committedTranscript, rawText);
          const normalized = normalizeSpokenWordsAndNumbers(fullRaw);
          config.onResult(normalized, false);
          return;
        }

        if (type === 'final') {
          if (rawText) {
            this.committedTranscript = mergeCommittedAndCurrentSpeech(this.committedTranscript, rawText);
            this.latestCycleTranscript = '';
            const normalized = normalizeSpokenWordsAndNumbers(this.committedTranscript);
            config.onResult(normalized, true);
          }

          if (config.keepAliveAcrossPauses && !this.manualStopRequested && this.isListening) {
            setTimeout(startNativeCycle, 120);
          } else {
            this.isListening = false;
            this.detachNativeListener();
            const finalOut = normalizeSpokenWordsAndNumbers(this.committedTranscript);
            config.onEnd(finalOut);
          }
          return;
        }

        if (type === 'end') {
          if (this.latestCycleTranscript) {
            this.committedTranscript = mergeCommittedAndCurrentSpeech(this.committedTranscript, this.latestCycleTranscript);
            this.latestCycleTranscript = '';
          }
          if (config.keepAliveAcrossPauses && !this.manualStopRequested && this.isListening) {
            setTimeout(startNativeCycle, 160);
          } else {
            this.isListening = false;
            this.detachNativeListener();
            const finalOut = normalizeSpokenWordsAndNumbers(this.committedTranscript);
            config.onEnd(finalOut);
          }
          return;
        }

        if (type === 'error') {
          this.isListening = false;
          this.detachNativeListener();
          config.onError(rawText || 'Microphone error');
        }
      };

      window.addEventListener('nativeSpeechEvent', this.nativeEventListener);
      startNativeCycle();
      return true;
    }

    // 2. WEB SPEECH API (Chrome / Edge / Safari — NO competing getUserMedia stream!)
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      config.onError('Live speech transcription is not supported in this browser. Use Chrome or the latest Android App.');
      return false;
    }

    this.isListening = true;
    const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    const launchWebCycle = () => {
      if (!this.isListening || this.manualStopRequested) return;

      try {
        const rec = new SpeechRecognition();
        this.recognition = rec;
        rec.lang = lang;
        // On mobile Chrome, continuous=false + fast cycle stitching prevents Chromium's duplicated word bug!
        rec.continuous = !isMobile;
        rec.interimResults = true;
        rec.maxAlternatives = 1;

        rec.onresult = (event: any) => {
          if (!this.isListening) return;
          const { finalSegment, combined } = stitchWebSpeechResults(event.results);
          this.latestCycleTranscript = combined;

          const mergedPreview = mergeCommittedAndCurrentSpeech(this.committedTranscript, combined);
          const normalized = normalizeSpokenWordsAndNumbers(mergedPreview);

          if (onAudioLevel) {
            onAudioLevel(45 + Math.floor(Math.random() * 45));
          }
          if (normalized) {
            config.onResult(normalized, Boolean(finalSegment && finalSegment === combined));
          }
        };

        rec.onerror = (event: any) => {
          const code = String(event?.error || '');
          if (code === 'no-speech' || code === 'aborted') {
            return;
          }
          this.isListening = false;
          if (code === 'not-allowed' || code === 'service-not-allowed') {
            const isApkWithoutBridge =
              typeof navigator !== 'undefined' &&
              /; wv\)|Version\/\d+\.\d+\s+Chrome\//i.test(navigator.userAgent) &&
              !this.hasNativeAndroidSpeech();
            config.onError(
              isApkWithoutBridge
                ? 'Please install the updated Android APK (v2.0) in Settings → Security to enable native Android voice typing, or allow Mic permission.'
                : 'Microphone permission blocked. Please allow microphone access.'
            );
          } else {
            config.onError(`Voice error (${code}). Please speak clearly and check connection.`);
          }
        };

        rec.onend = () => {
          if (this.latestCycleTranscript) {
            this.committedTranscript = mergeCommittedAndCurrentSpeech(
              this.committedTranscript,
              this.latestCycleTranscript
            );
            this.latestCycleTranscript = '';
          }

          if (config.keepAliveAcrossPauses && !this.manualStopRequested && this.isListening) {
            setTimeout(launchWebCycle, 120);
            return;
          }

          this.isListening = false;
          if (onAudioLevel) onAudioLevel(0);
          const finalNormalized = normalizeSpokenWordsAndNumbers(this.committedTranscript);
          config.onEnd(finalNormalized);
        };

        rec.start();
      } catch (err: any) {
        this.isListening = false;
        config.onError('Could not start microphone. Please try again.');
      }
    };

    launchWebCycle();
    return true;
  }

  private detachNativeListener() {
    if (this.nativeEventListener && typeof window !== 'undefined') {
      window.removeEventListener('nativeSpeechEvent', this.nativeEventListener);
      this.nativeEventListener = null;
    }
  }

  public getCurrentAccumulatedText(): string {
    const raw = mergeCommittedAndCurrentSpeech(this.committedTranscript, this.latestCycleTranscript);
    return normalizeSpokenWordsAndNumbers(raw);
  }

  public stop(): void {
    this.manualStopRequested = true;
    this.isListening = false;

    if (this.hasNativeAndroidSpeech()) {
      try {
        window.AndroidSpeech?.stopListening();
      } catch {}
    }
    this.detachNativeListener();

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }
    this.cleanupRecording();
  }

  // ─── Raw Audio Recorder (kept only as explicit fallback) ────────────────────
  public async startRecordingRaw(onAudioLevel?: (level: number) => void): Promise<boolean> {
    try {
      this.recordedChunks = [];
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.mediaStream, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : undefined);
      this.mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
      };
      this.mediaRecorder.start(250);
      this.isListening = true;

      if (onAudioLevel) {
        this.startLevelMeter(this.mediaStream, onAudioLevel);
      }
      return true;
    } catch {
      this.cleanupRecording();
      return false;
    }
  }

  private getSupportedMimeType(): string {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
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
        callback(Math.min(100, Math.floor((avg / 128) * 100) + 5));
        this.levelAnimFrame = requestAnimationFrame(tick);
      };
      this.levelAnimFrame = requestAnimationFrame(tick);
    } catch {}
  }

  public stopRecordingRaw(): Promise<Blob | null> {
    return new Promise(resolve => {
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
      try {
        this.analyser.disconnect();
      } catch {}
      this.analyser = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
  }

  private cleanupRecording() {
    this.recordedChunks = [];
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.mediaRecorder = null;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => {
        try {
          t.stop();
        } catch {}
      });
      this.mediaStream = null;
    }
    this.stopLevelMeter();
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
