import type { QueryIntent } from '@/types/nova.types';
import { makeAgent, zaiSearch } from './base';
export default makeAgent({
  id: '01-web-primary', name: 'Primary Web Search', priority: 1, timeout: 5000,
  shouldActivate: (_q: string, intent: QueryIntent) => !['conversational', 'creative'].includes(intent),
  run: (query) => zaiSearch(query, 8),
});
