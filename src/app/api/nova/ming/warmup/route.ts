/**
 * Vercel Cron Warmup — called by vercel.json cron schedule
 * Keeps Ming model in GPU VRAM, preventing cold starts
 */
import { NextResponse } from 'next/server';

export async function GET() {
  const MING_BASE = process.env.MING_BASE_URL;
  const MING_API_KEY = process.env.MING_API_KEY || '';

  if (!MING_BASE) {
    return NextResponse.json({ skipped: true, reason: 'MING_BASE_URL not set' });
  }

  const start = Date.now();

  try {
    const res = await fetch(`${MING_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(MING_API_KEY ? { Authorization: `Bearer ${MING_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: 'ming-flash-omni-preview',
        messages: [{ role: 'user', content: '.' }],
        max_new_tokens: 1,
        stream: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const duration = Date.now() - start;
    console.log(`[Ming Warmup] status=${res.status} duration=${duration}ms`);

    return NextResponse.json({ ok: res.ok, status: res.status, duration, timestamp: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown',
      duration: Date.now() - start,
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}
