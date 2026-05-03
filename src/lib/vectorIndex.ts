// Vector index: keeps note chunk embeddings in IndexedDB + brute-force cosine search.
import {
  deleteEmbeddingsForNote,
  getAllEmbeddings,
  getEmbeddingsForNote,
  listNotes,
  putEmbeddings,
  type Note,
  type NoteEmbedding,
} from './db';
import { chunkText, cosine, embed } from './embeddings';

export async function indexNote(note: Note): Promise<void> {
  const text = (note.plainText ?? '').trim();
  await deleteEmbeddingsForNote(note.id);
  if (!text) return;
  const chunks = chunkText(text);
  const embs: NoteEmbedding[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const v = await embed(chunks[i]);
    embs.push({
      id: `${note.id}:${i}`,
      noteId: note.id,
      chunkIdx: i,
      text: chunks[i],
      vector: v,
      updatedAt: note.updatedAt,
    });
  }
  await putEmbeddings(embs);
}

export interface SearchHit {
  noteId: string;
  chunkIdx: number;
  text: string;
  score: number;
}

export async function searchSimilar(query: string, topK = 5): Promise<SearchHit[]> {
  const q = await embed(query);
  const all = await getAllEmbeddings();
  const scored = all.map(e => ({
    noteId: e.noteId,
    chunkIdx: e.chunkIdx,
    text: e.text,
    score: cosine(q, e.vector),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

// Reindex any notes that don't have embeddings or whose embeddings are stale.
export async function reindexStale(opts?: { onProgress?: (done: number, total: number) => void }): Promise<number> {
  const notes = await listNotes();
  const stale: Note[] = [];
  for (const n of notes) {
    const e = await getEmbeddingsForNote(n.id);
    if (e.length === 0 || (e[0]?.updatedAt ?? 0) < n.updatedAt) stale.push(n);
  }
  for (let i = 0; i < stale.length; i++) {
    await indexNote(stale[i]);
    opts?.onProgress?.(i + 1, stale.length);
  }
  return stale.length;
}

export async function reindexAll(opts?: { onProgress?: (done: number, total: number) => void }): Promise<number> {
  const notes = await listNotes();
  for (let i = 0; i < notes.length; i++) {
    await indexNote(notes[i]);
    opts?.onProgress?.(i + 1, notes.length);
  }
  return notes.length;
}
