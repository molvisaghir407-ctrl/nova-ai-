/**
 * Nova Adaptive Multi-Layer RAG Pipeline v3.0
 *
 * Architecture:
 *   Layer 0 — Intent & complexity analysis
 *   Layer 1 — Parallel multi-source retrieval (primary + specialized)
 *   Layer 2 — Full-page content extraction for top results
 *   Layer 3 — NV-Rerank cross-encoder reranking
 *   Layer 4 — Source deduplication + diversity enforcement
 *   Layer 5 — Context compression & rich prompt injection
 *
 * All layers run with hard per-operation timeouts.
 * Results cached in Cloudflare KV (30-min TTL, skipped for live intents).
 */

import type { Source, QueryIntent } from '@/types/nova.types';
import {
  classifyIntent,
  decomposeQuery,
  expandQuery,
  assessComplexity,
  SPECIALIZED_SOURCES,
} from './intent';
import { rerank } from '@/lib/nova/nim/client';
import { rewriteQuery, allQueries } from './query-rewriter';
import { buildKGContext } from './kg';
import { searchChunks } from './qdrant';

// ── Cloudflare KV cache ───────────────────────────────────────────────────────
const KV_BASE = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${process.env.CLOUDFLARE_KV_NAMESPACE_ID}`;
const KV_H = { Authorization: `Bearer ${process.env.CLOUDFLARE_D1_TOKEN ?? ''}` };

async function kvGet(key: string): Promise<Source[] | null> {
  try {
    const r = await fetch(`${KV_BASE}/values/${encodeURIComponent(key)}`, {
      headers: KV_H,
      cache: 'no-store',
      signal: AbortSignal.timeout(800),
    });
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
  return `ragv3:${Math.abs(h).toString(16)}`;
}

// ── Layer 1a: DuckDuckGo HTML search ─────────────────────────────────────────
async function ddgSearch(query: string, num = 10, signal?: AbortSignal): Promise<Source[]> {
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=wt-wt`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NovaRAG/3.0)',
          Accept: 'text/html',
        },
        signal: signal ?? AbortSignal.timeout(5000),
      },
    );
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
    while ((m = snippetRe.exec(html)) !== null) {
      snippets.push((m[1] ?? '').trim().replace(/&#x27;/g, "'").replace(/&amp;/g, '&'));
    }

    return links.map((link, i) => {
      let domain = '';
      try { domain = new URL(link.href).hostname.replace(/^www\./, ''); } catch { domain = ''; }
      return {
        id: i + 1,
        title: link.text.replace(/&amp;/g, '&').replace(/&#x27;/g, "'"),
        url: link.href,
        snippet: snippets[i] ?? '',
        domain,
        date: '',
      };
    });
  } catch { return []; }
}

// ── Layer 1b: Wikipedia structured API ───────────────────────────────────────
async function wikipediaSearch(query: string, signal?: AbortSignal): Promise<Source[]> {
  try {
    const term = encodeURIComponent(
      query.replace(/\b(what is|who is|how does|explain|define)\b/gi, '').trim(),
    );
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${term}&srlimit=4&srprop=snippet|titlesnippet&format=json&origin=*`;
    const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const data = await res.json() as {
      query?: { search?: Array<{ title: string; snippet: string; pageid: number }> }
    };
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

// ── Layer 1c: Hacker News (Algolia API) ──────────────────────────────────────
async function hackerNewsSearch(query: string, signal?: AbortSignal): Promise<Source[]> {
  try {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=8&numericFilters=points>5`;
    const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const data = await res.json() as {
      hits?: Array<{
        title?: string; url?: string; story_text?: string;
        objectID?: string; created_at?: string; points?: number;
      }>
    };
    return (data.hits ?? [])
      .filter(h => h.title)
      .map((h, i) => ({
        id: i + 1,
        title: `HN: ${h.title ?? ''}`,
        url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID ?? ''}`,
        snippet: (h.story_text ?? '').replace(/<[^>]+>/g, '').slice(0, 300),
        domain: h.url
          ? (() => { try { return new URL(h.url ?? '').hostname.replace(/^www\./, ''); } catch { return 'news.ycombinator.com'; } })()
          : 'news.ycombinator.com',
        date: h.created_at ?? '',
      }));
  } catch { return []; }
}

// ── Layer 1e: Reddit search (public JSON API) ─────────────────────────────────
async function redditSearch(query: string, signal?: AbortSignal): Promise<Source[]> {
  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=8&t=year&type=link`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NovaRAG/3.0 (research assistant)' },
      signal: signal ?? AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json() as {
      data?: { children?: Array<{ data?: { title?: string; url?: string; selftext?: string; subreddit?: string; created_utc?: number; score?: number } }> }
    };
    return (data.data?.children ?? [])
      .filter(c => c.data?.title && (c.data.score ?? 0) > 3)
      .slice(0, 6)
      .map((c, i) => {
        const d = c.data!;
        const sub = d.subreddit ?? 'reddit';
        return {
          id: i + 1,
          title: `r/${sub}: ${d.title ?? ''}`,
          url: d.url ?? `https://reddit.com`,
          snippet: (d.selftext ?? '').replace(/\n+/g, ' ').slice(0, 280) || `Reddit discussion in r/${sub}`,
          domain: `reddit.com/r/${sub}`,
          date: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : '',
        };
      });
  } catch { return []; }
}

// ── Layer 1d: Weather (wttr.in) ───────────────────────────────────────────────
async function weatherFetch(query: string, signal?: AbortSignal): Promise<Source[]> {
  const locMatch = query.match(/(?:in|for|at)\s+([A-Za-z\s,]+?)(?:\?|$)/i);
  const location = (locMatch?.[1]?.trim() ?? query.replace(/weather|forecast|temperature/gi, '').trim()) || 'auto';
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`, {
      signal: signal ?? AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const data = await res.json() as {
      current_condition?: Array<{
        temp_C?: string; temp_F?: string;
        weatherDesc?: Array<{ value?: string }>;
        humidity?: string; windspeedKmph?: string; feelsLikeC?: string;
        uvIndex?: string; visibility?: string;
      }>
    };
    const c = data.current_condition?.[0];
    if (!c) return [];
    const desc = [
      `${location}: ${c.weatherDesc?.[0]?.value ?? 'Unknown'}`,
      `Temperature: ${c.temp_C}°C / ${c.temp_F}°F (feels like ${c.feelsLikeC}°C)`,
      `Humidity: ${c.humidity}%`,
      `Wind: ${c.windspeedKmph} km/h`,
      c.uvIndex ? `UV Index: ${c.uvIndex}` : '',
      c.visibility ? `Visibility: ${c.visibility} km` : '',
    ].filter(Boolean).join(' · ');

    return [{
      id: 1,
      title: `Live Weather — ${location}`,
      url: `https://wttr.in/${encodeURIComponent(location)}`,
      snippet: desc,
      domain: 'wttr.in',
      date: new Date().toISOString(),
    }];
  } catch { return []; }
}

