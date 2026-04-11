import type { QueryIntent } from '@/types/nova.types';
import { makeAgent } from './base';
import { webSearch } from '@/lib/nova/search';
export default makeAgent({
  id: '01-web-primary', name: 'Primary Web Search', priority: 1, timeout: 7000,
  shouldActivate: (_q: string, intent: QueryIntent) => !['conversational', 'creative'].includes(intent),
  run: async (query) => {
    const results = await webSearch(query, 8);
    return results.map((r, i) => ({ ...r, id: i + 1 }));
  },
});
