/**
 * Real-Time Bidirectional PCM Audio Engine for Gemini 3.8 Live API
 * - Captures microphone audio -> downsamples to 16kHz 16-bit Little-Endian Mono PCM -> Base64 chunks
 * - Plays back 24kHz 16-bit Little-Endian Mono PCM Base64 chunks gaplessly
 * - Supports 0ms instant barge-in queue flush on `interrupted: true`
 */

function floatTo16BitPCM(float32Array: Float32Array): Int16Array {
  const int16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

function downsampleFloat32(buffer: Float32Array, inputSampleRate: number, targetSampleRate: number): Float32Array {
  if (inputSampleRate === targetSampleRate) return buffer;
  const sampleRateRatio = inputSampleRate / targetSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}

function base64ToInt16Array(base64: string): Int16Array {
  const binary = atob(base64);
  const byteLength = binary.length - (binary.length % 2);
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

export class PcmMicrophoneStreamer {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private muted = false;

  public async start(
    onPcm16kBase64: (base64Chunk: string) => void,
    onLevel?: (rmsLevel: number) => void
  ): Promise<void> {
    this.stop();

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.audioCtx = new AudioCtx({ sampleRate: 16000 });
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    const actualSampleRate = this.audioCtx.sampleRate || 16000;
    this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);

    // 2048 frames @ 16kHz = ~128ms ultra-low latency streaming packets
    this.processorNode = this.audioCtx.createScriptProcessor(2048, 1, 1);
    this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
      if (this.muted) {
        onLevel?.(0);
        return;
      }
      const inputData = event.inputBuffer.getChannelData(0);

      // Compute RMS level (0..100) for Driving Orb visualization
      let sumSquares = 0;
      for (let i = 0; i < inputData.length; i++) {
        sumSquares += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sumSquares / inputData.length);
      const normalizedLevel = Math.min(100, Math.round(rms * 380));
      onLevel?.(normalizedLevel);

      const resampled = downsampleFloat32(inputData, actualSampleRate, 16000);
      const pcm16 = floatTo16BitPCM(resampled);
      const base64 = uint8ToBase64(new Uint8Array(pcm16.buffer));
      onPcm16kBase64(base64);
    };

    // Route through zero-gain sink so ScriptProcessorNode stays active on mobile WebKit/Blink without speaker feedback
    const silentGain = this.audioCtx.createGain();
    silentGain.gain.value = 0;

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(silentGain);
    silentGain.connect(this.audioCtx.destination);
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public stop() {
    if (this.processorNode) {
      try {
        this.processorNode.onaudioprocess = null;
        this.processorNode.disconnect();
      } catch {}
      this.processorNode = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {}
      });
      this.stream = null;
    }
  }
}

export class Pcm24kAudioPlayer {
  private audioCtx: AudioContext | null = null;
  private nextStartTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private onSpeakingChange?: (speaking: boolean, level: number) => void;

  constructor(onSpeakingChange?: (speaking: boolean, level: number) => void) {
    this.onSpeakingChange = onSpeakingChange;
  }

  private ensureContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx({ sampleRate: 24000 });
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public enqueuePcm24kBase64(base64Audio: string) {
    if (!base64Audio) return;
    try {
      const ctx = this.ensureContext();
      const int16 = base64ToInt16Array(base64Audio);
      if (int16.length === 0) return;

      const float32 = new Float32Array(int16.length);
      let sumSquares = 0;
      for (let i = 0; i < int16.length; i++) {
        const f = int16[i] / 32768.0;
        float32[i] = f;
        sumSquares += f * f;
      }
      const rms = Math.sqrt(sumSquares / int16.length);
      const level = Math.min(100, Math.round(rms * 320) + 15);

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      if (this.nextStartTime < now) {
        this.nextStartTime = now + 0.015;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;

      this.activeSources.add(source);
      this.onSpeakingChange?.(true, level);

      source.onended = () => {
        this.activeSources.delete(source);
        if (this.activeSources.size === 0) {
          this.onSpeakingChange?.(false, 0);
        }
      };
    } catch (err) {
      console.warn('PCM playback error:', err);
    }
  }

  /**
   * Immediately flushes all queued audio buffers on user barge-in (`interrupted: true`)
   */
  public interrupt() {
    this.activeSources.forEach(src => {
      try {
        src.onended = null;
        src.stop();
        src.disconnect();
      } catch {}
    });
    this.activeSources.clear();
    if (this.audioCtx) {
      this.nextStartTime = this.audioCtx.currentTime;
    }
    this.onSpeakingChange?.(false, 0);
  }

  public destroy() {
    this.interrupt();
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
  }
}
