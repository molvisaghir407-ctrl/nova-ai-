import type { Source, SubagentResult, RAGContext, QueryIntent } from '@/types/nova.types';
import { classifyIntent, shouldUseRAG, decomposeQuery } from './intent';
import { rerank } from '@/lib/nova/nim/client';

// Lazy-load all subagents
async function loadSubagents() {
  const modules = await Promise.all([
    import('./subagents/01-web-primary'),
    import('./subagents/02-web-news'),
    import('./subagents/03-wikipedia'),
    import('./subagents/04-stackoverflow'),
    import('./subagents/05-github'),
    import('./subagents/06-academic'),
    import('./subagents/07-hacker-news'),
    import('./subagents/08-weather'),
    import('./subagents/09-web-expanded'),
    import('./subagents/10-reddit'),
  ]);
  return modules.map(m => m.default);
}

// KV cache for RAG results
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID ?? '';
const CF_NS = process.env.CLOUDFLARE_KV_NAMESPACE_ID ?? '';
const CF_TOKEN = process.env.CLOUDFLARE_D1_TOKEN ?? '';
const KV_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${CF_NS}`;
const KV_HEADERS = { Authorization: `Bearer ${CF_TOKEN}` };

async function kvGetRAG(key: string): Promise<Source[] | null> {
  try {
    const r = await fetch(`${KV_BASE}/values/${encodeURIComponent(key)}`, { headers: KV_HEADERS, cache: 'no-store' });
    if (!r.ok) return null;
    return JSON.parse(await r.text()) as Source[];
  } catch { return null; }
}

async function kvSetRAG(key: string, data: Source[], ttl = 1800): Promise<void> {
  try {
    const form = new FormData();
    form.append('value', JSON.stringify(data));
    await fetch(`${KV_BASE}/values/${encodeURIComponent(key)}?expiration_ttl=${ttl}`, {
      method: 'PUT', headers: KV_HEADERS, body: form, cache: 'no-store',
    });
  } catch { /* ignore cache write failures */ }
}

function hashQuery(query: string): string {
  const s = query.toLowerCase().trim().replace(/\s+/g, ' ');
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return `rag:${Math.abs(h).toString(16)}`;
}

export type OnAgentUpdate = (agentId: string, status: 'running' | 'done' | 'error', count: number) => void;

export async function runRAG(
  message: string,
  onUpdate?: OnAgentUpdate,
): Promise<RAGContext> {
  const start = Date.now();
  const intent: QueryIntent = classifyIntent(message);

  if (!shouldUseRAG(intent)) {
    return { sources: [], searchQuery: message, subqueries: [], agentResults: [], fromCache: false, totalDurationMs: 0 };
  }

  const subqueries = decomposeQuery(message, intent);
  const cacheKey = hashQuery(message);

  // Try cache first (skip for news/weather — always fresh)
  if (!['news', 'weather'].includes(intent)) {
    const cached = await kvGetRAG(cacheKey);
    if (cached?.length) {
      return { sources: cached, searchQuery: message, subqueries, agentResults: [], fromCache: true, totalDurationMs: Date.now() - start };
    }
  }

  const agents = await loadSubagents();
  const activeAgents = agents.filter(a => a.shouldActivate(message, intent));

  // Run agents in parallel with per-agent timeout
  const agentPromises = activeAgents.map(async agent => {
    onUpdate?.(agent.id, 'running', 0);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), agent.timeout);
    try {
      const result: SubagentResult = await agent.execute(message, controller.signal);
      onUpdate?.(agent.id, result.success ? 'done' : 'error', result.results.length);
      return result;
    } catch {
      onUpdate?.(agent.id, 'error', 0);
      return { agentId: agent.id, source: agent.name, results: [], durationMs: 0, success: false } as SubagentResult;
    } finally {
      clearTimeout(timer);
    }
  });

  const agentResults = await Promise.all(agentPromises);

  // Collect + deduplicate by URL
  const urlSeen = new Set<string>();
  const allSources: Source[] = [];
  let nextId = 1;
  for (const result of agentResults) {
    for (const s of result.results) {
      if (!urlSeen.has(s.url) && s.url) {
        urlSeen.add(s.url);
        allSources.push({ ...s, id: nextId++ });
      }
    }
  }

  if (!allSources.length) {
    return { sources: [], searchQuery: message, subqueries, agentResults, fromCache: false, totalDurationMs: Date.now() - start };
  }

  // Rerank with NV-Rerank (top 8)
  let ranked = allSources.slice(0, 12);
  try {
    const docs = ranked.map(s => `${s.title}\n${s.snippet}`);
    const rankings = await rerank(message, docs);
    ranked = rankings.slice(0, 8).map((r, i) => ({ ...ranked[r.index]!, id: i + 1 }));
  } catch {
    ranked = allSources.slice(0, 8).map((s, i) => ({ ...s, id: i + 1 }));
  }

  // Cache result
  await kvSetRAG(cacheKey, ranked);

  return { sources: ranked, searchQuery: message, subqueries, agentResults, fromCache: false, totalDurationMs: Date.now() - start };
}

export function buildRAGContext(rag: RAGContext): string {
  if (!rag.sources.length) return '';
  const snippets = rag.sources
    .map(r => `[${r.id}] **${r.title}**\n${r.snippet}${r.date ? `\n*${r.date}*` : ''}`)
    .join('\n\n');
  return `\n\n---\n🔍 **Live Web Results** (${rag.sources.length} sources, ${rag.totalDurationMs}ms):\n\n${snippets}\n\n> Cite sources inline as [1], [2], etc. Prioritize the most recent and relevant.\n---`;
}
