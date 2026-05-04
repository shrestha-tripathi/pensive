// Browser capability probes for on-device audio + ML features.
// Cached after first call so we don't spam adapter requests.

export interface AudioCapabilities {
  mediaRecorder: boolean;     // MediaRecorder constructor exists
  getUserMedia: boolean;      // navigator.mediaDevices.getUserMedia exists
  secureContext: boolean;     // https or localhost (required for getUserMedia)
  supported: boolean;         // all of the above
  reason?: string;            // human-readable reason if unsupported
}

let _audioCache: AudioCapabilities | null = null;
export function getAudioCapabilities(): AudioCapabilities {
  if (_audioCache) return _audioCache;
  const mediaRecorder = typeof window !== 'undefined' && typeof (window as any).MediaRecorder !== 'undefined';
  const getUserMedia = typeof navigator !== 'undefined'
    && !!navigator.mediaDevices
    && typeof navigator.mediaDevices.getUserMedia === 'function';
  const secureContext = typeof window !== 'undefined'
    ? (window.isSecureContext ?? (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'))
    : false;
  const supported = mediaRecorder && getUserMedia && secureContext;
  let reason: string | undefined;
  if (!secureContext) reason = 'Microphone needs HTTPS (or localhost).';
  else if (!getUserMedia) reason = 'Browser does not support microphone access.';
  else if (!mediaRecorder) reason = 'Browser does not support audio recording.';
  _audioCache = { mediaRecorder, getUserMedia, secureContext, supported, reason };
  return _audioCache;
}

// WebGPU probe — actually requests an adapter (navigator.gpu existing is not enough on Windows).
let _webgpuPromise: Promise<boolean> | null = null;
export function probeWebGPU(): Promise<boolean> {
  if (_webgpuPromise) return _webgpuPromise;
  _webgpuPromise = (async () => {
    try {
      const gpu = (navigator as any).gpu;
      if (!gpu || typeof gpu.requestAdapter !== 'function') return false;
      const adapter = await gpu.requestAdapter();
      return !!adapter;
    } catch {
      return false;
    }
  })();
  return _webgpuPromise;
}

// Pick the best available transformers.js device. Always resolves (wasm fallback).
export async function pickDevice(): Promise<'webgpu' | 'wasm'> {
  return (await probeWebGPU()) ? 'webgpu' : 'wasm';
}
