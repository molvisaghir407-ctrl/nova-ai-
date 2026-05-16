/**
 * Nova Web Scraper v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Multi-strategy web content extractor for RAG pipeline integration.
 *
 * Strategy waterfall:
 *  1. Jina.ai Reader API  — best quality, clean markdown, handles JS sites
 *  2. Direct fetch + cheerio — raw HTML, extract main content nodes
 *  3. Metadata fallback   — title + description + OG tags
 *
 * Features:
 *  • URL detection in user messages
 *  • Full page content → chunked for RAG
 *  • Domain allowlist/blocklist
 *  • Concurrent scraping (up to 4 URLs)
 *  • Streaming progress callbacks (Kimi K2 style)
 */

import * as cheerio from 'cheerio';
import type { Source } from '@/types/nova.types';

// ── Config ─────────────────────────────────────────────────────────────────────
const JINA_BASE  = 'https://r.jina.ai';
const JINA_KEY   = process.env.JINA_API_KEY ?? '';           // optional; public tier works without
const TIMEOUT_MS = 12_000;
const MAX_CHARS  = 20_000;                                    // chars per page to keep
const CHUNK_SIZE = 800;                                       // chars per RAG chunk

const BLOCKED_EXTENSIONS = /\.(pdf|zip|tar|gz|mp4|mp3|avi|mov|jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|exe|dmg)$/i;
const BLOCKED_DOMAINS     = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ScrapedPage {
  url        : string;
  finalUrl   : string;
  title      : string;
  description: string;
  content    : string;    // clean text
  markdown   : string;    // formatted for LLM
  chunks     : string[];  // chunked for RAG
  wordCount  : number;
  domain     : string;
  strategy   : 'jina' | 'cheerio' | 'meta';
  duration   : number;
  error?     : string;
}

export interface ScrapeProgressEvent {
  url   : string;
  title : string;
  domain: string;
  status: 'scanning' | 'reading' | 'done' | 'error';
}

// ── URL utilities ──────────────────────────────────────────────────────────────
export function extractUrls(text: string): string[] {
  const raw = text.match(/https?:\/\/[^\s\]\)>"']+/g) ?? [];
  return raw
    .map(u => u.replace(/[.,;:!?]$/, ''))
    .filter(u => {
      try {
        const parsed = new URL(u);
        const host   = parsed.hostname.replace(/^www\./, '');
        if (BLOCKED_DOMAINS.has(host)) return false;
        if (BLOCKED_EXTENSIONS.test(parsed.pathname)) return false;
        return true;
      } catch { return false; }
    })
    .slice(0, 4);  // max 4 URLs per query
}

export function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

// ── Strategy 1: Jina.ai Reader ────────────────────────────────────────────────
async function scrapeWithJina(url: string): Promise<{ content: string; title: string; description: string } | null> {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-Return-Format': 'markdown',
      'X-Timeout': '10',
    };
    if (JINA_KEY) headers['Authorization'] = `Bearer ${JINA_KEY}`;

    const r = await fetch(`${JINA_BASE}/${url}`, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!r.ok) return null;

    // Jina may return JSON or markdown — handle both
    const ct = r.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      type JinaResp = { data?: { title?: string; description?: string; content?: string; text?: string }; title?: string; description?: string; content?: string; text?: string };
      const j = await r.json() as JinaResp;
      const d = j.data ?? j;
      return {
        content    : (('content' in d ? d.content : undefined) ?? ('text' in d ? d.text : undefined) ?? '').slice(0, MAX_CHARS),
        title      : d.title ?? '',
        description: d.description ?? '',
      };
    }

    const md = (await r.text()).slice(0, MAX_CHARS);
    // Extract title from first # heading
    const titleM = md.match(/^#\s+(.+)$/m);
    return { content: md, title: titleM?.[1] ?? '', description: '' };
  } catch { return null; }
}

// ── Strategy 2: Direct fetch + Cheerio ────────────────────────────────────────
async function scrapeWithCheerio(url: string): Promise<{ content: string; title: string; description: string } | null> {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NovaBot/1.0; +https://novaai.app/bot)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    });

    if (!r.ok) return null;
    const html = await r.text();
    const $    = cheerio.load(html);

    // Remove noise
    $('script, style, nav, footer, header, aside, .ad, .ads, .advertisement, .cookie-banner, .popup, .modal, iframe, noscript, [aria-hidden="true"]').remove();
    $('[class*="sidebar"], [class*="menu"], [class*="nav"], [class*="footer"], [class*="header"], [id*="sidebar"], [id*="nav"]').remove();

    const title       = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
    const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';

    // Try to find main content node
    const MAIN_SELECTORS = ['main', 'article', '[role="main"]', '.post-content', '.article-body', '.entry-content', '.content', '#content', '.main-content'];
    let   content = '';

    for (const sel of MAIN_SELECTORS) {
      const node = $(sel);
      if (node.length) {
        content = node.text().replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
        if (content.length > 200) break;
      }
    }

    if (!content || content.length < 100) {
      content = $('body').text().replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
    }

    return { content, title: title.trim(), description: description.trim() };
  } catch { return null; }
}

