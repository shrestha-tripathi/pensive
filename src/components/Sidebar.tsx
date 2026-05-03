import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  Plus, Search, Settings as SettingsIcon, Moon, Sun, Feather,
  ChevronRight, ChevronDown, MoreHorizontal, FileText, Star, Clock, Hash,
} from 'lucide-react';
import {
  DndContext, type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Note, TreeNode } from '../lib/db';
import { buildTree, flattenTree } from '../lib/db';

interface Props {
  notes: Note[];
  activeId: string | null;
  query: string;
  setQuery: (q: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onCreateChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, parentId: string | null, beforeId: string | null) => void;
  onRename: (id: string, title: string) => void;
  onToggleStar: (id: string) => void;
  onOpenSettings: () => void;
  onOpenQuickSwitch: () => void;
  recentIds: string[];
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const EXP_KEY = 'pensive-expanded-v1';

function loadExpanded(): Set<string> {
  try {
    const raw = localStorage.getItem(EXP_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}
function saveExpanded(s: Set<string>) {
  try { localStorage.setItem(EXP_KEY, JSON.stringify([...s])); } catch {}
}

function Row({
  node, isActive, isExpanded, hasChildren, onSelect, onToggle, onAddChild,
  onMenu, dragMode,
}: {
  node: TreeNode;
  isActive: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onAddChild: () => void;
  onMenu: (e: React.MouseEvent) => void;
  dragMode: 'before' | 'after' | 'inside' | null;
}) {
  const sortable = useSortable({ id: node.note.id });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        paddingLeft: 6 + node.depth * 14,
      }}
      {...attributes}
      {...listeners}
      className={`group relative flex items-center gap-1 pr-1 py-1 rounded-md cursor-pointer text-[13px] ${
        isActive
          ? 'bg-amethyst-50 dark:bg-amethyst-500/10 text-amethyst-700 dark:text-amethyst-300'
          : 'hover:bg-warm-100 dark:hover:bg-[#1c1c20]'
      }`}
    >
      {dragMode === 'before' && <div className="absolute left-0 right-0 -top-px h-0.5 bg-amethyst-500 rounded" />}
      {dragMode === 'after'  && <div className="absolute left-0 right-0 -bottom-px h-0.5 bg-amethyst-500 rounded" />}
      {dragMode === 'inside' && <div className="absolute inset-0 ring-2 ring-amethyst-500/60 rounded-md pointer-events-none" />}
      <button
        onClick={e => { e.stopPropagation(); if (hasChildren) onToggle(); }}
        onPointerDown={e => e.stopPropagation()}
        className={`w-4 h-4 flex items-center justify-center text-warm-500 ${hasChildren ? '' : 'opacity-0'}`}
        aria-label={isExpanded ? 'Collapse' : 'Expand'}
      >
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
      <FileText className="w-3.5 h-3.5 text-warm-500 shrink-0" />
      <div onClick={onSelect} className="flex-1 truncate min-w-0 select-none">
        {node.note.title || 'Untitled'}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onMenu(e); }}
        onPointerDown={e => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 text-warm-500 hover:text-ink dark:hover:text-white p-0.5 rounded"
        title="Menu"
      ><MoreHorizontal className="w-3.5 h-3.5" /></button>
      <button
        onClick={e => { e.stopPropagation(); onAddChild(); }}
        onPointerDown={e => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 text-warm-500 hover:text-amethyst-600 p-0.5 rounded"
        title="Add child page"
      ><Plus className="w-3.5 h-3.5" /></button>
    </div>
  );
}

