import { openDB, type IDBPDatabase } from 'idb';

export interface Note {
  id: string;
  title: string;
  content: any; // Tiptap JSON
  plainText: string;
  createdAt: number;
  updatedAt: number;
  parentId: string | null;
  order: number;
  starred?: boolean;
}

const DB_NAME = 'pensive';
const STORE = 'notes';
const EMB_STORE = 'embeddings';

export interface NoteEmbedding {
  id: string;
  noteId: string;
  chunkIdx: number;
  text: string;
  vector: Float32Array;
  updatedAt: number;
}

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  if (!dbp) {
    dbp = openDB(DB_NAME, 3, {
      async upgrade(d, oldVersion, _newVersion, tx) {
        if (!d.objectStoreNames.contains(STORE)) {
          const s = d.createObjectStore(STORE, { keyPath: 'id' });
          s.createIndex('updatedAt', 'updatedAt');
        }
        if (oldVersion < 2 && !d.objectStoreNames.contains(EMB_STORE)) {
          const e = d.createObjectStore(EMB_STORE, { keyPath: 'id' });
          e.createIndex('noteId', 'noteId');
        }
        if (oldVersion < 3) {
          // Backfill parentId/order on existing notes (preserve all data).
          const store = tx.objectStore(STORE);
          const all = await store.getAll();
          all.sort((a: any, b: any) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
          for (let i = 0; i < all.length; i++) {
            const n: any = all[i];
            if (n.parentId === undefined) n.parentId = null;
            if (n.order === undefined) n.order = i;
            if (n.starred === undefined) n.starred = false;
            await store.put(n);
          }
        }
      },
    });
  }
  return dbp;
}

export async function getEmbeddingsForNote(noteId: string): Promise<NoteEmbedding[]> {
  return (await (await db()).getAllFromIndex(EMB_STORE, 'noteId', noteId)) as NoteEmbedding[];
}
export async function getAllEmbeddings(): Promise<NoteEmbedding[]> {
  return (await (await db()).getAll(EMB_STORE)) as NoteEmbedding[];
}
export async function deleteEmbeddingsForNote(noteId: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(EMB_STORE, 'readwrite');
  const idx = tx.store.index('noteId');
  for await (const cur of idx.iterate(noteId)) await cur.delete();
  await tx.done;
}
export async function putEmbeddings(embs: NoteEmbedding[]): Promise<void> {
  const d = await db();
  const tx = d.transaction(EMB_STORE, 'readwrite');
  for (const e of embs) await tx.store.put(e);
  await tx.done;
}

export async function listNotes(): Promise<Note[]> {
  const d = await db();
  const all = (await d.getAll(STORE)) as Note[];
  // Normalize defaults defensively for any pre-v3 reads-in-flight.
  for (const n of all) {
    if (n.parentId === undefined) n.parentId = null;
    if (n.order === undefined) n.order = 0;
  }
  return all;
}
export async function getNote(id: string): Promise<Note | undefined> {
  return (await db()).get(STORE, id);
}
export async function putNote(n: Note): Promise<void> {
  await (await db()).put(STORE, n);
}
export async function putNotes(ns: Note[]): Promise<void> {
  const d = await db();
  const tx = d.transaction(STORE, 'readwrite');
  for (const n of ns) await tx.store.put(n);
  await tx.done;
}
export async function deleteNote(id: string): Promise<void> {
  await (await db()).delete(STORE, id);
}
export async function deleteNotes(ids: string[]): Promise<void> {
  const d = await db();
  const tx = d.transaction(STORE, 'readwrite');
  for (const id of ids) await tx.store.delete(id);
  await tx.done;
}
export async function clearAll(): Promise<void> {
  const d = await db();
  await d.clear(STORE);
  await d.clear(EMB_STORE);
}

export function newNote(parentId: string | null = null, order = 0): Note {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: 'Untitled',
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    plainText: '',
    createdAt: now,
    updatedAt: now,
    parentId,
    order,
    starred: false,
  };
}

