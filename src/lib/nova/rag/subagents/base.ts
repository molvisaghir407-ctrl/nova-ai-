import type { Source, SubagentResult, QueryIntent } from '@/types/nova.types';

export interface SubagentDefinition {
  id: string;
  name: string;
  priority: number;
  timeout: number;
  shouldActivate(query: string, intent: QueryIntent): boolean;
  execute(query: string, signal: AbortSignal): Promise<SubagentResult>;
}

let _zai: { functions?: { invoke: (name: string, params: Record<string, unknown>) => Promise<unknown> } } | null = null;
export async function getZAI() {
  if (_zai) return _zai;
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    _zai = await ZAI.create() as typeof _zai;
    return _zai;
  } catch { return null; }
}

export function tryHostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export async function zaiSearch(query: string, num = 8): Promise<Source[]> {
  const zai = await getZAI();
  if (!zai) return [];
  try {
    const raw = await zai.functions?.invoke('web_search', { query, num }) as Array<{
      name?: string; title?: string; url?: string; snippet?: string;
      host_name?: string; domain?: string; date?: string;
    }>;
    return (raw ?? []).map((item, i) => ({
      id: i + 1,
      title: item.name ?? item.title ?? '',
      url: item.url ?? '',
      snippet: item.snippet ?? '',
      domain: item.host_name ?? item.domain ?? tryHostname(item.url ?? ''),
      date: item.date ?? '',
    }));
  } catch { return []; }
}

export function makeAgent(def: Omit<SubagentDefinition, 'execute'> & {
  run: (query: string, signal: AbortSignal) => Promise<Source[]>;
}): SubagentDefinition {
  return {
    ...def,
    execute: async (query, signal): Promise<SubagentResult> => {
      const start = Date.now();
      try {
        const results = await def.run(query, signal);
        return { agentId: def.id, source: def.name, results, durationMs: Date.now() - start, success: true };
      } catch (err) {
        return { agentId: def.id, source: def.name, results: [], durationMs: Date.now() - start, success: false, error: String(err) };
      }
    },
  };
}
