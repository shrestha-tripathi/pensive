// Lazy WebLLM wrapper. Streams chat completions from a local Qwen 2.5 1.5B model.
import { probeWebGPU } from './capabilities';

export const LLM_MODEL = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

export type LoadProgress = { progress: number; text: string };

let enginePromise: Promise<any> | null = null;

/** Synchronous quick-check (only confirms the API exists; does NOT confirm an
 * adapter is available). Use isWebGpuUsable() for the real check. */
export function isWebGpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/** Real check — actually requests a GPU adapter. */
export async function isWebGpuUsable(): Promise<boolean> {
  return probeWebGPU();
}

export async function getEngine(onProgress?: (p: LoadProgress) => void): Promise<any> {
  const usable = await isWebGpuUsable();
  if (!usable) {
    throw new Error(
      'WebGPU is not available on this browser/device. The Ask feature needs WebGPU to run the local model. Try Chrome or Edge on desktop.'
    );
  }
  if (!enginePromise) {
    enginePromise = (async () => {
      try {
        const webllm = await import('@mlc-ai/web-llm');
        // Use IndexedDB cache (more persistent than the default Cache Storage API,
        // which Chrome evicts aggressively under disk pressure).
        const engine = await webllm.CreateMLCEngine(LLM_MODEL, {
          initProgressCallback: (r: any) =>
            onProgress?.({ progress: r.progress ?? 0, text: r.text ?? '' }),
          useIndexedDBCache: true,
        } as any);
        // Ask the browser to make this storage persistent so it survives eviction.
        try {
          if (navigator.storage?.persist) {
            const persisted = await navigator.storage.persisted();
            if (!persisted) await navigator.storage.persist();
          }
        } catch {}
        return engine;
      } catch (e: any) {
        // Reset so user can retry on a transient network failure.
        enginePromise = null;
        const msg = String(e?.message ?? e);
        if (/Cannot fetch|Failed to fetch|NetworkError|Load failed/i.test(msg)) {
          throw new Error(
            'Could not download the local AI model. Check your internet connection and try again — the model (~1 GB) downloads once, then runs fully offline.'
          );
        }
        if (/WebGPU|adapter|gpu/i.test(msg)) {
          throw new Error(
            'WebGPU initialisation failed. Your browser supports the API but no GPU adapter is available. On Windows, try enabling chrome://flags/#enable-unsafe-webgpu.'
          );
        }
        throw e;
      }
    })();
  }
  return enginePromise;
}

export interface ChatMsg { role: 'system' | 'user' | 'assistant'; content: string }

export async function* streamChat(messages: ChatMsg[], onProgress?: (p: LoadProgress) => void): AsyncGenerator<string> {
  const engine = await getEngine(onProgress);
  const stream = await engine.chat.completions.create({
    messages,
    stream: true,
    temperature: 0.4,
    max_tokens: 512,
  });
  for await (const chunk of stream) {
    const delta = chunk?.choices?.[0]?.delta?.content;
    if (delta) yield delta as string;
  }
}