// ── Layer 2: Full page content extraction ─────────────────────────────────────
async function fetchPageContent(url: string, signal?: AbortSignal): Promise<string> {
  try {
    // Skip binary files, video sites, social media (low quality for RAG)
    if (/\.(pdf|jpg|jpeg|png|gif|mp4|mp3|zip|exe)$/i.test(url)) return '';
    if (/youtube\.com|twitter\.com|x\.com|instagram\.com|tiktok\.com/i.test(url)) return '';

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NovaRAG/3.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: signal ?? AbortSignal.timeout(6000),
    });
    if (!res.ok) return '';

    const html = await res.text();

    // Remove script/style blocks first
    const clean = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // Extract <article> or <main> first for quality
    const articleMatch = /<(?:article|main)[^>]*>([\s\S]+?)<\/(?:article|main)>/i.exec(clean);
    const body = articleMatch?.[1] ?? clean;

    // Extract meaningful paragraphs
    const pRe = /<(?:p|li|td|blockquote)[^>]*>([^<]{30,})<\/(?:p|li|td|blockquote)>/gi;
    const texts: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = pRe.exec(body)) !== null && texts.length < 12) {
      const t = (m[1] ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (t.length > 40 && !t.includes('cookie') && !t.includes('subscribe')) {
        texts.push(t);
      }
    }

    return texts.join(' ').slice(0, 1200);
  } catch { return ''; }
}

