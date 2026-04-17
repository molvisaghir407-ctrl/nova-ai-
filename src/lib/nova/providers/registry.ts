/**
 * Nova Multi-Provider Registry
 * All providers share OpenAI-compatible /v1/chat/completions API format.
 * Each has free tier models that work without a credit card.
 */

export type ProviderName = 'nvidia' | 'groq' | 'huggingface' | 'gemini' | 'openrouter';

export interface ModelDef {
  id: string;               // model ID sent to API
  displayName: string;
  provider: ProviderName;
  contextWindow: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsThinking: boolean;
  supportsVision: boolean;
  quality: number;          // 1-10 (for auto-routing)
  speed: number;            // 1-10 (tokens/sec estimate)
  free: boolean;
  bestFor: string[];
}

export interface ProviderDef {
  name: ProviderName;
  baseUrl: string;
  envKey: string;           // process.env[envKey]
  displayName: string;
  description: string;
  signupUrl: string;
  freeLimit: string;
}

// ── Provider definitions ─────────────────────────────────────────────────────
export const PROVIDERS: Record<ProviderName, ProviderDef> = {
  nvidia: {
    name: 'nvidia',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    envKey: 'NVIDIA_NIM_API_KEY',
    displayName: 'NVIDIA NIM',
    description: 'Best quality. Kimi K2 128k with thinking.',
    signupUrl: 'https://build.nvidia.com',
    freeLimit: 'Pay per token',
  },
  groq: {
    name: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
    displayName: 'Groq',
    description: 'Ultra-fast inference. Llama 3.3 70B free.',
    signupUrl: 'https://console.groq.com',
    freeLimit: '14,400 req/day • 6,000 tok/min free',
  },
  huggingface: {
    name: 'huggingface',
    baseUrl: 'https://api-inference.huggingface.co/v1',
    envKey: 'HF_API_TOKEN',
    displayName: 'HuggingFace',
    description: 'Free serverless inference. Qwen2.5-72B.',
    signupUrl: 'https://huggingface.co/settings/tokens',
    freeLimit: 'Free tier available',
  },
  gemini: {
    name: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    envKey: 'GEMINI_API_KEY',
    displayName: 'Google Gemini',
    description: 'Gemini 2.0 Flash free. 1500 req/day.',
    signupUrl: 'https://aistudio.google.com/app/apikey',
    freeLimit: '1,500 RPD • 1M TPM free (Flash)',
  },
  openrouter: {
    name: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    envKey: 'OPENROUTER_API_KEY',
    displayName: 'OpenRouter',
    description: 'Aggregator with free models.',
    signupUrl: 'https://openrouter.ai/keys',
    freeLimit: 'Free tier with :free models',
  },
};

