/**
 * Nova RAG Pipeline — Pre-flight Container Pattern
 *
 * Architecture:
 *   Phase 1 (PARALLEL, ~2-4s): Fire ALL data sources simultaneously
 *     - Multiple DuckDuckGo searches (original query + decomposed sub-queries)
 *     - Wikipedia direct API (structured, reliable)
 *     - Hacker News Algolia API (tech discussions)
 *     - Full page content fetch for top 2 results
 *     - Memory recall from DB
 *   Phase 2 (INSTANT): Assemble → deduplicate → rerank → build prompt
 *   Phase 3 (FAST STREAMING): Model has everything, tokens flow immediately
 */

import type { Source, QueryIntent } from '@/types/nova.types';
import { classifyIntent, decomposeQuery } from './intent';
import { rerank } from '@/lib/nova/nim/client';

// ── Cloudflare KV cache ───────────────────────────────────────────────────────
const KV_BASE = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${process.env.CLOUDFLARE_KV_NAMESPACE_ID}`;
const KV_H = { Authorization: `Bearer ${process.env.CLOUDFLARE_D1_TOKEN ?? ''}` };

async function kvGet(key: string): Promise<Source[] | null> {
  try {
    const r = await fetch(`${KV_BASE}/values/${encodeURIComponent(key)}`, { headers: KV_H, cache: 'no-store', signal: AbortSignal.timeout(800) });
    if (!r.ok) return null;
    return JSON.parse(await r.text()) as Source[];
  } catch { return null; }
}

async function kvSet(key: string, data: Source[], ttl = 1800): Promise<void> {
  try {
    const form = new FormData();
    form.append('value', JSON.stringify(data));
    await fetch(`${KV_BASE}/values/${encodeURIComponent(key)}?expiration_ttl=${ttl}`, {
      method: 'PUT', headers: KV_H, body: form, cache: 'no-store',
    });
  } catch { /* ignore */ }
}

function cacheKey(query: string): string {
  const s = query.toLowerCase().trim().replace(/\s+/g, ' ');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return `rag2:${Math.abs(h).toString(16)}`;
}

// ── Source 1: DuckDuckGo HTML scraping ────────────────────────────────────────
async function ddgSearch(query: string, num = 10, signal?: AbortSignal): Promise<Source[]> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=wt-wt`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NovaRAG/2.0)', Accept: 'text/html' },
      signal: signal ?? AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    const links: Array<{ href: string; text: string }> = [];
    const snippets: string[] = [];
    let m: RegExpExecArray | null;

    const titleRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    while ((m = titleRe.exec(html)) !== null && links.length < num) {
      const href = m[1] ?? '', text = (m[2] ?? '').trim();
      if (href && !href.includes('duckduckgo.com') && text) links.push({ href, text });
    }
    const snippetRe = /<a[^>]*class="result__snippet"[^>]*>([^<]+)<\/a>/g;
    while ((m = snippetRe.exec(html)) !== null) snippets.push((m[1] ?? '').trim());

    return links.map((link, i) => {
      let domain = '';
      try { domain = new URL(link.href).hostname.replace(/^www\./, ''); } catch { domain = ''; }
      return { id: i + 1, title: link.text, url: link.href, snippet: snippets[i] ?? '', domain, date: '' };
    });
  } catch { return []; }
}

