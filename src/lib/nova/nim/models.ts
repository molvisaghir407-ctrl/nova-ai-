import type { NIMTask } from '@/types/nvidia.types';

export const NIM_MODELS = {
  // Reasoning / Chat
  KIMI_K2:          'moonshotai/kimi-k2-instruct',
  DEEPSEEK_R1:      'deepseek-ai/deepseek-r1',
  LLAMA_4_MAVERICK: 'meta/llama-4-maverick-17b-128e-instruct',
  QWEN3_235B:       'qwen/qwen3-235b-a22b',
  NEMOTRON_70B:     'nvidia/llama-3.1-nemotron-70b-instruct',
  // Vision
  LLAMA_VISION_90B: 'meta/llama-3.2-90b-vision-instruct',
  LLAMA_VISION_11B: 'nvidia/llama-3.2-11b-vision-instruct',
  // Image Generation
  FLUX_DEV:         'black-forest-labs/flux-dev',
  FLUX_SCHNELL:     'black-forest-labs/flux-schnell',
  SDXL:             'stabilityai/stable-diffusion-xl',
  // Code
  DEEPSEEK_CODER:   'deepseek-ai/deepseek-coder-v2-lite-instruct',
  // Reranking
  NV_RERANK:        'nvidia/nv-rerankqa-mistral-4b-v3',
} as const;

export type NIMModelKey = keyof typeof NIM_MODELS;
export type NIMModelId = (typeof NIM_MODELS)[NIMModelKey];

interface ModelConfig {
  id: NIMModelId;
  displayName: string;
  contextWindow: number;
  supportsThinking: boolean;
  supportsVision: boolean;
  costTier: 'fast' | 'balanced' | 'premium';
  maxOutputTokens: number;
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  [NIM_MODELS.KIMI_K2]: {
    id: NIM_MODELS.KIMI_K2, displayName: 'Kimi K2', contextWindow: 131072,
    supportsThinking: true, supportsVision: false, costTier: 'premium', maxOutputTokens: 16000,
  },
  [NIM_MODELS.DEEPSEEK_R1]: {
    id: NIM_MODELS.DEEPSEEK_R1, displayName: 'DeepSeek R1', contextWindow: 131072,
    supportsThinking: true, supportsVision: false, costTier: 'premium', maxOutputTokens: 16000,
  },
  [NIM_MODELS.LLAMA_4_MAVERICK]: {
    id: NIM_MODELS.LLAMA_4_MAVERICK, displayName: 'Llama 4 Maverick', contextWindow: 131072,
    supportsThinking: false, supportsVision: true, costTier: 'fast', maxOutputTokens: 8192,
  },
  [NIM_MODELS.LLAMA_VISION_90B]: {
    id: NIM_MODELS.LLAMA_VISION_90B, displayName: 'Llama Vision 90B', contextWindow: 8192,
    supportsThinking: false, supportsVision: true, costTier: 'balanced', maxOutputTokens: 4096,
  },
};

export function routeTask(task: NIMTask, userOverride?: string): string {
  if (userOverride) return userOverride;
  const routes: Record<NIMTask, NIMModelId> = {
    chat_general:    NIM_MODELS.KIMI_K2,
    chat_fast:       NIM_MODELS.LLAMA_4_MAVERICK,
    chat_thinking:   NIM_MODELS.KIMI_K2,
    code_generation: NIM_MODELS.DEEPSEEK_CODER,
    code_review:     NIM_MODELS.DEEPSEEK_R1,
    math_reasoning:  NIM_MODELS.DEEPSEEK_R1,
    vision_analysis: NIM_MODELS.LLAMA_VISION_90B,
    vision_fast:     NIM_MODELS.LLAMA_VISION_11B,
    image_gen_hq:    NIM_MODELS.FLUX_DEV,
    image_gen_fast:  NIM_MODELS.FLUX_SCHNELL,
    long_context:    NIM_MODELS.KIMI_K2,
    summarize:       NIM_MODELS.LLAMA_4_MAVERICK,
    rerank:          NIM_MODELS.NV_RERANK,
  };
  return routes[task] ?? NIM_MODELS.KIMI_K2;
}

export function classifyTask(message: string, hasImages: boolean, enableThinking: boolean): NIMTask {
  if (hasImages) return 'vision_analysis';
  if (enableThinking) return 'chat_thinking';
  const lower = message.toLowerCase();
  if (/\b(math|equation|solve|calculate|integral|derivative|proof)\b/.test(lower)) return 'math_reasoning';
  if (/\b(code|function|class|bug|debug|typescript|python|javascript|rust|golang)\b/.test(lower)) return 'code_generation';
  if (/\b(review|refactor|improve this code|what's wrong with)\b/.test(lower)) return 'code_review';
  if (message.length > 2000) return 'long_context';
  if (/\b(summarize|tldr|brief|summary)\b/.test(lower)) return 'summarize';
  return 'chat_general';
}
