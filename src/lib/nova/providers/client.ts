/**
 * Nova Universal Provider Client
 * ─────────────────────────────────────────────────────────────────────────────
 * All providers expose OpenAI-compatible /v1/chat/completions.
 * One streaming SSE parser works for all of them.
 *
 * Fallback chain (ordered by reliability then cost):
 *   Groq → Gemini → HuggingFace → OpenRouter → NVIDIA NIM (last resort)
 *
 * Key improvements in this version:
 *   • Runtime model-ban cache: 410/404 responses permanently skip that model
 *   • No empty Authorization headers (HuggingFace works anonymously)
 *   • Clear error messages showing which providers have no API key
 *   • Exponential timeout per attempt (15s → 30s → 45s)
 */

import type { NIMChatMessage } from '@/types/nvidia.types';
import type { StreamEvent } from '@/types/nova.types';
import { PROVIDERS, getFallbackChain, type TaskType, type ProviderName, type ModelDef } from './registry';
import { logger } from '@/lib/nova/logger';

// ── Runtime model-ban cache ───────────────────────────────────────────────────
// Models returning 410 (Gone) or 404 (Not Found) are permanently dead.
// Mark them so we stop wasting request budget on them.
const BANNED_MODELS = new Set<string>();
const PERMANENT_ERROR_CODES = new Set([410, 404]);

function banModel(modelId: string, reason: string) {
  if (!BANNED_MODELS.has(modelId)) {
    BANNED_MODELS.add(modelId);
    logger.warn('providers', `⛔ Model permanently banned: ${modelId} — ${reason}`);
  }
}

// ── Provider key resolver ─────────────────────────────────────────────────────
function getApiKey(provider: ProviderName): string {
  const def = PROVIDERS[provider];
  return (process.env[def.envKey] ?? '').trim();
}

function isProviderAvailable(provider: ProviderName): boolean {
  // HuggingFace works anonymously (rate-limited but functional)
  if (provider === 'huggingface') return true;
  return getApiKey(provider).length > 0;
}

function getAvailabilityReason(provider: ProviderName): string {
  if (provider === 'huggingface') return 'anonymous access';
  const key = getApiKey(provider);
  return key.length > 0 ? 'key set' : `missing ${PROVIDERS[provider].envKey}`;
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
                thinking?: string;
              };
              finish_reason?: string | null;
            }>;
            usage?: { prompt_tokens: number; completion_tokens: number };
          };

          const delta = chunk.choices?.[0]?.delta;
          const thinkingContent = delta?.reasoning_content ?? delta?.thinking;
          if (thinkingContent) yield { type: 'thinking', content: thinkingContent };
          if (delta?.content) yield { type: 'content', content: delta.content };
          if (chunk.usage) {
            yield {
              type: 'usage',
              usage: {
                prompt_tokens: chunk.usage.prompt_tokens,
                completion_tokens: chunk.usage.completion_tokens,
              },
            };
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
  timeoutMs?: number;
  signal?: AbortSignal;
}

async function callProvider(opts: CallOptions): Promise<Response> {
  const { model, messages, maxTokens, temperature, enableThinking, timeoutMs = 30000 } = opts;
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
  }

  // Build headers — NEVER send empty Authorization header
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  // HuggingFace anonymous: no Auth header needed (rate-limited free tier)

  if (model.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://nova-ai.vercel.app';
    headers['X-Title'] = 'Nova AI';
  }

  // Per-attempt timeout (increases with each retry level)
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signals: AbortSignal[] = [timeoutSignal];
  if (opts.signal) signals.push(opts.signal);
  const combinedSignal = signals.length > 1 ? AbortSignal.any(signals) : timeoutSignal;

  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: combinedSignal,
    keepalive: false,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');

    // Permanently ban 410 Gone / 404 Not Found models
    if (PERMANENT_ERROR_CODES.has(res.status)) {
      banModel(model.id, `HTTP ${res.status} from ${provider.displayName}`);
    }

    throw new Error(`${provider.displayName} ${res.status}: ${errText.slice(0, 300)}`);
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
  preferredModel?: string;
  signal?: AbortSignal;
}

export interface ProviderResult {
  stream: AsyncGenerator<StreamEvent>;
  modelUsed: ModelDef;
  providerUsed: ProviderName;
  fallbackLevel: number;
}

