export type ProviderName = 'nvidia' | 'groq' | 'huggingface' | 'gemini' | 'openrouter' | 'deepseek';

export interface ModelDef {
  id: string;
  displayName: string;
  provider: ProviderName;
  contextWindow: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsThinking: boolean;
  supportsVision: boolean;
  quality: number;
  speed: number;
  free: boolean;
  bestFor: string[];
}

export interface ProviderDef {
  name: ProviderName;
  baseUrl: string;
  envKey: string;
  displayName: string;
  description: string;
  signupUrl: string;
  freeLimit: string;
}

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
  deepseek: {
    name: 'deepseek',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    envKey: 'DEEPSEEK_API_KEY',
    displayName: 'DeepSeek',
    description: 'DeepSeek V3 + R1 reasoning models.',
    signupUrl: 'https://platform.deepseek.com',
    freeLimit: '500M tokens free',
  },
};

export const MODEL_CATALOGUE: ModelDef[] = [
  // ── DEEPSEEK (dedicated reasoning) ───────────────────────────────────────
  {
    id: 'deepseek-reasoner',
    displayName: 'DeepSeek R1',
    provider: 'deepseek', contextWindow: 64000, maxOutputTokens: 8192,
    supportsStreaming: true, supportsThinking: true, supportsVision: false,
    quality: 10, speed: 7, free: false,
    bestFor: ['thinking', 'math', 'reasoning', 'code_review', 'analysis'],
  },
  {
    id: 'deepseek-chat',
    displayName: 'DeepSeek V3',
    provider: 'deepseek', contextWindow: 64000, maxOutputTokens: 4096,
    supportsStreaming: true, supportsThinking: false, supportsVision: false,
    quality: 9, speed: 8, free: false,
    bestFor: ['general', 'code', 'fast', 'analysis'],
  },

  // ── NVIDIA NIM ───────────────────────────────────────────────────────────
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
    displayName: 'DeepSeek R1 (NIM)',
    provider: 'nvidia', contextWindow: 131072, maxOutputTokens: 16000,
    supportsStreaming: true, supportsThinking: true, supportsVision: false,
    quality: 10, speed: 4, free: false,
    bestFor: ['math', 'reasoning', 'code_review', 'thinking'],
  },

  // ── GROQ ─────────────────────────────────────────────────────────────────
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
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    displayName: 'Llama 4 Scout 17B',
    provider: 'groq', contextWindow: 131072, maxOutputTokens: 8192,
    supportsStreaming: true, supportsThinking: false, supportsVision: true,
    quality: 8, speed: 10, free: true,
    bestFor: ['general', 'vision', 'fast', 'long_context'],
  },

  // ── HUGGING FACE ─────────────────────────────────────────────────────────
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

  // ── GOOGLE GEMINI ────────────────────────────────────────────────────────
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

  // ── OPENROUTER ───────────────────────────────────────────────────────────
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
];

export function getProviderModels(provider: ProviderName): ModelDef[] {
  return MODEL_CATALOGUE.filter((m) => m.provider === provider);
}

export type TaskType = 'general' | 'code' | 'code_review' | 'math' | 'reasoning' | 'fast' | 'vision' | 'long_context' | 'thinking' | 'summarize' | 'analysis';

export function getBestModelForTask(task: TaskType, preferFree = false): ModelDef[] {
  const available = MODEL_CATALOGUE.filter((m) => {
    if (preferFree && !m.free) return false;
    return m.bestFor.includes(task) || m.bestFor.includes('general');
  });

  return available.sort((a, b) => {
    const scoreA = a.quality * 2 + (a.bestFor.includes(task) ? 3 : 0) + (preferFree ? a.speed : 0);
    const scoreB = b.quality * 2 + (b.bestFor.includes(task) ? 3 : 0) + (preferFree ? b.speed : 0);
    return scoreB - scoreA;
  });
}

export function getFallbackChain(task: TaskType, enableThinking: boolean, hasVision: boolean): ModelDef[] {
  const m = (id: string) => MODEL_CATALOGUE.find((x) => x.id === id)!;
  const chain: ModelDef[] = [];

  if (enableThinking) {
    chain.push(m('deepseek-reasoner'));
    chain.push(m('gemini-2.5-flash-preview-04-17'));
    chain.push(m('deepseek-ai/deepseek-r1'));
    chain.push(m('deepseek-r1-distill-llama-70b'));
    chain.push(m('moonshotai/kimi-k2-instruct'));
  } else if (hasVision) {
    chain.push(m('meta/llama-4-maverick-17b-128e-instruct'));
    chain.push(m('gemini-2.0-flash'));
    chain.push(m('meta-llama/llama-4-scout-17b-16e-instruct'));
  } else if (task === 'math' || task === 'reasoning' || task === 'code_review') {
    chain.push(m('deepseek-reasoner'));
    chain.push(m('deepseek-ai/deepseek-r1'));
    chain.push(m('deepseek-r1-distill-llama-70b'));
    chain.push(m('gemini-2.5-flash-preview-04-17'));
    chain.push(m('meta/llama-4-maverick-17b-128e-instruct'));
  } else if (task === 'fast') {
    chain.push(m('llama-3.3-70b-versatile'));
    chain.push(m('gemini-2.0-flash'));
    chain.push(m('deepseek-chat'));
    chain.push(m('moonshotai/kimi-k2-instruct'));
  } else if (task === 'long_context') {
    chain.push(m('gemini-2.5-flash-preview-04-17'));
    chain.push(m('gemini-2.0-flash'));
    chain.push(m('meta-llama/llama-4-scout-17b-16e-instruct'));
    chain.push(m('meta/llama-4-maverick-17b-128e-instruct'));
  } else {
    chain.push(m('meta/llama-4-maverick-17b-128e-instruct'));
    chain.push(m('llama-3.3-70b-versatile'));
    chain.push(m('gemini-2.0-flash'));
    chain.push(m('deepseek-chat'));
    chain.push(m('moonshotai/kimi-k2-instruct'));
  }

  const safetyNet = [
    'Qwen/Qwen2.5-72B-Instruct',
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemini-2.0-flash-exp:free',
  ];
  for (const id of safetyNet) {
    const model = m(id);
    if (model && !chain.find((x) => x.id === id)) chain.push(model);
  }

  return chain.filter(Boolean);
}
