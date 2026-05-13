/**
 * Nova Health Check — GET /api/nova/health
 * Returns provider availability, banned models, and env var status.
 * Useful for debugging "all providers failed" errors in production.
 */

import { getAvailableProviders, getBannedModels, streamWithFallback } from '@/lib/nova/providers/client';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const providers = getAvailableProviders();
  const bannedModels = getBannedModels();

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
    CLOUDFLARE_ACCOUNT_ID: !!process.env.CLOUDFLARE_ACCOUNT_ID,
  };

  // Live ping test
  let pingResult: { ok: boolean; model?: string; error?: string } = { ok: false };
  try {
    const { stream, modelUsed } = await streamWithFallback({
      messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
      task: 'fast', maxTokens: 10, temperature: 0,
    });
    // Drain just first chunk
    for await (const _ of stream) { break; }
    pingResult = { ok: true, model: modelUsed.displayName };
  } catch (err) {
    pingResult = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const anyProviderAvailable = providers.some(p => p.available);

  return NextResponse.json({
    status   : pingResult.ok ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    ping     : pingResult,
    providers,
    bannedModels,
    env      : envCheck,
  });
}
