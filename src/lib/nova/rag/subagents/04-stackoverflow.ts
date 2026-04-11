import type { QueryIntent } from '@/types/nova.types';
import { makeAgent } from './base';
import { webSearch } from '@/lib/nova/search';
export default makeAgent({
  id: '04-stackoverflow', name: 'Stack Overflow', priority: 4, timeout: 6000,
  shouldActivate: (_q: string, intent: QueryIntent) => intent === 'code',
  run: async (query) => {
    const results = await webSearch(`${query} site:stackoverflow.com`, 5);
    return results.map((r, i) => ({ ...r, id: i + 1 }));
  },
});
