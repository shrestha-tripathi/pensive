# 🪶 Pensive

> **Notes that never leave your device.**

[![Build](https://img.shields.io/github/actions/workflow/status/shrestha-tripathi/pensive/deploy.yml?branch=main&style=flat-square&color=8b5cf6)](https://github.com/shrestha-tripathi/pensive/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-amethyst.svg?style=flat-square&color=8b5cf6)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/shrestha-tripathi/pensive?style=flat-square&color=8b5cf6)](https://github.com/shrestha-tripathi/pensive/stargazers)
[![Made in India](https://img.shields.io/badge/Made%20in-India%20%F0%9F%87%AE%F0%9F%87%B3-orange?style=flat-square)](https://worksoffline.in)
[![Local-first](https://img.shields.io/badge/local--first-100%25-success?style=flat-square)](#privacy)

A **local-first**, fully offline note-taking app with on-device AI. Speak into it (Whisper). Chat with your notes (RAG + Qwen2.5 via WebGPU). Organize them in nested pages. **Nothing — not a single byte — ever leaves your browser.**

🔗 **Live demo:** https://shrestha-tripathi.github.io/pensive/

---

## ⏱️ 30-second value prop

You want Notion's structure, Obsidian's privacy, Mem.ai's intelligence, and Reflect's polish — without sending your thoughts to anyone's servers, without paying $10/month, without a desktop install.

Pensive is a **single React app** that runs entirely in your browser. Whisper transcribes your voice on-device. A bge-small embedding model indexes every note. Qwen2.5 chats with that index over WebGPU. Your data lives in IndexedDB and stays there.

Free, MIT-licensed, and shipping today.

---

## 🆚 How it compares

| Feature | **Pensive** | Notion | Obsidian | Mem.ai | Reflect |
|---|:---:|:---:|:---:|:---:|:---:|
| 100% local data | ✅ | ❌ | ✅ | ❌ | ❌ |
| Works offline | ✅ | ⚠️ | ✅ | ❌ | ⚠️ |
| Zero install (browser) | ✅ | ✅ | ❌ | ✅ | ✅ |
| On-device voice transcription | ✅ | ❌ | ❌ | ❌ | ❌ |
| On-device RAG chat | ✅ | ❌ | ⚠️ plugin | ✅ cloud | ✅ cloud |
| Nested pages | ✅ | ✅ | ⚠️ | ❌ | ❌ |
| Backlinks & mentions | ✅ | ✅ | ✅ | ✅ | ✅ |
| Quick switcher | ✅ | ✅ | ✅ | ✅ | ✅ |
| Zero telemetry | ✅ | ❌ | ✅ | ❌ | ❌ |
| Open source | ✅ MIT | ❌ | ⚠️ partial | ❌ | ❌ |
| Free tier fully featured | ✅ | ⚠️ | ✅ | ❌ | ❌ |

---

## 📸 Screenshots

> _Add screenshots here_ — editor, RAG chat, voice capture, quick switcher.

---

## 🛠️ Tech stack

| Layer | Tool |
|---|---|
| Build | **Vite** |
| UI | **React 18 + TypeScript + Tailwind** |
| Editor | **Tiptap (ProseMirror)** |
| Voice | **Whisper via Transformers.js** (WASM/WebGPU) |
| Embeddings | **bge-small-en** (Transformers.js) |
| Chat LLM | **Qwen2.5 via @mlc-ai/web-llm** (WebGPU) |
| Storage | **IndexedDB** (idb-keyval) |
| Search | Local vector index + BM25 hybrid |

---

## 🚀 Quick start

```bash
git clone https://github.com/shrestha-tripathi/pensive.git
cd pensive
npm install --legacy-peer-deps
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # preview the production build
```

> **WebGPU required** for the chat feature. Use Chrome 113+ / Edge 113+ on a desktop with a modern GPU. Whisper transcription works everywhere via WASM.

---

## 🗺️ Roadmap & Changelog

### v1.4 — Final v1 ship 🎉 _(current)_
- 🎙️ **Meeting Mode** — long-form recording with chunked Whisper transcription + AI summary (TLDR / Decisions / Action Items) inserted into the active note
- 💳 **Pricing modal** wired into the footer (Free / Pro waitlist / Self-host tiers)
- 🌐 **OG + Twitter card meta tags** for rich link previews

### v1.3 — Mobile + media _(shipped)_
- 📱 Responsive mobile drawer (hamburger toggle, backdrop, swipe-friendly)
- 🖼️ Image attachments via drag-drop / paste (stored as data URLs in IndexedDB)

### v1.2 — Knowledge & polish _(shipped)_
- 🕸️ Force-directed knowledge graph view (lazy-loaded)
- 🏷️ Auto-tagging from note content (topic vocab + embeddings)
- 🔗 Related-notes sidebar (vector similarity)
- 📦 Workspace ZIP export (preserves nested-page hierarchy)

### v1.1 — AI everywhere _(shipped)_
- ✨ Slash-menu AI commands: Continue, Summarize (callout), Improve selection
- 💬 RAG chat (⌘K) with streaming citations
- ⚡ PWA install + offline service-worker cache

### v1.0 — Local-first foundations _(shipped)_
- Tiptap editor with slash menu, mentions, nested pages, tasks, tables, code blocks
- IndexedDB persistence + sample onboarding note
- 🎤 Whisper voice capture (one-shot transcription)
- 🧠 bge-small embedding index for semantic search
- ⌘P quick switcher, dark mode, MD export
- Backlinks & `@mention` linking

### v2+ — What's next
- E2E-encrypted optional sync (server cannot decrypt)
- Templates & daily notes
- Plugin SDK
- Whisper-large + Llama-3 model upgrades

---

## 🔐 Privacy

- **Zero telemetry.** No analytics, no error reporting, no pings.
- **Zero servers.** There is no backend. The "deploy" is `dist/` on GitHub Pages.
- **Zero accounts.** No sign-up, no login.
- **Your data lives in IndexedDB** under your browser's origin. Clear browser data → clear Pensive.
- **All AI runs on-device.** Whisper, bge, and Qwen2.5 are downloaded once and cached.
- **Open source under MIT.** Audit every line.

If we ever add sync, it will be **end-to-end encrypted** with a key that never leaves your browser. We physically cannot read your notes.

---

## 🤝 Contributing

Issues and PRs welcome. Run `npm run build` before opening a PR — TypeScript must pass.

---

## 📄 License

MIT — do whatever you want, just keep the notice.

---

<p align="center">
  Made with 🪶 in 🇮🇳 by <a href="https://github.com/shrestha-tripathi">@shrestha-tripathi</a><br/>
  Part of <a href="https://worksoffline.in"><b>worksoffline.in</b></a> — the home of browser-only, privacy-first tools.
</p>
