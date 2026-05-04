// Meeting Mode: long-form recording with chunked Whisper transcription.
// Uses the same @huggingface/transformers Whisper pipeline as useTranscriber,
// but loads it lazily here to avoid circular deps.

import { useCallback, useRef, useState } from 'react';

export type MeetingStatus = 'idle' | 'starting' | 'recording' | 'finishing' | 'error';

interface MeetingState {
  status: MeetingStatus;
  transcript: string;
  chunkCount: number;
  error?: string;
}

const CHUNK_MS = 30000;

// Decode arbitrary container blob → mono Float32Array @ 16kHz for Whisper.
async function blobToAudio(blob: Blob): Promise<Float32Array | null> {
  try {
    const buf = await blob.arrayBuffer();
    if (!buf.byteLength) return null;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const decoded = await ctx.decodeAudioData(buf.slice(0));
    let mono: Float32Array;
    if (decoded.numberOfChannels > 1) {
      const l = decoded.getChannelData(0);
      const r = decoded.getChannelData(1);
      mono = new Float32Array(l.length);
      for (let i = 0; i < l.length; i++) mono[i] = (l[i] + r[i]) / 2;
    } else {
      mono = decoded.getChannelData(0);
    }
    let audio = mono;
    if (decoded.sampleRate !== 16000) {
      const ratio = decoded.sampleRate / 16000;
      const len = Math.floor(mono.length / ratio);
      const out = new Float32Array(len);
      for (let i = 0; i < len; i++) out[i] = mono[Math.floor(i * ratio)];
      audio = out;
    }
    ctx.close();
    return audio;
  } catch (e) {
    console.warn('[meeting] decode chunk failed', e);
    return null;
  }
}

let pipelinePromise: Promise<any> | null = null;
async function getPipeline(model: string) {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const tf = await import('@huggingface/transformers');
      tf.env.allowRemoteModels = true;
      tf.env.allowLocalModels = false;
      const { pickDevice } = await import('../lib/capabilities');
      const device = await pickDevice();
      try {
        return await tf.pipeline('automatic-speech-recognition', model, { device } as any);
      } catch (e) {
        if (device === 'webgpu') {
          console.warn('[meeting] WebGPU init failed, falling back to wasm', e);
          return tf.pipeline('automatic-speech-recognition', model, { device: 'wasm' } as any);
        }
        throw e;
      }
    })();
  }
  return pipelinePromise;
}

export function useMeetingRecorder(model: string, onChunk?: (text: string) => void) {
  const [state, setState] = useState<MeetingState>({ status: 'idle', transcript: '', chunkCount: 0 });
  const mrRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef('');
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const transcribeChunk = useCallback(async (blob: Blob) => {
    const audio = await blobToAudio(blob);
    if (!audio || audio.length < 1600) return; // <0.1s
    try {
      const pl = await getPipeline(model);
      const result: any = await pl(audio, { language: 'english', task: 'transcribe', return_timestamps: false });
      const text = (result?.text ?? '').trim();
      if (text) {
        transcriptRef.current = (transcriptRef.current + ' ' + text).trim();
        setState(s => ({ ...s, transcript: transcriptRef.current, chunkCount: s.chunkCount + 1 }));
        onChunk?.(text);
      }
    } catch (e) {
      console.warn('[meeting] transcribe chunk failed', e);
    }
  }, [model, onChunk]);

  const start = useCallback(async () => {
    if (mrRef.current) return;
    setState({ status: 'starting', transcript: '', chunkCount: 0 });
    transcriptRef.current = '';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      // Buffer raw chunks until each ~30s window, then concat & transcribe.
      let bufBlobs: Blob[] = [];
      let lastFlush = Date.now();
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) bufBlobs.push(e.data);
        if (Date.now() - lastFlush >= CHUNK_MS - 500) {
          const flush = new Blob(bufBlobs, { type: bufBlobs[0]?.type || 'audio/webm' });
          bufBlobs = [];
          lastFlush = Date.now();
          // Serialize chunk transcription so model isn't called concurrently.
          queueRef.current = queueRef.current.then(() => transcribeChunk(flush));
        }
      };
      mr.onstop = async () => {
        if (bufBlobs.length) {
          const flush = new Blob(bufBlobs, { type: bufBlobs[0]?.type || 'audio/webm' });
          queueRef.current = queueRef.current.then(() => transcribeChunk(flush));
        }
      };
      mr.start(2000); // emit dataavailable every 2s; we batch into 30s windows
      mrRef.current = mr;
      setState(s => ({ ...s, status: 'recording' }));
    } catch (e: any) {
      const msg = e?.name === 'NotAllowedError' ? 'Microphone permission denied'
        : e?.name === 'NotFoundError' ? 'No microphone found on this device'
        : (e?.message ?? String(e));
      setState({ status: 'error', transcript: '', chunkCount: 0, error: msg });
      throw new Error(msg);
    }
  }, [transcribeChunk]);

  const stop = useCallback(async (): Promise<string> => {
    const mr = mrRef.current;
    if (!mr) return transcriptRef.current;
    setState(s => ({ ...s, status: 'finishing' }));
    await new Promise<void>((resolve) => { mr.onstop = () => resolve(); mr.stop(); });
    streamRef.current?.getTracks().forEach(t => t.stop());
    mrRef.current = null;
    streamRef.current = null;
    // Wait for any pending chunk transcriptions to finish.
    await queueRef.current;
    setState(s => ({ ...s, status: 'idle' }));
    return transcriptRef.current;
  }, []);

  const cancel = useCallback(() => {
    try { mrRef.current?.stop(); } catch {}
    streamRef.current?.getTracks().forEach(t => t.stop());
    mrRef.current = null;
    streamRef.current = null;
    setState({ status: 'idle', transcript: '', chunkCount: 0 });
  }, []);

  return { state, start, stop, cancel };
}
