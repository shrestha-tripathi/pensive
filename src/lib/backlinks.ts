// Smart backlinks: for a given note, find top-K semantically related OTHER notes.
import { getAllEmbeddings, getEmbeddingsForNote, getNote, type Note } from './db';
import { cosine } from './embeddings';

export interface RelatedNote {
  noteId: string;
  title: string;
  snippet: string;
  score: number;
}

export async function findRelatedNotes(noteId: string, topK = 5): Promise<RelatedNote[]> {
  const own = await getEmbeddingsForNote(noteId);
  if (own.length === 0) return [];
  const all = await getAllEmbeddings();
  // For each other-note chunk, take max similarity vs any own chunk.
  const bestPerOther = new Map<string, { chunkText: string; score: number }>();
  for (const e of all) {
    if (e.noteId === noteId) continue;
    let best = -Infinity;
    for (const o of own) {
      const s = cosine(o.vector, e.vector);
      if (s > best) best = s;
    }
    const cur = bestPerOther.get(e.noteId);
    if (!cur || best > cur.score) bestPerOther.set(e.noteId, { chunkText: e.text, score: best });
  }
  const ranked = [...bestPerOther.entries()]
    .map(([id, v]) => ({ noteId: id, ...v }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  const out: RelatedNote[] = [];
  for (const r of ranked) {
    const n: Note | undefined = await getNote(r.noteId);
    if (!n) continue;
    const snippet = (r.chunkText || n.plainText || '').replace(/\s+/g, ' ').slice(0, 140);
    out.push({ noteId: r.noteId, title: n.title || 'Untitled', snippet, score: r.score });
  }
  return out;
}
