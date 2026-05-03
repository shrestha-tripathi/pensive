import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Lock, Sparkles } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { NoteEditor } from './components/Editor';
import { Sidebar } from './components/Sidebar';
import { SettingsPanel } from './components/Settings';
import { MicButton } from './components/MicButton';
import { useTheme } from './hooks/useTheme';
import { useTranscriber, type TranscriberSettings } from './hooks/useTranscriber';
import {
  clearAll,
  deleteNote,
  deriveTitle,
  extractText,
  getNote,
  jsonToMarkdown,
  listNotes,
  newNote,
  putNote,
  type Note,
} from './lib/db';
import { sampleNote } from './lib/sample';
import { ChatPanel } from './components/ChatPanel';
import { indexNote, reindexStale } from './lib/vectorIndex';

export function App() {
  const { theme, toggle } = useTheme();
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<Note | null>(null);
  const [query, setQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
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
  const saveTimer = useRef<number | null>(null);

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
      setActiveId(all[0].id);
      // Background reindex any missing/stale embeddings.
      const ric = (window as any).requestIdleCallback ?? ((cb: any) => setTimeout(cb, 800));
      ric(() => { reindexStale().catch(err => console.warn('[reindex]', err)); });
    })();
  }, []);

  // Cmd/Ctrl+K → toggle chat
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setChatOpen(o => !o);
      } else if (e.key === 'Escape' && chatOpen) {
        setChatOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chatOpen]);

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
      setNotes(prev => {
        const others = prev.filter(n => n.id !== updated.id);
        return [updated, ...others].sort((a, b) => b.updatedAt - a.updatedAt);
      });
      indexNote(updated).catch(err => console.warn('[indexNote]', err));
    }, 500);
  }, [active]);

  const handleCreate = useCallback(async () => {
    const n = newNote();
    await putNote(n);
    setNotes(prev => [n, ...prev]);
    setActiveId(n.id);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await deleteNote(id);
    setNotes(prev => {
      const next = prev.filter(n => n.id !== id);
      if (id === activeId) setActiveId(next[0]?.id ?? null);
      return next;
    });
  }, [activeId]);

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

  const startMic = useCallback(async () => {
    try { await transcriber.startRecording(); } catch (e) { console.error(e); }
  }, [transcriber]);

  const stopMic = useCallback(async () => {
    const text = await transcriber.stopAndTranscribe();
    if (text && editorRef.current) {
      editorRef.current.chain().focus().insertContent(text + ' ').run();
    }
  }, [transcriber]);

  const editorKey = useMemo(() => active?.id ?? 'none', [active?.id]);

  return (
    <div className="flex h-full bg-canvas dark:bg-ink text-ink dark:text-[#ECECEC]">
      <Sidebar
        notes={notes}
        activeId={activeId}
        query={query}
        setQuery={setQuery}
        onSelect={setActiveId}
        onCreate={handleCreate}
        onDelete={handleDelete}
        onOpenSettings={() => setSettingsOpen(true)}
        theme={theme}
        toggleTheme={toggle}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-3 border-b border-warm-200 dark:border-[#1f1f23]">
          <div className="text-sm text-warm-500 truncate">{active?.title || 'Pensive'}</div>
          <div className="flex items-center gap-2">
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
              <Download className="w-3.5 h-3.5" /> Export .md
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-[720px] mx-auto px-6 py-10">
            {active ? (
              <NoteEditor
                key={editorKey}
                noteId={active.id}
                initialContent={active.content}
                onChange={handleEditorChange}
                onEditor={ed => { editorRef.current = ed; }}
              />
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
            <Lock className="w-3 h-3" /> On-device · Press <kbd className="px-1 rounded bg-white/70 dark:bg-black/40 border border-warm-200 dark:border-[#26262b]">⌘K</kbd> to ask your notes
          </div>
        </footer>
      </main>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={tSettings}
        setSettings={setTSettings}
        onClearAll={handleClearAll}
      />
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        notes={notes}
        onJumpToNote={(id) => setActiveId(id)}
      />
    </div>
  );
}
