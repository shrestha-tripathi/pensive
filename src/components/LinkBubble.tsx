// Inline link editor — appears whenever the cursor is inside a link mark.
// Click the URL pill to visit; click the pencil to edit; click the unlink to remove.

import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { ExternalLink, Pencil, Unlink, Check } from 'lucide-react';

interface Props { editor: Editor }

export function LinkBubble({ editor }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // When the active link mark changes, reset draft.
  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const href = editor.getAttributes('link').href ?? '';
      setDraft(href);
      setEditing(false);
    };
    editor.on('selectionUpdate', sync);
    editor.on('transaction', sync);
    return () => { editor.off('selectionUpdate', sync); editor.off('transaction', sync); };
  }, [editor]);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const href = editor.getAttributes('link').href ?? '';

  const apply = () => {
    const url = draft.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      const safe = /^[a-z]+:\/\//i.test(url) || url.startsWith('mailto:') ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href: safe }).run();
    }
    setEditing(false);
  };

  return (
    <div className="pensive-link-bubble flex items-center gap-1 px-1.5 py-1 rounded-lg border border-warm-200 dark:border-[#26262b] bg-white dark:bg-[#1a1a1d] shadow-xl text-xs">
      {editing ? (
        <>
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } if (e.key === 'Escape') setEditing(false); }}
            placeholder="https://…"
            className="px-2 py-1 w-[240px] bg-transparent outline-none border-0 text-warm-700 dark:text-warm-200 placeholder:text-warm-500"
          />
          <button onMouseDown={e => e.preventDefault()} onClick={apply} title="Apply" className="p-1 rounded hover:bg-warm-100 dark:hover:bg-[#26262b] text-amethyst-600">
            <Check className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={href}
            onMouseDown={e => e.stopPropagation()}
            className="px-2 py-1 max-w-[240px] truncate text-amethyst-600 dark:text-amethyst-300 hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3 shrink-0" />
            <span className="truncate">{href.replace(/^https?:\/\//, '')}</span>
          </a>
          <span className="w-px h-4 bg-warm-200 dark:bg-[#26262b]" />
          <button onMouseDown={e => e.preventDefault()} onClick={() => setEditing(true)} title="Edit link" className="p-1 rounded hover:bg-warm-100 dark:hover:bg-[#26262b]">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
            title="Remove link"
            className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-500/15 text-rose-500"
          >
            <Unlink className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
