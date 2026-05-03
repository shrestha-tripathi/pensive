// Lazy WebLLM wrapper. Streams chat completions from a local Qwen 2.5 1.5B model.
export const LLM_MODEL = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

export type LoadProgress = { progress: number; text: string };

let enginePromise: Promise<any> | null = null;

export function isWebGpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export async function getEngine(onProgress?: (p: LoadProgress) => void): Promise<any> {
  if (!isWebGpuAvailable()) throw new Error('WebGPU not available');
  if (!enginePromise) {
    enginePromise = (async () => {
      const webllm = await import('@mlc-ai/web-llm');
      const engine = await webllm.CreateMLCEngine(LLM_MODEL, {
        initProgressCallback: (r: any) => onProgress?.({ progress: r.progress ?? 0, text: r.text ?? '' }),
      });
      return engine;
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
