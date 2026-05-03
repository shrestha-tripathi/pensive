# Pensive 🪶

> Notes that never leave your device.

A local-first note-taking PWA with on-device Whisper audio transcription. Everything — your notes, your voice, the AI model — runs entirely in your browser.

**Live:** https://shrestha-tripathi.github.io/pensive/

## Features

- ✍️ Tiptap rich-text editor (headings, lists, task lists, code blocks, quotes)
- 🎤 Voice dictation via Whisper running in WebAssembly / WebGPU (`@huggingface/transformers` v3)
- 💾 IndexedDB storage with debounced auto-save
- 🔍 Full-text search across all notes
- 🌗 Dark / light mode
- 📱 Installable PWA, works offline after first load
- 📤 Export any note as Markdown
- 🔒 Zero servers, zero accounts, zero telemetry

## Stack

Vite 6 · React 19 · TypeScript · Tailwind CSS v4 · Tiptap · idb · @huggingface/transformers · vite-plugin-pwa

## Develop

```bash
npm install --legacy-peer-deps
npm run dev
npm run build
```

## License

MIT © Shrestha Tripathi
