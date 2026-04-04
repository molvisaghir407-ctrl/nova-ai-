import type { NIMChatOptions, NIMChatMessage, NIMStreamChunk } from '@/types/nvidia.types';
import type { StreamEvent } from '@/types/nova.types';
import { NIM_MODELS } from './models';

const NIM_BASE = process.env.NVIDIA_NIM_BASE ?? 'https://integrate.api.nvidia.com/v1';
const NIM_KEY  = process.env.NVIDIA_NIM_API_KEY ?? '';

// ── Retry helper ──────────────────────────────────────────────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  backoffMs = 200,
): Promise<T> {
  let lastError: Error = new Error('Unknown error');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isClientError = lastError.message.includes('400') || lastError.message.includes('401') || lastError.message.includes('403');
      if (isClientError || attempt === maxAttempts) break;
      await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt - 1)));
    }
  }
  throw lastError;
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────
function nimFetch(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  return withRetry(() =>
    fetch(`${NIM_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${NIM_KEY}` },
      body: JSON.stringify(body),
      signal,
    }).then(r => {
      if (!r.ok) return r.text().then(t => { throw new Error(`NIM ${r.status}: ${t.slice(0, 200)}`); });
      return r;
    })
  );
}

// ── Streaming SSE parser ──────────────────────────────────────────────────────
export async function* parseNIMStream(
  response: Response
): AsyncGenerator<StreamEvent> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');
  const decoder = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const json = trimmed.slice(5).trim();
        if (json === '[DONE]') return;

        try {
          const chunk = JSON.parse(json) as NIMStreamChunk;
          const delta = chunk.choices?.[0]?.delta;

          if (delta?.reasoning_content) {
            yield { type: 'thinking', content: delta.reasoning_content };
          }
          if (delta?.content) {
            yield { type: 'content', content: delta.content };
          }
          if (chunk.usage) {
            yield { type: 'usage', usage: { prompt_tokens: chunk.usage.prompt_tokens, completion_tokens: chunk.usage.completion_tokens } };
          }
        } catch {
          // skip malformed chunk
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Chat completion ───────────────────────────────────────────────────────────
export async function chatStream(
  opts: NIMChatOptions,
  signal?: AbortSignal
): Promise<Response> {
  return nimFetch('/chat/completions', opts, signal);
}

export async function chatComplete(
  opts: Omit<NIMChatOptions, 'stream'>,
  signal?: AbortSignal
): Promise<{ content: string; thinking: string; usage?: { prompt_tokens: number; completion_tokens: number } }> {
  const res = await nimFetch('/chat/completions', { ...opts, stream: false }, signal);
  const data = await res.json() as { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>; usage?: { prompt_tokens: number; completion_tokens: number } };
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    thinking: data.choices?.[0]?.message?.reasoning_content ?? '',
    usage: data.usage,
  };
}

// ── Embed texts ───────────────────────────────────────────────────────────────
export async function embed(
  texts: string[],
  model = NIM_MODELS.LLAMA_VISION_11B,
  signal?: AbortSignal
): Promise<number[][]> {
  const res = await nimFetch('/embeddings', { model, input: texts }, signal);
  const data = await res.json() as { data?: Array<{ embedding: number[] }> };
  return (data.data ?? []).map(d => d.embedding);
}

// ── Rerank ────────────────────────────────────────────────────────────────────
export async function rerank(
  query: string,
  documents: string[],
  signal?: AbortSignal
): Promise<Array<{ index: number; score: number }>> {
  try {
    const res = await nimFetch('/ranking', { model: NIM_MODELS.NV_RERANK, query: { query }, passages: documents.map(d => ({ text: d })) }, signal);
    const data = await res.json() as { rankings?: Array<{ index: number; logit: number }> };
    return (data.rankings ?? []).map(r => ({ index: r.index, score: r.logit })).sort((a, b) => b.score - a.score);
  } catch {
    // If rerank fails, return identity ranking
    return documents.map((_, i) => ({ index: i, score: 1 - i * 0.01 }));
  }
}

// ── Image generation ──────────────────────────────────────────────────────────
export async function generateImage(
  prompt: string,
  opts: {
    model?: string; width?: number; height?: number;
    steps?: number; cfgScale?: number; seed?: number;
    negativePrompt?: string; numImages?: number;
  } = {},
  signal?: AbortSignal
): Promise<Array<{ b64: string; revisedPrompt: string }>> {
  const { model = NIM_MODELS.FLUX_DEV, width = 1024, height = 1024, steps = 20, cfgScale = 7, seed, negativePrompt, numImages = 1 } = opts;
  const payload: Record<string, unknown> = {
    model, prompt,
    n: Math.min(numImages, 1), // FLUX max is 1
    size: `${width}x${height}`,
    response_format: 'b64_json',
    num_inference_steps: steps,
    guidance_scale: cfgScale,
  };
  if (negativePrompt) payload['negative_prompt'] = negativePrompt;
  if (seed !== undefined) payload['seed'] = seed;
  const res = await nimFetch('/images/generations', payload, signal);
  const data = await res.json() as { data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }> };
  return (data.data ?? []).map(img => ({ b64: img.b64_json ?? '', revisedPrompt: img.revised_prompt ?? prompt }));
}

// ── Quick text generation (non-streaming, for internal use) ───────────────────
export async function quickChat(
  messages: NIMChatMessage[],
  model = NIM_MODELS.LLAMA_4_MAVERICK,
  maxTokens = 1024,
  signal?: AbortSignal
): Promise<string> {
  const result = await chatComplete({ model, messages, max_tokens: maxTokens, temperature: 0.3, top_p: 0.9 }, signal);
  return result.content;
}
