/**
 * Nova Inngest Client
 * Single shared Inngest instance for all background functions.
 */
import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id  : 'nova-ai',
  name: 'Nova AI Background Worker',
});

// ── Event type map (type-safe event names) ────────────────────────────────────
export type NovaEvents = {
  'nova/content.index': {
    data: {
      sources  : Array<{ url: string; text: string; domain: string }>;
      query    : string;
      sessionId: string;
    };
  };
  'nova/memory.consolidate': {
    data: {
      userId  : string;
      messages: Array<{ role: string; content: string }>;
    };
  };
  'nova/kg.update': {
    data: {
      texts    : string[];
      sessionId: string;
    };
  };
};
