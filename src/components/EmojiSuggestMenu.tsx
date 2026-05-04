import { useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import type { EmojiEntry } from '../lib/emojiData';

interface Props {
  items: EmojiEntry[];
  command: (item: EmojiEntry) => void;
}

export const EmojiSuggestMenu = forwardRef<{ onKeyDown: (e: KeyboardEvent) => boolean }, Props>(
  function EmojiSuggestMenu({ items, command }, ref) {
    const [sel, setSel] = useState(0);
    useEffect(() => setSel(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: (e: KeyboardEvent) => {
        if (!items.length) return false;
        if (e.key === 'ArrowDown') { setSel(s => (s + 1) % items.length); return true; }
        if (e.key === 'ArrowUp')   { setSel(s => (s - 1 + items.length) % items.length); return true; }
        if (e.key === 'Enter' || e.key === 'Tab') { command(items[sel]); return true; }
        return false;
      },
    }));

    if (!items.length) {
      return <div className="slash-menu"><div className="slash-empty">No emoji</div></div>;
    }

    return (
      <div className="slash-menu emoji-suggest" style={{ minWidth: 220, maxHeight: 280, overflowY: 'auto' }}>
        {items.map((it, i) => (
          <button
            key={it.n}
            className={`slash-item ${i === sel ? 'is-selected' : ''}`}
            onMouseEnter={() => setSel(i)}
            onMouseDown={e => { e.preventDefault(); command(it); }}
          >
            <span className="slash-icon" style={{ fontSize: 18 }}>{it.e}</span>
            <span className="slash-meta">
              <span className="slash-title">:{it.n}</span>
            </span>
          </button>
        ))}
      </div>
    );
  },
);
