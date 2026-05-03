// Auto-tagging via semantic similarity to a curated topic vocabulary.
import { embed, cosine } from './embeddings';
import { TOPIC_VOCAB } from './topicVocab';

let vocabVecs: Float32Array[] | null = null;
let vocabPromise: Promise<Float32Array[]> | null = null;

async function ensureVocab(): Promise<Float32Array[]> {
  if (vocabVecs) return vocabVecs;
  if (vocabPromise) return vocabPromise;
  vocabPromise = (async () => {
    const out: Float32Array[] = [];
    for (const t of TOPIC_VOCAB) out.push(await embed(t));
    vocabVecs = out;
    return out;
  })();
  return vocabPromise;
}

export interface AutoTagOptions {
  topK?: number;
  minScore?: number;
}

/** Compute up to topK auto-tags from note plain text. */
export async function computeAutoTags(text: string, opts: AutoTagOptions = {}): Promise<string[]> {
  const topK = opts.topK ?? 3;
  const minScore = opts.minScore ?? 0.45;
  const t = (text || '').trim();
  if (!t) return [];
  const vocab = await ensureVocab();
  // Use up to ~1500 chars total; if longer, sample first/middle/last paragraphs.
  const sample = t.length > 1500 ? (t.slice(0, 700) + ' ' + t.slice(Math.max(0, Math.floor(t.length / 2) - 200), Math.floor(t.length / 2) + 200) + ' ' + t.slice(-500)) : t;
  const noteVec = await embed(sample);
  const scored = vocab.map((v, i) => ({ tag: TOPIC_VOCAB[i], score: cosine(noteVec, v) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.filter(s => s.score >= minScore).slice(0, topK).map(s => s.tag);
}
