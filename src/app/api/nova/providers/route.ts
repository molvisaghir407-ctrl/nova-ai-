import { NextResponse } from 'next/server';
import { getAvailableProviders } from '@/lib/nova/providers/client';
import { MODEL_CATALOGUE, PROVIDERS } from '@/lib/nova/providers/registry';

export async function GET() {
  const providers = getAvailableProviders();
  const models = MODEL_CATALOGUE.map(m => ({
    id: m.id,
    displayName: m.displayName,
    provider: m.provider,
    quality: m.quality,
    speed: m.speed,
    free: m.free,
    contextWindow: m.contextWindow,
    supportsThinking: m.supportsThinking,
    supportsVision: m.supportsVision,
    bestFor: m.bestFor,
    available: providers.find(p => p.name === m.provider)?.available ?? false,
  }));

  const setupInstructions = providers
    .filter(p => !p.available)
    .map(p => {
      const def = PROVIDERS[p.name];
      return {
        provider: p.name,
        displayName: p.displayName,
        envKey: def.envKey,
        freeLimit: p.freeLimit,
        signupUrl: def.signupUrl,
        steps: getSetupSteps(p.name as Parameters<typeof getSetupSteps>[0]),
      };
    });

  return NextResponse.json({
    success: true,
    providers,
    models,
    setupInstructions,
    activeCount: providers.filter(p => p.available).length,
    totalCount: providers.length,
  });
}

function getSetupSteps(provider: 'nvidia' | 'groq' | 'huggingface' | 'gemini' | 'openrouter'): string[] {
  const steps: Record<typeof provider, string[]> = {
    groq: [
      '1. Go to console.groq.com → Sign up free',
      '2. API Keys → Create API Key',
      '3. Add GROQ_API_KEY to Vercel env vars',
      'Free: 14,400 req/day • Llama 3.3 70B, DeepSeek R1 Distill',
    ],
    huggingface: [
      '1. Go to huggingface.co → Create account',
      '2. Settings → Access Tokens → New Token (read)',
      '3. Add HF_API_TOKEN to Vercel env vars',
      'Free: Serverless inference on Qwen2.5-72B, Llama 3.3-70B, Mistral',
    ],
    gemini: [
      '1. Go to aistudio.google.com → Sign in',
      '2. Get API Key → Create API key',
      '3. Add GEMINI_API_KEY to Vercel env vars',
      'Free: 1,500 req/day • Gemini 2.0 Flash (1M context!)',
    ],
    openrouter: [
      '1. Go to openrouter.ai → Sign up',
      '2. Keys → Create key',
      '3. Add OPENROUTER_API_KEY to Vercel env vars',
      'Free: Access to :free models (Llama, Gemma, Mistral, Qwen)',
    ],
    nvidia: [
      '1. Go to build.nvidia.com',
      '2. Sign up and create API key',
      '3. Add NVIDIA_NIM_API_KEY to Vercel env vars',
      'Pay per token — Kimi K2, DeepSeek R1, Llama 4',
    ],
  };
  return steps[provider] ?? [];
}