// ── Model catalogue ──────────────────────────────────────────────────────────
export const MODEL_CATALOGUE: ModelDef[] = [
  // ── NVIDIA NIM ────────────────────────────────────────────────────────────
  {
    id: 'moonshotai/kimi-k2-instruct',
    displayName: 'Kimi K2 (128k)',
    provider: 'nvidia', contextWindow: 131072, maxOutputTokens: 16000,
    supportsStreaming: true, supportsThinking: true, supportsVision: false,
    quality: 10, speed: 6, free: false,
    bestFor: ['general', 'code', 'reasoning', 'long_context', 'thinking'],
  },
  {
    id: 'meta/llama-4-maverick-17b-128e-instruct',
    displayName: 'Llama 4 Maverick',
    provider: 'nvidia', contextWindow: 131072, maxOutputTokens: 8192,
    supportsStreaming: true, supportsThinking: false, supportsVision: true,
    quality: 8, speed: 9, free: false,
    bestFor: ['general', 'fast', 'vision', 'summarize'],
  },
  {
    id: 'deepseek-ai/deepseek-r1',
    displayName: 'DeepSeek R1',
    provider: 'nvidia', contextWindow: 131072, maxOutputTokens: 16000,
    supportsStreaming: true, supportsThinking: true, supportsVision: false,
    quality: 10, speed: 4, free: false,
    bestFor: ['math', 'reasoning', 'code_review'],
  },

  // ── GROQ (free, ultra-fast) ───────────────────────────────────────────────
  {
    id: 'llama-3.3-70b-versatile',
    displayName: 'Llama 3.3 70B',
    provider: 'groq', contextWindow: 128000, maxOutputTokens: 8192,
    supportsStreaming: true, supportsThinking: false, supportsVision: false,
    quality: 9, speed: 10, free: true,
    bestFor: ['general', 'code', 'fast', 'summarize', 'analysis'],
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    displayName: 'DeepSeek R1 Distill 70B',
    provider: 'groq', contextWindow: 128000, maxOutputTokens: 8000,
    supportsStreaming: true, supportsThinking: true, supportsVision: false,
    quality: 9, speed: 8, free: true,
    bestFor: ['math', 'reasoning', 'thinking', 'code_review'],
  },
  {
    id: 'moonshotai/moonlight-16b-a3b-instruct',
    displayName: 'Moonlight 16B',
    provider: 'groq', contextWindow: 8192, maxOutputTokens: 4096,
    supportsStreaming: true, supportsThinking: false, supportsVision: false,
    quality: 7, speed: 10, free: true,
    bestFor: ['fast', 'simple', 'chat'],
  },
  {
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    displayName: 'Llama 4 Scout 17B',
    provider: 'groq', contextWindow: 131072, maxOutputTokens: 8192,
    supportsStreaming: true, supportsThinking: false, supportsVision: true,
    quality: 8, speed: 10, free: true,
    bestFor: ['general', 'vision', 'fast', 'long_context'],
  },

  // ── HUGGING FACE (free serverless) ───────────────────────────────────────
  {
    id: 'Qwen/Qwen2.5-72B-Instruct',
    displayName: 'Qwen2.5 72B',
    provider: 'huggingface', contextWindow: 131072, maxOutputTokens: 8192,
    supportsStreaming: true, supportsThinking: false, supportsVision: false,
    quality: 9, speed: 5, free: true,
    bestFor: ['general', 'code', 'analysis', 'multilingual'],
  },
  {
    id: 'meta-llama/Llama-3.3-70B-Instruct',
    displayName: 'Llama 3.3 70B (HF)',
    provider: 'huggingface', contextWindow: 128000, maxOutputTokens: 8192,
    supportsStreaming: true, supportsThinking: false, supportsVision: false,
    quality: 9, speed: 5, free: true,
    bestFor: ['general', 'code', 'reasoning'],
  },
  {
    id: 'mistralai/Mistral-7B-Instruct-v0.3',
    displayName: 'Mistral 7B',
    provider: 'huggingface', contextWindow: 32000, maxOutputTokens: 4096,
    supportsStreaming: true, supportsThinking: false, supportsVision: false,
    quality: 7, speed: 8, free: true,
    bestFor: ['fast', 'simple', 'summarize'],
  },

  // ── GOOGLE GEMINI (free tier) ─────────────────────────────────────────────
  {
    id: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    provider: 'gemini', contextWindow: 1048576, maxOutputTokens: 8192,
    supportsStreaming: true, supportsThinking: false, supportsVision: true,
    quality: 9, speed: 9, free: true,
    bestFor: ['general', 'fast', 'vision', 'long_context', 'code'],
  },
  {
    id: 'gemini-2.5-flash-preview-04-17',
    displayName: 'Gemini 2.5 Flash',
    provider: 'gemini', contextWindow: 1048576, maxOutputTokens: 65536,
    supportsStreaming: true, supportsThinking: true, supportsVision: true,
    quality: 10, speed: 8, free: true,
    bestFor: ['reasoning', 'thinking', 'vision', 'long_context'],
  },

  // ── OPENROUTER (free models) ──────────────────────────────────────────────
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    displayName: 'Llama 3.3 70B (OR)',
    provider: 'openrouter', contextWindow: 131072, maxOutputTokens: 8192,
    supportsStreaming: true, supportsThinking: false, supportsVision: false,
    quality: 9, speed: 7, free: true,
    bestFor: ['general', 'code', 'fallback'],
  },
  {
    id: 'qwen/qwen3-32b:free',
    displayName: 'Qwen3 32B (OR)',
    provider: 'openrouter', contextWindow: 40000, maxOutputTokens: 8192,
    supportsStreaming: true, supportsThinking: true, supportsVision: false,
    quality: 8, speed: 6, free: true,
    bestFor: ['reasoning', 'thinking', 'code'],
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    displayName: 'Gemini Flash Exp (OR)',
    provider: 'openrouter', contextWindow: 1048576, maxOutputTokens: 8192,
    supportsStreaming: true, supportsThinking: false, supportsVision: true,
    quality: 9, speed: 8, free: true,
    bestFor: ['general', 'vision', 'fallback'],
  },
];

