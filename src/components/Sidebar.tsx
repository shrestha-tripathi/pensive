import { Plus, Search, Trash2, Settings as SettingsIcon, Moon, Sun, Feather } from 'lucide-react';
import type { Note } from '../lib/db';

interface Props {
  notes: Note[];
  activeId: string | null;
  query: string;
  setQuery: (q: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

function fmtDate(t: number) {
  const d = new Date(t);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function Sidebar(p: Props) {
  const filtered = p.query.trim()
    ? p.notes.filter(n =>
        (n.title + ' ' + n.plainText).toLowerCase().includes(p.query.toLowerCase()),
      )
    : p.notes;

  return (
    <aside className="w-[280px] shrink-0 h-full border-r border-warm-200 dark:border-[#1f1f23] flex flex-col bg-warm-100/40 dark:bg-[#141417]">
      <div className="px-4 py-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amethyst-300 to-amethyst-700 flex items-center justify-center shadow-sm">
          <Feather className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="font-semibold leading-tight">Pensive</div>
          <div className="text-[11px] text-warm-500 leading-tight">Notes that never leave your device</div>
        </div>
      </div>

      <div className="px-3 pb-2 flex gap-2">
        <button
          onClick={p.onCreate}
          className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-amethyst-500 hover:bg-amethyst-600 text-white shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> New note
        </button>
        <button
          onClick={p.toggleTheme}
          aria-label="Toggle theme"
          className="px-2.5 rounded-lg border border-warm-200 dark:border-[#26262b] hover:bg-warm-100 dark:hover:bg-[#1c1c20] transition"
        >
          {p.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          onClick={p.onOpenSettings}
          aria-label="Settings"
          className="px-2.5 rounded-lg border border-warm-200 dark:border-[#26262b] hover:bg-warm-100 dark:hover:bg-[#1c1c20] transition"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3 pb-2 relative">
        <Search className="w-3.5 h-3.5 absolute left-5 top-1/2 -translate-y-1/2 text-warm-500" />
        <input
          value={p.query}
          onChange={e => p.setQuery(e.target.value)}
          placeholder="Search notes…"
          className="w-full pl-7 pr-2 py-1.5 text-sm rounded-md bg-white dark:bg-[#1a1a1d] border border-warm-200 dark:border-[#26262b] outline-none focus:border-amethyst-500 dark:focus:border-amethyst-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3">
        {filtered.length === 0 && (
          <div className="text-xs text-warm-500 px-3 py-6 text-center">
            {p.query ? 'No matches' : 'No notes yet — create one to begin.'}
          </div>
        )}
        {filtered.map(n => (
          <div
            key={n.id}
            onClick={() => p.onSelect(n.id)}
            className={`group cursor-pointer px-3 py-2.5 rounded-lg mb-0.5 transition ${
              n.id === p.activeId
                ? 'bg-amethyst-50 dark:bg-amethyst-500/10 text-amethyst-700 dark:text-amethyst-300'
                : 'hover:bg-warm-100 dark:hover:bg-[#1c1c20]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium truncate">{n.title || 'Untitled'}</div>
              <button
                onClick={e => { e.stopPropagation(); p.onDelete(n.id); }}
                className="opacity-0 group-hover:opacity-100 text-warm-500 hover:text-rose-500 transition"
                aria-label="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <div className="text-xs text-warm-500 truncate">{n.plainText.slice(0, 60) || 'Empty note'}</div>
              <div className="text-[10px] text-warm-500 shrink-0">{fmtDate(n.updatedAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
