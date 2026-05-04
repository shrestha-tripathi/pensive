import { useEffect, useMemo, useRef, useState } from 'react';
import { EMOJI, searchEmoji, type EmojiEntry } from '../lib/emojiData';

const RECENT_KEY = 'pensive.recentEmoji';

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw).slice(0, 24) : [];
  } catch { return []; }
}

function pushRecent(e: string) {
  const cur = loadRecent().filter(x => x !== e);
  cur.unshift(e);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, 24))); } catch {}
}

interface Props {
  onPick: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onPick, onClose }: Props) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recent = useMemo(() => loadRecent(), []);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const matches: EmojiEntry[] = q ? searchEmoji(q, 120) : EMOJI;

  return (
    <div className="emoji-picker-backdrop" onMouseDown={onClose}>
      <div className="emoji-picker" onMouseDown={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="emoji-picker-input"
          placeholder="Search emoji…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && matches[0]) {
              const em = matches[0].e;
              pushRecent(em); onPick(em); onClose();
            }
          }}
        />
        {!q && recent.length > 0 && (
          <>
            <div className="emoji-picker-section">Recent</div>
            <div className="emoji-picker-grid">
              {recent.map(em => (
                <button
                  key={'r-' + em}
                  className="emoji-picker-cell"
                  title={em}
                  onClick={() => { pushRecent(em); onPick(em); onClose(); }}
                >{em}</button>
              ))}
            </div>
          </>
        )}
        <div className="emoji-picker-section">{q ? 'Results' : 'All'}</div>
        <div className="emoji-picker-grid">
          {matches.map(it => (
            <button
              key={it.n}
              className="emoji-picker-cell"
              title={`:${it.n}:`}
              onClick={() => { pushRecent(it.e); onPick(it.e); onClose(); }}
            >{it.e}</button>
          ))}
          {!matches.length && <div className="emoji-picker-empty">No matches</div>}
        </div>
      </div>
    </div>
  );
}
