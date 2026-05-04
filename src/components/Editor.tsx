import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Mention from '@tiptap/extension-mention';
import Highlight from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Details } from '@tiptap/extension-details';
import { DetailsSummary } from '@tiptap/extension-details-summary';
import { DetailsContent } from '@tiptap/extension-details-content';
import Link from '@tiptap/extension-link';
import Typography from '@tiptap/extension-typography';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import DragHandle from '@tiptap/extension-drag-handle-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SlashCommands, type SlashItem } from '../lib/slashCommands';
import { EmojiSuggest } from '../lib/emojiSuggest';
import { EmojiSuggestMenu } from './EmojiSuggestMenu';
import { EmojiPicker } from './EmojiPicker';
import { Callout, Toggle, AttachmentImage } from '../lib/tiptapExtensions';
import { storeImage } from '../lib/images';
import { attachmentUrl } from '../lib/images';
import { SlashMenu } from './SlashMenu';
import { MentionMenu } from './MentionMenu';
import { TableMenu } from './TableMenu';
import { LinkBubble } from './LinkBubble';
import type { Note } from '../lib/db';
import { Bold, Italic, Code, Highlighter, Sparkles, Table as TableIcon, GripVertical, Plus, Link as LinkIcon } from 'lucide-react';

const lowlight = createLowlight(common);

interface Props {
  noteId: string;
  initialContent: any;
  onChange: (json: any) => void;
  onEditor?: (editor: Editor | null) => void;
  notes: Note[];
  onOpenNote: (id: string) => void;
  onAICommand?: (kind: 'continue' | 'summarize' | 'improve', editor: Editor) => void;
  onInsertTable?: (editor: Editor) => void;
  onInsertCodeBlock?: (editor: Editor) => void;
}

// Floating popup renderer for suggestion plugins.
function makePopupRender(getComponent: (props: any) => any) {
  return () => {
    let el: HTMLDivElement | null = null;
    let root: Root | null = null;
    let component: any = null;
    let compRef: any = null;

    const updatePosition = (props: any) => {
      if (!el) return;
      const rect = props.clientRect?.();
      if (!rect) return;
      el.style.position = 'fixed';
      el.style.left = `${rect.left}px`;
      el.style.top = `${rect.bottom + 6}px`;
      el.style.zIndex = '50';
    };

    return {
      onStart: (props: any) => {
        el = document.createElement('div');
        document.body.appendChild(el);
        root = createRoot(el);
        const setRef = (r: any) => { compRef = r; };
        component = getComponent({ ...props, ref: setRef });
        root.render(component);
        updatePosition(props);
      },
      onUpdate: (props: any) => {
        component = getComponent({ ...props, ref: (r: any) => { compRef = r; } });
        root?.render(component);
        updatePosition(props);
      },
      onKeyDown: (props: any) => {
        if (props.event.key === 'Escape') return true;
        return compRef?.onKeyDown?.(props.event) ?? false;
      },
      onExit: () => {
        root?.unmount();
        el?.remove();
        el = null;
        root = null;
      },
    };
  };
}

