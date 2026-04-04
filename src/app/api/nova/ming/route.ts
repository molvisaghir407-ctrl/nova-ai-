import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/nova/logger';

/**
 * Ming-flash-omni Preview — Unified Multimodal Endpoint
 * 
 * Wraps a self-hosted Ming server (FastAPI/vLLM) with:
 * - OpenAI-compatible chat completions passthrough
 * - Multimodal content (image, audio, video URLs)
 * - Warmup ping to prevent cold starts
 * - Health tracking
 */

const MING_BASE = process.env.MING_BASE_URL || 'http://localhost:8000';
const MING_API_KEY = process.env.MING_API_KEY || '';
const WARMUP_INTERVAL_MS = 4 * 60 * 1000; // ping every 4 min to stay warm

// ── In-memory health state ─────────────────────────────────────────────────────
let lastPing = 0;
let isWarm = false;
let warmupInFlight = false;

async function pingMing(): Promise<boolean> {
  try {
    const res = await fetch(`${MING_BASE}/health`, {
      method: 'GET',
      headers: { ...(MING_API_KEY ? { Authorization: `Bearer ${MING_API_KEY}` } : {}) },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function warmup() {
  if (warmupInFlight) return;
  warmupInFlight = true;
  try {
    // Send a minimal generation request — forces model weights into GPU VRAM
    const res = await fetch(`${MING_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(MING_API_KEY ? { Authorization: `Bearer ${MING_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: 'ming-flash-omni-preview',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: AbortSignal.timeout(120_000), // 2 min for first load
    });
    isWarm = res.ok;
    lastPing = Date.now();
    logger.info('ming', isWarm ? 'Model warmed up ✓' : 'Warmup failed', { status: res.status });
  } catch (e) {
    isWarm = false;
    logger.warn('ming', 'Warmup request failed');
  } finally {
    warmupInFlight = false;
  }
}

// Keep model warm — fire-and-forget from each request
function keepWarm() {
  const now = Date.now();
  if (!warmupInFlight && now - lastPing > WARMUP_INTERVAL_MS) {
    warmup().catch(() => {});
  }
}

// ── GET /api/nova/ming — health + warmup trigger ───────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'warmup') {
    // Manual warmup trigger (e.g. from cron job or Vercel cron)
    warmup().catch(() => {});
    return NextResponse.json({ triggered: true, wasWarm: isWarm, lastPing });
  }

  // Health check
  const healthy = await pingMing();
  isWarm = healthy;
  lastPing = Date.now();

  return NextResponse.json({
    healthy,
    isWarm,
    lastPing,
    model: 'Ming-flash-omni Preview',
    capabilities: ['text', 'image', 'audio', 'video', 'image-gen', 'tts', 'asr', 'segmentation'],
    endpoint: MING_BASE,
  });
}

// ── POST /api/nova/ming — unified inference ────────────────────────────────────
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  keepWarm(); // trigger background warmup ping if needed

  try {
    const body = await req.json();
    const {
      messages,
      mode = 'chat',      // 'chat' | 'imagine' | 'asr' | 'tts' | 'video'
      stream = false,
      maxTokens = 2048,
      voice,              // for TTS
      imagePrompt,        // for image gen
      audioBase64,        // for ASR
      videoUrl,           // for video chat
    } = body;

    // Build the appropriate request for Ming
    let mingMessages = messages || [];

    // Mode-specific message construction
    if (mode === 'asr' && audioBase64) {
      mingMessages = [{
        role: 'user',
        content: [
          { type: 'audio', audio: { base64: audioBase64 } },
          { type: 'text', text: 'Please transcribe this audio accurately.' },
        ],
      }];
    } else if (mode === 'tts' && body.text) {
      mingMessages = [{
        role: 'user',
        content: [
          { type: 'text', text: body.text },
          ...(voice ? [{ type: 'audio', audio: { url: voice } }] : []),
        ],
      }];
    } else if (mode === 'imagine' && imagePrompt) {
      mingMessages = [{
        role: 'user',
        content: [{ type: 'text', text: `Generate an image: ${imagePrompt}` }],
      }];
    } else if (mode === 'video' && videoUrl) {
      const lastMsg = messages?.[messages.length - 1];
      mingMessages = [...(messages?.slice(0, -1) || []), {
        role: 'user',
        content: [
          { type: 'video', video: { url: videoUrl } },
          { type: 'text', text: lastMsg?.content || 'Describe this video.' },
        ],
      }];
    }

    logger.info('ming', `Request mode=${mode}`, { stream, tokens: maxTokens });

    const mingRes = await fetch(`${MING_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(MING_API_KEY ? { Authorization: `Bearer ${MING_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: 'ming-flash-omni-preview',
        messages: mingMessages,
        max_new_tokens: maxTokens,
        stream,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    isWarm = true;
    lastPing = Date.now();

    if (!mingRes.ok) {
      const errText = await mingRes.text();
      logger.error('ming', 'Ming API error', errText);
      throw new Error(`Ming ${mingRes.status}: ${errText.slice(0, 200)}`);
    }

    const duration = Date.now() - startTime;

    // Streaming passthrough
    if (stream && mingRes.body) {
      return new Response(mingRes.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // Non-streaming
    const data = await mingRes.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    const usage = data.usage;

    return NextResponse.json({ success: true, content, mode, duration, usage, isWarm });

  } catch (error) {
    logger.error('ming', 'Request failed', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Ming request failed' },
      { status: 500 }
    );
  }
}
