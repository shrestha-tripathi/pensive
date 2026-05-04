import { useCallback, useRef, useState } from 'react';

export type TranscriberStatus = 'idle' | 'loading' | 'ready' | 'recording' | 'transcribing' | 'error';

interface State {
  status: TranscriberStatus;
  progress: number;
  message: string;
  error?: string;
}

export interface TranscriberSettings {
  model: string; // e.g. 'Xenova/whisper-tiny.en'
  language: string;
}

export function useTranscriber(settings: TranscriberSettings) {
  const [state, setState] = useState<State>({ status: 'idle', progress: 0, message: '' });
  const pipelineRef = useRef<any>(null);
  const loadedModelRef = useRef<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const ensurePipeline = useCallback(async () => {
    if (pipelineRef.current && loadedModelRef.current === settings.model) return pipelineRef.current;
    setState({ status: 'loading', progress: 0, message: 'Loading model…' });
    const tf = await import('@huggingface/transformers');
    tf.env.allowRemoteModels = true;
    tf.env.allowLocalModels = false;
    const { pickDevice } = await import('../lib/capabilities');
    const device = await pickDevice();
    const progress_callback = (p: any) => {
      if (p?.status === 'progress') {
        const pct = Math.round(p.progress ?? 0);
        setState({ status: 'loading', progress: pct, message: `Loading model ${pct}%` });
      } else if (p?.status === 'ready') {
        setState({ status: 'ready', progress: 100, message: 'Model ready' });
      }
    };
    let pl: any;
    try {
      pl = await tf.pipeline('automatic-speech-recognition', settings.model, { device, progress_callback } as any);
    } catch (e) {
      if (device === 'webgpu') {
        console.warn('[transcriber] WebGPU init failed, falling back to wasm', e);
        pl = await tf.pipeline('automatic-speech-recognition', settings.model, { device: 'wasm', progress_callback } as any);
      } else {
        throw e;
      }
    }
    pipelineRef.current = pl;
    loadedModelRef.current = settings.model;
    setState({ status: 'ready', progress: 100, message: 'Model ready' });
    return pl;
  }, [settings.model]);

  const startRecording = useCallback(async () => {
    // Acquire mic FIRST; only flip to 'recording' on success so a denied permission
    // doesn't strand the UI in a recording state forever.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start();
      mediaRef.current = mr;
      setState({ status: 'recording', progress: 0, message: 'Recording…' });
    } catch (e: any) {
      const msg = e?.name === 'NotAllowedError' ? 'Microphone permission denied'
        : e?.name === 'NotFoundError' ? 'No microphone found on this device'
        : (e?.message ?? String(e));
      setState({ status: 'error', progress: 0, message: '', error: msg });
      throw new Error(msg);
    }
  }, []);

  const stopAndTranscribe = useCallback(async (): Promise<string> => {
    const mr = mediaRef.current;
    if (!mr) return '';
    const blob: Blob = await new Promise(resolve => {
      mr.onstop = () => resolve(new Blob(chunksRef.current, { type: 'audio/webm' }));
      mr.stop();
    });
    streamRef.current?.getTracks().forEach(t => t.stop());

    setState({ status: 'transcribing', progress: 0, message: 'Transcribing…' });
    try {
      const pl = await ensurePipeline();
      setState({ status: 'transcribing', progress: 50, message: 'Transcribing…' });
      const arrayBuf = await blob.arrayBuffer();
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
      // mono mix
      let mono: Float32Array;
      if (decoded.numberOfChannels > 1) {
        const l = decoded.getChannelData(0);
        const r = decoded.getChannelData(1);
        mono = new Float32Array(l.length);
        for (let i = 0; i < l.length; i++) mono[i] = (l[i] + r[i]) / 2;
      } else {
        mono = decoded.getChannelData(0);
      }
      // resample to 16k if needed
      let audio = mono;
      if (decoded.sampleRate !== 16000) {
        const ratio = decoded.sampleRate / 16000;
        const len = Math.floor(mono.length / ratio);
        const out = new Float32Array(len);
        for (let i = 0; i < len; i++) out[i] = mono[Math.floor(i * ratio)];
        audio = out;
      }
      ctx.close();
      const result: any = await pl(audio, { language: 'english', task: 'transcribe', return_timestamps: false });
      const text = (result?.text ?? '').trim();
      setState({ status: 'idle', progress: 100, message: '' });
      return text;
    } catch (e: any) {
      setState({ status: 'error', progress: 0, message: '', error: e?.message ?? String(e) });
      return '';
    }
  }, [ensurePipeline]);

  const cancel = useCallback(() => {
    try { mediaRef.current?.stop(); } catch {}
    streamRef.current?.getTracks().forEach(t => t.stop());
    setState({ status: 'idle', progress: 0, message: '' });
  }, []);

  return { state, startRecording, stopAndTranscribe, cancel };
}
