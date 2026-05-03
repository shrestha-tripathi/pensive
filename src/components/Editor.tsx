import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
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
import { useEffect, useMemo, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SlashCommands, type SlashItem } from '../lib/slashCommands';
import { Callout, Toggle, AttachmentImage } from '../lib/tiptapExtensions';
import { storeImage } from '../lib/images';
import { attachmentUrl } from '../lib/images';
import { SlashMenu } from './SlashMenu';
import { MentionMenu } from './MentionMenu';
import type { Note } from '../lib/db';
import { Bold, Italic, Code, Highlighter, Sparkles } from 'lucide-react';

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
    { group: 'Basic', title: 'Code block', description: 'Syntax-highlighted code', icon: '</>', keywords: ['code'],
      command: (ed, range) => { ed.chain().focus().deleteRange(range).run(); onCBRef.current?.(ed); } },

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
        type: 'toggle', attrs: { summary: 'Toggle', open: true },
        content: [{ type: 'paragraph' }],
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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
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
      Callout,
      Toggle,
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
    ],
    content: initialContent,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  }, [noteId]);

  const onEditorRef = useRef(onEditor);
  onEditorRef.current = onEditor;
  useEffect(() => {
    onEditorRef.current?.(editor);
    return () => onEditorRef.current?.(null);
  }, [editor]);

  // Click handler for mentions.
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const m = t.closest('[data-type="mention"]') as HTMLElement | null;
      if (m) {
        const id = m.getAttribute('data-id');
        if (id) onOpenRef.current?.(id);
      }
    };
    dom.addEventListener('click', handler);
    return () => dom.removeEventListener('click', handler);
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

  return (
    <>
      <EditorContent editor={editor} className="px-2" />
      {editor && (
        <BubbleMenu editor={editor} className="pensive-bubble-menu">
          <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'active' : ''}><Bold className="w-3.5 h-3.5" /></button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'active' : ''}><Italic className="w-3.5 h-3.5" /></button>
          <button onClick={() => editor.chain().focus().toggleCode().run()} className={editor.isActive('code') ? 'active' : ''}><Code className="w-3.5 h-3.5" /></button>
          <button onClick={() => editor.chain().focus().toggleHighlight?.().run()} title="Highlight"><Highlighter className="w-3.5 h-3.5" /></button>
          {onAICommand && (
            <button onClick={() => onAICommand('improve', editor)} title="Improve writing"><Sparkles className="w-3.5 h-3.5" /></button>
          )}
        </BubbleMenu>
      )}
    </>
  );
}