export async function streamWithFallback(opts: StreamWithFallbackOptions): Promise<ProviderResult> {
  const {
    messages, task, maxTokens,
    temperature = 0.6,
    enableThinking = false,
    hasVision = false,
    signal,
  } = opts;

  // Build fallback chain
  const chain = getFallbackChain(task, enableThinking, hasVision);

  // Prepend preferred model if specified
  if (opts.preferredModel) {
    const { MODEL_CATALOGUE } = await import('./registry');
    const preferred = MODEL_CATALOGUE.find(m => m.id === opts.preferredModel);
    if (preferred && !BANNED_MODELS.has(preferred.id)) chain.unshift(preferred);
  }

  // Log availability map upfront for debugging
  const availMap = Object.keys(PROVIDERS).map(p =>
    `${p}:${getAvailabilityReason(p as ProviderName)}`
  ).join(', ');
  logger.info('providers', `Chain: ${chain.length} models | Keys: [${availMap}]`);

  let lastError: Error = new Error('No providers configured');
  let attemptsMade = 0;

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    if (!model) continue;

    // Skip permanently banned models (410/404)
    if (BANNED_MODELS.has(model.id)) {
      logger.info('providers', `⛔ Skip banned: ${model.id}`);
      continue;
    }

    // Skip providers without API keys (except HuggingFace which works anonymously)
    if (!isProviderAvailable(model.provider)) {
      logger.info('providers', `⏭  Skip ${model.provider}: no API key`);
      continue;
    }

    // Timeout scales with attempt number: 15s → 30s → 45s
    const timeoutMs = Math.min(15000 + i * 15000, 45000);

    try {
      logger.info('providers', `[${i}] Trying ${model.displayName} (${model.provider}) timeout=${timeoutMs}ms`);
      attemptsMade++;

      const response = await callProvider({
        model, messages, maxTokens, temperature, enableThinking, timeoutMs, signal,
      });

      logger.info('providers', `✓ ${model.displayName} responded (fallback level ${i})`);

      return {
        stream: parseSSEStream(response),
        modelUsed: model,
        providerUsed: model.provider,
        fallbackLevel: i,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn('providers', `✗ ${model.displayName}: ${lastError.message.slice(0, 120)}`);
      // Continue to next provider
    }
  }

  const noKeyProviders = Object.keys(PROVIDERS)
    .filter(p => !isProviderAvailable(p as ProviderName))
    .join(', ');

  throw new Error(
    `All providers failed after ${attemptsMade} attempt(s). Last error: ${lastError.message}` +
    (noKeyProviders ? ` | No key set for: ${noKeyProviders}` : ''),
  );
}

// ── Quick non-streaming call (for internal tasks) ─────────────────────────────
export async function quickComplete(
  messages: NIMChatMessage[],
  task: TaskType = 'fast',
  maxTokens = 1024,
): Promise<string> {
  const chain = getFallbackChain(task, false, false);

  for (const model of chain) {
    if (BANNED_MODELS.has(model.id)) continue;
    if (!isProviderAvailable(model.provider)) continue;

    try {
      const provider = PROVIDERS[model.provider];
      const apiKey = getApiKey(model.provider);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      if (model.provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://nova-ai.vercel.app';
        headers['X-Title'] = 'Nova AI';
      }

      const res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: model.id, messages, max_tokens: maxTokens, temperature: 0.3, stream: false }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        if (PERMANENT_ERROR_CODES.has(res.status)) banModel(model.id, `quickComplete ${res.status}`);
        continue;
      }

      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content ?? '';
      if (content) return content;
    } catch { continue; }
  }
  return '';
}

// ── List available providers (for health/debug) ────────────────────────────────
export function getAvailableProviders(): Array<{
  name: ProviderName; available: boolean; displayName: string; freeLimit: string; reason: string;
}> {
  return Object.values(PROVIDERS).map(p => ({
    name: p.name,
    available: isProviderAvailable(p.name),
    displayName: p.displayName,
    freeLimit: p.freeLimit,
    reason: getAvailabilityReason(p.name),
  }));
}

// ── Export banned model list (for health endpoint) ───────────────────────────
export function getBannedModels(): string[] {
  return [...BANNED_MODELS];
}
