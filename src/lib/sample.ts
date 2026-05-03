import { type Note } from './db';

export function sampleNote(): Note {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: 'Welcome to Pensive 🪶',
    plainText: 'Welcome to Pensive',
    createdAt: now,
    updatedAt: now,
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Welcome to Pensive 🪶' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'A calm place to think. Everything stays on your device — nothing is ever sent to a server.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What you can do' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Write rich notes — headings, lists, code, quotes' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Press the mic to dictate (Whisper runs in your browser)' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Search across all notes from the sidebar' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Export any note as Markdown' }] }] },
        ] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Try the mic ↓' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'On first use the model (~40MB) downloads once and caches forever. Then transcription is instant and offline.' }] },
        { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pensive · Notes that never leave your device.' }] }] },
      ],
    },
  };
}
