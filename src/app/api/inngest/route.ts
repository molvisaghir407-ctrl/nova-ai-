/**
 * Inngest Serve Handler — /api/inngest
 * ─────────────────────────────────────────────────────────────────────────────
 * This is the webhook endpoint Inngest calls to:
 *   • Register function definitions (GET)
 *   • Trigger function execution (POST)
 *   • Handle retries and step results (PUT)
 *
 * Set INNGEST_SIGNING_KEY and INNGEST_EVENT_KEY in your Vercel env vars.
 * In the Inngest dashboard, set the app URL to: https://your-domain/api/inngest
 */

import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { ALL_FUNCTIONS } from '@/lib/inngest/functions';

export const { GET, POST, PUT } = serve({
  client   : inngest,
  functions: ALL_FUNCTIONS,
  // Streaming: enabled for faster function start in Vercel Edge
});
