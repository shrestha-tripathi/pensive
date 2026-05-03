import { useEffect, useImperativeHandle, useState, forwardRef } from 'react';

interface Item { id: string; label: string }
interface Props {
  items: Item[];
  command: (item: Item) => void;
}

export const MentionMenu = forwardRef<{ onKeyDown: (e: KeyboardEvent) => boolean }, Props>(
  function MentionMenu({ items, command }, ref) {
    const [sel, setSel] = useState(0);
    useEffect(() => setSel(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: (e: KeyboardEvent) => {
        if (!items.length) return false;
        if (e.key === 'ArrowDown') { setSel(s => (s + 1) % items.length); return true; }
        if (e.key === 'ArrowUp')   { setSel(s => (s - 1 + items.length) % items.length); return true; }
        if (e.key === 'Enter')     { command(items[sel]); return true; }
        return false;
      },
    }));

    if (!items.length) {
      return <div className="slash-menu"><div className="slash-empty">No notes</div></div>;
    }
    return (
      <div className="slash-menu" style={{ minWidth: 220 }}>
        {items.map((it, i) => (
          <button
            key={it.id}
            className={`slash-item ${i === sel ? 'is-selected' : ''}`}
            onMouseEnter={() => setSel(i)}
            onMouseDown={e => { e.preventDefault(); command(it); }}
          >
            <span className="slash-icon">📄</span>
            <span className="slash-meta">
              <span className="slash-title">{it.label || 'Untitled'}</span>
            </span>
          </button>
        ))}
      </div>
    );
  },
);
