// Demo GIF recorder for Pensive.
// Scripts a real browser through the live app, records WebM, then converts to GIF.
//
// Prereqs (one-time):
//   npm install -D playwright
//   npx playwright install chromium
//   sudo apt install ffmpeg gifsicle    # or: brew install ffmpeg gifsicle
//
// Run:
//   node docs/demo/record.mjs                          # records against live demo
//   PENSIVE_URL=http://localhost:5173 node docs/demo/record.mjs   # against local dev
//
// Output:
//   docs/demo/raw.webm     — raw recording
//   docs/screenshots/demo.gif — optimized GIF, ready for README
//
// Tweak the SCENE constants below to retime / restage the demo.

import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync, readdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(__dirname);
const GIF_DIR = join(ROOT, 'docs', 'screenshots');
const URL = process.env.PENSIVE_URL || 'https://shrestha-tripathi.github.io/pensive/';

const VIEWPORT = { width: 1280, height: 720 };
const FPS = 12;        // GIF frame rate — 10–15 is the sweet spot
const MAX_WIDTH = 960; // GIF width cap for README

// ── Helpers ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function typeSlowly(page, selector, text, perChar = 35) {
  await page.click(selector);
  for (const ch of text) {
    await page.keyboard.type(ch, { delay: perChar });
  }
}

async function moveTo(page, ref, hover = 250) {
  const box = await ref.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
  await sleep(hover);
}

