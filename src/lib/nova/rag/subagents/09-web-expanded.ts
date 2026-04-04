import type { QueryIntent } from '@/types/nova.types';
import { makeAgent, zaiSearch } from './base';
// Rephrased version of query for broader coverage
export default makeAgent({
  id: '09-web-expanded', name: 'Expanded Web Search', priority: 9, timeout: 5000,
  shouldActivate: (_q: string, intent: QueryIntent) => ['factual', 'news', 'general'].includes(intent),
  run: (query) => {
    // Add "explained" or "how" for more tutorial-style results
    const expanded = query.length < 50 ? `${query} explained guide` : query;
    return zaiSearch(expanded, 5);
  },
});
