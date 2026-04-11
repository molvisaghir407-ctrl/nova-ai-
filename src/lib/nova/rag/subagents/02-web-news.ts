import type { QueryIntent } from '@/types/nova.types';
import { makeAgent } from './base';
import { webSearch } from '@/lib/nova/search';
export default makeAgent({
  id: '02-web-news', name: 'News Search', priority: 2, timeout: 7000,
  shouldActivate: (_q: string, intent: QueryIntent) => ['news', 'factual', 'general', 'finance'].includes(intent),
  run: async (query) => {
    const results = await webSearch(`${query} latest news`, 5);
    return results.map((r, i) => ({ ...r, id: i + 1 }));
  },
});
