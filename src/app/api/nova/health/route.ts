/**
 * Nova Health Check — GET /api/nova/health
 * Returns provider availability, banned models, and env var status.
 * Useful for debugging "all providers failed" errors in production.
 */

import { getAvailableProviders, getBannedModels } from '@/lib/nova/providers/client';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const providers = getAvailableProviders();
  const bannedModels = getBannedModels();

  // Check which required env vars are present (values redacted)
  const envCheck: Record<string, boolean> = {
    NVIDIA_NIM_API_KEY  : !!process.env.NVIDIA_NIM_API_KEY,
    GROQ_API_KEY        : !!process.env.GROQ_API_KEY,
    GEMINI_API_KEY      : !!process.env.GEMINI_API_KEY,
    HF_API_TOKEN        : !!process.env.HF_API_TOKEN,
    OPENROUTER_API_KEY  : !!process.env.OPENROUTER_API_KEY,
    DATABASE_URL        : !!process.env.DATABASE_URL,
    QDRANT_URL          : !!process.env.QDRANT_URL,
    QDRANT_API_KEY      : !!process.env.QDRANT_API_KEY,
    INNGEST_SIGNING_KEY : !!process.env.INNGEST_SIGNING_KEY,
    INNGEST_EVENT_KEY   : !!process.env.INNGEST_EVENT_KEY,
  };

  const anyProviderAvailable = providers.some(p => p.available);

  return NextResponse.json({
    status   : anyProviderAvailable ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    providers,
    bannedModels,
    env      : envCheck,
    note     : anyProviderAvailable
      ? 'At least one provider is available'
      : 'NO providers available — add at least one API key to Vercel env vars',
  });
}
