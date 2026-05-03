import { Mic, Square, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TranscriberStatus } from '../hooks/useTranscriber';

interface Props {
  status: TranscriberStatus;
  message: string;
  progress: number;
  onStart: () => void;
  onStop: () => void;
}

export function MicButton({ status, message, progress, onStart, onStop }: Props) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (status !== 'recording') { setSeconds(0); return; }
    setSeconds(0);
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const recording = status === 'recording';
  const busy = status === 'loading' || status === 'transcribing';

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={recording ? onStop : onStart}
        disabled={busy}
        aria-label={recording ? 'Stop recording' : 'Start recording'}
        className={`relative w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition
          ${recording
            ? 'bg-rose-500 text-white mic-pulse'
            : busy
            ? 'bg-warm-300 dark:bg-[#2a2a2f] text-warm-700 dark:text-warm-300 cursor-not-allowed'
            : 'bg-gradient-to-br from-amethyst-500 to-amethyst-700 text-white hover:scale-105'}
        `}
      >
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : recording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>
      <div className="text-xs text-warm-500 min-w-[120px]">
        {recording && <span className="text-rose-500 font-medium">● Recording {String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</span>}
        {busy && <span>{message}{status === 'loading' && progress ? ` ${progress}%` : ''}</span>}
        {!recording && !busy && <span>Tap to dictate</span>}
      </div>
    </div>
  );
}
