import type { QueryIntent } from '@/types/nova.types';
import { makeAgent } from './base';
import { webSearch } from '@/lib/nova/search';
export default makeAgent({
  id: '05-github', name: 'GitHub', priority: 5, timeout: 6000,
  shouldActivate: (_q: string, intent: QueryIntent) => intent === 'code',
  run: async (query) => {
    const results = await webSearch(`${query} site:github.com`, 4);
    return results.map((r, i) => ({ ...r, id: i + 1 }));
  },
});
