import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, X, Loader2, ArrowUpRight, AlertTriangle } from 'lucide-react';
import { searchSimilar, type SearchHit } from '../lib/vectorIndex';
import { isWebGpuAvailable, isWebGpuUsable, streamChat, type ChatMsg } from '../lib/llm';
import type { Note } from '../lib/db';

interface Citation extends SearchHit { title: string }

interface ChatTurn {
  id: string;
  question: string;
  status: 'searching' | 'thinking' | 'streaming' | 'done' | 'error' | 'no-llm';
  loadingText?: string;
  answer: string;
  citations: Citation[];
  error?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  notes: Note[];
  onJumpToNote: (noteId: string) => void;
}

const SYSTEM_PROMPT = `You are Pensive, the user's private AI thinking partner. Answer ONLY using the provided note snippets. If the snippets don't contain the answer, say "I couldn't find that in your notes." Cite sources inline using [n] referring to the numbered snippets. Be concise and warm.`;

export function ChatPanel({ open, onClose, notes, onJumpToNote }: Props) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [webgpu, setWebgpu] = useState<boolean>(isWebGpuAvailable());
  useEffect(() => {
    // Real adapter probe — overrides the optimistic sync check above.
    isWebGpuUsable().then(setWebgpu);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  const noteById = useMemo(() => {
    const m = new Map<string, Note>();
    for (const n of notes) m.set(n.id, n);
    return m;
  }, [notes]);

  const ask = useCallback(async (question: string) => {
    if (!question.trim() || busy) return;
    setBusy(true);
    const id = crypto.randomUUID();
    const turn: ChatTurn = { id, question, status: 'searching', loadingText: 'Searching your notes…', answer: '', citations: [] };
    setTurns(prev => [...prev, turn]);
    const update = (patch: Partial<ChatTurn>) =>
      setTurns(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
    try {
      const hits = await searchSimilar(question, 5);
      const cits: Citation[] = hits.map(h => ({ ...h, title: noteById.get(h.noteId)?.title || 'Untitled' }));
      update({ citations: cits });

      if (!webgpu) {
        update({ status: 'no-llm', answer: cits.length ? 'Top matching notes from your library:' : "I couldn't find anything relevant in your notes." });
        setBusy(false);
        return;
      }

      if (cits.length === 0) {
        update({ status: 'done', answer: "I couldn't find that in your notes." });
        setBusy(false);
        return;
      }

      const context = cits
        .map((c, i) => `[${i + 1}] (from "${c.title}")\n${c.text}`)
        .join('\n\n');
      const messages: ChatMsg[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Notes:\n\n${context}\n\nQuestion: ${question}` },
      ];

      update({ status: 'thinking', loadingText: 'Thinking…' });
      let acc = '';
      let firstToken = true;
      for await (const tok of streamChat(messages, p => {
        if (firstToken) update({ loadingText: p.text || 'Loading model…' });
      })) {
        if (firstToken) { update({ status: 'streaming', loadingText: undefined }); firstToken = false; }
        acc += tok;
        update({ answer: acc });
      }
      update({ status: 'done' });
    } catch (e: any) {
      console.error(e);
      update({ status: 'error', error: e?.message ?? 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  }, [busy, noteById, webgpu]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput('');
    ask(q);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-10 bg-black/50 backdrop-blur-md"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full max-w-2xl bg-canvas dark:bg-[#17171a] rounded-2xl shadow-2xl border border-warm-200 dark:border-[#26262b] flex flex-col overflow-hidden max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            <header className="flex items-center justify-between px-5 py-3 border-b border-warm-200 dark:border-[#1f1f23]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amethyst-300 to-amethyst-700 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Ask your notes</div>
                  <div className="text-[11px] text-warm-500">{webgpu ? 'Local RAG · everything stays on-device' : 'Semantic search (no WebGPU)'}</div>
                </div>
              </div>
              <button onClick={onClose} className="text-warm-500 hover:text-warm-700 dark:hover:text-warm-300" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scrollbar-thin">
              {turns.length === 0 && (
                <div className="text-center py-10">
                  <div className="text-warm-500 text-sm mb-2">Ask anything about your notes.</div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {['What is this app?', 'Summarize my recent notes', 'What did I write about?'].map(s => (
                      <button
                        key={s}
                        onClick={() => ask(s)}
                        className="text-xs px-2.5 py-1.5 rounded-full border border-warm-200 dark:border-[#26262b] hover:bg-warm-100 dark:hover:bg-[#1c1c20] text-warm-700 dark:text-warm-300 transition"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {turns.map(t => (
                <div key={t.id} className="space-y-2">
                  <div className="flex justify-end">
                    <div className="max-w-[85%] px-3.5 py-2 rounded-2xl rounded-br-md bg-amethyst-500 text-white text-sm">
                      {t.question}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(t.status === 'searching' || t.status === 'thinking') && (
                      <div className="flex items-center gap-2 text-sm text-warm-500">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t.loadingText}
                      </div>
                    )}
                    {t.status === 'error' && (
                      <div className="flex items-start gap-2 text-sm text-rose-600">
                        <AlertTriangle className="w-4 h-4 mt-0.5" /> {t.error}
                      </div>
                    )}
                    {t.answer && (
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="text-sm text-ink dark:text-[#ECECEC] leading-relaxed whitespace-pre-wrap"
                      >
                        {t.answer}
                      </motion.div>
                    )}
                    {t.citations.length > 0 && (t.status === 'done' || t.status === 'streaming' || t.status === 'no-llm') && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {t.citations.map((c, i) => (
                          <button
                            key={`${c.noteId}-${c.chunkIdx}`}
                            onClick={() => { onJumpToNote(c.noteId); onClose(); }}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amethyst-50 dark:bg-amethyst-500/10 text-amethyst-700 dark:text-amethyst-300 border border-amethyst-300/40 hover:bg-amethyst-50/80 dark:hover:bg-amethyst-500/20 transition"
                            title={c.text.slice(0, 200)}
                          >
                            <ArrowUpRight className="w-3 h-3" />
                            <span className="font-medium">[{i + 1}]</span>
                            <span className="truncate max-w-[200px]">{c.title}</span>
                            <span className="opacity-60">· chunk {c.chunkIdx + 1}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={submit} className="border-t border-warm-200 dark:border-[#1f1f23] p-3 flex items-end gap-2 bg-warm-100/40 dark:bg-[#141417]">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                rows={1}
                placeholder="Ask your notes anything…"
                className="flex-1 resize-none px-3 py-2 text-sm bg-white dark:bg-[#1a1a1d] border border-warm-200 dark:border-[#26262b] rounded-lg outline-none focus:border-amethyst-500 dark:focus:border-amethyst-500"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="p-2 rounded-lg bg-amethyst-500 hover:bg-amethyst-600 text-white disabled:opacity-40 transition"
                aria-label="Send"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
