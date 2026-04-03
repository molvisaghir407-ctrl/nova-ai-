/**
 * Nova AI — Cloudflare KV Session Store
 * Namespace: nova-ai-sessions (cbb6c3599af44d8c8b5990bfea17eda6)
 */

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CF_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID!;
const CF_TOKEN = process.env.CLOUDFLARE_D1_TOKEN!;

const BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_NAMESPACE_ID}`;

export const sessionStore = {
  async get(sessionId: string): Promise<any[]> {
    try {
      const res = await fetch(`${BASE}/values/session:${sessionId}`, {
        headers: { Authorization: `Bearer ${CF_TOKEN}` },
        cache: 'no-store',
      });
      if (!res.ok) return [];
      return JSON.parse(await res.text());
    } catch { return []; }
  },

  async set(sessionId: string, messages: any[]): Promise<void> {
    const form = new FormData();
    form.append('value', JSON.stringify(messages));
    form.append('metadata', JSON.stringify({ updatedAt: new Date().toISOString() }));
    await fetch(`${BASE}/values/session:${sessionId}?expiration_ttl=86400`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${CF_TOKEN}` },
      body: form,
      cache: 'no-store',
    });
  },

  async del(sessionId: string): Promise<void> {
    await fetch(`${BASE}/values/session:${sessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${CF_TOKEN}` },
    });
  },
};
