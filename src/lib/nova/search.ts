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
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NovaBot/1.0)',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) throw new Error(`DDG ${res.status}`);
  const html = await res.text();

  const results: SearchResult[] = [];
  // Extract results from DDG HTML
  const resultPattern = /<div class="result[^"]*"[^>]*>[\s\S]*?<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__url"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  // Simpler approach: extract result__a links and result__snippet
  const titleUrlPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gs;
  const snippetPattern = /<a[^>]+class="result__snippet"[^>]*>(.*?)<\/a>/gs;

  const links: Array<{ href: string; text: string }> = [];
  const snippets: string[] = [];

  let m: RegExpExecArray | null;

  const titleRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  while ((m = titleRe.exec(html)) !== null && links.length < num) {
    const href = m[1] ?? '';
    const text = (m[2] ?? '').replace(/<[^>]+>/g, '').trim();
    if (href && !href.includes('duckduckgo.com') && text) {
      links.push({ href, text });
    }
  }

  const snippetRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  while ((m = snippetRe.exec(html)) !== null) {
    snippets.push((m[1] ?? '').replace(/<[^>]+>/g, '').trim());
  }

  for (let i = 0; i < Math.min(links.length, num); i++) {
    const link = links[i];
    if (!link) continue;
    let domain = '';
    try { domain = new URL(link.href).hostname.replace(/^www\./, ''); } catch { domain = link.href; }
    results.push({
      id: i + 1,
      title: link.text,
      url: link.href,
      snippet: snippets[i] ?? '',
      domain,
      date: '',
    });
  }

  return results;
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
    id: i + 1,
    title: item.name ?? item.title ?? '',
    url: item.url ?? '',
    snippet: item.snippet ?? '',
    domain: item.host_name ?? item.domain ?? '',
    date: item.date ?? '',
  }));
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function webSearch(query: string, num = 8): Promise<SearchResult[]> {
  // Try DuckDuckGo first, fall back to ZAI
  try {
    const results = await duckduckgoSearch(query, num);
    if (results.length > 0) return results;
  } catch { /* fall through */ }

  try {
    return await zaiSearch(query, num);
  } catch { return []; }
}

export function detectSearchIntent(message: string): boolean {
  const triggers = ['latest', 'current', 'today', 'news', 'recent', '2025', '2026',
    'who won', 'stock price', 'weather', 'breaking', 'right now', 'this week',
    'just released', 'score', 'standings', 'trending'];
  const lower = message.toLowerCase();
  return triggers.some(t => lower.includes(t));
}

export function buildRAGContext(query: string, results: SearchResult[]): string {
  if (!results.length) return '';
  const snippets = results.slice(0, 6).map(r =>
    `[${r.id}] **${r.title}**\nURL: ${r.url}\n${r.snippet}`
  ).join('\n\n');
  return `\n\n---\n🔍 **Web Results for: "${query}"**\n\n${snippets}\n\n> Cite as [1], [2], etc.\n---`;
}
