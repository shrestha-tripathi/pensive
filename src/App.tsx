import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { Download, Lock, Sparkles, Star, ChevronRight, Archive, Network, Menu, Mic, MicOff, Square, CreditCard } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { NoteEditor } from './components/Editor';
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

  const handleCreate = useCallback(async () => {
    const n = newNote(null, nextRootOrder());
    await putNote(n);
    setNotes(prev => [...prev, n]);
    setActiveId(n.id);
  }, [nextRootOrder]);

  const handleCreateChild = useCallback(async (parentId: string) => {
    const siblings = notes.filter(x => x.parentId === parentId);
    const order = siblings.length ? Math.max(...siblings.map(s => s.order ?? 0)) + 1 : 0;
    const n = newNote(parentId, order);
    await putNote(n);
    setNotes(prev => [...prev, n]);
    setActiveId(n.id);
  }, [notes]);

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

  const handleExportZip = useCallback(async () => {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const safe = (s: string) => s.replace(/[^\w\-\. ]+/g, '_').slice(0, 80) || 'note';
    for (const n of notes) {
      const path = getPath(notes, n.id);
      const dir = path.slice(0, -1).map(p => safe(p.title || 'Untitled')).join('/');
      const file = `${safe(n.title || 'Untitled')}-${n.id.slice(0, 6)}.md`;
      const md = `# ${n.title || 'Untitled'}\n\n${jsonToMarkdown(n.content)}\n`;
      zip.file(dir ? `${dir}/${file}` : file, md);
    }
    // Lossless manifest — used by Import to restore IDs, parents, tags, timestamps, etc.
    const manifest = {
      version: 1,
      exportedAt: Date.now(),
      app: 'pensive',
      notes,
    };
    zip.file('pensive.json', JSON.stringify(manifest, null, 2));
    zip.file('README.txt',
      'This ZIP contains your Pensive workspace.\n' +
      '• .md files: human-readable export, organized by folder.\n' +
      '• pensive.json: lossless manifest used when importing back into Pensive\n' +
      '  (preserves note IDs, parents, tags, timestamps, and rich formatting).\n' +
      '\nTo restore on another device: open Settings → Import workspace ZIP.\n');
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

  const startMic = useCallback(async () => {
    try { await transcriber.startRecording(); } catch (e) { console.error(e); }
  }, [transcriber]);

  const stopMic = useCallback(async () => {
    const text = await transcriber.stopAndTranscribe();
    if (text && editorRef.current) {
      editorRef.current.chain().focus().insertContent(text + ' ').run();
    }
  }, [transcriber]);

  const startMeeting = useCallback(async () => {
    try {
      meetingStartRef.current = Date.now();
      setMeetingElapsed(0);
      await meeting.start();
    } catch (e: any) {
      console.error('[meeting]', e);
      alert('Could not start meeting: ' + (e?.message ?? e));
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
        if (empty) { alert('Select text to improve first.'); return; }
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
      alert('AI command failed: ' + (e?.message ?? e));
    }
  }, []);

  const editorKey = useMemo(() => active?.id ?? 'none', [active?.id]);
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
              onClick={handleExport}
              disabled={!active}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-warm-200 dark:border-[#26262b] hover:bg-warm-100 dark:hover:bg-[#1c1c20] text-warm-700 dark:text-warm-300 disabled:opacity-50 transition"
            >
              <Download className="w-3.5 h-3.5" /> .md
            </button>
            <button
              onClick={handleExportZip}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-warm-200 dark:border-[#26262b] hover:bg-warm-100 dark:hover:bg-[#1c1c20] text-warm-700 dark:text-warm-300 transition"
              title="Export entire workspace as ZIP"
            >
              <Archive className="w-3.5 h-3.5" /> ZIP
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
                <NoteEditor
                  key={editorKey}
                  noteId={active.id}
                  initialContent={active.content}
                  onChange={handleEditorChange}
                  onEditor={ed => { editorRef.current = ed; }}
                  notes={notes}
                  onOpenNote={setActiveId}
                  onAICommand={onAICommand}
                />
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

        <footer className="border-t border-warm-200 dark:border-[#1f1f23] px-6 py-3 flex items-center justify-between gap-4 bg-warm-100/40 dark:bg-[#141417]">
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
    </div>
  );
}

// Suppress unused import — deleteNote kept for API compat reference.
void deleteNote;