// ── Layer 3: NV-Rerank cross-encoder ─────────────────────────────────────────
async function rerankSources(query: string, sources: Source[]): Promise<Source[]> {
  if (sources.length <= 1) return sources;
  try {
    const docs = sources.slice(0, 20).map(s => `${s.title}\n${s.snippet}`);
    const rankings = await rerank(query, docs);
    return rankings.slice(0, 12).map((r, i) => ({
      ...sources[r.index]!,
      id: i + 1,
    }));
  } catch {
    return sources.slice(0, 12).map((s, i) => ({ ...s, id: i + 1 }));
  }
}

// ── Layer 4: Domain diversity enforcement ─────────────────────────────────────
function enforceDiversity(sources: Source[], maxPerDomain = 3): Source[] {
  const domainCount: Record<string, number> = {};
  const result: Source[] = [];
  let nextId = 1;

  for (const s of sources) {
    const domain = s.domain || 'unknown';
    domainCount[domain] = (domainCount[domain] ?? 0) + 1;
    if (domainCount[domain] <= maxPerDomain) {
      result.push({ ...s, id: nextId++ });
    }
  }

  return result;
}


// ── Conversational context resolver ──────────────────────────────────────────
// When the user says "what about it?", "who are they?", "explain more" —
// resolve the reference using recent conversation history so the search
// query is semantically complete.
export function resolveConversationalQuery(
  message: string,
  recentHistory: Array<{ role: string; content: string }>,
): string {
  const lower = message.trim().toLowerCase();
  const isVague = lower.length < 40 ||
    /^(what about|tell me more|explain (more|that|it|this)|who (is|are) (they|it|he|she)|how (does|do) (it|that|this) work|why (is|are|does) (that|it|this)|and (what|how|why)|more (about|on|details)|go (on|ahead)|continue|elaborate|can you expand)/i.test(lower) ||
    /(it|they|that|this|those|these|him|her|them)/.test(lower) && lower.split(' ').length < 8;

  if (!isVague || recentHistory.length === 0) return message;

  // Extract key subject from recent assistant response
  const lastAssistant = [...recentHistory].reverse().find(m => m.role === 'assistant');
  const lastUser      = [...recentHistory].reverse().find(m => m.role === 'user' && m.content !== message);

  if (!lastAssistant && !lastUser) return message;

  // Pull the first meaningful noun phrase from the prior context
  const priorContext = (lastUser?.content ?? '') + ' ' + (lastAssistant?.content?.slice(0, 200) ?? '');
  const nouns = priorContext.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g) ?? [];
  const subject = nouns.slice(0, 3).join(' ');

  if (!subject) return message;

  // Expand vague query: "what about it?" → "what about [subject]?"
  const expanded = message.replace(/(it|they|that|this|those|these|him|her|them)/gi, subject);
  return expanded !== message ? expanded : `${subject} — ${message}`;
}

// ── DuckDuckGo Instant Answer API (for quick factual lookups) ─────────────────
async function ddgInstantAnswer(query: string, signal?: AbortSignal): Promise<Source[]> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const data = await res.json() as {
      AbstractText?: string; AbstractSource?: string; AbstractURL?: string;
      Answer?: string; AnswerType?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    };

    const sources: Source[] = [];
    // Main abstract (Wikipedia-sourced usually)
    if (data.AbstractText && data.AbstractURL) {
      sources.push({
        id: 1,
        title: `${data.AbstractSource ?? 'Quick Answer'}: ${query}`,
        url: data.AbstractURL,
        snippet: data.AbstractText.slice(0, 600),
        domain: data.AbstractSource?.toLowerCase() ?? 'duckduckgo.com',
        date: '',
      });
    }
    // Instant answer (e.g. calculations, definitions)
    if (data.Answer) {
      sources.push({
        id: 2,
        title: `Instant Answer: ${query}`,
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: data.Answer,
        domain: 'duckduckgo.com',
        date: '',
      });
    }
    return sources;
  } catch { return []; }
}

