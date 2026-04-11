/**
 * Nova Search — DuckDuckGo HTML scraping (free, no API key required)
 * Fallback to ZAI if DuckDuckGo fails.
 */

export interface SearchResult {
  id: number;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  date: string;
}

// ── DuckDuckGo HTML search ────────────────────────────────────────────────────
async function duckduckgoSearch(query: string, num = 8): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=wt-wt`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NovaBot/1.0)', Accept: 'text/html' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`DDG ${res.status}`);
  const html = await res.text();

  const links: Array<{ href: string; text: string }> = [];
  const snippets: string[] = [];
  let m: RegExpExecArray | null;

  // Extract title + URL  (ES2017-safe: no /s flag)
  const titleRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  while ((m = titleRe.exec(html)) !== null && links.length < num) {
    const href = m[1] ?? '';
    const text = (m[2] ?? '').trim();
    if (href && !href.includes('duckduckgo.com') && text) links.push({ href, text });
  }

  // Extract snippets
  const snippetRe = /<a[^>]*class="result__snippet"[^>]*>([^<]+)<\/a>/g;
  while ((m = snippetRe.exec(html)) !== null) {
    snippets.push((m[1] ?? '').trim());
  }

  return links.slice(0, num).map((link, i) => {
    let domain = '';
    try { domain = new URL(link.href).hostname.replace(/^www\./, ''); } catch { domain = ''; }
    return { id: i + 1, title: link.text, url: link.href, snippet: snippets[i] ?? '', domain, date: '' };
  });
}

// ── ZAI fallback ──────────────────────────────────────────────────────────────
let _zai: { functions?: { invoke: (n: string, p: Record<string, unknown>) => Promise<unknown> } } | null = null;
async function getZAI() {
  if (_zai) return _zai;
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    _zai = (await ZAI.create()) as unknown as typeof _zai;
    return _zai;
  } catch { return null; }
}

async function zaiSearch(query: string, num = 8): Promise<SearchResult[]> {
  const zai = await getZAI();
  if (!zai) return [];
  const raw = await zai.functions?.invoke('web_search', { query, num }) as Array<{
    name?: string; title?: string; url?: string; snippet?: string;
    host_name?: string; domain?: string; date?: string;
  }>;
  return (raw ?? []).map((item, i) => ({
    id: i + 1, title: item.name ?? item.title ?? '',
    url: item.url ?? '', snippet: item.snippet ?? '',
    domain: item.host_name ?? item.domain ?? '', date: item.date ?? '',
  }));
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function webSearch(query: string, num = 8): Promise<SearchResult[]> {
  try {
    const results = await duckduckgoSearch(query, num);
    if (results.length > 0) return results;
  } catch { /* fall through to ZAI */ }
  try { return await zaiSearch(query, num); } catch { return []; }
}

export function detectSearchIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return ['latest','current','today','news','recent','2025','2026','who won',
    'stock price','weather','breaking','right now','this week','just released',
    'score','standings','trending'].some(t => lower.includes(t));
}

export function buildRAGContext(query: string, results: SearchResult[]): string {
  if (!results.length) return '';
  const snippets = results.slice(0, 6).map(r =>
    `[${r.id}] **${r.title}**\nURL: ${r.url}\n${r.snippet}`
  ).join('\n\n');
  return `\n\n---\n🔍 **Web Results for: "${query}"**\n\n${snippets}\n\n> Cite as [1], [2], etc.\n---`;
}
