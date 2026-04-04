import type { QueryIntent, Source } from '@/types/nova.types';
import { makeAgent, tryHostname } from './base';
export default makeAgent({
  id: '07-hacker-news', name: 'Hacker News', priority: 7, timeout: 5000,
  shouldActivate: (_q: string, intent: QueryIntent) => ['code', 'news', 'general'].includes(intent),
  run: async (query, signal) => {
    try {
      const res = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=5`, { signal });
      const data = await res.json() as { hits?: Array<{ objectID: string; title?: string; url?: string; story_text?: string; created_at?: string }> };
      return (data.hits ?? []).map((h, i): Source => ({
        id: i + 1, title: h.title ?? '', url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
        snippet: (h.story_text ?? '').slice(0, 200), domain: tryHostname(h.url ?? 'news.ycombinator.com'),
        date: h.created_at ?? '',
      }));
    } catch { return []; }
  },
});