// ── Seed sample data so the demo isn't empty ────────────────────────────────
async function seed(page) {
  await page.evaluate(async () => {
    const idb = window.indexedDB;
    const db = await new Promise((res, rej) => {
      const r = idb.open('pensive');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('notes', 'readwrite');
    const s = tx.objectStore('notes');
    const now = Date.now();
    const mk = (id, title, parentId, order, paragraphs, tags = []) => ({
      id, title, parentId, order, starred: false, tags,
      createdAt: now - order * 60000, updatedAt: now - order * 60000,
      plainText: paragraphs.join('\n\n'),
      content: { type: 'doc', content: paragraphs.map(t => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })) },
    });
    const notes = [
      mk('demo-welcome', '🪶 Welcome to Pensive', null, 0,
        ['A calm, local-first thinking space. Voice → text → searchable RAG, all on-device.',
         'Press ⌘K to ask questions across every note. Press / for slash commands.'], ['intro']),
      mk('demo-roadmap', 'Q4 product roadmap', null, 1,
        ['Three bets for next quarter: client-only AI, India SMB tooling, and developer experience.',
         'Each bet has a single owner, a 90-day milestone, and a kill-criteria.'], ['product', 'planning']),
      mk('demo-okrs', 'OKRs', 'demo-roadmap', 0,
        ['O1: Ship 3 monetizable client-side AI tools. KR1: 100 paying users. KR2: 4-week MAU > 1k.'], ['product']),
      mk('demo-eng', 'Engineering principles', null, 2,
        ['Local-first by default. The browser is the runtime; the server is an exception.',
         'Privacy is a property of the architecture, not a promise.'], ['engineering']),
      mk('demo-meeting', 'Architecture review', null, 3,
        ['TLDR: WebGPU is the primary inference path; WASM is the always-available fallback.',
         'Decisions: ship import/export ZIP for manual sync; defer encrypted cloud sync to v2.'], ['meetings']),
    ];
    for (const n of notes) s.put(n);
    await new Promise(r => tx.oncomplete = r);
    db.close();
  });
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(GIF_DIR, { recursive: true });
  const tmp = join(OUT_DIR, '_record');
  if (existsSync(tmp)) rmSync(tmp, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    recordVideo: { dir: tmp, size: VIEWPORT },
  });
  const page = await ctx.newPage();

  console.log('▶ Loading', URL);
  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(800);

  console.log('▶ Seeding sample notes');
  await seed(page);
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(1000);

  // ── SCENE 1: Click into the roadmap note (1.5s) ───────────────────────────
  console.log('▶ Scene 1: open a note');
  const roadmap = page.locator('text=Q4 product roadmap').first();
  await moveTo(page, roadmap, 200);
  await roadmap.click();
  await sleep(1200);

  // ── SCENE 2: Type into the editor (3s) ────────────────────────────────────
  console.log('▶ Scene 2: type in editor');
  const editor = page.locator('.ProseMirror').first();
  await editor.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await typeSlowly(page, '.ProseMirror', 'Pensive runs entirely on this device — no servers, no accounts.', 30);
  await sleep(800);

  // ── SCENE 3: Open the Knowledge Graph (3s) ────────────────────────────────
  console.log('▶ Scene 3: knowledge graph');
  const graphBtn = page.locator('button[title*="graph" i], button:has-text("Graph")').first();
  if (await graphBtn.count()) {
    await moveTo(page, graphBtn, 200);
    await graphBtn.click();
    await sleep(2200);
    const closeGraph = page.locator('button[title="Close"]').first();
    await closeGraph.click();
    await sleep(500);
  }

  // ── SCENE 4: Open Settings → highlight Import (2.5s) ──────────────────────
  console.log('▶ Scene 4: settings + import');
  const settingsBtn = page.locator('button[aria-label="Settings"]').first();
  await moveTo(page, settingsBtn, 200);
  await settingsBtn.click();
  await sleep(1200);
  const importBtn = page.locator('button:has-text("Import workspace ZIP")').first();
  if (await importBtn.count()) {
    await moveTo(page, importBtn, 800);
  }
  await sleep(600);
  await page.keyboard.press('Escape');
  await sleep(600);

  // ── SCENE 5: Hover the export ZIP button (1s) ─────────────────────────────
  console.log('▶ Scene 5: ZIP export');
  const zipBtn = page.locator('button:has-text("ZIP")').first();
  if (await zipBtn.count()) {
    await moveTo(page, zipBtn, 1000);
  }

  await sleep(800);

  // ── Stop & save ───────────────────────────────────────────────────────────
  await ctx.close();
  await browser.close();

  const webm = readdirSync(tmp).find(f => f.endsWith('.webm'));
  if (!webm) { console.error('No video produced'); process.exit(1); }
  const rawPath = join(OUT_DIR, 'raw.webm');
  renameSync(join(tmp, webm), rawPath);
  rmSync(tmp, { recursive: true });
  console.log('✓ Recorded', rawPath);

  // ── Convert to GIF ────────────────────────────────────────────────────────
  console.log('▶ Converting to GIF (this takes ~30s)…');
  const gifPath = join(GIF_DIR, 'demo.gif');
  // Two-pass palette for higher quality; gifsicle for size.
  const palette = join(OUT_DIR, 'palette.png');
  execSync(`ffmpeg -y -i "${rawPath}" -vf "fps=${FPS},scale=${MAX_WIDTH}:-1:flags=lanczos,palettegen=stats_mode=diff" "${palette}"`, { stdio: 'inherit' });
  execSync(`ffmpeg -y -i "${rawPath}" -i "${palette}" -lavfi "fps=${FPS},scale=${MAX_WIDTH}:-1:flags=lanczos [v]; [v][1:v] paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" "${gifPath}"`, { stdio: 'inherit' });
  rmSync(palette);

  // Optimize with gifsicle if available.
  try {
    execSync(`gifsicle -O3 --lossy=80 -o "${gifPath}" "${gifPath}"`, { stdio: 'inherit' });
  } catch {
    console.warn('⚠ gifsicle not installed — skipping size optimization');
  }

  const sizeMB = (execSync(`stat -c %s "${gifPath}"`).toString().trim() / 1024 / 1024).toFixed(2);
  console.log(`\n✓ Demo GIF: ${gifPath} (${sizeMB} MB)`);
  console.log('  Add to README:  ![Pensive demo](docs/screenshots/demo.gif)');
})().catch(e => { console.error(e); process.exit(1); });
