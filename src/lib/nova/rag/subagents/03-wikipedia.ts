import type { QueryIntent } from '@/types/nova.types';
import { makeAgent } from './base';
import { webSearch } from '@/lib/nova/search';
export default makeAgent({
  id: '03-wikipedia', name: 'Wikipedia', priority: 3, timeout: 6000,
  shouldActivate: (_q: string, intent: QueryIntent) => ['factual', 'general', 'medical'].includes(intent),
  run: async (query) => {
    const results = await webSearch(`${query} site:wikipedia.org`, 3);
    return results.map((r, i) => ({ ...r, id: i + 1 }));
  },
});
