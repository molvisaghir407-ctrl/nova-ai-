/**
 * Nova Search Utility — used by search route AND chat RAG pipeline
 */
import ZAI from 'z-ai-web-dev-sdk';

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) zaiInstance = await ZAI.create();
  return zaiInstance;
}

export interface SearchResult {
  id: number;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  date: string;
}

export async function webSearch(query: string, num = 8): Promise<SearchResult[]> {
  const zai = await getZAI();
  const results = await zai.functions.invoke('web_search', { query, num: Math.min(num, 20) });
  return (results || []).map((item: any, i: number) => ({
    id: i + 1,
    title: item.name || item.title || '',
    url: item.url || '',
    snippet: item.snippet || '',
    domain: item.host_name || item.domain || new URL(item.url || 'https://unknown').hostname,
    date: item.date || '',
  }));
}

// Keywords that trigger RAG auto-search
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
