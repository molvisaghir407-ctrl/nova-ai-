import type { QueryIntent } from '@/types/nova.types';
import { makeAgent } from './base';
import { webSearch } from '@/lib/nova/search';
export default makeAgent({
  id: '09-web-expanded', name: 'Expanded Web Search', priority: 9, timeout: 6000,
  shouldActivate: (_q: string, intent: QueryIntent) => ['factual', 'news', 'general'].includes(intent),
  run: async (query) => {
    const expanded = query.length < 50 ? `${query} explained` : query;
    const results = await webSearch(expanded, 5);
    return results.map((r, i) => ({ ...r, id: i + 1 }));
  },
});
