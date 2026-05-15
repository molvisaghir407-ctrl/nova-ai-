'use client';
import { useState, useRef, useCallback, memo } from 'react';
import { Code2, Eye, Download, Maximize2, Minimize2, RefreshCw, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HtmlArtifactProps {
  code    : string;
  language: string;       // 'html' | 'jsx' | 'svg'
}

const SANDBOX = [
  'allow-scripts',
  'allow-same-origin',
  'allow-forms',
  'allow-popups',
].join(' ');

// Wrap bare HTML snippets with full doc + reset styles
function wrapHtml(code: string, lang: string): string {
  const isFullDoc =
    /<!DOCTYPE/i.test(code) ||
    /<html/i.test(code);

  if (isFullDoc) return code;

  if (lang === 'svg') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#09090b;}</style>
</head><body>${code}</body></html>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      background: #ffffff;
      color: #111827;
    }
    /* Tailwind-compat resets */
    img { max-width: 100%; display: block; }
    a { color: #6d28d9; }
    pre, code { font-family: 'Fira Code', 'Cascadia Code', monospace; }
  </style>
</head>
<body>
${code}
</body>
</html>`;
}

export const HtmlArtifact = memo(function HtmlArtifact({ code, language }: HtmlArtifactProps) {
  const [tab,      setTab]      = useState<'preview' | 'code'>('preview');
  const [expanded, setExpanded] = useState(false);
  const [key,      setKey]      = useState(0);          // force iframe reload
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const reload = useCallback(() => setKey(k => k + 1), []);

  const download = useCallback(() => {
    const blob = new Blob([code], { type: 'text/html' });
    const a = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'nova-output.html';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [code]);

  const openInTab = useCallback(() => {
    const wrapped = wrapHtml(code, language);
    const blob = new Blob([wrapped], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [code, language]);

  const srcDoc = wrapHtml(code, language);

  const langLabel = language === 'svg'
    ? 'SVG'
    : language === 'jsx'
    ? 'JSX Preview'
    : 'HTML';

  return (
    <div
      className={cn(
        'my-4 rounded-xl overflow-hidden border border-white/12 bg-zinc-900/60 shadow-lg shadow-black/30 transition-all duration-300',
        expanded ? 'fixed inset-4 z-50 m-0 rounded-2xl' : 'relative',
      )}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-3 py-2 bg-zinc-900/90 border-b border-white/8">
        {/* Traffic lights */}
        <span className="flex gap-1.5 mr-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        </span>

        {/* Language badge */}
        <span className="text-[10px] font-mono text-zinc-500 mr-3">{langLabel}</span>

        {/* Tabs */}
        <div className="flex gap-0.5 bg-zinc-800/60 rounded-lg p-0.5">
          <button
            onClick={() => setTab('preview')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all duration-200',
              tab === 'preview'
                ? 'bg-violet-600/80 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            <Eye className="w-3 h-3" />
            Preview
          </button>
          <button
            onClick={() => setTab('code')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all duration-200',
              tab === 'code'
                ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            <Code2 className="w-3 h-3" />
            Source
          </button>
        </div>

        <div className="flex-1" />

        {/* Action buttons */}
        {tab === 'preview' && (
          <button
            onClick={reload}
            title="Reload"
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/8 transition-all duration-150"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={openInTab}
          title="Open in new tab"
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/8 transition-all duration-150"
        >
          <ExternalLink className="w-3 h-3" />
        </button>
        <button
          onClick={download}
          title="Download"
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/8 transition-all duration-150"
        >
          <Download className="w-3 h-3" />
        </button>
        <button
          onClick={() => setExpanded(e => !e)}
          title={expanded ? 'Collapse' : 'Expand'}
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/8 transition-all duration-150"
        >
          {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        </button>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {tab === 'preview' ? (
        <iframe
          key={key}
          ref={iframeRef}
          srcDoc={srcDoc}
          sandbox={SANDBOX}
          title="HTML Preview"
          className={cn(
            'w-full border-0 bg-white transition-all duration-300',
            expanded ? 'h-[calc(100vh-120px)]' : 'h-[380px]',
          )}
        />
      ) : (
        <div
          className={cn(
            'overflow-auto font-mono text-[12px] leading-relaxed p-4 text-zinc-300 bg-zinc-950/80',
            expanded ? 'h-[calc(100vh-120px)]' : 'h-[380px] max-h-[380px]',
          )}
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.2) transparent' }}
        >
          <pre className="whitespace-pre-wrap break-words">{code}</pre>
        </div>
      )}
    </div>
  );
});
