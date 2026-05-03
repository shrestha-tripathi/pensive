import { type Note } from './db';

export function sampleNote(): Note {
  const now = Date.now();
  const paragraphs: { type: 'paragraph'; content: { type: 'text'; text: string }[] }[] = [
    { type: 'paragraph', content: [{ type: 'text', text: 'Pensive is a calm, local-first thinking space. Every note, every embedding, and even the AI that answers your questions runs entirely inside your browser — nothing is ever sent to a server. Your thoughts stay yours.' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'You can write rich notes with headings, lists, code blocks and quotes. Press the microphone in the footer to dictate; a tiny Whisper model transcribes your voice on-device. Notes autosave to IndexedDB the moment you stop typing.' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'The real magic is the Ask panel: press ⌘K (or Ctrl+K on Windows) to open a chat that answers questions across your notes. It uses local embeddings (bge-small) for semantic retrieval and a small local language model (Qwen2.5 1.5B) to compose answers with citations linked back to the source note.' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'On first use the AI model downloads once (~1GB) and caches forever. After that, everything works fully offline. If your device does not support WebGPU, Pensive gracefully degrades into pure semantic search across your notes — still useful, still private.' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Try it: press ⌘K and ask "What is this app?" — Pensive will pull from this very note to answer.' }] },
  ];
  const plain = paragraphs.map(p => p.content[0].text).join('\n\n');
  return {
    id: crypto.randomUUID(),
    title: 'Welcome to Pensive 🪶',
    plainText: plain,
    createdAt: now,
    updatedAt: now,
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Welcome to Pensive 🪶' }] },
        ...paragraphs,
        { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pensive · Notes that never leave your device.' }] }] },
      ],
    },
  };
}
