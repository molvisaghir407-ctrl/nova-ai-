/**
 * Nova AI — Cloudflare KV Session Store
 * Handles both single sessions AND multi-conversation management
 */

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CF_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID!;
const CF_TOKEN = process.env.CLOUDFLARE_D1_TOKEN!;
const BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_NAMESPACE_ID}`;

const headers = () => ({ Authorization: `Bearer ${CF_TOKEN}` });

async function kvGet(key: string): Promise<string | null> {
  const res = await fetch(`${BASE}/values/${encodeURIComponent(key)}`, { headers: headers(), cache: 'no-store' });
  if (!res.ok) return null;
  return res.text();
}

async function kvSet(key: string, value: string, ttl = 604800): Promise<void> {
  const form = new FormData();
  form.append('value', value);
  form.append('metadata', JSON.stringify({ updatedAt: new Date().toISOString() }));
  await fetch(`${BASE}/values/${encodeURIComponent(key)}?expiration_ttl=${ttl}`, {
    method: 'PUT', headers: headers(), body: form, cache: 'no-store',
  });
}

async function kvDel(key: string): Promise<void> {
  await fetch(`${BASE}/values/${encodeURIComponent(key)}`, { method: 'DELETE', headers: headers() });
}

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview: string; // last user message snippet
}

export const sessionStore = {
  // ── Message history ──────────────────────────────────────────────────────────
  async get(sessionId: string): Promise<any[]> {
    try {
      const raw = await kvGet(`session:${sessionId}`);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch { return []; }
  },

  async set(sessionId: string, messages: any[]): Promise<void> {
    // Keep last 100 messages per session for long conversations
    const toStore = messages.length > 100 ? messages.slice(-100) : messages;
    await kvSet(`session:${sessionId}`, JSON.stringify(toStore), 604800); // 7 day TTL
  },

  async del(sessionId: string): Promise<void> {
    await kvDel(`session:${sessionId}`);
  },

  // ── Conversation index (per user) ────────────────────────────────────────────
  async getConversations(userId = 'default'): Promise<ConversationMeta[]> {
    try {
      const raw = await kvGet(`convindex:${userId}`);
      if (!raw) return [];
      const list: ConversationMeta[] = JSON.parse(raw);
      return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch { return []; }
  },

  async upsertConversation(userId = 'default', meta: ConversationMeta): Promise<void> {
    const list = await this.getConversations(userId);
    const idx = list.findIndex(c => c.id === meta.id);
    if (idx >= 0) list[idx] = meta;
    else list.unshift(meta);
    // Keep max 50 conversations
    const trimmed = list.slice(0, 50);
    await kvSet(`convindex:${userId}`, JSON.stringify(trimmed), 604800);
  },

  async deleteConversation(userId = 'default', sessionId: string): Promise<void> {
    const list = await this.getConversations(userId);
    const filtered = list.filter(c => c.id !== sessionId);
    await kvSet(`convindex:${userId}`, JSON.stringify(filtered), 604800);
    await this.del(sessionId);
  },
};
