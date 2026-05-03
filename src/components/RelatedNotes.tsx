import { useEffect, useState } from 'react';
import { Link2 } from 'lucide-react';
import { findRelatedNotes, type RelatedNote } from '../lib/backlinks';

interface Props {
  noteId: string;
  noteUpdatedAt: number;
  onOpen: (id: string) => void;
}

export function RelatedNotes({ noteId, noteUpdatedAt, onOpen }: Props) {
  const [items, setItems] = useState<RelatedNote[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setLoading(true);
    // Small delay to let embeddings settle after a save.
    const t = window.setTimeout(async () => {
      try {
        const r = await findRelatedNotes(noteId, 5);
        if (!cancelled) setItems(r);
      } catch (e) {
        console.warn('[related]', e);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; window.clearTimeout(t); };
    // Recompute when note id or last-saved timestamp changes.
  }, [noteId, noteUpdatedAt]);

  if (!loading && (!items || items.length === 0)) return null;

  return (
    <div className="mt-12 pt-6 border-t border-warm-200 dark:border-[#1f1f23]">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-warm-500 mb-3">
        <Link2 className="w-3 h-3" /> Related notes
      </div>
      {loading && <div className="text-xs text-warm-500">Searching…</div>}
      {!loading && items && (
        <div className="grid sm:grid-cols-2 gap-2">
          {items.map(r => (
            <button
              key={r.noteId}
              onClick={() => onOpen(r.noteId)}
              className="text-left p-3 rounded-lg border border-warm-200 dark:border-[#26262b] hover:border-amethyst-400 hover:bg-amethyst-50/30 dark:hover:bg-amethyst-500/5 transition"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-sm font-medium truncate">{r.title}</div>
                <div className="text-[10px] text-amethyst-600 dark:text-amethyst-400 shrink-0">
                  {Math.round(r.score * 100)}%
                </div>
              </div>
              <div className="text-xs text-warm-500 line-clamp-1">{r.snippet}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
