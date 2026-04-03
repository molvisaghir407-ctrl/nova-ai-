/**
 * Nova Search Utility — RAG pipeline + search panel
 * ZAI is loaded lazily so import failures don't kill the chat route
 */

export interface SearchResult {
  id: number;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  date: string;
}

let _zai: any = null;
async function getZAI(): Promise<any | null> {
  if (_zai) return _zai;
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    _zai = await ZAI.create();
    return _zai;
  } catch {
    return null;
  }
}

export async function webSearch(query: string, num = 8): Promise<SearchResult[]> {
  try {
    const zai = await getZAI();
    if (!zai) return [];
    const results = await zai.functions.invoke('web_search', { query, num: Math.min(num, 20) });
    return (results || []).map((item: any, i: number) => ({
      id: i + 1,
      title: item.name || item.title || '',
      url: item.url || '',
      snippet: item.snippet || '',
      domain: item.host_name || item.domain || tryHostname(item.url),
      date: item.date || '',
    }));
  } catch {
    return [];
  }
}

function tryHostname(url: string): string {
  try { return new URL(url).hostname; } catch { return ''; }
}

const SEARCH_TRIGGERS = [
  'latest', 'current', 'today', 'news', 'recent', '2025', '2026',
  'who won', 'what happened', 'stock price', 'weather', 'breaking',
  'right now', 'this week', 'yesterday', 'just released', 'new version',
  'update', 'released', 'announced', 'live', 'trending', 'score',
];

export function detectSearchIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return SEARCH_TRIGGERS.some(t => lower.includes(t));
}

export function buildRAGContext(query: string, results: SearchResult[]): string {
  if (!results.length) return '';
  const snippets = results.slice(0, 6).map(r =>
    `[${r.id}] **${r.title}**\nURL: ${r.url}\n${r.snippet}${r.date ? `\nDate: ${r.date}` : ''}`
  ).join('\n\n');
  return `\n\n---\n🔍 **Live Web Results for: "${query}"**\n\n${snippets}\n\n> Cite sources inline as [1], [2], etc. Prioritise recent results.\n---`;
}
