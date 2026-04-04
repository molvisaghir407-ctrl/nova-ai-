import type { QueryIntent } from '@/types/nova.types';
import { makeAgent, zaiSearch } from './base';
export default makeAgent({
  id: '05-github', name: 'GitHub', priority: 5, timeout: 5000,
  shouldActivate: (_q: string, intent: QueryIntent) => intent === 'code',
  run: (query) => zaiSearch(`${query} site:github.com`, 4),
});