// ── Strategy 3: Metadata-only fallback ────────────────────────────────────────
async function scrapeMetaOnly(url: string): Promise<{ content: string; title: string; description: string } | null> {
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5_000) });
    return { content: '', title: getDomain(url), description: `Page at ${url}` };
  } catch { return null; }
}

// ── Chunk text for RAG ─────────────────────────────────────────────────────────
function chunkContent(text: string, size = CHUNK_SIZE): string[] {
  if (text.length <= size) return [text];
  const chunks: string[] = [];
  const paragraphs = text.split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/);
  let   current    = '';

  for (const para of paragraphs) {
    if ((current + para).length > size && current.length > 50) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current.trim().length > 20) chunks.push(current.trim());
  return chunks.slice(0, 20);  // max 20 chunks per page
}

// ── Build formatted markdown for LLM ──────────────────────────────────────────
function formatForLLM(page: Omit<ScrapedPage, 'markdown' | 'chunks' | 'wordCount'>): string {
  const lines = [
    `# ${page.title || page.domain}`,
    `**URL**: ${page.finalUrl}`,
    `**Domain**: ${page.domain}`,
  ];
  if (page.description) lines.push(`**Summary**: ${page.description}`);
  lines.push('', '---', '', page.content);
  return lines.join('\n');
}

// ── Main scrape function ───────────────────────────────────────────────────────
export async function scrapePage(
  url     : string,
  onProgress?: (evt: ScrapeProgressEvent) => void,
): Promise<ScrapedPage> {
  const start  = Date.now();
  const domain = getDomain(url);

  onProgress?.({ url, title: '', domain, status: 'scanning' });

  let result: { content: string; title: string; description: string } | null = null;
  let strategy: ScrapedPage['strategy'] = 'jina';

  // Try Jina first
  result = await scrapeWithJina(url);

  if (!result || !result.content) {
    strategy = 'cheerio';
    onProgress?.({ url, title: '', domain, status: 'reading' });
    result   = await scrapeWithCheerio(url);
  }

  if (!result || !result.content) {
    strategy = 'meta';
    result   = await scrapeMetaOnly(url) ?? { content: '', title: domain, description: '' };
  }

  onProgress?.({ url, title: result.title, domain, status: 'done' });

  const content  = result.content;
  const markdown = formatForLLM({ url, finalUrl: url, title: result.title, description: result.description, content, domain, strategy, duration: Date.now() - start });
  const chunks   = chunkContent(content);

  return {
    url,
    finalUrl   : url,
    title      : result.title,
    description: result.description,
    content,
    markdown,
    chunks,
    wordCount  : content.split(/\s+/).length,
    domain,
    strategy,
    duration   : Date.now() - start,
  };
}

// ── Scrape multiple URLs concurrently ─────────────────────────────────────────
export async function scrapeUrls(
  urls      : string[],
  onProgress: (evt: ScrapeProgressEvent) => void = () => undefined,
): Promise<ScrapedPage[]> {
  const results = await Promise.allSettled(
    urls.map(u => scrapePage(u, onProgress))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<ScrapedPage> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter(p => p.content.length > 50);
}

// ── Convert scraped pages to RAG Sources ──────────────────────────────────────
export function pagesToSources(pages: ScrapedPage[]): Source[] {
  return pages.flatMap((page, pi) =>
    page.chunks.map((chunk, ci) => ({
      id     : pi * 100 + ci + 1,
      title  : page.title  || page.domain,
      url    : page.url,
      snippet: chunk,
      domain : page.domain,
      date   : new Date().toISOString().split('T')[0]!,
    }))
  );
}

// ── Build rich scrape context for LLM ─────────────────────────────────────────
export function buildScrapeContext(pages: ScrapedPage[]): string {
  if (!pages.length) return '';
  const parts = [
    '',
    '---',
    `## 🌐 Scanned Web Content — ${pages.length} page${pages.length > 1 ? 's' : ''}`,
    '',
  ];

  for (const [i, page] of pages.entries()) {
    parts.push(
      `### Page ${i + 1}: ${page.title || page.domain}`,
      `**URL**: ${page.url}`,
      `**Scraped via**: ${page.strategy} · ${page.wordCount.toLocaleString()} words · ${page.duration}ms`,
      '',
      page.content.slice(0, 6000),
      '',
      '---',
      '',
    );
  }

  parts.push('> Analyse the scanned content thoroughly. Cite page numbers as [P1], [P2], etc.');
  parts.push('---');
  return parts.join('\n');
}
