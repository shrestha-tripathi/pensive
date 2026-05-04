import { useEffect, useState } from 'react';
import {
  Feather, Lock, Cpu, Wifi, Mic, Network, Search, Sparkles, Archive,
  ArrowRight, Check, X, Zap, Shield, Code2, Globe, Database,
  MessageSquare, Tag, Hash, Smartphone, Layers, Star,
} from 'lucide-react';
import { FeatherMark } from './FeatherMark';

const GithubIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.6-.3-5.4-1.3-5.4-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/>
  </svg>
);

const APP_HASH = '#/app';

function go() {
  window.location.hash = '/app';
}

export function Landing() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const features = [
    { icon: Feather,        title: 'Tiptap editor',         desc: 'Slash menu, headings, tasks, tables, code, callouts, toggles, mentions, drag-handles — Notion-grade writing.' },
    { icon: Mic,            title: 'On-device voice',       desc: 'One-shot dictation and Meeting Mode (long-form chunked transcription with AI summary) via Whisper in your browser.' },
    { icon: MessageSquare,  title: 'RAG chat (⌘K)',         desc: 'Ask questions across every note. Streamed answers with citations, all on-device via Qwen2.5 + WebGPU.' },
    { icon: Search,         title: 'Hybrid search',         desc: 'BM25 + bge-small embeddings. Quick switcher (⌘P) for keyboard-first navigation.' },
    { icon: Network,        title: 'Knowledge graph',       desc: 'Force-directed view of semantic links between notes. Click to jump.' },
    { icon: Tag,            title: 'Auto-tags & backlinks', desc: 'Suggested tags from a topic vocab. @mentions create wikilinks both ways automatically.' },
    { icon: Archive,        title: 'Portable ZIP sync',     desc: 'Export the whole workspace as ZIP (markdown + lossless manifest). Import on any device — newer wins, never deletes.' },
    { icon: Smartphone,     title: 'PWA + mobile',          desc: 'Installable. Offline. Hamburger drawer. Light + dark themes with no flash on load.' },
  ];

  const tech = [
    { icon: Code2,   label: 'Vite 5 + React 18 + TS' },
    { icon: Layers,  label: 'Tailwind v4' },
    { icon: Feather, label: 'Tiptap (ProseMirror)' },
    { icon: Mic,     label: 'Whisper via @huggingface/transformers' },
    { icon: Hash,    label: 'bge-small-en-v1.5 embeddings' },
    { icon: Sparkles,label: 'Qwen2.5 via @mlc-ai/web-llm' },
    { icon: Database,label: 'IndexedDB (idb)' },
    { icon: Globe,   label: 'GitHub Pages — zero backend' },
  ];

  const compare = [
    ['100% local data',           [true, false, true,  false, false]],
    ['Works offline',             [true, false, true,  false, false]],
    ['Zero install (browser)',    [true, true,  false, true,  true]],
    ['On-device voice',           [true, false, false, false, false]],
    ['On-device RAG chat',        [true, false, false, false, false]],
    ['Knowledge graph',           [true, false, true,  false, false]],
    ['Portable ZIP sync',         [true, false, true,  false, false]],
    ['Zero telemetry',            [true, false, true,  false, false]],
    ['Open source (MIT)',         [true, false, false, false, false]],
    ['Free, fully featured',      [true, false, true,  false, false]],
  ] as const;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100 selection:bg-violet-500/30">
      {/* gradient blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      {/* nav */}
      <header className={`sticky top-0 z-30 transition-all ${scrolled ? 'backdrop-blur-md bg-stone-50/70 dark:bg-stone-950/70 border-b border-stone-200/60 dark:border-stone-800/60' : ''}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#top" className="flex items-center gap-2 font-semibold">
            <FeatherMark size={32} />
            <span className="text-lg tracking-tight">Pensive</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm text-stone-600 dark:text-stone-400 md:flex">
            <a href="#features" className="hover:text-stone-900 dark:hover:text-stone-100">Features</a>
            <a href="#privacy" className="hover:text-stone-900 dark:hover:text-stone-100">Privacy</a>
            <a href="#tech" className="hover:text-stone-900 dark:hover:text-stone-100">Tech</a>
            <a href="#compare" className="hover:text-stone-900 dark:hover:text-stone-100">Compare</a>
            <a href="https://github.com/shrestha-tripathi/pensive" target="_blank" rel="noreferrer" className="hover:text-stone-900 dark:hover:text-stone-100 flex items-center gap-1.5">
              <GithubIcon size={15} /> GitHub
            </a>
          </nav>
          <button
            onClick={go}
            className="group inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-stone-700 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
          >
            Open app <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </header>

      {/* hero */}
      <section id="top" className="mx-auto max-w-6xl px-6 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="mx-auto max-w-3xl text-center">
          <a href="https://github.com/shrestha-tripathi/pensive" target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/60 px-3 py-1 text-xs font-medium text-stone-600 backdrop-blur transition hover:border-violet-300 hover:text-violet-700 dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-400 dark:hover:border-violet-700 dark:hover:text-violet-300">
            <Star size={12} /> v1.5 — Sync, sturdiness & sane fallbacks
          </a>
          <h1 className="mt-6 text-balance bg-gradient-to-br from-stone-900 to-stone-600 bg-clip-text text-5xl font-bold leading-tight tracking-tight text-transparent dark:from-white dark:to-stone-400 md:text-7xl">
            Notes that never leave your device.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-stone-600 dark:text-stone-400 md:text-xl">
            Notion's structure, Obsidian's privacy, Mem.ai's intelligence — without
            sending your thoughts to anyone's servers. Voice, RAG chat, embeddings,
            and a knowledge graph, all running <em>in your browser</em>.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={go}
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:shadow-xl hover:shadow-violet-500/40"
            >
              Launch Pensive <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </button>
            <a
              href="https://github.com/shrestha-tripathi/pensive"
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white/60 px-6 py-3 text-base font-medium text-stone-700 backdrop-blur transition hover:border-stone-400 hover:bg-white dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-300 dark:hover:border-stone-600 dark:hover:bg-stone-900"
            >
              <GithubIcon size={16} /> Star on GitHub
            </a>
          </div>
          <p className="mt-5 text-xs text-stone-500 dark:text-stone-500">
            Free · MIT · No sign-up · No tracking · Works offline
          </p>
        </div>

        {/* hero badges */}
        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: Lock,  label: '100% local' },
            { icon: Cpu,   label: 'On-device AI' },
            { icon: Wifi,  label: 'Offline-first' },
            { icon: Zap,   label: 'Zero backend' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white/60 px-4 py-3 text-sm text-stone-700 backdrop-blur dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-300">
              <Icon size={16} className="text-violet-600 dark:text-violet-400" />
              {label}
            </div>
          ))}
        </div>

        {/* hero image */}
        <div className="mx-auto mt-16 max-w-5xl">
          <div className="relative rounded-2xl border border-stone-200 bg-white/40 p-2 shadow-2xl shadow-violet-500/10 backdrop-blur dark:border-stone-800 dark:bg-stone-900/40">
            <img
              src="docs/screenshots/demo.gif"
              alt="Pensive demo"
              className="rounded-xl"
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">Everything you need. Nothing you don't.</h2>
          <p className="mt-4 text-lg text-stone-600 dark:text-stone-400">
            A full PKM stack — editor, voice, search, AI chat, graph — running entirely client-side.
          </p>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="group relative rounded-2xl border border-stone-200 bg-white/50 p-6 backdrop-blur transition hover:border-violet-300 hover:shadow-lg hover:shadow-violet-500/10 dark:border-stone-800 dark:bg-stone-900/50 dark:hover:border-violet-700">
              <div className="mb-4 inline-grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-violet-100 to-fuchsia-100 text-violet-700 dark:from-violet-900/40 dark:to-fuchsia-900/40 dark:text-violet-300">
                <Icon size={18} />
              </div>
              <h3 className="font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* privacy */}
      <section id="privacy" className="border-y border-stone-200 bg-gradient-to-br from-violet-50/50 via-stone-50 to-fuchsia-50/50 px-6 py-24 dark:border-stone-800 dark:from-violet-950/20 dark:via-stone-950 dark:to-fuchsia-950/20">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-start gap-12 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                <Shield size={12} /> Privacy
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">Your thoughts. Your hardware. Period.</h2>
              <p className="mt-5 text-lg leading-relaxed text-stone-600 dark:text-stone-400">
                Pensive doesn't have a backend. It cannot leak what it cannot send. There is no
                sign-up, no analytics, no error reporting, no telemetry — open the source and
                check yourself.
              </p>
              <a href="https://github.com/shrestha-tripathi/pensive" target="_blank" rel="noreferrer"
                 className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100">
                Audit the source on GitHub <ArrowRight size={14} />
              </a>
            </div>
            <div className="space-y-3">
              {[
                ['Zero telemetry', 'No analytics, no error reporting, no pings home — ever.'],
                ['Zero servers', 'The "deploy" is dist/ on GitHub Pages. There is no backend to compromise.'],
                ['Zero accounts', 'No sign-up, no login, no forgot-password emails.'],
                ['IndexedDB only', 'Your data lives under your browser origin. Clear browser data → clear Pensive.'],
                ['On-device AI', 'Whisper, bge, and Qwen2.5 download once, then run in your browser. No prompts leave your machine.'],
                ['MIT licensed', 'Fork it. Self-host it. Audit it. Trust by verification.'],
              ].map(([title, desc]) => (
                <div key={title} className="flex gap-4 rounded-xl border border-stone-200/60 bg-white/70 p-4 backdrop-blur dark:border-stone-800/60 dark:bg-stone-900/70">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <Check size={16} />
                  </div>
                  <div>
                    <h4 className="font-semibold tracking-tight">{title}</h4>
                    <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* tech */}
      <section id="tech" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">Built on the open web.</h2>
          <p className="mt-4 text-lg text-stone-600 dark:text-stone-400">
            Standards-based, browser-native, and audit-friendly. No proprietary runtimes.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
          {tech.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-3 rounded-xl border border-stone-200 bg-white/50 p-5 text-center backdrop-blur dark:border-stone-800 dark:bg-stone-900/50">
              <Icon size={22} className="text-violet-600 dark:text-violet-400" />
              <span className="text-xs font-medium leading-tight text-stone-700 dark:text-stone-300">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* compare */}
      <section id="compare" className="border-t border-stone-200 bg-white/50 px-6 py-24 dark:border-stone-800 dark:bg-stone-900/30">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-bold tracking-tight md:text-5xl">How it compares</h2>
            <p className="mt-4 text-lg text-stone-600 dark:text-stone-400">
              Same capabilities as the big names, with zero of the data tradeoffs.
            </p>
          </div>
          <div className="mt-12 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-950">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 dark:bg-stone-900">
                    <th className="px-5 py-4 text-left font-semibold">Feature</th>
                    {['Pensive', 'Notion', 'Obsidian', 'Mem.ai', 'Reflect'].map((name, i) => (
                      <th key={name} className={`px-4 py-4 text-center font-semibold ${i === 0 ? 'text-violet-700 dark:text-violet-300' : ''}`}>{name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compare.map(([feature, vals]) => (
                    <tr key={feature} className="border-t border-stone-100 dark:border-stone-800">
                      <td className="px-5 py-3.5 font-medium">{feature}</td>
                      {vals.map((v, i) => (
                        <td key={i} className="px-4 py-3.5 text-center">
                          {v
                            ? <Check size={18} className={`mx-auto ${i === 0 ? 'text-violet-600 dark:text-violet-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
                            : <X size={18} className="mx-auto text-stone-300 dark:text-stone-700" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <div className="rounded-3xl border border-stone-200 bg-gradient-to-br from-violet-600 to-fuchsia-600 p-12 shadow-2xl shadow-violet-500/30 md:p-16">
          <h2 className="text-balance text-4xl font-bold tracking-tight text-white md:text-5xl">
            Start writing. Locally. Right now.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-violet-100">
            No download. No sign-up. Open the app and your first note is already there.
          </p>
          <button
            onClick={go}
            className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-violet-700 shadow-lg transition hover:bg-violet-50"
          >
            Open Pensive <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-stone-200 px-6 py-10 dark:border-stone-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-stone-500 md:flex-row">
          <div className="flex items-center gap-2">
            <FeatherMark size={20} />
            Pensive · MIT · Made in India 🇮🇳
          </div>
          <div className="flex items-center gap-5">
            <a href="https://github.com/shrestha-tripathi/pensive" target="_blank" rel="noreferrer" className="hover:text-stone-700 dark:hover:text-stone-300">GitHub</a>
            <a href="https://worksoffline.in" target="_blank" rel="noreferrer" className="hover:text-stone-700 dark:hover:text-stone-300">worksoffline.in</a>
            <button onClick={go} className="hover:text-stone-700 dark:hover:text-stone-300">Open app</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export { APP_HASH };