export function extractText(json: any): string {
  if (!json) return '';
  let out = '';
  const walk = (n: any) => {
    if (!n) return;
    if (typeof n.text === 'string') out += n.text + ' ';
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(json);
  return out.trim();
}

export function deriveTitle(json: any): string {
  if (!json?.content) return 'Untitled';
  for (const node of json.content) {
    if (node.type === 'heading' || node.type === 'paragraph') {
      const t = extractText(node).trim();
      if (t) return t.slice(0, 80);
    }
  }
  return 'Untitled';
}

export function jsonToMarkdown(json: any): string {
  if (!json?.content) return '';
  const lines: string[] = [];
  const inline = (node: any): string => {
    if (!node) return '';
    if (node.type === 'text') {
      let t = node.text ?? '';
      const marks = node.marks ?? [];
      for (const m of marks) {
        if (m.type === 'bold') t = `**${t}**`;
        else if (m.type === 'italic') t = `*${t}*`;
        else if (m.type === 'code') t = `\`${t}\``;
        else if (m.type === 'strike') t = `~~${t}~~`;
        else if (m.type === 'link') t = `[${t}](${m.attrs?.href ?? ''})`;
      }
      return t;
    }
    if (node.type === 'hardBreak') return '\n';
    if (node.type === 'mention') return `@${node.attrs?.label ?? node.attrs?.id ?? ''}`;
    return (node.content ?? []).map(inline).join('');
  };
  const walk = (node: any, depth = 0) => {
    switch (node.type) {
      case 'heading': {
        const lvl = node.attrs?.level ?? 1;
        lines.push(`${'#'.repeat(lvl)} ${inline(node)}`, '');
        break;
      }
      case 'paragraph':
        lines.push(inline(node), '');
        break;
      case 'bulletList':
        for (const li of node.content ?? []) {
          const text = (li.content ?? []).map(inline).join('').trim();
          lines.push(`${'  '.repeat(depth)}- ${text}`);
        }
        lines.push('');
        break;
      case 'orderedList':
        (node.content ?? []).forEach((li: any, i: number) => {
          const text = (li.content ?? []).map(inline).join('').trim();
          lines.push(`${'  '.repeat(depth)}${i + 1}. ${text}`);
        });
        lines.push('');
        break;
      case 'taskList':
        for (const li of node.content ?? []) {
          const checked = li.attrs?.checked ? 'x' : ' ';
          const text = (li.content ?? []).map(inline).join('').trim();
          lines.push(`- [${checked}] ${text}`);
        }
        lines.push('');
        break;
      case 'blockquote':
        for (const c of node.content ?? []) lines.push(`> ${inline(c)}`);
        lines.push('');
        break;
      case 'codeBlock':
        lines.push('```' + (node.attrs?.language ?? ''), inline(node), '```', '');
        break;
      case 'horizontalRule':
        lines.push('---', '');
        break;
      case 'callout':
        lines.push(`> ${node.attrs?.emoji ?? '💡'} ${(node.content ?? []).map(inline).join(' ')}`, '');
        break;
      case 'toggle':
        lines.push(`<details><summary>${node.attrs?.summary ?? 'Toggle'}</summary>`, '');
        (node.content ?? []).forEach((c: any) => walk(c, depth));
        lines.push('</details>', '');
        break;
      case 'image':
        lines.push(`![${node.attrs?.alt ?? ''}](${node.attrs?.src ?? ''})`, '');
        break;
      default:
        if (node.content) node.content.forEach((c: any) => walk(c, depth));
    }
  };
  json.content.forEach((n: any) => walk(n));
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ── Tree helpers ────────────────────────────────────────────────────────────
export interface TreeNode {
  note: Note;
  children: TreeNode[];
  depth: number;
}

export function buildTree(notes: Note[]): TreeNode[] {
  const byParent = new Map<string | null, Note[]>();
  for (const n of notes) {
    const k = n.parentId ?? null;
    const arr = byParent.get(k) ?? [];
    arr.push(n);
    byParent.set(k, arr);
  }
  for (const arr of byParent.values()) arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const build = (parentId: string | null, depth: number): TreeNode[] =>
    (byParent.get(parentId) ?? []).map(note => ({
      note,
      depth,
      children: build(note.id, depth + 1),
    }));
  return build(null, 0);
}

export function flattenTree(tree: TreeNode[], expanded: Set<string>): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      out.push(n);
      if (n.children.length && expanded.has(n.note.id)) walk(n.children);
    }
  };
  walk(tree);
  return out;
}

export function getDescendants(notes: Note[], id: string): Note[] {
  const out: Note[] = [];
  const childrenOf = (pid: string) => notes.filter(n => n.parentId === pid);
  const walk = (pid: string) => {
    for (const c of childrenOf(pid)) {
      out.push(c);
      walk(c.id);
    }
  };
  walk(id);
  return out;
}

export function getPath(notes: Note[], id: string): Note[] {
  const byId = new Map(notes.map(n => [n.id, n]));
  const out: Note[] = [];
  let cur = byId.get(id);
  while (cur) {
    out.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return out;
}
