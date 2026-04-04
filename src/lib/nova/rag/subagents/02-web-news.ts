import type { QueryIntent } from '@/types/nova.types';
import { makeAgent, zaiSearch } from './base';
export default makeAgent({
  id: '02-web-news', name: 'News Search', priority: 2, timeout: 5000,
  shouldActivate: (_q: string, intent: QueryIntent) => ['news', 'factual', 'general'].includes(intent),
  run: (query) => zaiSearch(`${query} site:reuters.com OR site:bbc.com OR site:apnews.com`, 6),
});
