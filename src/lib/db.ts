import { openDB, type IDBPDatabase } from 'idb';

export interface Note {
  id: string;
  title: string;
  content: any; // Tiptap JSON
  plainText: string;
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = 'pensive';
const STORE = 'notes';

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  if (!dbp) {
    dbp = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) {
          const s = d.createObjectStore(STORE, { keyPath: 'id' });
          s.createIndex('updatedAt', 'updatedAt');
        }
      },
    });
  }
  return dbp;
}

export async function listNotes(): Promise<Note[]> {
  const d = await db();
  const all = await d.getAll(STORE);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getNote(id: string): Promise<Note | undefined> {
  return (await db()).get(STORE, id);
}

export async function putNote(n: Note): Promise<void> {
  await (await db()).put(STORE, n);
}

export async function deleteNote(id: string): Promise<void> {
  await (await db()).delete(STORE, id);
}

export async function clearAll(): Promise<void> {
  await (await db()).clear(STORE);
}

export function newNote(): Note {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: 'Untitled',
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    plainText: '',
    createdAt: now,
    updatedAt: now,
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
      default:
        if (node.content) node.content.forEach((c: any) => walk(c, depth));
    }
  };
  json.content.forEach((n: any) => walk(n));
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
