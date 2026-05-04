import { useEffect, useMemo, useRef, useState } from 'react';
import { X, RefreshCw, AlertTriangle } from 'lucide-react';
import type { Note } from '../lib/db';
import { getAllEmbeddings } from '../lib/db';
import { cosine } from '../lib/embeddings';
import { reindexAll } from '../lib/vectorIndex';

interface Props {
  notes: Note[];
  onOpen: (id: string) => void;
  onClose: () => void;
}

interface GraphData {
  nodes: { id: string; name: string; tag?: string; color: string }[];
  links: { source: string; target: string; value: number }[];
}

const PALETTE = [
  '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6',
  '#EF4444', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

function colorForTag(tag: string | undefined, mapping: Map<string, string>): string {
  if (!tag) return '#9CA3AF';
  if (mapping.has(tag)) return mapping.get(tag)!;
  const c = PALETTE[mapping.size % PALETTE.length];
  mapping.set(tag, c);
  return c;
}

const THRESHOLD = 0.65;

export default function GraphView({ notes, onOpen, onClose }: Props) {
  const [data, setData] = useState<GraphData | null>(null);
  const [ForceGraph, setForceGraph] = useState<any>(null);
  const [chunkErr, setChunkErr] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    let cancelled = false;
    const load = (attempt = 0) => {
      import('react-force-graph-2d')
        .then(m => { if (!cancelled) { setForceGraph(() => m.default); setChunkErr(null); } })
        .catch(err => {
          if (cancelled) return;
          console.warn('[graph] chunk load failed', err);
          if (attempt < 2) setTimeout(() => load(attempt + 1), 800 * (attempt + 1));
          else setChunkErr(err?.message || 'Could not load graph renderer.');
        });
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const triggerReindex = async () => {
    setReindexing(true);
    setReindexMsg('Starting…');
    try {
      const n = await reindexAll({ onProgress: (d, t) => setReindexMsg(`Indexing ${d}/${t}…`) });
      setReindexMsg(`Indexed ${n} notes. Reloading graph…`);
      // re-trigger embedding fetch
      const all = await getAllEmbeddings();
      if (all.length === 0) { setReindexMsg('No embeddings produced — check console.'); return; }
      // force the data effect to re-run by toggling notes ref via a no-op: just recompute here
      window.dispatchEvent(new Event('pensive:reindexed'));
    } catch (e: any) {
      setReindexMsg('Failed: ' + (e?.message ?? e));
    } finally {
      setReindexing(false);
    }
  };

  useEffect(() => {
    const update = () => {
      if (wrapRef.current) {
        setSize({ w: wrapRef.current.clientWidth, h: wrapRef.current.clientHeight });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const all = await getAllEmbeddings();
      if (cancelled) return;
      // Group embeddings per note → use first chunk as "centroid" approximation.
      // Better: compute pairwise max-chunk similarity for accuracy.
      const byNote = new Map<string, typeof all>();
      for (const e of all) {
        const arr = byNote.get(e.noteId) ?? [];
        arr.push(e);
        byNote.set(e.noteId, arr);
      }
      const tagColors = new Map<string, string>();
      const noteById = new Map(notes.map(n => [n.id, n]));
      const nodes = [...byNote.keys()]
        .map(id => noteById.get(id))
        .filter((n): n is Note => !!n)
        .map(n => {
          const topTag = n.tags?.[0];
          return { id: n.id, name: n.title || 'Untitled', tag: topTag, color: colorForTag(topTag, tagColors) };
        });
      const ids = nodes.map(n => n.id);
      const links: GraphData['links'] = [];
      for (let i = 0; i < ids.length; i++) {
        const a = byNote.get(ids[i])!;
        for (let j = i + 1; j < ids.length; j++) {
          const b = byNote.get(ids[j])!;
          let best = -Infinity;
          for (const x of a) for (const y of b) {
            const s = cosine(x.vector, y.vector);
            if (s > best) best = s;
          }
          if (best >= THRESHOLD) links.push({ source: ids[i], target: ids[j], value: best });
        }
      }
      if (!cancelled) setData({ nodes, links });
    };
    run();
    const handler = () => run();
    window.addEventListener('pensive:reindexed', handler);
    return () => { cancelled = true; window.removeEventListener('pensive:reindexed', handler); };
  }, [notes]);

  const stats = useMemo(() => data
    ? `${data.nodes.length} notes · ${data.links.length} links (≥ ${THRESHOLD})`
    : 'Computing graph…', [data]);

  return (
    <div className="fixed inset-0 z-40 bg-canvas dark:bg-ink flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-warm-200 dark:border-[#1f1f23]">
        <div>
          <div className="font-semibold">Knowledge Graph</div>
          <div className="text-xs text-warm-500">{stats}</div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-warm-100 dark:hover:bg-[#1c1c20]" title="Close">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div ref={wrapRef} className="flex-1 overflow-hidden">
        {chunkErr ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            <div className="text-sm font-medium">Couldn't load the graph renderer.</div>
            <div className="text-xs text-warm-500 max-w-md">{chunkErr}<br/>This usually means a network blip while loading the chunk. Refresh the page and try again.</div>
            <button onClick={() => window.location.reload()} className="text-xs px-3 py-1.5 rounded-md border border-warm-200 dark:border-[#26262b] hover:bg-warm-100 dark:hover:bg-[#1c1c20]">Reload page</button>
          </div>
        ) : ForceGraph && data && data.nodes.length > 0 ? (
          <ForceGraph
            graphData={data}
            width={size.w}
            height={size.h}
            nodeLabel={(n: any) => n.name}
            nodeColor={(n: any) => n.color}
            nodeRelSize={5}
            linkColor={() => 'rgba(139,92,246,0.25)'}
            linkWidth={(l: any) => Math.max(0.5, (l.value - THRESHOLD) * 6)}
            onNodeClick={(n: any) => { onOpen(n.id); onClose(); }}
            cooldownTicks={80}
          />
        ) : data && data.nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
            <div className="text-4xl">🕸️</div>
            <div className="text-sm font-medium">No graph yet</div>
            <div className="text-xs text-warm-500 max-w-md">
              The knowledge graph needs note embeddings to draw connections. Either you haven't written any notes yet, or embeddings haven't been generated (the embedder may have failed earlier — fixed now).
            </div>
            <button
              onClick={triggerReindex}
              disabled={reindexing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-amethyst-300 dark:border-amethyst-500/40 bg-amethyst-50 dark:bg-amethyst-500/10 text-amethyst-700 dark:text-amethyst-300 hover:bg-amethyst-100 dark:hover:bg-amethyst-500/20 transition disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reindexing ? 'animate-spin' : ''}`} />
              {reindexing ? 'Indexing…' : 'Index all notes now'}
            </button>
            {reindexMsg && <div className="text-[11px] text-warm-500">{reindexMsg}</div>}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-warm-500 text-sm">Loading graph…</div>
        )}
      </div>
    </div>
  );
}