// ── Stack Exchange API (for technical questions) ───────────────────────────────
async function stackExchangeSearch(query: string, signal?: AbortSignal): Promise<Source[]> {
  try {
    const url = `https://api.stackexchange.com/2.3/search/advanced?q=${encodeURIComponent(query)}&order=desc&sort=votes&site=stackoverflow&filter=withbody&pagesize=4`;
    const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const data = await res.json() as {
      items?: Array<{
        title?: string; link?: string; body?: string;
        score?: number; answer_count?: number; is_answered?: boolean;
      }>
    };
    return (data.items ?? [])
      .filter(i => (i.is_answered ?? false) || (i.score ?? 0) > 5)
      .slice(0, 3)
      .map((item, i) => ({
        id: i + 1,
        title: `StackOverflow: ${item.title ?? ''}`,
        url: item.link ?? '',
        snippet: (item.body ?? '').replace(/<[^>]+>/g, '').slice(0, 500),
        domain: 'stackoverflow.com',
        date: '',
      }));
  } catch { return []; }
}

// ── Layer 5: Rich context builder ─────────────────────────────────────────────
/**
 * Thin search-only wrapper — used by multihop.ts for each hop.
 * Returns sources without the full pipeline overhead (no caching, no KG).
 */
export async function runPipelineSearch(
  primaryQuery: string,
  additionalQueries: string[] = [],
  signal?: AbortSignal,
): Promise<Source[]> {
  const intent = classifyIntent(primaryQuery);
  const expanded = expandQuery(primaryQuery, intent);
  const allQ = [...new Set([primaryQuery, ...additionalQueries, ...expanded])].slice(0, 4);

  const results = await Promise.all(
    allQ.map(q => ddgSearch(q, 10, signal))
  );
  const flat = results.flat();
  const diverse = enforceDiversity(flat, 3);
  return diverse.slice(0, 12);
}

export interface RAGPackage {
  sources       : Source[];
  intent        : QueryIntent;
  subqueries    : string[];
  fromCache     : boolean;
  durationMs    : number;
  searchQuery   : string;
  kgContext     : string;   // knowledge graph entity context
  vectorSnippets: string[]; // top chunks from Qdrant vector store
  rewrittenQuery: string;   // LLM-rewritten query
  hops          : number;   // multi-hop count
}

