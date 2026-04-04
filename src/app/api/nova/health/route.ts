import { NextResponse } from 'next/server';

interface HealthCheck { name: string; status: 'ok' | 'degraded' | 'down'; latencyMs: number; detail?: string }

async function checkNIM(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const base = process.env.NVIDIA_NIM_BASE ?? 'https://integrate.api.nvidia.com/v1';
    const key = process.env.NVIDIA_NIM_API_KEY ?? '';
    const r = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(3000) });
    return { name: 'nvidia-nim', status: r.ok ? 'ok' : 'degraded', latencyMs: Date.now() - start };
  } catch (e) { return { name: 'nvidia-nim', status: 'down', latencyMs: Date.now() - start, detail: String(e) }; }
}

async function checkKV(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const base = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${process.env.CLOUDFLARE_KV_NAMESPACE_ID}`;
    const r = await fetch(`${base}/values/health-ping`, { headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_D1_TOKEN ?? ''}` }, signal: AbortSignal.timeout(2000), cache: 'no-store' });
    return { name: 'cloudflare-kv', status: r.status < 500 ? 'ok' : 'degraded', latencyMs: Date.now() - start };
  } catch (e) { return { name: 'cloudflare-kv', status: 'down', latencyMs: Date.now() - start, detail: String(e) }; }
}

export async function GET() {
  const start = Date.now();
  const [nim, kv] = await Promise.allSettled([checkNIM(), checkKV()]);
  const checks: HealthCheck[] = [
    nim.status === 'fulfilled' ? nim.value : { name: 'nvidia-nim', status: 'down' as const, latencyMs: 0 },
    kv.status === 'fulfilled' ? kv.value : { name: 'cloudflare-kv', status: 'down' as const, latencyMs: 0 },
    { name: 'api', status: 'ok' as const, latencyMs: 0 },
  ];
  const overallStatus = checks.some(c => c.status === 'down') ? 'degraded' : 'ok';
  return NextResponse.json({ status: overallStatus, checks, totalMs: Date.now() - start, timestamp: new Date().toISOString() });
}