// ── Helper: get available models for a provider ─────────────────────────────
export function getProviderModels(provider: ProviderName): ModelDef[] {
  return MODEL_CATALOGUE.filter(m => m.provider === provider);
}

// ── Helper: get best model for a task ───────────────────────────────────────
export type TaskType = 'general' | 'code' | 'math' | 'reasoning' | 'fast' | 'vision' | 'long_context' | 'thinking' | 'summarize' | 'analysis';

export function getBestModelForTask(task: TaskType, preferFree = false): ModelDef[] {
  const available = MODEL_CATALOGUE.filter(m => {
    if (preferFree && !m.free) return false;
    return m.bestFor.includes(task) || m.bestFor.includes('general');
  });

  return available.sort((a, b) => {
    const scoreA = a.quality * 2 + (a.bestFor.includes(task) ? 3 : 0) + (preferFree ? a.speed : 0);
    const scoreB = b.quality * 2 + (b.bestFor.includes(task) ? 3 : 0) + (preferFree ? b.speed : 0);
    return scoreB - scoreA;
  });
}

// ── Priority fallback chain for a given task ─────────────────────────────────
export function getFallbackChain(task: TaskType, enableThinking: boolean, hasVision: boolean): ModelDef[] {
  const chain: ModelDef[] = [];

  // 1. NVIDIA NIM (primary — best quality)
  if (enableThinking) {
    chain.push(MODEL_CATALOGUE.find(m => m.id === 'moonshotai/kimi-k2-instruct')!);
  } else if (hasVision) {
    chain.push(MODEL_CATALOGUE.find(m => m.id === 'meta/llama-4-maverick-17b-128e-instruct')!);
  } else if (task === 'math' || task === 'reasoning') {
    chain.push(MODEL_CATALOGUE.find(m => m.id === 'deepseek-ai/deepseek-r1')!);
  } else {
    chain.push(MODEL_CATALOGUE.find(m => m.id === 'moonshotai/kimi-k2-instruct')!);
  }

  // 2. Groq (free, ultra-fast fallback)
  if (enableThinking) {
    chain.push(MODEL_CATALOGUE.find(m => m.id === 'deepseek-r1-distill-llama-70b')!);
  } else if (hasVision) {
    chain.push(MODEL_CATALOGUE.find(m => m.id === 'meta-llama/llama-4-scout-17b-16e-instruct')!);
  } else {
    chain.push(MODEL_CATALOGUE.find(m => m.id === 'llama-3.3-70b-versatile')!);
  }

  // 3. HuggingFace (free, 72B quality)
  chain.push(MODEL_CATALOGUE.find(m => m.id === 'Qwen/Qwen2.5-72B-Instruct')!);

  // 4. Google Gemini (free, 1M context)
  if (enableThinking) {
    chain.push(MODEL_CATALOGUE.find(m => m.id === 'gemini-2.5-flash-preview-04-17')!);
  } else {
    chain.push(MODEL_CATALOGUE.find(m => m.id === 'gemini-2.0-flash')!);
  }

  // 5. OpenRouter (free models, last resort)
  chain.push(MODEL_CATALOGUE.find(m => m.id === 'meta-llama/llama-3.3-70b-instruct:free')!);

  return chain.filter(Boolean);
}
