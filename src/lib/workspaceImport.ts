// Workspace ZIP import — merges notes from a previously-exported Pensive ZIP
// (or any markdown collection). Conflict policy: updatedAt-newer-wins. Never
// deletes notes that exist locally but not in the ZIP.

import { extractText, deriveTitle, listNotes, putNotes, type Note } from './db';
import { markdownToTiptapJson } from './markdownImport';

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;     // existed locally with newer or equal updatedAt
  fromManifest: boolean;
  warnings: string[];
}

interface Manifest {
  version: number;
  exportedAt: number;
  notes: Note[];
}

function genId(): string {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  return 'n_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function normalizeNote(n: any): Note | null {
  if (!n || typeof n !== 'object') return null;
  if (!n.content || typeof n.content !== 'object') return null;
  const now = Date.now();
  const note: Note = {
    id: typeof n.id === 'string' && n.id ? n.id : genId(),
    title: typeof n.title === 'string' ? n.title : '',
    content: n.content,
    plainText: typeof n.plainText === 'string' ? n.plainText : extractText(n.content),
    createdAt: typeof n.createdAt === 'number' ? n.createdAt : now,
    updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : now,
    parentId: typeof n.parentId === 'string' ? n.parentId : null,
    order: typeof n.order === 'number' ? n.order : 0,
    starred: !!n.starred,
    tags: Array.isArray(n.tags) ? n.tags.filter((t: any) => typeof t === 'string') : [],
  };
  if (!note.title) note.title = deriveTitle(note.content);
  return note;
}

export async function importWorkspaceZip(file: File): Promise<ImportResult> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(file);

  const warnings: string[] = [];
  let incoming: Note[] = [];
  let fromManifest = false;

  // 1. Try the manifest (fidelity round-trip).
  const manifestFile = zip.file('pensive.json');
  if (manifestFile) {
    try {
      const text = await manifestFile.async('string');
      const parsed = JSON.parse(text) as Manifest;
      if (parsed && Array.isArray(parsed.notes)) {
        for (const n of parsed.notes) {
          const norm = normalizeNote(n);
          if (norm) incoming.push(norm);
          else warnings.push(`Skipped malformed manifest entry: ${(n as any)?.id ?? '<no id>'}`);
        }
        fromManifest = true;
      }
    } catch (e: any) {
      warnings.push('Manifest parse failed, falling back to .md files: ' + (e?.message ?? e));
    }
  }

  // 2. Otherwise (or if manifest empty) fall back to .md files.
  if (!incoming.length) {
    const mdFiles: { path: string; file: any }[] = [];
    zip.forEach((path, file) => {
      if (file.dir) return;
      if (path.startsWith('__MACOSX/')) return;
      if (path.endsWith('.md')) mdFiles.push({ path, file });
    });
    for (const { path, file } of mdFiles) {
      try {
        const md = await file.async('string');
        const { title, doc } = markdownToTiptapJson(md);
        const now = Date.now();
        // Try to extract id from filename pattern "<safe>-<6char>.md"
        const idMatch = /-([a-z0-9]{6})\.md$/i.exec(path);
        const fallbackId = idMatch ? `imported-${idMatch[1]}-${now.toString(36)}` : genId();
        // Folder structure becomes lost (no parent linking by path) — flat import.
        // User can reorganize via drag-drop.
        const note: Note = {
          id: fallbackId,
          title: title || path.split('/').pop()!.replace(/\.md$/i, ''),
          content: doc,
          plainText: extractText(doc),
          createdAt: now,
          updatedAt: now,
          parentId: null,
          order: 0,
          starred: false,
          tags: [],
        };
        incoming.push(note);
      } catch (e: any) {
        warnings.push(`Failed to parse ${path}: ${e?.message ?? e}`);
      }
    }
  }

  if (!incoming.length) {
    return { added: 0, updated: 0, skipped: 0, fromManifest, warnings: [...warnings, 'No notes found in ZIP.'] };
  }

  // 3. Merge with conflict resolution.
  const existing = await listNotes();
  const byId = new Map(existing.map(n => [n.id, n]));
  let added = 0, updated = 0, skipped = 0;
  const toWrite: Note[] = [];

  for (const n of incoming) {
    const cur = byId.get(n.id);
    if (!cur) {
      toWrite.push(n);
      added++;
    } else if (n.updatedAt > cur.updatedAt) {
      toWrite.push(n);
      updated++;
    } else {
      skipped++;
    }
  }

  if (toWrite.length) await putNotes(toWrite);

  return { added, updated, skipped, fromManifest, warnings };
}
