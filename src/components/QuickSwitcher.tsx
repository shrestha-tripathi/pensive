import { useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import type { Note } from '../lib/db';
import { getPath } from '../lib/db';

interface Props {
  open: boolean;
  notes: Note[];
  onClose: () => void;
  onSelect: (id: string) => void;
}

export function QuickSwitcher({ open, notes, onClose, onSelect }: Props) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const fuse = useMemo(() => new Fuse(notes, {
    keys: ['title', 'plainText'],
    threshold: 0.4,
    includeScore: true,
  }), [notes]);

  const results = useMemo(() => {
    if (!q.trim()) return notes.slice(0, 12);
    return fuse.search(q).slice(0, 12).map(r => r.item);
  }, [q, notes, fuse]);

  useEffect(() => {
    if (open) {
      setQ(''); setSel(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/40" onClick={onClose}>
      <div
        className="w-[560px] max-w-[92vw] bg-white dark:bg-[#1a1a1d] rounded-xl shadow-2xl border border-warm-200 dark:border-[#26262b] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={e => { setQ(e.target.value); setSel(0); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
            else if (e.key === 'Enter') {
              const r = results[sel];
              if (r) { onSelect(r.id); onClose(); }
            } else if (e.key === 'Escape') onClose();
          }}
          placeholder="Jump to a page…"
          className="w-full px-4 py-3 text-base bg-transparent outline-none border-b border-warm-200 dark:border-[#26262b]"
        />
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 && <div className="text-sm text-warm-500 px-4 py-6 text-center">No matches</div>}
          {results.map((n, i) => {
            const path = getPath(notes, n.id);
            const crumbs = path.slice(0, -1).map(x => x.title || 'Untitled').join(' › ');
            return (
              <button
                key={n.id}
                onMouseEnter={() => setSel(i)}
                onClick={() => { onSelect(n.id); onClose(); }}
                className={`w-full text-left px-4 py-2 flex flex-col ${i === sel ? 'bg-amethyst-50 dark:bg-amethyst-500/10' : 'hover:bg-warm-100 dark:hover:bg-[#222226]'}`}
              >
                <span className="text-sm">{n.title || 'Untitled'}</span>
                {crumbs && <span className="text-[11px] text-warm-500 truncate">{crumbs}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
