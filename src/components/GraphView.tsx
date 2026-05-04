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
  const [hoverLink, setHoverLink] = useState<any>(null);
  const [hoverNode, setHoverNode] = useState<any>(null);
  const [mouse, setMouse] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  // Track theme changes (the toggle adds/removes 'dark' on <html>)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark'))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

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
          <div
            className="relative w-full h-full"
            onMouseMove={(e) => {
              const r = wrapRef.current?.getBoundingClientRect();
              if (r) setMouse({ x: e.clientX - r.left, y: e.clientY - r.top });
            }}
          >
            <ForceGraph
              graphData={data}
              width={size.w}
              height={size.h}
              backgroundColor={isDark ? '#0d0d10' : '#FAFAF7'}
              nodeLabel={(n: any) => `${n.name}${n.tag ? ` · #${n.tag}` : ''}`}
              nodeColor={(n: any) => n.color}
              nodeRelSize={6}
              nodeCanvasObjectMode={() => 'after'}
              nodeCanvasObject={(node: any, ctx: any, globalScale: number) => {
                // Draw the title under the node, like Obsidian
                const label = node.name as string;
                const fontSize = Math.max(10, 12 / globalScale);
                ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillStyle = isDark ? 'rgba(236,236,236,0.85)' : 'rgba(60,60,70,0.85)';
                ctx.fillText(label.length > 28 ? label.slice(0, 26) + '…' : label, node.x, node.y + 9);
                // Highlight ring for hovered node
                if (hoverNode === node) {
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, 9, 0, 2 * Math.PI);
                  ctx.strokeStyle = isDark ? '#C4B5FD' : '#6D28D9';
                  ctx.lineWidth = 2 / globalScale;
                  ctx.stroke();
                }
              }}
              linkColor={(l: any) => {
                if (hoverLink === l) return isDark ? '#C4B5FD' : '#6D28D9';
                if (hoverNode && (l.source === hoverNode || l.target === hoverNode)) {
                  return isDark ? 'rgba(196,181,253,0.85)' : 'rgba(109,40,217,0.85)';
                }
                // Stronger similarity → more opaque
                const t = Math.min(1, Math.max(0, (l.value - THRESHOLD) / (1 - THRESHOLD)));
                const alpha = isDark ? 0.35 + t * 0.45 : 0.30 + t * 0.50;
                return isDark
                  ? `rgba(167,139,250,${alpha.toFixed(2)})`
                  : `rgba(124,58,237,${alpha.toFixed(2)})`;
              }}
              linkWidth={(l: any) => {
                const base = 1.2 + (l.value - THRESHOLD) * 8;
                if (hoverLink === l) return base + 2;
                if (hoverNode && (l.source === hoverNode || l.target === hoverNode)) return base + 1;
                return base;
              }}
              linkDirectionalParticles={(l: any) => (hoverLink === l ? 4 : 0)}
              linkDirectionalParticleSpeed={0.012}
              linkDirectionalParticleColor={() => (isDark ? '#FDE68A' : '#F59E0B')}
              onLinkHover={(l: any) => setHoverLink(l)}
              onNodeHover={(n: any) => setHoverNode(n)}
              onNodeClick={(n: any) => { onOpen(n.id); onClose(); }}
              cooldownTicks={80}
            />
            {(hoverLink || hoverNode) && (
              <div
                className="pointer-events-none absolute z-10 rounded-md px-2.5 py-1.5 text-[11px] shadow-lg border"
                style={{
                  left: Math.min(mouse.x + 14, size.w - 240),
                  top: Math.min(mouse.y + 14, size.h - 80),
                  background: isDark ? 'rgba(26,26,29,0.95)' : 'rgba(255,255,255,0.97)',
                  borderColor: isDark ? '#26262b' : '#E7E5E4',
                  color: isDark ? '#ECECEC' : '#1c1917',
                  maxWidth: 240,
                }}
              >
                {hoverLink ? (
                  <>
                    <div className="font-semibold mb-0.5">Semantic similarity</div>
                    <div className="text-warm-500 dark:text-warm-400 truncate">
                      {(hoverLink.source as any).name} ↔ {(hoverLink.target as any).name}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-warm-200 dark:bg-[#26262b] overflow-hidden">
                        <div
                          className="h-full bg-amethyst-500"
                          style={{ width: `${Math.round(hoverLink.value * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono opacity-80">{(hoverLink.value * 100).toFixed(0)}%</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-semibold truncate">{hoverNode.name}</div>
                    {hoverNode.tag && <div className="text-warm-500 dark:text-warm-400 mt-0.5">#{hoverNode.tag}</div>}
                    <div className="text-[10px] text-warm-500 dark:text-warm-400 mt-1">Click to open</div>
                  </>
                )}
              </div>
            )}
            <div className="pointer-events-none absolute bottom-2 left-2 text-[10px] text-warm-500 dark:text-warm-400 bg-white/70 dark:bg-[#0d0d10]/80 backdrop-blur px-2 py-1 rounded">
              Hover a link to see similarity · click a node to open
            </div>
          </div>
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
