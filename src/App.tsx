import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { Download, Upload, FilePlus, FileInput, Lock, Sparkles, Star, ChevronRight, Archive, Network, Menu, Mic, MicOff, Square, CreditCard, FileText, FileJson, X } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { NoteEditor } from './components/Editor';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useToast } from './components/Toast';
import { Sidebar } from './components/Sidebar';
import { SettingsPanel } from './components/Settings';
import { MicButton } from './components/MicButton';
import { QuickSwitcher } from './components/QuickSwitcher';
import { TagChips } from './components/TagChips';
import { RelatedNotes } from './components/RelatedNotes';
const GraphView = lazy(() => import('./components/GraphView'));
import { useTheme } from './hooks/useTheme';
import { useTranscriber, type TranscriberSettings } from './hooks/useTranscriber';
import {
  clearAll,
  deleteNote,
  deleteNotes,
  deleteEmbeddingsForNote,
  deriveTitle,
  extractText,
  getNote,
  getDescendants,
  getPath,
  jsonToMarkdown,
  listNotes,
  newNote,
  putNote,
  putNotes,
  type Note,
} from './lib/db';
import { sampleNote } from './lib/sample';
import { ChatPanel } from './components/ChatPanel';
import { indexNote, reindexStale } from './lib/vectorIndex';
import { computeAutoTags } from './lib/autoTags';
import { streamChat } from './lib/llm';
import { useMeetingRecorder } from './hooks/useMeetingRecorder';
import { getAudioCapabilities } from './lib/capabilities';
import { Pricing } from './components/Pricing';

const RECENT_KEY = 'pensive-recent-v1';

function loadRecent(): string[] {
  try { const raw = localStorage.getItem(RECENT_KEY); if (raw) return JSON.parse(raw); } catch {}
  return [];
}

