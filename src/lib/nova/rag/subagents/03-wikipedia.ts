import type { QueryIntent } from '@/types/nova.types';
import { makeAgent, zaiSearch } from './base';
export default makeAgent({
  id: '03-wikipedia', name: 'Wikipedia', priority: 3, timeout: 5000,
  shouldActivate: (_q: string, intent: QueryIntent) => ['factual', 'general', 'medical'].includes(intent),
  run: (query) => zaiSearch(`${query} site:wikipedia.org`, 4),
});
