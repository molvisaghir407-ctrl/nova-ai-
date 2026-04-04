import type { QueryIntent } from '@/types/nova.types';
import { makeAgent, zaiSearch } from './base';
export default makeAgent({
  id: '04-stackoverflow', name: 'Stack Overflow', priority: 4, timeout: 5000,
  shouldActivate: (_q: string, intent: QueryIntent) => intent === 'code',
  run: (query) => zaiSearch(`${query} site:stackoverflow.com`, 5),
});