export function App() {
  const { theme, toggle } = useTheme();
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<Note | null>(null);
  const [query, setQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [autoTagging, setAutoTagging] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [meetingElapsed, setMeetingElapsed] = useState(0);
  const [meetingSummarizing, setMeetingSummarizing] = useState(false);
  const [mdImportPending, setMdImportPending] = useState<{ title: string; doc: any } | null>(null);
  const [exportChooserOpen, setExportChooserOpen] = useState(false);
  const [importChooserOpen, setImportChooserOpen] = useState(false);
  const mdFileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const zipFileInputRef = useRef<HTMLInputElement>(null);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const [tSettings, setTSettings] = useState<TranscriberSettings>(() => {
    try {
      const raw = localStorage.getItem('pensive-tsettings');
      if (raw) return JSON.parse(raw);
    } catch {}
    return { model: 'Xenova/whisper-tiny.en', language: 'english' };
  });
  useEffect(() => { localStorage.setItem('pensive-tsettings', JSON.stringify(tSettings)); }, [tSettings]);

  const editorRef = useRef<Editor | null>(null);
  const transcriber = useTranscriber(tSettings);
  const meeting = useMeetingRecorder(tSettings.model);
  const audioCaps = useMemo(() => getAudioCapabilities(), []);
  const saveTimer = useRef<number | null>(null);
  const meetingStartRef = useRef<number>(0);

  // Meeting elapsed-time ticker
  useEffect(() => {
    if (meeting.state.status !== 'recording') return;
    meetingStartRef.current = meetingStartRef.current || Date.now();
    const id = window.setInterval(() => {
      setMeetingElapsed(Math.floor((Date.now() - meetingStartRef.current) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [meeting.state.status]);

  // Initial load
  useEffect(() => {
    (async () => {
      let all = await listNotes();
      if (all.length === 0) {
        const s = sampleNote();
        await putNote(s);
        all = [s];
      }
      setNotes(all);
      setActiveId(all[0]?.id ?? null);
      const ric = (window as any).requestIdleCallback ?? ((cb: any) => setTimeout(cb, 800));
      ric(() => { reindexStale().catch(err => console.warn('[reindex]', err)); });
    })();
  }, []);

  // Recent notes tracking
  useEffect(() => {
    if (!activeId) return;
    setRecent(prev => {
      const next = [activeId, ...prev.filter(id => id !== activeId)].slice(0, 8);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [activeId]);

  // Load active note
  useEffect(() => {
    if (!activeId) { setActive(null); return; }
    getNote(activeId).then(n => setActive(n ?? null));
  }, [activeId]);

  const handleEditorChange = useCallback((json: any) => {
    if (!active) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const plain = extractText(json);
      const updated: Note = {
        ...active,
        content: json,
        plainText: plain,
        title: deriveTitle(json),
        updatedAt: Date.now(),
      };
      await putNote(updated);
      setActive(updated);
      setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
      indexNote(updated).then(async () => {
        // Auto-tag once after first meaningful save if note has no tags yet.
        if ((!updated.tags || updated.tags.length === 0) && plain.trim().length > 80) {
          try {
            const tags = await computeAutoTags(plain);
            if (tags.length) {
              const withTags = { ...updated, tags };
              await putNote(withTags);
              setActive(prev => (prev && prev.id === withTags.id ? withTags : prev));
              setNotes(prev => prev.map(n => n.id === withTags.id ? withTags : n));
            }
          } catch (e) { console.warn('[autoTags]', e); }
        }
      }).catch(err => console.warn('[indexNote]', err));
    }, 500);
  }, [active]);

  const handleSetTags = useCallback(async (id: string, tags: string[]) => {
    const n = notes.find(x => x.id === id);
    if (!n) return;
    const updated = { ...n, tags, updatedAt: Date.now() };
    await putNote(updated);
    setNotes(prev => prev.map(x => x.id === id ? updated : x));
    if (id === activeId) setActive(updated);
  }, [notes, activeId]);

  const handleAutoTag = useCallback(async () => {
    if (!active) return;
    setAutoTagging(true);
    try {
      const tags = await computeAutoTags(active.plainText);
      const merged = Array.from(new Set([...(active.tags ?? []), ...tags])).slice(0, 6);
      await handleSetTags(active.id, merged);
    } catch (e) { console.warn('[autoTag]', e); }
    finally { setAutoTagging(false); }
  }, [active, handleSetTags]);

  const nextRootOrder = useCallback(() => {
    const roots = notes.filter(n => !n.parentId);
    return roots.length ? Math.max(...roots.map(n => n.order ?? 0)) + 1 : 0;
  }, [notes]);

  const toast = useToast();

  const handleCreate = useCallback(async () => {
    try {
      const n = newNote(null, nextRootOrder());
      await putNote(n);
      setNotes(prev => [...prev, n]);
      setActiveId(n.id);
    } catch (e: any) {
      toast.error('Could not create note', e?.message ?? String(e));
    }
  }, [nextRootOrder, toast]);

  const handleCreateChild = useCallback(async (parentId: string) => {
    try {
      const siblings = notes.filter(x => x.parentId === parentId);
      const order = siblings.length ? Math.max(...siblings.map(s => s.order ?? 0)) + 1 : 0;
      const n = newNote(parentId, order);
      await putNote(n);
      setNotes(prev => [...prev, n]);
      setActiveId(n.id);
    } catch (e: any) {
      toast.error('Could not create sub-page', e?.message ?? String(e));
    }
  }, [notes, toast]);

  const handleDelete = useCallback(async (id: string) => {
    const descendants = getDescendants(notes, id);
    if (descendants.length > 0) {
      if (!confirm(`Delete this page and ${descendants.length} child page${descendants.length === 1 ? '' : 's'}?`)) return;
    }
    const allIds = [id, ...descendants.map(d => d.id)];
    await deleteNotes(allIds);
    for (const d of allIds) await deleteEmbeddingsForNote(d).catch(() => {});
    setNotes(prev => {
      const next = prev.filter(n => !allIds.includes(n.id));
      if (allIds.includes(activeId ?? '')) setActiveId(next[0]?.id ?? null);
      return next;
    });
  }, [notes, activeId]);

  const handleDuplicate = useCallback(async (id: string) => {
    const src = notes.find(n => n.id === id);
    if (!src) return;
    const siblings = notes.filter(n => n.parentId === src.parentId);
    const order = siblings.length ? Math.max(...siblings.map(s => s.order ?? 0)) + 1 : 0;
    const dup: Note = {
      ...src,
      id: crypto.randomUUID(),
      title: src.title + ' (copy)',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order,
    };
    await putNote(dup);
    setNotes(prev => [...prev, dup]);
    setActiveId(dup.id);
  }, [notes]);

  const handleRename = useCallback(async (id: string, title: string) => {
    const n = notes.find(x => x.id === id);
    if (!n) return;
    const updated = { ...n, title, updatedAt: Date.now() };
    await putNote(updated);
    setNotes(prev => prev.map(x => x.id === id ? updated : x));
    if (id === activeId) setActive(updated);
  }, [notes, activeId]);

  const handleToggleStar = useCallback(async (id: string) => {
    const n = notes.find(x => x.id === id);
    if (!n) return;
    const updated = { ...n, starred: !n.starred, updatedAt: Date.now() };
    await putNote(updated);
    setNotes(prev => prev.map(x => x.id === id ? updated : x));
    if (id === activeId) setActive(updated);
  }, [notes, activeId]);

  const handleMove = useCallback(async (id: string, parentId: string | null, beforeId: string | null) => {
    // Reorder siblings under target parent.
    const siblings = notes
      .filter(n => (n.parentId ?? null) === parentId && n.id !== id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const movingNote = notes.find(n => n.id === id);
    if (!movingNote) return;
    const insertIdx = beforeId ? siblings.findIndex(s => s.id === beforeId) : siblings.length;
    const finalIdx = insertIdx < 0 ? siblings.length : insertIdx;
    const newSibs = [...siblings.slice(0, finalIdx), { ...movingNote, parentId }, ...siblings.slice(finalIdx)];
    const toSave: Note[] = newSibs.map((n, i) => ({ ...n, order: i, updatedAt: n.id === id ? Date.now() : n.updatedAt }));
    await putNotes(toSave);
    setNotes(prev => {
      const map = new Map(prev.map(n => [n.id, n]));
      for (const t of toSave) map.set(t.id, t);
      return [...map.values()];
    });
  }, [notes]);

  const handleClearAll = useCallback(async () => {
    await clearAll();
    setNotes([]);
    setActiveId(null);
    setSettingsOpen(false);
    const s = sampleNote();
    await putNote(s);
    setNotes([s]);
    setActiveId(s.id);
  }, []);

  const handleExport = useCallback(() => {
    if (!active) return;
    const md = jsonToMarkdown(active.content);
    const blob = new Blob([`# ${active.title}\n\n${md}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${active.title.replace(/[^\w\-]+/g, '_').slice(0, 50) || 'note'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [active]);

  // Trigger the file picker. Result handled in onChange below.
  const handleImportMarkdownClick = useCallback(() => {
    mdFileInputRef.current?.click();
  }, []);

  const handleMarkdownFileChosen = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so picking the same file again still fires onChange
    if (!file) return;
    try {
      const text = await file.text();
      const { markdownToTiptapJson } = await import('./lib/markdownImport');
      const parsed = markdownToTiptapJson(text);
      // Fall back to filename if markdown had no leading H1.
      const title = parsed.title || file.name.replace(/\.(md|markdown|txt)$/i, '').replace(/[-_]+/g, ' ').trim() || 'Imported note';
      setMdImportPending({ title, doc: parsed.doc });
    } catch (err: any) {
      toast.error('Could not read markdown file', err?.message ?? String(err));
    }
  }, [toast]);

  const handleMarkdownImportInsert = useCallback(() => {
    if (!mdImportPending || !editorRef.current) {
      setMdImportPending(null);
      return;
    }
    try {
      // Insert the doc's content (skip the wrapping doc node).
      const content = mdImportPending.doc?.content ?? [];
      editorRef.current.chain().focus().insertContent(content).run();
      toast.success('Markdown inserted', `“${mdImportPending.title}” appended to current page`);
    } catch (err: any) {
      toast.error('Insert failed', err?.message ?? String(err));
    } finally {
      setMdImportPending(null);
    }
  }, [mdImportPending, toast]);

  const handleMarkdownImportNewPage = useCallback(async () => {
    if (!mdImportPending) return;
    try {
      const order = nextRootOrder();
      const n = newNote(null, order);
      n.title = mdImportPending.title;
      n.content = mdImportPending.doc;
      n.plainText = extractText(mdImportPending.doc);
      await putNote(n);
      setNotes(prev => [...prev, n]);
      setActiveId(n.id);
      const title = mdImportPending.title;
      setMdImportPending(null);
      toast.success('Page created', `“${title}” imported as a new page`);
    } catch (err: any) {
      toast.error('Could not create page', err?.message ?? String(err));
      setMdImportPending(null);
    }
  }, [mdImportPending, nextRootOrder, toast]);

  const handleExportZip = useCallback(async () => {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    // Lossless: JSON manifest is the source of truth (preserves callouts, toggles,
    // tables, all node attrs, IDs, parents, tags, timestamps).
    const manifest = {
      version: 1,
      exportedAt: Date.now(),
      app: 'pensive',
      notes,
    };
    zip.file('pensive.json', JSON.stringify(manifest, null, 2));
    zip.file('README.txt',
      'This ZIP is a lossless backup of your Pensive workspace.\n' +
      '• pensive.json — the full workspace as structured JSON. Restoring from this\n' +
      '  preserves callouts, toggles, tables, tags, parents, and timestamps.\n' +
      '\nTo restore on another device: open Pensive → Import → Workspace ZIP.\n');
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pensive-workspace-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [notes]);

  const handleImportZip = useCallback(async (file: File) => {
    const { importWorkspaceZip } = await import('./lib/workspaceImport');
    const result = await importWorkspaceZip(file);
    // Reload notes from DB so UI reflects the import.
    const fresh = await listNotes();
    setNotes(fresh);
    // Trigger background reindex of newly-imported notes.
    if (result.added + result.updated > 0) {
      reindexStale().catch(err => console.warn('[reindex after import]', err));
    }
    return result;
  }, []);

  // Export single note as lossless JSON (preserves callouts, toggles, tables, all attrs).
  const handleExportJson = useCallback(() => {
    if (!active) return;
    const payload = {
      version: 1,
      app: 'pensive',
      exportedAt: Date.now(),
      kind: 'note',
      note: active,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${active.title.replace(/[^\w\-]+/g, '_').slice(0, 50) || 'note'}.pensive.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [active]);

  const handleImportJsonClick = useCallback(() => {
    jsonFileInputRef.current?.click();
  }, []);

  const handleJsonFileChosen = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      // Accept either single-note ({note}) or workspace ({notes}) shapes for flexibility.
      const incoming: any[] = parsed?.notes && Array.isArray(parsed.notes)
        ? parsed.notes
        : parsed?.note
          ? [parsed.note]
          : Array.isArray(parsed)
            ? parsed
            : null;
      if (!incoming) throw new Error('Unrecognized JSON shape — expected {note} or {notes:[]}');

      let added = 0;
      const toWrite: Note[] = [];
      const existingById = new Map(notes.map(n => [n.id, n]));
      let order = nextRootOrder();
      for (const raw of incoming) {
        if (!raw?.content) continue;
        // Reuse ID if it doesn't collide; otherwise mint new so we don't clobber an existing note.
        const collides = raw.id && existingById.has(raw.id);
        const note: Note = {
          id: collides ? `${raw.id}-${Math.random().toString(36).slice(2, 6)}` : (raw.id || `n_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`),
          title: raw.title || deriveTitle(raw.content) || 'Imported note',
          content: raw.content,
          plainText: typeof raw.plainText === 'string' ? raw.plainText : extractText(raw.content),
          createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
          updatedAt: Date.now(),
          parentId: collides ? null : (typeof raw.parentId === 'string' ? raw.parentId : null),
          order: collides ? order++ : (typeof raw.order === 'number' ? raw.order : order++),
          starred: !!raw.starred,
          tags: Array.isArray(raw.tags) ? raw.tags.filter((t: any) => typeof t === 'string') : [],
        };
        toWrite.push(note);
        added++;
      }
      if (toWrite.length) await putNotes(toWrite);
      const fresh = await listNotes();
      setNotes(fresh);
      if (toWrite.length === 1) setActiveId(toWrite[0].id);
      reindexStale().catch(err => console.warn('[reindex after json import]', err));
      toast.success('JSON imported', `${added} note${added === 1 ? '' : 's'} restored losslessly`);
    } catch (err: any) {
      toast.error('Could not import JSON', err?.message ?? String(err));
    }
  }, [notes, nextRootOrder, toast]);

  const handleImportZipClick = useCallback(() => {
    zipFileInputRef.current?.click();
  }, []);

  const handleZipFileChosen = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const result = await handleImportZip(file);
      const parts: string[] = [];
      if (result.added) parts.push(`${result.added} added`);
      if (result.updated) parts.push(`${result.updated} updated`);
      if (result.skipped) parts.push(`${result.skipped} skipped`);
      toast.success('Workspace imported', parts.join(' · ') || 'No changes');
    } catch (err: any) {
      toast.error('Could not import ZIP', err?.message ?? String(err));
    }
  }, [toast]);

  const startMic = useCallback(async () => {
    try {
      await transcriber.startRecording();
    } catch (e: any) {
      toast.error('Could not start mic', e?.message ?? String(e));
    }
  }, [transcriber, toast]);

  const stopMic = useCallback(async () => {
    try {
      const text = await transcriber.stopAndTranscribe();
      if (text && editorRef.current) {
        editorRef.current.chain().focus().insertContent(text + ' ').run();
      } else if (!text) {
        toast.info('No speech detected', 'Try speaking a bit longer or check your mic.');
      }
    } catch (e: any) {
      toast.error('Transcription failed', e?.message ?? String(e));
    }
  }, [transcriber, toast]);

  const startMeeting = useCallback(async () => {
    try {
      meetingStartRef.current = Date.now();
      setMeetingElapsed(0);
      await meeting.start();
    } catch (e: any) {
      console.error('[meeting]', e);
      toast.error('Could not start meeting', e?.message ?? String(e));
    }
  }, [meeting]);

  const stopMeeting = useCallback(async () => {
    const transcript = await meeting.stop();
    meetingStartRef.current = 0;
    setMeetingElapsed(0);
    if (!transcript || !editorRef.current) return;
    setMeetingSummarizing(true);
    const editor = editorRef.current;
    try {
      // Insert a heading + the raw transcript first so user always has it.
      editor.chain().focus().insertContent([
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '🎙️ Meeting — ' + new Date().toLocaleString() }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Summary' }] },
      ]).run();
      let buf = '';
      for await (const chunk of streamChat([
        { role: 'system', content: 'You summarize meeting transcripts. Output exactly: ## TLDR (3 bullets)\n## Key Decisions\n## Action Items\nUse markdown headings and bullets.' },
        { role: 'user', content: transcript },
      ])) {
        buf += chunk;
        editor.chain().insertContent(chunk).run();
      }
      if (!buf) editor.chain().insertContent('_(model returned no summary)_').run();
      editor.chain().focus().insertContent([
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Full transcript' }] },
        { type: 'paragraph', content: [{ type: 'text', text: transcript }] },
      ]).run();
    } catch (e: any) {
      console.error('[meeting summary]', e);
      editor.chain().insertContent('\n\n_(Summary failed: ' + (e?.message ?? e) + ')_\n\nFull transcript:\n' + transcript).run();
    } finally {
      setMeetingSummarizing(false);
    }
  }, [meeting]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setChatOpen(o => !o);
      } else if (mod && e.key.toLowerCase() === 'p') {
        e.preventDefault(); setSwitchOpen(o => !o);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (activeId) handleCreateChild(activeId);
      } else if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault(); handleCreate();
      } else if (e.key === 'Escape') {
        setChatOpen(false); setSwitchOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeId, handleCreate, handleCreateChild]);

  const onAICommand = useCallback(async (kind: 'continue' | 'summarize' | 'improve', editor: Editor) => {
    try {
      let messages: { role: 'system' | 'user'; content: string }[] = [];
      const fullText = extractText(editor.getJSON());
      if (kind === 'continue') {
        const tail = fullText.slice(-500);
        messages = [
          { role: 'system', content: 'Continue the user\'s text in their voice. Be concise. Do not repeat what was written.' },
          { role: 'user', content: tail },
        ];
      } else if (kind === 'summarize') {
        messages = [
          { role: 'system', content: 'Summarize the user\'s note in 2-4 sentences. No preamble.' },
          { role: 'user', content: fullText },
        ];
        // Insert a callout at the top first.
        editor.chain().focus().setTextSelection(0).insertContentAt(0, {
          type: 'callout', attrs: { emoji: '📝', variant: 'info' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
        }).run();
        // Move selection inside the just-inserted callout's paragraph.
        editor.commands.setTextSelection(2);
      } else {
        const { from, to, empty } = editor.state.selection;
        if (empty) { toast.warning('Select some text first', 'Highlight what you want to improve.'); return; }
        const selected = editor.state.doc.textBetween(from, to, ' ');
        editor.chain().focus().deleteRange({ from, to }).run();
        messages = [
          { role: 'system', content: 'Rewrite the user\'s text to be clearer and more polished. Output only the rewrite, no preamble.' },
          { role: 'user', content: selected },
        ];
      }
      let buf = '';
      for await (const chunk of streamChat(messages as any)) {
        buf += chunk;
        editor.chain().insertContent(chunk).run();
      }
      if (!buf) editor.chain().insertContent(' [AI returned nothing]').run();
    } catch (e: any) {
      console.error('[ai]', e);
      toast.error('AI command failed', e?.message ?? String(e));
    }
  }, []);

  // editorKey removed — editor is kept stable across note switches via setContent.
  const breadcrumb = useMemo(() => active ? getPath(notes, active.id) : [], [active, notes]);

  return (
    <div className="flex h-full bg-canvas dark:bg-ink text-ink dark:text-[#ECECEC] relative">
      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <div
        className={`md:static md:translate-x-0 fixed top-0 left-0 z-40 h-full transition-transform duration-200 ease-out ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <Sidebar
          notes={notes}
          activeId={activeId}
          query={query}
          setQuery={setQuery}
          onSelect={(id) => { setActiveId(id); setDrawerOpen(false); }}
          onCreate={handleCreate}
          onCreateChild={handleCreateChild}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onRename={handleRename}
          onMove={handleMove}
          onToggleStar={handleToggleStar}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenQuickSwitch={() => setSwitchOpen(true)}
          recentIds={recent}
          theme={theme}
          toggleTheme={toggle}
        />
      </div>
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="flex items-center justify-between px-3 md:px-6 py-3 border-b border-warm-200 dark:border-[#1f1f23] gap-2 md:gap-3">
          <button
            className="md:hidden p-1.5 rounded-md border border-warm-200 dark:border-[#26262b] hover:bg-warm-100 dark:hover:bg-[#1c1c20]"
            onClick={() => setDrawerOpen(o => !o)}
            aria-label="Open navigation"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 text-xs text-warm-500 truncate min-w-0 flex-1">
            {breadcrumb.length === 0 ? (
              <span>Pensive</span>
            ) : breadcrumb.map((n, i) => (
              <span key={n.id} className="flex items-center gap-1 truncate">
                {i > 0 && <ChevronRight className="w-3 h-3 shrink-0" />}
                <button
                  onClick={() => setActiveId(n.id)}
                  className={`truncate hover:text-ink dark:hover:text-white ${i === breadcrumb.length - 1 ? 'text-ink dark:text-white font-medium' : ''}`}
                >
                  {n.title || 'Untitled'}
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {meeting.state.status === 'recording' || meeting.state.status === 'starting' || meeting.state.status === 'finishing' ? (
              <button
                onClick={stopMeeting}
                disabled={meeting.state.status !== 'recording'}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-red-400/60 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/20 transition disabled:opacity-60"
                title="Stop meeting & summarize"
              >
                <Square className="w-3.5 h-3.5" fill="currentColor" />
                <span className="hidden sm:inline">
                  {meeting.state.status === 'starting' ? 'Starting…' : meeting.state.status === 'finishing' ? 'Finishing…' : `${String(Math.floor(meetingElapsed/60)).padStart(2,'0')}:${String(meetingElapsed%60).padStart(2,'0')}`}
                </span>
              </button>
            ) : (
              <button
                onClick={startMeeting}
                disabled={!audioCaps.supported}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-warm-200 dark:border-[#26262b] hover:bg-warm-100 dark:hover:bg-[#1c1c20] text-warm-700 dark:text-warm-300 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                title={audioCaps.supported ? 'Start meeting (long-form recording + AI summary)' : `Meeting recording unavailable — ${audioCaps.reason ?? 'browser does not support audio capture.'}`}
              >
                {audioCaps.supported
                  ? <Mic className="w-3.5 h-3.5" />
                  : <MicOff className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Meeting</span>
              </button>
            )}
            {active && (
              <button
                onClick={() => handleToggleStar(active.id)}
                className={`p-1.5 rounded-md border border-warm-200 dark:border-[#26262b] hover:bg-warm-100 dark:hover:bg-[#1c1c20] transition ${active.starred ? 'text-yellow-500' : 'text-warm-500'}`}
                title={active.starred ? 'Unstar' : 'Star'}
              >
                <Star className="w-3.5 h-3.5" fill={active.starred ? 'currentColor' : 'none'} />
              </button>
            )}
            <button
              onClick={() => setGraphOpen(true)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-warm-200 dark:border-[#26262b] hover:bg-warm-100 dark:hover:bg-[#1c1c20] text-warm-700 dark:text-warm-300 transition"
              title="Knowledge graph"
            >
              <Network className="w-3.5 h-3.5" /> Graph
            </button>
            <button
              onClick={() => setChatOpen(true)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-amethyst-300/50 bg-amethyst-50 dark:bg-amethyst-500/10 hover:bg-amethyst-50/80 dark:hover:bg-amethyst-500/20 text-amethyst-700 dark:text-amethyst-300 transition"
              title="Ask your notes (⌘K)"
            >
              <Sparkles className="w-3.5 h-3.5" /> Ask
              <kbd className="ml-1 hidden sm:inline text-[10px] px-1 py-0.5 rounded bg-white/60 dark:bg-black/30 border border-amethyst-300/40">⌘K</kbd>
            </button>
            <button
              onClick={() => setExportChooserOpen(true)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-warm-200 dark:border-[#26262b] hover:bg-warm-100 dark:hover:bg-[#1c1c20] text-warm-700 dark:text-warm-300 transition"
              title="Export this note or full workspace"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button
              onClick={() => setImportChooserOpen(true)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-warm-200 dark:border-[#26262b] hover:bg-warm-100 dark:hover:bg-[#1c1c20] text-warm-700 dark:text-warm-300 transition"
              title="Import a note or workspace"
            >
              <Upload className="w-3.5 h-3.5" /> Import
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-[760px] mx-auto px-4 md:px-6 py-6 md:py-10">
            {active ? (
              <>
                <TagChips
                  tags={active.tags ?? []}
                  onChange={(tags) => handleSetTags(active.id, tags)}
                  onAutoTag={handleAutoTag}
                  autoTagging={autoTagging}
                />
                <ErrorBoundary
                  fallback={
                    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                      <div className="text-2xl">🪶</div>
                      <div className="text-sm text-warm-500">The editor hit a snag. Switching notes or reloading usually fixes it.</div>
                      <button
                        onClick={() => location.reload()}
                        className="px-3 py-1.5 rounded-md bg-amethyst-500 text-white text-sm hover:bg-amethyst-600"
                      >
                        Reload app
                      </button>
                    </div>
                  }
                >
                  <NoteEditor
                    noteId={active.id}
                    initialContent={active.content}
                    onChange={handleEditorChange}
                    onEditor={ed => { editorRef.current = ed; }}
                    notes={notes}
                    onOpenNote={setActiveId}
                    onAICommand={onAICommand}
                  />
                </ErrorBoundary>
                <RelatedNotes
                  noteId={active.id}
                  noteUpdatedAt={active.updatedAt}
                  onOpen={setActiveId}
                />
              </>
            ) : (
              <div className="text-warm-500 text-center py-20">
                <p>No note selected. Create a new one from the sidebar.</p>
              </div>
            )}
          </div>
        </div>

        <footer className="border-t border-warm-200 dark:border-[#1f1f23] px-6 py-3 flex items-center justify-between gap-4 bg-warm-100 dark:bg-[#141417]">
          <MicButton
            status={transcriber.state.status}
            message={transcriber.state.message}
            progress={transcriber.state.progress}
            onStart={startMic}
            onStop={stopMic}
          />
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-warm-500 px-3 py-1 rounded-full bg-warm-100 dark:bg-[#1c1c20] border border-warm-200 dark:border-[#26262b]">
            <Lock className="w-3 h-3" /> On-device · <kbd className="px-1 rounded bg-white/70 dark:bg-black/40 border border-warm-200 dark:border-[#26262b]">⌘K</kbd> ask · <kbd className="px-1 rounded bg-white/70 dark:bg-black/40 border border-warm-200 dark:border-[#26262b]">⌘P</kbd> switch · <kbd className="px-1 rounded bg-white/70 dark:bg-black/40 border border-warm-200 dark:border-[#26262b]">/</kbd> commands
          </div>
          <button
            onClick={() => setPricingOpen(true)}
            className="flex items-center gap-1 text-[11px] text-warm-600 dark:text-warm-300 hover:text-amethyst-600 dark:hover:text-amethyst-300 transition"
            title="View pricing"
          >
            <CreditCard className="w-3 h-3" /> Upgrade
          </button>
        </footer>
      </main>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={tSettings}
        setSettings={setTSettings}
        onClearAll={handleClearAll}
        onImportZip={handleImportZip}
      />
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        notes={notes}
        onJumpToNote={(id) => setActiveId(id)}
      />
      <QuickSwitcher
        open={switchOpen}
        notes={notes}
        onClose={() => setSwitchOpen(false)}
        onSelect={(id) => setActiveId(id)}
      />
      {graphOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-40 flex items-center justify-center bg-canvas dark:bg-ink text-warm-500 text-sm">Loading graph…</div>}>
          <GraphView
            notes={notes}
            onOpen={(id) => setActiveId(id)}
            onClose={() => setGraphOpen(false)}
          />
        </Suspense>
      )}
      <Pricing open={pricingOpen} onClose={() => setPricingOpen(false)} />

      {/* Live meeting overlay */}
      {(meeting.state.status === 'recording' || meeting.state.status === 'starting' || meeting.state.status === 'finishing' || meetingSummarizing) && (
        <div className="fixed bottom-4 right-4 z-40 w-[min(380px,calc(100vw-2rem))] rounded-xl border border-red-300/60 dark:border-red-500/40 bg-white/95 dark:bg-[#16161a]/95 backdrop-blur shadow-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className={`relative flex h-2.5 w-2.5 ${meeting.state.status === 'recording' ? '' : 'opacity-50'}`}>
              {meeting.state.status === 'recording' && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
              )}
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-medium text-red-700 dark:text-red-300">
              {meetingSummarizing ? 'Summarizing meeting…' :
                meeting.state.status === 'starting' ? 'Requesting mic…' :
                meeting.state.status === 'finishing' ? 'Finalizing transcript…' :
                `Recording — ${String(Math.floor(meetingElapsed/60)).padStart(2,'0')}:${String(meetingElapsed%60).padStart(2,'0')} · ${meeting.state.chunkCount} chunk${meeting.state.chunkCount===1?'':'s'}`}
            </span>
          </div>
          <div className="text-[11px] text-warm-600 dark:text-warm-400 max-h-24 overflow-y-auto scrollbar-thin whitespace-pre-wrap">
            {meeting.state.transcript || <span className="italic text-warm-500">Live transcript will appear here as ~30s chunks finish…</span>}
          </div>
        </div>
      )}

      {/* Hidden file input for markdown imports. */}
      <input
        ref={mdFileInputRef}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        className="hidden"
        onChange={handleMarkdownFileChosen}
      />
      <input
        ref={jsonFileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleJsonFileChosen}
      />
      <input
        ref={zipFileInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={handleZipFileChosen}
      />

      {/* Export format chooser */}
      {exportChooserOpen && (
        <FormatChooser
          title="Export"
          subtitle="Pick a format. JSON & ZIP are lossless — Markdown is portable but loses callouts, toggles, and cell colors."
          icon={<Download className="w-5 h-5 text-amethyst-500" />}
          onClose={() => setExportChooserOpen(false)}
          options={[
            {
              icon: <FileText className="w-5 h-5 text-amethyst-500" />,
              title: 'Markdown (.md)',
              hint: 'Portable plain text — paste into Obsidian, Notion, GitHub. Lossy: callouts → blockquotes, toggles flatten.',
              disabled: !active,
              disabledHint: 'Open a page first to export',
              onClick: () => { setExportChooserOpen(false); handleExport(); },
            },
            {
              icon: <FileJson className="w-5 h-5 text-amethyst-500" />,
              title: 'JSON (.pensive.json)',
              hint: 'Lossless single-note backup. Preserves callouts, toggles, tables, tags, timestamps.',
              disabled: !active,
              disabledHint: 'Open a page first to export',
              onClick: () => { setExportChooserOpen(false); handleExportJson(); },
            },
            {
              icon: <Archive className="w-5 h-5 text-amethyst-500" />,
              title: 'Workspace ZIP',
              hint: `Lossless full backup of all ${notes.length} note${notes.length === 1 ? '' : 's'}. Use this to move between devices.`,
              onClick: () => { setExportChooserOpen(false); handleExportZip(); },
            },
          ]}
        />
      )}

      {/* Import format chooser */}
      {importChooserOpen && (
        <FormatChooser
          title="Import"
          subtitle="Pick the file format you have."
          icon={<Upload className="w-5 h-5 text-amethyst-500" />}
          onClose={() => setImportChooserOpen(false)}
          options={[
            {
              icon: <FileText className="w-5 h-5 text-amethyst-500" />,
              title: 'Markdown (.md / .txt)',
              hint: 'Import a single markdown file. You can append to current page or create a new one.',
              onClick: () => { setImportChooserOpen(false); handleImportMarkdownClick(); },
            },
            {
              icon: <FileJson className="w-5 h-5 text-amethyst-500" />,
              title: 'JSON (.pensive.json)',
              hint: 'Restore a single-note or multi-note JSON backup with full fidelity.',
              onClick: () => { setImportChooserOpen(false); handleImportJsonClick(); },
            },
            {
              icon: <Archive className="w-5 h-5 text-amethyst-500" />,
              title: 'Workspace ZIP',
              hint: 'Restore an entire workspace from a Pensive ZIP backup. Merges with existing notes (newer-wins).',
              onClick: () => { setImportChooserOpen(false); handleImportZipClick(); },
            },
          ]}
        />
      )}

      {/* Markdown import chooser modal */}
      {mdImportPending && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setMdImportPending(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white dark:bg-[#16161a] border border-warm-200 dark:border-[#26262b] shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-2">
              <div className="flex items-center gap-2 mb-2">
                <Upload className="w-5 h-5 text-amethyst-500" />
                <h3 className="text-lg font-semibold">Import markdown</h3>
              </div>
              <p className="text-sm text-warm-500 mb-1">
                Detected title: <span className="font-medium text-warm-700 dark:text-warm-300">{mdImportPending.title}</span>
              </p>
              <p className="text-sm text-warm-500">How do you want to import it?</p>
            </div>
            <div className="px-5 pb-5 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={handleMarkdownImportNewPage}
                className="group flex flex-col items-start gap-1.5 p-3 rounded-lg border border-warm-200 dark:border-[#26262b] hover:border-amethyst-400 hover:bg-amethyst-50 dark:hover:bg-amethyst-900/10 transition text-left"
              >
                <FilePlus className="w-5 h-5 text-amethyst-500" />
                <div className="font-medium text-sm">Create new page</div>
                <div className="text-[11px] text-warm-500 leading-snug">Add as a brand-new page in your workspace.</div>
              </button>
              <button
                onClick={handleMarkdownImportInsert}
                disabled={!active}
                className="group flex flex-col items-start gap-1.5 p-3 rounded-lg border border-warm-200 dark:border-[#26262b] hover:border-amethyst-400 hover:bg-amethyst-50 dark:hover:bg-amethyst-900/10 transition text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-warm-200 disabled:hover:bg-transparent"
                title={!active ? 'Open a page first to insert into it' : undefined}
              >
                <FileInput className="w-5 h-5 text-amethyst-500" />
                <div className="font-medium text-sm">Insert into current page</div>
                <div className="text-[11px] text-warm-500 leading-snug">Append the markdown at the cursor of the open page.</div>
              </button>
            </div>
            <div className="px-5 pb-4 flex justify-end">
              <button
                onClick={() => setMdImportPending(null)}
                className="text-xs text-warm-500 hover:text-warm-700 dark:hover:text-warm-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Suppress unused import — deleteNote kept for API compat reference.

interface FormatOption {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  disabledHint?: string;
}

function FormatChooser({
  title, subtitle, icon, onClose, options,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onClose: () => void;
  options: FormatOption[];
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white dark:bg-[#16161a] border border-warm-200 dark:border-[#26262b] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-2 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">{icon}<h3 className="text-lg font-semibold">{title}</h3></div>
            <p className="text-sm text-warm-500">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-warm-400 hover:text-warm-700 dark:hover:text-warm-200 -mt-1 -mr-1 p-1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 pb-5 pt-3 grid grid-cols-1 gap-2">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={opt.onClick}
              disabled={opt.disabled}
              title={opt.disabled ? opt.disabledHint : undefined}
              className="group flex items-start gap-3 p-3 rounded-lg border border-warm-200 dark:border-[#26262b] hover:border-amethyst-400 hover:bg-amethyst-50 dark:hover:bg-amethyst-900/10 transition text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-warm-200 disabled:hover:bg-transparent"
            >
              <div className="mt-0.5 shrink-0">{opt.icon}</div>
              <div className="flex-1">
                <div className="font-medium text-sm">{opt.title}</div>
                <div className="text-[11px] text-warm-500 leading-snug mt-0.5">{opt.hint}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
void deleteNote;
