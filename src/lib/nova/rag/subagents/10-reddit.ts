import type { QueryIntent } from '@/types/nova.types';
import { makeAgent, zaiSearch } from './base';
export default makeAgent({
  id: '10-reddit', name: 'Reddit Discussions', priority: 10, timeout: 5000,
  shouldActivate: (_q: string, intent: QueryIntent) => ['general', 'code', 'factual'].includes(intent),
  run: (query) => zaiSearch(`${query} site:reddit.com`, 4),
});