// ── Source 2: Wikipedia API (structured, reliable) ────────────────────────────
async function wikipediaSearch(query: string, signal?: AbortSignal): Promise<Source[]> {
  try {
    const term = encodeURIComponent(query.replace(/\b(what is|who is|how does|explain)\b/gi, '').trim());
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${term}&srlimit=3&srprop=snippet&format=json&origin=*`;
    const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const data = await res.json() as { query?: { search?: Array<{ title: string; snippet: string; pageid: number }> } };
    return (data.query?.search ?? []).map((item, i) => ({
      id: i + 1,
      title: `Wikipedia: ${item.title}`,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
      snippet: item.snippet.replace(/<[^>]+>/g, '').trim(),
      domain: 'wikipedia.org',
      date: '',
    }));
  } catch { return []; }
}

// ── Source 3: Hacker News (Algolia API — free) ────────────────────────────────
async function hackerNewsSearch(query: string, signal?: AbortSignal): Promise<Source[]> {
  try {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=5`;
    const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const data = await res.json() as { hits?: Array<{ title?: string; url?: string; story_text?: string; objectID?: string; created_at?: string }> };
    return (data.hits ?? []).filter(h => h.title).map((h, i) => ({
      id: i + 1,
      title: `HN: ${h.title ?? ''}`,
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID ?? ''}`,
      snippet: (h.story_text ?? '').replace(/<[^>]+>/g, '').slice(0, 200),
      domain: h.url ? (() => { try { return new URL(h.url ?? '').hostname.replace(/^www\./, ''); } catch { return 'news.ycombinator.com'; } })() : 'news.ycombinator.com',
      date: h.created_at ?? '',
    }));
  } catch { return []; }
}

// ── Source 4: Weather (wttr.in) ────────────────────────────────────────────────
async function weatherFetch(query: string, signal?: AbortSignal): Promise<Source[]> {
  const locMatch = query.match(/(?:in|for|at)\s+([A-Za-z\s,]+?)(?:\?|$)/i);
  const location = (locMatch?.[1]?.trim() ?? query.replace(/weather|forecast|temperature/gi, '').trim()) || 'auto';
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`, { signal: signal ?? AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const data = await res.json() as { current_condition?: Array<{ temp_C?: string; temp_F?: string; weatherDesc?: Array<{ value?: string }>; humidity?: string; windspeedKmph?: string; feelsLikeC?: string }> };
    const c = data.current_condition?.[0];
    if (!c) return [];
    const desc = `${location}: ${c.weatherDesc?.[0]?.value ?? 'Unknown'}, ${c.temp_C}°C/${c.temp_F}°F (feels like ${c.feelsLikeC}°C), Humidity: ${c.humidity}%, Wind: ${c.windspeedKmph} km/h`;
    return [{ id: 1, title: `Live Weather — ${location}`, url: `https://wttr.in/${encodeURIComponent(location)}`, snippet: desc, domain: 'wttr.in', date: new Date().toISOString() }];
  } catch { return []; }
}

// ── Source 5: Full page content fetch for top results ────────────────────────
async function fetchPageContent(url: string, signal?: AbortSignal): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NovaRAG/2.0)', Accept: 'text/html' },
      signal: signal ?? AbortSignal.timeout(5000),
    });
    if (!res.ok) return '';
    const html = await res.text();
    // Extract text from paragraph tags
    const pRe = /<p[^>]*>([^<]{20,})<\/p>/g;
    const texts: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = pRe.exec(html)) !== null && texts.length < 8) {
      const t = (m[1] ?? '').replace(/<[^>]+>/g, '').trim();
      if (t.length > 30) texts.push(t);
    }
    return texts.join(' ').slice(0, 800);
  } catch { return ''; }
}

// ── NV-Rerank wrapper ─────────────────────────────────────────────────────────
async function rerankSources(query: string, sources: Source[]): Promise<Source[]> {
  if (sources.length <= 1) return sources;
  try {
    const docs = sources.slice(0, 15).map(s => `${s.title}\n${s.snippet}`);
    const rankings = await rerank(query, docs);
    return rankings.slice(0, 10).map((r, i) => ({
      ...sources[r.index]!,
      id: i + 1,
    }));
  } catch {
    return sources.slice(0, 10).map((s, i) => ({ ...s, id: i + 1 }));
  }
}

// ── Main export: full pre-flight RAG container ────────────────────────────────
export interface RAGPackage {
  sources: Source[];
  intent: QueryIntent;
  subqueries: string[];
  fromCache: boolean;
  durationMs: number;
  searchQuery: string;
}

