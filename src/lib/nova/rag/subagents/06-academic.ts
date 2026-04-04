import type { QueryIntent } from '@/types/nova.types';
import { makeAgent, zaiSearch } from './base';
export default makeAgent({
  id: '06-academic', name: 'Academic Search', priority: 6, timeout: 5000,
  shouldActivate: (_q: string, intent: QueryIntent) => ['factual', 'medical', 'general'].includes(intent),
  run: (query) => zaiSearch(`${query} site:arxiv.org OR site:pubmed.ncbi.nlm.nih.gov`, 4),
});
