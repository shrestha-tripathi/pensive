// Image attachment helpers: resize large images, store as Blob in IndexedDB,
// render via blob: URL through the AttachmentImage tiptap extension.

import { putAttachment, getAttachment, type Attachment } from './db';

const MAX_DIM = 1920;
const RESIZE_THRESHOLD = 2 * 1024 * 1024; // 2MB

export async function resizeIfLarge(file: Blob): Promise<Blob> {
  if (file.size <= RESIZE_THRESHOLD) return file;
  try {
    const bmp = await createImageBitmap(file);
    const ratio = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height));
    if (ratio >= 1) { bmp.close(); return file; }
    const w = Math.round(bmp.width * ratio);
    const h = Math.round(bmp.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob: Blob = await new Promise(res =>
      canvas.toBlob(b => res(b ?? file), 'image/jpeg', 0.85)!,
    );
    return blob.size < file.size ? blob : file;
  } catch (e) {
    console.warn('[resizeIfLarge]', e);
    return file;
  }
}

export async function storeImage(file: Blob, noteId: string | null): Promise<Attachment> {
  const blob = await resizeIfLarge(file);
  const att: Attachment = {
    id: crypto.randomUUID(),
    noteId,
    mimeType: blob.type || 'image/png',
    blob,
    createdAt: Date.now(),
  };
  await putAttachment(att);
  return att;
}

// Cache of attachment id → object URL to avoid leaking.
const urlCache = new Map<string, string>();

export async function attachmentUrl(id: string): Promise<string | null> {
  if (urlCache.has(id)) return urlCache.get(id)!;
  const a = await getAttachment(id);
  if (!a) return null;
  const url = URL.createObjectURL(a.blob);
  urlCache.set(id, url);
  return url;
}

export function revokeAttachment(id: string) {
  const u = urlCache.get(id);
  if (u) { URL.revokeObjectURL(u); urlCache.delete(id); }
}