export async function runRAGPipeline(
  message: string,
  recentHistory: Array<{ role: string; content: string }> = [],
): Promise<RAGPackage> {
  const pipelineStart = Date.now();
  const intent = classifyIntent(message);
  const complexity = assessComplexity(message, intent);
  const subqueries = decomposeQuery(message, intent);
  const isLive = ['news', 'weather', 'finance', 'sports'].includes(intent);

  // ── LLM Query Rewriting (fast model, parallel with cache check) ──────────
  // Use conversation history to resolve vague references ("it", "that", "they")
  const resolvedMessage = resolveConversationalQuery(message, recentHistory);
  const conversationCtx = recentHistory.slice(-4)
    .map(m => `${m.role}: ${String(m.content).slice(0, 200)}`)
    .join('\n');
  const rewritePromise = rewriteQuery(resolvedMessage, conversationCtx);

  // Cache check (skip for live/real-time)
  if (!isLive) {
    const cached = await kvGet(cacheKey(message));
    if (cached?.length) {
      return {
        sources       : cached,
        intent,
        subqueries,
        fromCache     : true,
        durationMs    : Date.now() - pipelineStart,
        searchQuery   : message,
        kgContext     : '',
        vectorSnippets: [],
        rewrittenQuery: message,
        hops          : 1,
      };
    }
  }

  // Await rewrite result
  const rewrite = await rewritePromise;
  const searchMessage = rewrite.rewrittenQuery || message;
  const expanded = allQueries(rewrite);

  // Bug 6 fix: skip web search for purely conversational messages (greetings, thanks)
  if (rewrite.isConversational) {
    return {
      sources       : [],
      intent,
      subqueries,
      fromCache     : false,
      durationMs    : Date.now() - pipelineStart,
      searchQuery   : message,
      kgContext     : '',
      vectorSnippets: [],
      rewrittenQuery: message,
      hops          : 1,
    };
  }

  const ac = new AbortController();
  // Hard timeout scales with complexity — research gets more time for multi-hop
  const timeoutMs = complexity === 'research' ? 18000 : complexity === 'complex' ? 12000 : 8000;
  const globalTimer = setTimeout(() => ac.abort(), timeoutMs);

  // ── LAYER 0b: Vector chunk search (Qdrant) — runs in parallel ─────────────
  const vectorSearchPromise = searchChunks(searchMessage, 6).catch(() => []);

  // ── Bug 5 fix: Multi-hop reasoning for research/complex queries ───────────
  // For deep queries: run multi-hop (2-3 hops) instead of single-pass search
  if (complexity === 'research' || complexity === 'complex') {
    const hopCount: 2 | 3 = complexity === 'research' ? 3 : 2;
    try {
      const { multiHopSearch } = await import('./multihop');
      const hopResult = await multiHopSearch(rewrite, hopCount, ac.signal);
      clearTimeout(globalTimer);

      if (hopResult.sources.length >= 3) {
        // Multi-hop succeeded — rank and return its sources
        const ranked = await rerankSources(message, hopResult.sources);
        const diverse = enforceDiversity(ranked, 4);
        const maxSources = hopCount === 3 ? 20 : 15;
        const finalSources = diverse.slice(0, maxSources);

        if (!isLive) void kvSet(cacheKey(message), finalSources);

        const [kgContext, vectorHits] = await Promise.all([
          buildKGContext(searchMessage).catch(() => ''),
          vectorSearchPromise,
        ]);
        const vectorSnippets = vectorHits.map(h =>
          `[Vector] ${h.payload.domain}: ${h.payload.text.slice(0, 300)}`
        );

        return {
          sources       : finalSources,
          intent,
          subqueries,
          fromCache     : false,
          durationMs    : Date.now() - pipelineStart,
          searchQuery   : searchMessage,
          kgContext,
          vectorSnippets,
          rewrittenQuery: searchMessage,
          hops          : hopResult.totalHops,
        };
      }
      // If multi-hop found < 3 sources, fall through to standard pipeline
    } catch {
      // Multi-hop failed — fall through to standard single-pass pipeline
      clearTimeout(globalTimer);
    }
  }

  // ── LAYER 1: Standard parallel multi-source retrieval ─────────────────────
  const promises: Array<Promise<Source[]>> = [
    // Primary search with REWRITTEN query
    ddgSearch(searchMessage, 15, ac.signal),
    // Also search with original for coverage
    expanded.length > 1 ? ddgSearch(expanded[1] ?? message, 8, ac.signal) : Promise.resolve([]),
    // Wikipedia — always for factual grounding
    wikipediaSearch(searchMessage, ac.signal),
    // DDG instant answer (fast factual lookup — definitions, calculations, etc.)
    ddgInstantAnswer(searchMessage, ac.signal),
    // Stack Exchange for technical questions
    intent === 'code' || intent === 'howto'
      ? stackExchangeSearch(searchMessage, ac.signal)
      : Promise.resolve([]),
  ];

  // Intent-specific sources — always add Reddit for community perspective
  promises.push(redditSearch(message, ac.signal));

  if (intent === 'weather') {
    promises.push(weatherFetch(message, ac.signal));
  } else if (intent === 'code' || intent === 'howto') {
    // Domain-specialized searches for technical queries
    promises.push(ddgSearch(`${message} site:stackoverflow.com`, 8, ac.signal));
    promises.push(ddgSearch(`${message} site:github.com`, 6, ac.signal));
    promises.push(hackerNewsSearch(message, ac.signal));
    promises.push(ddgSearch(`${message} tutorial documentation`, 5, ac.signal));
  } else if (['news', 'finance', 'sports'].includes(intent)) {
    promises.push(hackerNewsSearch(searchMessage, ac.signal));
    promises.push(ddgSearch(`${searchMessage} news 2026`, 8, ac.signal));
    promises.push(ddgSearch(`${message} latest update`, 6, ac.signal));
  } else if (intent === 'science' || intent === 'medical') {
    const specSources = SPECIALIZED_SOURCES[intent] ?? [];
    if (specSources.length > 0) {
      promises.push(ddgSearch(`${searchMessage} ${specSources[0] ?? ''}`, 6, ac.signal));
    }
    promises.push(ddgSearch(`${message} research study 2025 2026`, 6, ac.signal));
    promises.push(hackerNewsSearch(message, ac.signal));
    promises.push(ddgSearch(`${message} site:pubmed.ncbi.nlm.nih.gov`, 4, ac.signal));
  } else if (intent === 'comparison') {
    // Search both sides of the comparison
    promises.push(hackerNewsSearch(message, ac.signal));
    promises.push(ddgSearch(`${message} comparison review pros cons`, 8, ac.signal));
  } else if (intent === 'history') {
    promises.push(ddgSearch(`${message} site:britannica.com`, 4, ac.signal));
    promises.push(ddgSearch(`${message} historical context`, 5, ac.signal));
  } else {
    promises.push(hackerNewsSearch(message, ac.signal));
    promises.push(ddgSearch(`${message} explained in depth`, 5, ac.signal));
  }

  // Expanded query variants
  for (const variant of expanded.slice(1)) {
    if (variant !== message) {
      promises.push(ddgSearch(variant, 5, ac.signal));
    }
  }

  // Sub-query searches for complex / research queries
  if (complexity === 'complex' || complexity === 'research') {
    for (const sq of subqueries.slice(1, 3)) {
      if (sq !== message) promises.push(ddgSearch(sq, 5, ac.signal));
    }
  }

  const rawResults = await Promise.allSettled(promises);
  clearTimeout(globalTimer);

  // ── Collect + deduplicate ─────────────────────────────────────────────────
  const urlSeen = new Set<string>();
  const allSources: Source[] = [];
  let nextId = 1;

  for (const result of rawResults) {
    if (result.status !== 'fulfilled') continue;
    for (const s of result.value) {
      if (s.url && !urlSeen.has(s.url) && s.snippet) {
        urlSeen.add(s.url);
        allSources.push({ ...s, id: nextId++ });
      }
    }
  }

  if (!allSources.length) {
    return {
      sources       : [],
      intent,
      subqueries,
      fromCache     : false,
      durationMs    : Date.now() - pipelineStart,
      searchQuery   : searchMessage ?? message,
      kgContext     : '',
      vectorSnippets: [],
      rewrittenQuery: searchMessage ?? message,
      hops          : 1,
    };
  }

  // ── LAYER 2: Page content fetch for top non-wiki results ──────────────────
  const fetchCount = complexity === 'research' ? 6 : complexity === 'complex' ? 4 : 3;
  const topUrls = allSources
    .filter(s => !s.url.includes('wikipedia.org'))
    .slice(0, fetchCount)
    .map(s => s.url);

  const contentFetches = await Promise.allSettled(
    topUrls.map(url => fetchPageContent(url, AbortSignal.timeout(6000))),
  );

  contentFetches.forEach((res, i) => {
    if (res.status === 'fulfilled' && res.value && allSources[i]) {
      // Only upgrade snippet if page content is substantially better
      if (res.value.length > (allSources[i]!.snippet.length + 100)) {
        allSources[i]!.snippet = res.value;
      }
    }
  });

  // ── LAYER 3: Rerank ───────────────────────────────────────────────────────
  const ranked = await rerankSources(message, allSources);

  // ── LAYER 4: Domain diversity ─────────────────────────────────────────────
  const diverse = enforceDiversity(ranked, 4);

  // Final slice — research gets more sources
  const maxSources = complexity === 'research' ? 20 : complexity === 'complex' ? 15 : 10;
  const finalSources = diverse.slice(0, maxSources);

  // Cache (skip live intents)
  if (!isLive) void kvSet(cacheKey(message), finalSources);

  // ── LAYER 5: Knowledge graph context (parallel with reranking) ────────────
  const [kgContext, vectorHits] = await Promise.all([
    buildKGContext(searchMessage).catch(() => ''),
    vectorSearchPromise,
  ]);

  const vectorSnippets = vectorHits.map(h =>
    `[Vector] ${h.payload.domain}: ${h.payload.text.slice(0, 300)}`
  );

  return {
    sources       : finalSources,
    intent,
    subqueries,
    fromCache     : false,
    durationMs    : Date.now() - pipelineStart,
    searchQuery   : searchMessage,
    kgContext,
    vectorSnippets,
    rewrittenQuery: searchMessage,
    hops          : 1,
  };
}

