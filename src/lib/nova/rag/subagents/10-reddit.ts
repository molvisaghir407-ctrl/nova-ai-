import type { QueryIntent } from '@/types/nova.types';
import { makeAgent } from './base';
import { webSearch } from '@/lib/nova/search';
export default makeAgent({
  id: '10-reddit', name: 'Reddit', priority: 10, timeout: 6000,
  shouldActivate: (_q: string, intent: QueryIntent) => ['general', 'factual'].includes(intent),
  run: async (query) => {
    const results = await webSearch(`${query} site:reddit.com`, 4);
    return results.map((r, i) => ({ ...r, id: i + 1 }));
  },
});
