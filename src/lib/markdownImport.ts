// Minimal Markdown → Tiptap JSON converter for workspace import.
// Handles headings, paragraphs, bullet/ordered/task lists, blockquote, code
// blocks, hr, images, and inline bold/italic/code/strike/link.
// Loose by design — round-trips Pensive's own export plus most plain markdown.

type Node = { type: string; attrs?: any; content?: Node[]; text?: string; marks?: any[] };

const INLINE_RE = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|~~([^~]+)~~|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;

function parseInline(line: string): Node[] {
  const out: Node[] = [];
  let last = 0;
  for (const m of line.matchAll(INLINE_RE)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ type: 'text', text: line.slice(last, start) });
    if (m[2] !== undefined) out.push({ type: 'text', text: m[2], marks: [{ type: 'bold' }] });
    else if (m[3] !== undefined) out.push({ type: 'text', text: m[3], marks: [{ type: 'bold' }] });
    else if (m[4] !== undefined) out.push({ type: 'text', text: m[4], marks: [{ type: 'italic' }] });
    else if (m[5] !== undefined) out.push({ type: 'text', text: m[5], marks: [{ type: 'italic' }] });
    else if (m[6] !== undefined) out.push({ type: 'text', text: m[6], marks: [{ type: 'strike' }] });
    else if (m[7] !== undefined) out.push({ type: 'text', text: m[7], marks: [{ type: 'code' }] });
    else if (m[8] !== undefined && m[9] !== undefined) out.push({ type: 'text', text: m[8], marks: [{ type: 'link', attrs: { href: m[9] } }] });
    last = start + m[0].length;
  }
  if (last < line.length) out.push({ type: 'text', text: line.slice(last) });
  return out.filter(n => n.text !== '');
}

function paragraph(text: string): Node {
  const c = parseInline(text);
  return c.length ? { type: 'paragraph', content: c } : { type: 'paragraph' };
}

export function markdownToTiptapJson(md: string): { title: string; doc: any } {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const content: Node[] = [];
  let title = '';
  let i = 0;

  // First H1 as title (and skip from body).
  for (let k = 0; k < Math.min(lines.length, 5); k++) {
    const m = /^#\s+(.+)$/.exec(lines[k].trim());
    if (m) { title = m[1].trim(); i = k + 1; break; }
    if (lines[k].trim()) break;
  }

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // Blank line → skip
    if (!line.trim()) { i++; continue; }

    // Code block
    const fence = /^```(\w*)\s*$/.exec(line.trim());
    if (fence) {
      const lang = fence[1] || null;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
      i++; // skip closing fence
      content.push({
        type: 'codeBlock',
        attrs: lang ? { language: lang } : {},
        content: buf.length ? [{ type: 'text', text: buf.join('\n') }] : undefined,
      });
      continue;
    }

    // Heading
    const h = /^(#{1,6})\s+(.+)$/.exec(line);
    if (h) {
      content.push({ type: 'heading', attrs: { level: h[1].length }, content: parseInline(h[2]) });
      i++; continue;
    }

    // Horizontal rule
    if (/^(---|\*\*\*|___)\s*$/.test(line)) {
      content.push({ type: 'horizontalRule' });
      i++; continue;
    }

    // Image-only line
    const img = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(line);
    if (img) {
      content.push({ type: 'image', attrs: { alt: img[1], src: img[2] } });
      i++; continue;
    }

    // Blockquote (consume consecutive)
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      content.push({
        type: 'blockquote',
        content: buf.filter(Boolean).map(t => paragraph(t)),
      });
      continue;
    }

    // Task list item
    const task = /^[-*]\s+\[( |x|X)\]\s+(.+)$/.exec(line);
    if (task) {
      const items: Node[] = [];
      while (i < lines.length) {
        const t = /^[-*]\s+\[( |x|X)\]\s+(.+)$/.exec(lines[i].trim());
        if (!t) break;
        items.push({
          type: 'taskItem',
          attrs: { checked: t[1].toLowerCase() === 'x' },
          content: [{ type: 'paragraph', content: parseInline(t[2]) }],
        });
        i++;
      }
      content.push({ type: 'taskList', content: items });
      continue;
    }

    // Bullet list
    const bul = /^([-*+])\s+(.+)$/.exec(line);
    if (bul) {
      const items: Node[] = [];
      while (i < lines.length) {
        const t = /^[-*+]\s+(.+)$/.exec(lines[i].trim());
        if (!t) break;
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: parseInline(t[1]) }] });
        i++;
      }
      content.push({ type: 'bulletList', content: items });
      continue;
    }

    // Ordered list
    const ord = /^\d+\.\s+(.+)$/.exec(line);
    if (ord) {
      const items: Node[] = [];
      while (i < lines.length) {
        const t = /^\d+\.\s+(.+)$/.exec(lines[i].trim());
        if (!t) break;
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: parseInline(t[1]) }] });
        i++;
      }
      content.push({ type: 'orderedList', content: items });
      continue;
    }

    // Paragraph (consume consecutive non-blank lines, join with hardBreak)
    const buf: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|>|```|---|\*\*\*|___|[-*+]\s|\d+\.\s|!\[)/.test(lines[i].trim())) {
      buf.push(lines[i].trim());
      i++;
    }
    content.push(paragraph(buf.join(' ')));
  }

  return {
    title,
    doc: { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] },
  };
}