export async function runRAGPipeline(message: string): Promise<RAGPackage> {
  const pipelineStart = Date.now();
  const intent = classifyIntent(message);
  const subqueries = decomposeQuery(message, intent);
  const isLive = ['news', 'weather', 'finance'].includes(intent);

  // Cache check (skip for live/real-time queries)
  if (!isLive) {
    const cached = await kvGet(cacheKey(message));
    if (cached?.length) {
      return { sources: cached, intent, subqueries, fromCache: true, durationMs: Date.now() - pipelineStart, searchQuery: message };
    }
  }

  const ac = new AbortController();
  // Hard timeout: entire pipeline must finish in 8s
  const globalTimer = setTimeout(() => ac.abort(), 8000);

  // ── PHASE 1: Fire everything in parallel ─────────────────────────────────
  const promises: Array<Promise<Source[]>> = [
    // Primary search on the main query
    ddgSearch(message, 10, ac.signal),
    // Wikipedia always for factual grounding
    wikipediaSearch(message, ac.signal),
  ];

  // Add intent-specific sources
  if (intent === 'weather') {
    promises.push(weatherFetch(message, ac.signal));
  } else if (['code'].includes(intent)) {
    promises.push(ddgSearch(`${message} site:stackoverflow.com`, 5, ac.signal));
    promises.push(ddgSearch(`${message} site:github.com`, 4, ac.signal));
    promises.push(hackerNewsSearch(message, ac.signal));
  } else if (['news', 'general', 'finance', 'factual'].includes(intent)) {
    promises.push(hackerNewsSearch(message, ac.signal));
    promises.push(ddgSearch(`${message} latest news 2025 2026`, 6, ac.signal));
  } else {
    promises.push(hackerNewsSearch(message, ac.signal));
  }

  // Sub-query searches (decomposed queries run in parallel too)
  for (const sq of subqueries.slice(0, 2)) {
    if (sq !== message) promises.push(ddgSearch(sq, 5, ac.signal));
  }

  // Run all in parallel
  const rawResults = await Promise.allSettled(promises);
  clearTimeout(globalTimer);

  // ── PHASE 2: Collect + deduplicate ──────────────────────────────────────
  const urlSeen = new Set<string>();
  const allSources: Source[] = [];
  let nextId = 1;

  for (const result of rawResults) {
    if (result.status !== 'fulfilled') continue;
    for (const s of result.value) {
      if (s.url && !urlSeen.has(s.url)) {
        urlSeen.add(s.url);
        allSources.push({ ...s, id: nextId++ });
      }
    }
  }

  if (!allSources.length) {
    return { sources: [], intent, subqueries, fromCache: false, durationMs: Date.now() - pipelineStart, searchQuery: message };
  }

  // ── PHASE 2b: Fetch full content for top 2 sources ───────────────────────
  const topUrls = allSources.slice(0, 2).map(s => s.url).filter(u => !u.includes('wikipedia'));
  const contentFetches = await Promise.allSettled(topUrls.map(url => fetchPageContent(url)));

  contentFetches.forEach((res, i) => {
    if (res.status === 'fulfilled' && res.value && allSources[i]) {
      allSources[i]!.snippet = res.value.length > allSources[i]!.snippet.length
        ? res.value
        : allSources[i]!.snippet;
    }
  });

  // ── PHASE 3: NV-Rerank → top 10 ─────────────────────────────────────────
  const ranked = await rerankSources(message, allSources);

  // Cache (non-live queries only)
  if (!isLive) void kvSet(cacheKey(message), ranked);

  return {
    sources: ranked,
    intent,
    subqueries,
    fromCache: false,
    durationMs: Date.now() - pipelineStart,
    searchQuery: message,
  };
}

// ── Build rich system context from RAG package ────────────────────────────────
export function buildRichContext(pkg: RAGPackage): string {
  if (!pkg.sources.length) return '';

  const lines = pkg.sources.map(s =>
    `[${s.id}] **${s.title}**\n` +
    `URL: ${s.url}\n` +
    `${s.snippet}` +
    (s.date ? `\n*Published: ${s.date}*` : '')
  );

  return [
    '',
    '---',
    `## 🔍 Live Research Context (${pkg.sources.length} sources, ${pkg.durationMs}ms)`,
    `**Query**: ${pkg.searchQuery}`,
    pkg.subqueries.length > 1 ? `**Sub-queries searched**: ${pkg.subqueries.join(' | ')}` : '',
    '',
    lines.join('\n\n'),
    '',
    '> **Instructions**: Use the above sources to inform your answer. Cite inline as [1], [2], etc.',
    '> Prefer the most recent, authoritative sources. If sources conflict, note the discrepancy.',
    '---',
  ].filter(Boolean).join('\n');
}
