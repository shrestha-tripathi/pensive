// Lazy-loaded embedding pipeline using @huggingface/transformers v3 (bge-small-en-v1.5).
// Returns 384-dim mean-pooled, L2-normalized vectors → cosine ≡ dot product.

type FeatureExtractionPipeline = (text: string | string[], opts?: any) => Promise<any>;

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

const MODEL = 'Xenova/bge-small-en-v1.5';

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (pipelinePromise) return pipelinePromise;
  pipelinePromise = (async () => {
    const tx = await import('@huggingface/transformers');
    try {
      return (await tx.pipeline('feature-extraction', MODEL, { device: 'webgpu' as any })) as any;
    } catch (e) {
      console.warn('[embeddings] WebGPU init failed, falling back to wasm', e);
      return (await tx.pipeline('feature-extraction', MODEL, { device: 'wasm' as any })) as any;
    }
  })();
  return pipelinePromise;
}

export async function embed(text: string): Promise<Float32Array> {
  const pipe = await getPipeline();
  const out = await pipe(text, { pooling: 'mean', normalize: true });
  // out.data is Float32Array of length 384
  return new Float32Array(out.data);
}

export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  const out: Float32Array[] = [];
  for (const t of texts) out.push(await embed(t));
  return out;
}

// Char-based heuristic ≈ 400 tokens / 50-token overlap.
const CHUNK_CHARS = 1500;
const OVERLAP_CHARS = 200;

export function chunkText(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= CHUNK_CHARS) return [t];
  const chunks: string[] = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(t.length, i + CHUNK_CHARS);
    chunks.push(t.slice(i, end));
    if (end >= t.length) break;
    i = end - OVERLAP_CHARS;
  }
  return chunks;
}

export function cosine(a: Float32Array, b: Float32Array): number {
  // Assumes both are L2-normalized → dot product.
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

export async function preloadEmbedder(): Promise<void> {
  await getPipeline();
}