export function Sidebar(p: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(loadExpanded);
  useEffect(() => saveExpanded(expanded), [expanded]);

  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [dragOver, setDragOver] = useState<{ id: string; mode: 'before' | 'after' | 'inside' } | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const rowYRef = useRef<Map<string, DOMRect>>(new Map());

  const tree = useMemo(() => buildTree(p.notes), [p.notes]);

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of p.notes) for (const t of n.tags ?? []) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [p.notes]);

  // Search across all notes (flat)
  const filtered = useMemo(() => {
    if (tagFilter) {
      return p.notes.filter(n => (n.tags ?? []).includes(tagFilter));
    }
    if (!p.query.trim()) return null;
    const q = p.query.toLowerCase();
    return p.notes.filter(n => (n.title + ' ' + n.plainText).toLowerCase().includes(q));
  }, [p.query, p.notes, tagFilter]);

  const flat = useMemo(() => flattenTree(tree, expanded), [tree, expanded]);

  // Auto-expand parent chain when active note has parents.
  useEffect(() => {
    if (!p.activeId) return;
    const byId = new Map(p.notes.map(n => [n.id, n]));
    let cur = byId.get(p.activeId);
    const toAdd: string[] = [];
    while (cur?.parentId) {
      toAdd.push(cur.parentId);
      cur = byId.get(cur.parentId);
    }
    if (toAdd.length) {
      setExpanded(s => {
        const next = new Set(s);
        toAdd.forEach(id => next.add(id));
        return next;
      });
    }
  }, [p.activeId, p.notes]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragStart = (e: DragStartEvent) => {
    setActiveDragId(String(e.active.id));
    rowYRef.current.clear();
    document.querySelectorAll('[data-sidebar-row]').forEach(el => {
      const id = el.getAttribute('data-id');
      if (id) rowYRef.current.set(id, (el as HTMLElement).getBoundingClientRect());
    });
  };

  const onDragOver = (event: any) => {
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId || overId === activeDragId) { setDragOver(null); return; }
    const rect = rowYRef.current.get(overId);
    const y = event.activatorEvent ? (event.activatorEvent.clientY ?? 0) : 0;
    // Use the pointer Y from the event delta since dnd-kit does not expose pointer cleanly here.
    const ptrY = (event.delta && rect)
      ? (rowYRef.current.get(activeDragId!)?.top ?? 0) + (event.delta.y ?? 0) + (rect ? 10 : 0)
      : y;
    if (!rect) { setDragOver({ id: overId, mode: 'after' }); return; }
    const rel = (ptrY - rect.top) / rect.height;
    let mode: 'before' | 'after' | 'inside' = 'inside';
    if (rel < 0.25) mode = 'before';
    else if (rel > 0.75) mode = 'after';
    setDragOver({ id: overId, mode });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    const over = dragOver;
    setActiveDragId(null);
    setDragOver(null);
    if (!over || !e.over) return;
    if (over.id === activeId) return;
    // Prevent dropping into own descendants
    const byId = new Map(p.notes.map(n => [n.id, n]));
    const isDescendant = (cand: string, root: string) => {
      let cur = byId.get(cand);
      while (cur?.parentId) {
        if (cur.parentId === root) return true;
        cur = byId.get(cur.parentId);
      }
      return false;
    };
    if (over.id === activeId || isDescendant(over.id, activeId)) return;

    const target = byId.get(over.id);
    if (!target) return;

    if (over.mode === 'inside') {
      p.onMove(activeId, target.id, null);
    } else if (over.mode === 'before') {
      p.onMove(activeId, target.parentId ?? null, target.id);
    } else {
      // after: insert before next sibling under same parent
      const siblings = p.notes
        .filter(n => (n.parentId ?? null) === (target.parentId ?? null))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const idx = siblings.findIndex(n => n.id === target.id);
      const nextSibling = siblings[idx + 1];
      p.onMove(activeId, target.parentId ?? null, nextSibling?.id ?? null);
    }
  };

  // Recent + starred
  const starred = p.notes.filter(n => n.starred);
  const recents = p.recentIds
    .map(id => p.notes.find(n => n.id === id))
    .filter((n): n is Note => !!n)
    .slice(0, 5);

  const closeMenu = useCallback(() => setMenu(null), []);
  useEffect(() => {
    if (!menu) return;
    const h = () => closeMenu();
    window.addEventListener('click', h);
    window.addEventListener('blur', h);
    return () => { window.removeEventListener('click', h); window.removeEventListener('blur', h); };
  }, [menu, closeMenu]);

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
          <Plus className="w-4 h-4" /> New page
        </button>
        <button onClick={p.toggleTheme} aria-label="Toggle theme"
          className="px-2.5 rounded-lg border border-warm-200 dark:border-[#26262b] hover:bg-warm-100 dark:hover:bg-[#1c1c20] transition">
          {p.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button onClick={p.onOpenSettings} aria-label="Settings"
          className="px-2.5 rounded-lg border border-warm-200 dark:border-[#26262b] hover:bg-warm-100 dark:hover:bg-[#1c1c20] transition">
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3 pb-2 relative">
        <Search className="w-3.5 h-3.5 absolute left-5 top-1/2 -translate-y-1/2 text-warm-500" />
        <input
          value={p.query}
          onChange={e => p.setQuery(e.target.value)}
          onFocus={() => p.onOpenQuickSwitch()}
          placeholder="Search notes…  ⌘P"
          className="w-full pl-7 pr-2 py-1.5 text-sm rounded-md bg-white dark:bg-[#1a1a1d] border border-warm-200 dark:border-[#26262b] outline-none focus:border-amethyst-500 dark:focus:border-amethyst-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2">
        {filtered ? (
          <div className="py-1">
            <div className="text-[10px] uppercase tracking-wide text-warm-500 px-2 py-1 flex items-center justify-between">
              <span>{tagFilter ? <>Tag: <span className="text-amethyst-600">#{tagFilter}</span></> : 'Search'}</span>
              {tagFilter && (
                <button onClick={() => setTagFilter(null)} className="text-warm-500 hover:text-ink dark:hover:text-white normal-case tracking-normal">clear</button>
              )}
            </div>
            {filtered.length === 0 && <div className="text-xs text-warm-500 px-3 py-4 text-center">No matches</div>}
            {filtered.map(n => (
              <div key={n.id} onClick={() => p.onSelect(n.id)}
                className={`px-2 py-1 rounded text-[13px] cursor-pointer truncate ${
                  n.id === p.activeId ? 'bg-amethyst-50 dark:bg-amethyst-500/10 text-amethyst-700 dark:text-amethyst-300' : 'hover:bg-warm-100 dark:hover:bg-[#1c1c20]'
                }`}>
                {n.title || 'Untitled'}
              </div>
            ))}
          </div>
        ) : (
          <>
            {starred.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] uppercase tracking-wide text-warm-500 px-2 py-1 flex items-center gap-1"><Star className="w-3 h-3" /> Starred</div>
                {starred.map(n => (
                  <div key={n.id} onClick={() => p.onSelect(n.id)}
                    className={`px-2 py-1 rounded text-[13px] cursor-pointer truncate ${
                      n.id === p.activeId ? 'bg-amethyst-50 dark:bg-amethyst-500/10 text-amethyst-700 dark:text-amethyst-300' : 'hover:bg-warm-100 dark:hover:bg-[#1c1c20]'
                    }`}>★ {n.title || 'Untitled'}</div>
                ))}
              </div>
            )}
            {recents.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] uppercase tracking-wide text-warm-500 px-2 py-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Recent</div>
                {recents.map(n => (
                  <div key={n.id} onClick={() => p.onSelect(n.id)}
                    className={`px-2 py-1 rounded text-[13px] cursor-pointer truncate ${
                      n.id === p.activeId ? 'bg-amethyst-50 dark:bg-amethyst-500/10 text-amethyst-700 dark:text-amethyst-300' : 'hover:bg-warm-100 dark:hover:bg-[#1c1c20]'
                    }`}>{n.title || 'Untitled'}</div>
                ))}
              </div>
            )}
            {tagCounts.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] uppercase tracking-wide text-warm-500 px-2 py-1 flex items-center gap-1"><Hash className="w-3 h-3" /> Tags</div>
                <div className="flex flex-wrap gap-1 px-2 pb-1">
                  {tagCounts.slice(0, 30).map(([tag, count]) => (
                    <button
                      key={tag}
                      onClick={() => setTagFilter(tag)}
                      className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-warm-100 dark:bg-[#1c1c20] hover:bg-amethyst-50 dark:hover:bg-amethyst-500/10 text-warm-700 dark:text-warm-300 hover:text-amethyst-700 dark:hover:text-amethyst-300 border border-warm-200 dark:border-[#26262b]"
                    >
                      #{tag}<span className="opacity-60">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="text-[10px] uppercase tracking-wide text-warm-500 px-2 py-1">Pages</div>
            <DndContext sensors={sensors} collisionDetection={closestCenter}
              onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
              <SortableContext items={flat.map(n => n.note.id)} strategy={verticalListSortingStrategy}>
                {flat.map(node => (
                  <div key={node.note.id} data-sidebar-row data-id={node.note.id}>
                    <Row
                      node={node}
                      isActive={node.note.id === p.activeId}
                      isExpanded={expanded.has(node.note.id)}
                      hasChildren={node.children.length > 0}
                      onSelect={() => p.onSelect(node.note.id)}
                      onToggle={() => setExpanded(s => {
                        const next = new Set(s);
                        if (next.has(node.note.id)) next.delete(node.note.id); else next.add(node.note.id);
                        return next;
                      })}
                      onAddChild={() => {
                        setExpanded(s => new Set(s).add(node.note.id));
                        p.onCreateChild(node.note.id);
                      }}
                      onMenu={(e) => setMenu({ x: e.clientX, y: e.clientY, id: node.note.id })}
                      dragMode={dragOver?.id === node.note.id ? dragOver.mode : null}
                    />
                  </div>
                ))}
              </SortableContext>
            </DndContext>
            {flat.length === 0 && (
              <div className="text-xs text-warm-500 px-3 py-6 text-center">No pages yet — click "New page".</div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-warm-200 dark:border-[#1f1f23] px-3 py-2 text-[10px] text-warm-500 flex flex-wrap gap-x-3 gap-y-1">
        <span><kbd className="px-1 rounded bg-warm-100 dark:bg-[#1c1c20] border border-warm-200 dark:border-[#26262b]">⌘K</kbd> Ask</span>
        <span><kbd className="px-1 rounded bg-warm-100 dark:bg-[#1c1c20] border border-warm-200 dark:border-[#26262b]">⌘P</kbd> Switch</span>
        <span><kbd className="px-1 rounded bg-warm-100 dark:bg-[#1c1c20] border border-warm-200 dark:border-[#26262b]">⌘N</kbd> New</span>
        <span><kbd className="px-1 rounded bg-warm-100 dark:bg-[#1c1c20] border border-warm-200 dark:border-[#26262b]">/</kbd> Cmds</span>
      </div>

      {menu && (
        <div
          className="fixed z-50 min-w-[160px] bg-white dark:bg-[#1a1a1d] border border-warm-200 dark:border-[#26262b] rounded-lg shadow-xl py-1 text-sm"
          style={{ left: menu.x, top: menu.y }}
          onClick={e => e.stopPropagation()}
        >
          <button className="w-full text-left px-3 py-1.5 hover:bg-warm-100 dark:hover:bg-[#26262b]" onClick={() => {
            const t = prompt('Rename page', p.notes.find(n => n.id === menu.id)?.title ?? '');
            if (t != null) p.onRename(menu.id, t.trim() || 'Untitled');
            setMenu(null);
          }}>Rename</button>
          <button className="w-full text-left px-3 py-1.5 hover:bg-warm-100 dark:hover:bg-[#26262b]" onClick={() => { p.onDuplicate(menu.id); setMenu(null); }}>Duplicate</button>
          <button className="w-full text-left px-3 py-1.5 hover:bg-warm-100 dark:hover:bg-[#26262b]" onClick={() => { p.onToggleStar(menu.id); setMenu(null); }}>
            {p.notes.find(n => n.id === menu.id)?.starred ? 'Unstar' : 'Star'}
          </button>
          <button className="w-full text-left px-3 py-1.5 hover:bg-warm-100 dark:hover:bg-[#26262b]" onClick={() => { p.onCreateChild(menu.id); setMenu(null); }}>Add child page</button>
          <div className="my-1 border-t border-warm-200 dark:border-[#26262b]" />
          <button className="w-full text-left px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-600" onClick={() => { p.onDelete(menu.id); setMenu(null); }}>Delete</button>
        </div>
      )}
    </aside>
  );
}