export function NoteEditor({
  noteId,
  initialContent,
  onChange,
  onEditor,
  notes,
  onOpenNote,
  onAICommand,
  onInsertTable,
  onInsertCodeBlock,
}: Props) {
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const onOpenRef = useRef(onOpenNote);
  onOpenRef.current = onOpenNote;
  const onAIRef = useRef(onAICommand);
  onAIRef.current = onAICommand;
  const onTableRef = useRef(onInsertTable);
  onTableRef.current = onInsertTable;
  const onCBRef = useRef(onInsertCodeBlock);
  onCBRef.current = onInsertCodeBlock;

  const slashItems: SlashItem[] = useMemo(() => [
    { group: 'Basic', title: 'Heading 1', description: 'Big section heading', icon: 'H1', shortcut: '⌘⇧1', keywords: ['h1', 'title'],
      command: (ed, range) => ed.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run() },
    { group: 'Basic', title: 'Heading 2', description: 'Medium heading', icon: 'H2', shortcut: '⌘⇧2', keywords: ['h2'],
      command: (ed, range) => ed.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run() },
    { group: 'Basic', title: 'Heading 3', description: 'Small heading', icon: 'H3', shortcut: '⌘⇧3', keywords: ['h3'],
      command: (ed, range) => ed.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run() },
    { group: 'Basic', title: 'Paragraph', description: 'Plain text', icon: '¶',
      command: (ed, range) => ed.chain().focus().deleteRange(range).setParagraph().run() },
    { group: 'Basic', title: 'Bullet list', description: 'Unordered list', icon: '•', shortcut: '⌘⇧8',
      command: (ed, range) => ed.chain().focus().deleteRange(range).toggleBulletList().run() },
    { group: 'Basic', title: 'Numbered list', description: 'Ordered list', icon: '1.', shortcut: '⌘⇧7',
      command: (ed, range) => ed.chain().focus().deleteRange(range).toggleOrderedList().run() },
    { group: 'Basic', title: 'Task list', description: 'To-do checkboxes', icon: '☐',
      command: (ed, range) => ed.chain().focus().deleteRange(range).toggleTaskList().run() },
    { group: 'Basic', title: 'Quote', description: 'Block quote', icon: '❝',
      command: (ed, range) => ed.chain().focus().deleteRange(range).setBlockquote().run() },
    { group: 'Basic', title: 'Divider', description: 'Horizontal rule', icon: '—',
      command: (ed, range) => ed.chain().focus().deleteRange(range).setHorizontalRule().run() },
    { group: 'Basic', title: 'Code block', description: 'Syntax-highlighted code', icon: '</>', keywords: ['code', 'pre'],
      command: (ed, range) => ed.chain().focus().deleteRange(range).setCodeBlock().run() },
    { group: 'Basic', title: 'Emoji', description: 'Open the emoji picker', icon: '😊', keywords: ['emoji', 'emote', 'reaction', 'smiley'],
      command: (ed, range) => { ed.chain().focus().deleteRange(range).run(); setEmojiPickerOpen(true); } },

    { group: 'Media', title: 'Image', description: 'Upload an image (stored as blob)', icon: '🖼', keywords: ['img', 'photo'],
      command: (ed, range) => {
        ed.chain().focus().deleteRange(range).run();
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.onchange = async () => {
          const f = inp.files?.[0];
          if (!f) return;
          try {
            const att = await storeImage(f, noteId);
            const url = await attachmentUrl(att.id);
            ed.chain().focus().insertContent({
              type: 'image',
              attrs: { attachmentId: att.id, src: url, alt: f.name },
            }).run();
          } catch (e) { console.error('[image upload]', e); alert('Failed to store image'); }
        };
        inp.click();
      } },

    { group: 'Advanced', title: 'Callout', description: 'Highlighted info block', icon: '💡',
      command: (ed, range) => ed.chain().focus().deleteRange(range).insertContent({
        type: 'callout', attrs: { emoji: '💡', variant: 'info' },
        content: [{ type: 'paragraph' }],
      }).run() },
    { group: 'Advanced', title: 'Toggle', description: 'Collapsible block', icon: '▸',
      command: (ed, range) => ed.chain().focus().deleteRange(range).insertContent({
        type: 'details', attrs: { open: true },
        content: [
          { type: 'detailsSummary', content: [{ type: 'text', text: 'Toggle' }] },
          { type: 'detailsContent', content: [{ type: 'paragraph' }] },
        ],
      }).run() },
    { group: 'Advanced', title: 'Table', description: '3×3 with header', icon: '⊞', keywords: ['table'],
      command: (ed, range) => ed.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },

    { group: 'AI', title: 'Continue writing', description: 'Let AI continue the text', icon: '✨', keywords: ['ai', 'continue'],
      command: (ed, range) => { ed.chain().focus().deleteRange(range).run(); onAIRef.current?.('continue', ed); } },
    { group: 'AI', title: 'Summarize', description: 'Add a summary callout', icon: '📝', keywords: ['ai', 'summary'],
      command: (ed, range) => { ed.chain().focus().deleteRange(range).run(); onAIRef.current?.('summarize', ed); } },
    { group: 'AI', title: 'Improve writing', description: 'Improve selection', icon: '🪄', keywords: ['ai', 'rewrite'],
      command: (ed, range) => { ed.chain().focus().deleteRange(range).run(); onAIRef.current?.('improve', ed); } },
  ], []);

  // Migrate legacy {type:'toggle'} JSON to the official Details schema in-place
  // so old saved notes (incl. the one in the user's current screenshot) become
  // fully interactive after this load.
  const migratedContent = useMemo(() => {
    const migrate = (node: any): any => {
      if (!node || typeof node !== 'object') return node;
      if (node.type === 'toggle') {
        const summary = (node.attrs && node.attrs.summary) || 'Toggle';
        const inner = (node.content ?? []).map(migrate);
        return {
          type: 'details',
          attrs: { open: node.attrs?.open !== false },
          content: [
            { type: 'detailsSummary', content: [{ type: 'text', text: summary }] },
            { type: 'detailsContent', content: inner.length ? inner : [{ type: 'paragraph' }] },
          ],
        };
      }
      if (Array.isArray(node.content)) return { ...node, content: node.content.map(migrate) };
      return node;
    };
    return migrate(initialContent);
  }, [initialContent]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false, link: false }),
      Typography,
      CodeBlockLowlight.configure({ lowlight, defaultLanguage: null, HTMLAttributes: { class: 'pensive-code-block' } }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { class: 'pensive-link', rel: 'noopener noreferrer nofollow', target: '_blank' },
      }),
      Placeholder.configure({
        placeholder: ({ node, pos }) => {
          if (pos === 0 && node.type.name === 'heading') return 'Untitled';
          return "Press '/' for commands";
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      AttachmentImage.configure({ inline: false, allowBase64: true }),
      Highlight,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Details.configure({ persist: true, HTMLAttributes: { class: 'pensive-details' } }),
      DetailsSummary,
      DetailsContent,
      Callout,
      Toggle, // kept only so legacy {type:'toggle'} JSON in old notes still parses
      Mention.configure({
        HTMLAttributes: { class: 'pensive-mention' },
        renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
        suggestion: {
          char: '@',
          allowSpaces: false,
          command: ({ editor, range, props }: any) => {
            editor.chain().focus().insertContentAt(range, [
              { type: 'mention', attrs: { id: props.id, label: props.label } },
              { type: 'text', text: ' ' },
            ]).run();
          },
          items: ({ query }: any) => {
            const q = query.toLowerCase();
            return notesRef.current
              .filter(n => (n.title || 'Untitled').toLowerCase().includes(q))
              .slice(0, 8)
              .map(n => ({ id: n.id, label: n.title || 'Untitled' }));
          },
          render: makePopupRender(({ ref, items, command }: any) => (
            <MentionMenu ref={ref} items={items} command={command} />
          )),
        },
      }),
      SlashCommands.configure({
        items: slashItems,
        render: makePopupRender(({ ref, items, command }: any) => (
          <SlashMenu ref={ref} items={items} command={(it: SlashItem) => command(it)} />
        )),
      }),
      EmojiSuggest.configure({
        render: makePopupRender(({ ref, items, command }: any) => (
          <EmojiSuggestMenu ref={ref} items={items} command={(it: any) => command(it)} />
        )),
      }),
    ],
    content: migratedContent,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  }, [noteId]);

  const onEditorRef = useRef(onEditor);
  onEditorRef.current = onEditor;
  useEffect(() => {
    onEditorRef.current?.(editor);
    return () => onEditorRef.current?.(null);
  }, [editor]);

  // Click handler for mentions + toggle expand/collapse + toggle summary editing.
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;

      // Mention navigation
      const m = t.closest('[data-type="mention"]') as HTMLElement | null;
      if (m) {
        const id = m.getAttribute('data-id');
        if (id) onOpenRef.current?.(id);
        return;
      }

      // Click anywhere on a Details summary text to toggle the block.
      // Tiptap's chevron button already toggles; this extends the hit-area
      // to the summary text itself (Notion behaviour).
      // We skip toggling if the user is making a text selection or already
      // editing inside the summary (focus inside the contenteditable summary).
      const sum = t.closest('[data-type="detailsSummary"]') as HTMLElement | null;
      if (sum) {
        const sel = window.getSelection();
        const isSelecting = sel && !sel.isCollapsed;
        const detailsEl = sum.closest('[data-type="details"]') as HTMLElement | null;
        if (!detailsEl || isSelecting) return;
        // If summary is already focused (caret in it), don't toggle on single click;
        // require a click on the chevron or a second click to toggle.
        const wasFocused = detailsEl.contains(document.activeElement) && document.activeElement !== document.body;
        if (wasFocused) return;
        e.preventDefault();
        const chevron = detailsEl.querySelector(':scope > button') as HTMLElement | null;
        chevron?.click();
        return;
      }
    };
    dom.addEventListener('click', handler);
    return () => {
      dom.removeEventListener('click', handler);
    };
  }, [editor]);

  // Right-click context menu when inside a table.
  const [tableCtx, setTableCtx] = useState<{ x: number; y: number } | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const onCtx = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('table')) {
        e.preventDefault();
        // Place cursor where the user clicked so the next command targets that cell.
        const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
        if (pos) editor.commands.setTextSelection(pos.pos);
        setTableCtx({ x: e.clientX, y: e.clientY });
      }
    };
    const onDocClick = () => setTableCtx(null);
    dom.addEventListener('contextmenu', onCtx);
    document.addEventListener('click', onDocClick);
    document.addEventListener('scroll', onDocClick, true);
    return () => {
      dom.removeEventListener('contextmenu', onCtx);
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('scroll', onDocClick, true);
    };
  }, [editor]);

  // Resolve <img data-attachment-id> → blob URL after every render.
  useEffect(() => {
    if (!editor) return;
    const resolve = async () => {
      const imgs = editor.view.dom.querySelectorAll<HTMLImageElement>('img[data-attachment-id]');
      for (const img of imgs) {
        if (img.src && img.src.startsWith('blob:')) continue;
        const id = img.getAttribute('data-attachment-id');
        if (!id) continue;
        const url = await attachmentUrl(id);
        if (url) img.src = url;
      }
    };
    resolve();
    const off = editor.on('update', resolve);
    return () => { off; editor.off('update', resolve); };
  }, [editor]);

  // Paste/drop image → store as attachment.
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const insertFile = async (file: File) => {
      try {
        const att = await storeImage(file, noteId);
        const url = await attachmentUrl(att.id);
        editor.chain().focus().insertContent({
          type: 'image',
          attrs: { attachmentId: att.id, src: url, alt: file.name },
        }).run();
      } catch (e) { console.error('[image insert]', e); }
    };
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) { e.preventDefault(); insertFile(f); return; }
        }
      }
    };
    const onDrop = (e: DragEvent) => {
      const files = e.dataTransfer?.files;
      if (!files || !files.length) return;
      const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
      if (!imgs.length) return;
      e.preventDefault();
      imgs.forEach(insertFile);
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
    };
    dom.addEventListener('paste', onPaste);
    dom.addEventListener('drop', onDrop);
    dom.addEventListener('dragover', onDragOver);
    return () => {
      dom.removeEventListener('paste', onPaste);
      dom.removeEventListener('drop', onDrop);
      dom.removeEventListener('dragover', onDragOver);
    };
  }, [editor, noteId]);

  // Tear down editor cleanly on unmount so tippy popovers/portals don't leak
  // into the DOM and trigger React reconciler "removeChild" crashes when the
  // parent unmounts (happens on note-switch / new-note).
  useEffect(() => {
    return () => {
      try { editor?.destroy(); } catch { /* swallow tippy/PM teardown noise */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <EditorContent editor={editor} className="px-2" />

      {/* ⋮⋮ drag handle that follows the hovered block (Notion-style) */}
      {editor && (
        <DragHandle editor={editor} className="pensive-drag-handle">
          <button
            type="button"
            title="Drag to move · click for menu"
            aria-label="Drag block"
            className="p-1 rounded hover:bg-warm-100 dark:hover:bg-[#26262b] text-warm-500 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        </DragHandle>
      )}

      {/* Floating "+" on empty lines */}
      {editor && (
        <FloatingMenu
          editor={editor}
          shouldShow={({ state }) => {
            const { selection } = state;
            const { $anchor } = selection;
            const isEmptyTextBlock = $anchor.parent.isTextblock && !$anchor.parent.textContent;
            return isEmptyTextBlock && $anchor.parent.type.name === 'paragraph';
          }}
          className="pensive-floating-menu"
        >
          <button
            type="button"
            title="Add a block (or press '/')"
            onClick={() => editor.chain().focus().insertContent('/').run()}
            className="p-1 rounded text-warm-500 hover:text-amethyst-600 hover:bg-warm-100 dark:hover:bg-[#26262b] transition"
          >
            <Plus className="w-4 h-4" />
          </button>
        </FloatingMenu>
      )}

      {/* Text formatting bubble */}
      {editor && (
        <BubbleMenu
          editor={editor}
          shouldShow={({ editor: ed, from, to }) => from !== to && !ed.isActive('table') && !ed.isActive('link')}
          className="pensive-bubble-menu"
        >
          <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'active' : ''} title="Bold (⌘B)"><Bold className="w-3.5 h-3.5" /></button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'active' : ''} title="Italic (⌘I)"><Italic className="w-3.5 h-3.5" /></button>
          <button onClick={() => editor.chain().focus().toggleCode().run()} className={editor.isActive('code') ? 'active' : ''} title="Inline code"><Code className="w-3.5 h-3.5" /></button>
          <button onClick={() => editor.chain().focus().toggleHighlight?.().run()} className={editor.isActive('highlight') ? 'active' : ''} title="Highlight"><Highlighter className="w-3.5 h-3.5" /></button>
          <button
            onClick={() => {
              const prev = editor.getAttributes('link').href ?? '';
              const url = window.prompt('Link URL', prev);
              if (url == null) return;
              if (url === '') editor.chain().focus().extendMarkRange('link').unsetLink().run();
              else {
                const safe = /^[a-z]+:\/\//i.test(url) || url.startsWith('mailto:') ? url : `https://${url}`;
                editor.chain().focus().extendMarkRange('link').setLink({ href: safe }).run();
              }
            }}
            className={editor.isActive('link') ? 'active' : ''}
            title="Add link"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>
          {onAICommand && (
            <button onClick={() => onAICommand('improve', editor)} title="Improve writing"><Sparkles className="w-3.5 h-3.5" /></button>
          )}
        </BubbleMenu>
      )}

      {/* Link editor — appears whenever cursor is inside an active link mark */}
      {editor && (
        <BubbleMenu
          editor={editor}
          shouldShow={({ editor: ed }) => ed.isActive('link')}
          className="pensive-link-bubble-wrap"
          options={{ placement: 'bottom' as any }}
        >
          <LinkBubble editor={editor} />
        </BubbleMenu>
      )}

      {/* Table toolbar */}
      {editor && (
        <BubbleMenu
          editor={editor}
          shouldShow={({ editor: ed }) => ed.isActive('table')}
          className="pensive-bubble-menu pensive-table-bubble"
          options={{ placement: 'top' as any }}
        >
          <button title="Insert row above" onClick={() => editor.chain().focus().addRowBefore().run()}>＋↑</button>
          <button title="Insert row below" onClick={() => editor.chain().focus().addRowAfter().run()}>＋↓</button>
          <button title="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}>−Row</button>
          <span className="pensive-bubble-sep" />
          <button title="Insert column left" onClick={() => editor.chain().focus().addColumnBefore().run()}>＋←</button>
          <button title="Insert column right" onClick={() => editor.chain().focus().addColumnAfter().run()}>＋→</button>
          <button title="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>−Col</button>
          <span className="pensive-bubble-sep" />
          <button title="Toggle header row" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>H</button>
          <button title="Merge / split cells" onClick={() => editor.chain().focus().mergeOrSplit().run()}>⊟</button>
          <button title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()} className="text-rose-500 dark:text-rose-400"><TableIcon className="w-3.5 h-3.5" />×</button>
        </BubbleMenu>
      )}

      {/* Right-click context menu for tables */}
      {editor && tableCtx && (
        <div
          className="fixed z-[60]"
          style={{ left: tableCtx.x, top: tableCtx.y }}
          onClick={e => e.stopPropagation()}
          onContextMenu={e => e.preventDefault()}
        >
          <TableMenu editor={editor} onClose={() => setTableCtx(null)} />
        </div>
      )}

      {emojiPickerOpen && editor && (
        <EmojiPicker
          onPick={em => editor.chain().focus().insertContent(em + ' ').run()}
          onClose={() => setEmojiPickerOpen(false)}
        />
      )}
    </>
  );
}