// ── Context builder — injected into system prompt ─────────────────────────────
export function buildRichContext(pkg: RAGPackage): string {
  if (!pkg.sources.length) return '';

  const intentLabel: Partial<Record<QueryIntent, string>> = {
    code:     '💻 Code & Technical',
    weather:  '🌤️ Live Weather',
    finance:  '📈 Market Data',
    news:     '📰 Latest News',
    sports:   '⚽ Sports',
    science:  '🔬 Scientific',
    medical:  '🏥 Medical',
    history:  '📚 Historical',
    factual:  '✅ Factual',
    howto:    '🔧 How-To',
    general:  '🌐 General',
  };

  const label = intentLabel[pkg.intent] ?? '🔍 Research';
  const cacheNote = pkg.fromCache ? ' (cached)' : '';

  const snippets = pkg.sources.map(s => {
    const lines = [
      `[${s.id}] **${s.title}**`,
      `   Source: ${s.domain || s.url}`,
      `   ${s.snippet.slice(0, 600)}`,
    ];
    if (s.date) lines.push(`   *Published: ${new Date(s.date).toLocaleDateString()}*`);
    return lines.join('\n');
  });

  const parts = [
    '',
    '---',
    `## ${label} Research Context — ${pkg.sources.length} sources · ${pkg.durationMs}ms${cacheNote}`,
    `**Query**: "${pkg.searchQuery}"`,
    pkg.rewrittenQuery && pkg.rewrittenQuery !== pkg.searchQuery
      ? `**Optimized**: "${pkg.rewrittenQuery}"`
      : '',
    pkg.hops > 1 ? `**Multi-hop**: ${pkg.hops} search hops` : '',
  ].filter(Boolean);

  if (pkg.subqueries.length > 1) {
    parts.push(`**Also searched**: ${pkg.subqueries.slice(1).join(' · ')}`);
  }

  parts.push('', snippets.join('\n\n'), '');
  parts.push('> **Cite sources inline as [1], [2], etc.** Prefer most recent & authoritative sources.');
  parts.push('> If sources contradict each other, acknowledge the discrepancy.');
  parts.push('---');

  // ── Inject Knowledge Graph entity context ─────────────────────────────────
  if (pkg.kgContext) {
    parts.push('', pkg.kgContext, '');
  }

  // ── Inject top vector-store chunks (long-term knowledge base) ─────────────
  if (pkg.vectorSnippets.length) {
    parts.push('### Long-term Knowledge Base (Vector Store)');
    for (const s of pkg.vectorSnippets) parts.push(s);
    parts.push('');
  }

  return parts.filter(p => p !== undefined).join('\n');
}
