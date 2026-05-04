# Demo GIF recorder

Scripts a real Chromium browser through the live Pensive app via Playwright,
records the session as WebM, and converts it to an optimized GIF for the README.

## One-time setup

```bash
npm install -D playwright
npx playwright install chromium
sudo apt install ffmpeg gifsicle      # macOS: brew install ffmpeg gifsicle
```

## Record

```bash
# Default: records against the live demo on GitHub Pages
node docs/demo/record.mjs

# Or against a local dev server (npm run dev)
PENSIVE_URL=http://localhost:5173 node docs/demo/record.mjs
```

Output:
- `docs/demo/raw.webm` — raw recording (kept for re-encoding without re-running the bot)
- `docs/screenshots/demo.gif` — optimized GIF, ready for the README

## What the demo does (~12 s)

1. Loads the app, seeds 5 sample notes into IndexedDB so the UI isn't empty.
2. Clicks into the *Q4 product roadmap* note.
3. Types a sentence into the editor.
4. Opens the Knowledge Graph, holds for 2 s, closes it.
5. Opens Settings, hovers the new **Import workspace ZIP** button.
6. Returns to the editor and hovers the **ZIP** export button.

## Tweaking

Edit the `SCENE` blocks in [`record.mjs`](./record.mjs). Common knobs at the top:

| Constant | What it does |
|---|---|
| `VIEWPORT` | Browser window size (default 1280×720) |
| `FPS` | GIF frame rate (default 12 — 10–15 is the sweet spot) |
| `MAX_WIDTH` | GIF width cap for README friendliness (default 960) |
| `typeSlowly(..., perChar)` | Per-character typing delay in ms |

After recording you can re-encode with different params from the cached `raw.webm`
without re-running the browser:

```bash
ffmpeg -i docs/demo/raw.webm -vf "fps=10,scale=720:-1:flags=lanczos" docs/screenshots/demo.gif
```

## Tips

- Record on a clean profile (the script uses a fresh Playwright context, so this is automatic).
- If the live deploy is slow, point at a local `npm run preview` instead — the recording will be smoother.
- Aim for **< 4 MB** so GitHub doesn't lazy-load it on README scroll. `gifsicle -O3 --lossy=80` usually gets there.
- If the GIF still feels too long, drop a SCENE — viewers fall off after ~10 s on README pages.
