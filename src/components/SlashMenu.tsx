import { useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import type { SlashItem } from '../lib/slashCommands';

interface Props {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

export const SlashMenu = forwardRef<{ onKeyDown: (e: KeyboardEvent) => boolean }, Props>(
  function SlashMenu({ items, command }, ref) {
    const [sel, setSel] = useState(0);
    useEffect(() => setSel(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: (e: KeyboardEvent) => {
        if (!items.length) return false;
        if (e.key === 'ArrowDown') {
          setSel(s => (s + 1) % items.length);
          return true;
        }
        if (e.key === 'ArrowUp') {
          setSel(s => (s - 1 + items.length) % items.length);
          return true;
        }
        if (e.key === 'Enter') {
          command(items[sel]);
          return true;
        }
        return false;
      },
    }));

    if (!items.length) {
      return (
        <div className="slash-menu">
          <div className="slash-empty">No matches</div>
        </div>
      );
    }

    // Group items
    const groups: Record<string, SlashItem[]> = {};
    items.forEach(it => {
      (groups[it.group] ||= []).push(it);
    });
    let idx = -1;

    return (
      <div className="slash-menu">
        {Object.entries(groups).map(([group, gItems]) => (
          <div key={group} className="slash-group">
            <div className="slash-group-title">{group}</div>
            {gItems.map(it => {
              idx++;
              const myIdx = idx;
              return (
                <button
                  key={it.title}
                  className={`slash-item ${myIdx === sel ? 'is-selected' : ''}`}
                  onMouseEnter={() => setSel(myIdx)}
                  onMouseDown={e => { e.preventDefault(); command(it); }}
                >
                  <span className="slash-icon">{it.icon}</span>
                  <span className="slash-meta">
                    <span className="slash-title">{it.title}</span>
                    <span className="slash-desc">{it.description}</span>
                  </span>
                  {it.shortcut && <span className="slash-kbd">{it.shortcut}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  },
);
