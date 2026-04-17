/**
 * Nova Universal Provider Client
 * 
 * All providers expose OpenAI-compatible /v1/chat/completions.
 * One streaming parser works for all of them.
 * 
 * Fallback chain:
 *   NVIDIA NIM → Groq → HuggingFace → Gemini → OpenRouter
 */

import type { NIMChatMessage } from '@/types/nvidia.types';
import type { StreamEvent } from '@/types/nova.types';
import { PROVIDERS, getFallbackChain, type TaskType, type ProviderName, type ModelDef } from './registry';
import { logger } from '@/lib/nova/logger';

// ── Provider key resolver ─────────────────────────────────────────────────────
function getApiKey(provider: ProviderName): string {
  const def = PROVIDERS[provider];
  return process.env[def.envKey] ?? '';
}

function isProviderAvailable(provider: ProviderName): boolean {
  return getApiKey(provider).length > 0;
}

// ── OpenAI-compatible SSE parser (works for ALL providers) ────────────────────
async function* parseSSEStream(response: Response): AsyncGenerator<StreamEvent> {
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
          const chunk = JSON.parse(json) as {
            choices?: Array<{
              delta?: {
                content?: string;
                reasoning_content?: string;
                // Gemini/Groq thinking uses different field names
                thinking?: string;
              };
              finish_reason?: string | null;
            }>;
            usage?: { prompt_tokens: number; completion_tokens: number };
          };

          const delta = chunk.choices?.[0]?.delta;

          // Handle thinking tokens (varies by provider)
          const thinkingContent = delta?.reasoning_content ?? delta?.thinking;
          if (thinkingContent) yield { type: 'thinking', content: thinkingContent };

          if (delta?.content) yield { type: 'content', content: delta.content };

          if (chunk.usage) {
            yield { type: 'usage', usage: { prompt_tokens: chunk.usage.prompt_tokens, completion_tokens: chunk.usage.completion_tokens } };
          }
        } catch { /* skip malformed chunks */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Single provider call ──────────────────────────────────────────────────────
interface CallOptions {
  model: ModelDef;
  messages: NIMChatMessage[];
  maxTokens: number;
  temperature: number;
  enableThinking: boolean;
  signal?: AbortSignal;
}

async function callProvider(opts: CallOptions): Promise<Response> {
  const { model, messages, maxTokens, temperature, enableThinking } = opts;
  const provider = PROVIDERS[model.provider];
  const apiKey = getApiKey(model.provider);

  const body: Record<string, unknown> = {
    model: model.id,
    messages,
    max_tokens: Math.min(maxTokens, model.maxOutputTokens),
    temperature,
    top_p: 0.95,
    stream: true,
  };

  // Provider-specific thinking configuration
  if (enableThinking && model.supportsThinking) {
    if (model.provider === 'nvidia') {
      body['thinking'] = { type: 'enabled', budget_tokens: 8000 };
    } else if (model.provider === 'groq') {
      body['reasoning_effort'] = 'default';
    } else if (model.provider === 'gemini') {
      body['thinking_config'] = { thinking_budget: 8000 };
    }
    // OpenRouter and HF use model-native thinking (already in model)
  }

  // HuggingFace needs specific headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  // OpenRouter requires extra headers
  if (model.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://nova-ai.vercel.app';
    headers['X-Title'] = 'Nova AI';
  }

  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`${provider.displayName} ${res.status}: ${errText.slice(0, 200)}`);
  }

  return res;
}

// ── Public: stream with auto-fallback ────────────────────────────────────────
export interface StreamWithFallbackOptions {
  messages: NIMChatMessage[];
  task: TaskType;
  maxTokens: number;
  temperature?: number;
  enableThinking?: boolean;
  hasVision?: boolean;
  preferredModel?: string;   // override: specific model ID
  signal?: AbortSignal;
}

export interface ProviderResult {
  stream: AsyncGenerator<StreamEvent>;
  modelUsed: ModelDef;
  providerUsed: ProviderName;
  fallbackLevel: number;     // 0 = primary, 1 = first fallback, etc.
}

export async function streamWithFallback(opts: StreamWithFallbackOptions): Promise<ProviderResult> {
  const {
    messages, task, maxTokens, temperature = 0.6,
    enableThinking = false, hasVision = false, signal,
  } = opts;

  // Build fallback chain
  const chain = getFallbackChain(task, enableThinking, hasVision);

  // If user specified a preferred model, try to put it first
  if (opts.preferredModel) {
    const { MODEL_CATALOGUE } = await import('./registry');
    const preferred = MODEL_CATALOGUE.find(m => m.id === opts.preferredModel);
    if (preferred) chain.unshift(preferred);
  }

  let lastError: Error = new Error('No providers available');
  
  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    if (!model) continue;

    // Skip if provider has no key
    if (!isProviderAvailable(model.provider)) {
      logger.info('providers', `Skipping ${model.provider} (no API key)`);
      continue;
    }

    try {
      logger.info('providers', `Trying [${i}] ${model.displayName} (${model.provider})`, { task });
      
      const response = await callProvider({ model, messages, maxTokens, temperature, enableThinking, signal });

      logger.info('providers', `✓ Using ${model.displayName}`, { fallbackLevel: i });

      return {
        stream: parseSSEStream(response),
        modelUsed: model,
        providerUsed: model.provider,
        fallbackLevel: i,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn('providers', `✗ ${model.displayName} failed: ${lastError.message}`, { attempt: i });
      // Continue to next fallback
    }
  }

  throw new Error(`All providers failed. Last error: ${lastError.message}`);
}

// ── Quick non-streaming call (for internal use) ───────────────────────────────
export async function quickComplete(
  messages: NIMChatMessage[],
  task: TaskType = 'fast',
  maxTokens = 1024,
): Promise<string> {
  const chain = getFallbackChain(task, false, false);

  for (const model of chain) {
    if (!isProviderAvailable(model.provider)) continue;
    try {
      const provider = PROVIDERS[model.provider];
      const apiKey = getApiKey(model.provider);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };
      if (model.provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://nova-ai.vercel.app';
        headers['X-Title'] = 'Nova AI';
      }
      const res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: model.id, messages, max_tokens: maxTokens, temperature: 0.3, stream: false }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content ?? '';
      if (content) return content;
    } catch { continue; }
  }

  return '';
}

// ── List available providers (for health/debug) ───────────────────────────────
export function getAvailableProviders(): Array<{ name: ProviderName; available: boolean; displayName: string; freeLimit: string }> {
  return Object.values(PROVIDERS).map(p => ({
    name: p.name,
    available: isProviderAvailable(p.name),
    displayName: p.displayName,
    freeLimit: p.freeLimit,
  }));
}
