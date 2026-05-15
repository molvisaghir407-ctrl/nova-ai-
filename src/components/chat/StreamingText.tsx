'use client';
import { useState, useEffect, useRef, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';
import { HtmlArtifact } from './HtmlArtifact';
import type { Components } from 'react-markdown';
import { cn } from '@/lib/utils';

interface StreamingTextProps {
  content    : string;
  isStreaming: boolean;
}

// ── HTML/SVG artifact detection ───────────────────────────────────────────────
// Detects fenced code blocks with html/svg/jsx language tag, OR bare <html>
const HTML_LANGS = new Set(['html', 'htm', 'svg', 'jsx-preview', 'html-preview']);

function isHtmlLang(lang: string) {
  return HTML_LANGS.has(lang.toLowerCase().trim());
}

// ── 60fps smooth display queue ────────────────────────────────────────────────
function useSmoothDisplay(content: string, isStreaming: boolean): string {
  const [displayed, setDisplayed] = useState('');
  const queueRef = useRef('');
  const prevRef  = useRef('');
  const rafRef   = useRef<number | null>(null);
  const tsRef    = useRef(0);

  useEffect(() => {
    const delta = content.slice(prevRef.current.length);
    prevRef.current = content;
    if (delta) queueRef.current += delta;
  }, [content]);

  useEffect(() => {
    if (!isStreaming) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setDisplayed(content);
      queueRef.current = '';
      prevRef.current  = content;
      tsRef.current    = 0;
      return;
    }

    const drain = (ts: number) => {
      if (ts - tsRef.current >= 14) {   // ~60fps
        tsRef.current = ts;
        if (queueRef.current.length > 0) {
          const bl   = queueRef.current.length;
          const step = bl > 120 ? 10 : bl > 60 ? 7 : bl > 20 ? 4 : 2;
          let end = step;
          while (end < bl && queueRef.current[end] !== ' ' && queueRef.current[end] !== '\n' && end < step + 8) end++;
          const chunk = queueRef.current.slice(0, end);
          queueRef.current = queueRef.current.slice(end);
          setDisplayed(prev => prev + chunk);
        }
      }
      rafRef.current = requestAnimationFrame(drain);
    };

    rafRef.current = requestAnimationFrame(drain);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
  }, [isStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  return displayed;
}

// ── Block-aware split (settled vs live) ───────────────────────────────────────
function splitBlocks(text: string): { settled: string; live: string } {
  if (!text) return { settled: '', live: '' };

  const fences = text.match(/^```/gm) ?? [];
  if (fences.length % 2 === 1) {
    const openIdx = text.lastIndexOf('\n```');
    if (openIdx <= 0) return { settled: '', live: text };
    return { settled: text.slice(0, openIdx + 1), live: text.slice(openIdx + 1) };
  }

  const last = text.lastIndexOf('\n\n');
  if (last < 20) return { settled: '', live: text };
  return { settled: text.slice(0, last + 2), live: text.slice(last + 2) };
}

// ── Shared ReactMarkdown component map ────────────────────────────────────────
const MD: Components = {
  code({ className, children, ...props }) {
    const lang = (className ?? '').replace('language-', '');

    // Fenced block
    if (className) {
      const raw = String(children).replace(/\n$/, '');
      if (isHtmlLang(lang)) {
        return <HtmlArtifact code={raw} language={lang} />;
      }
      return <CodeBlock language={lang}>{raw}</CodeBlock>;
    }

    // Inline code
    return (
      <code
        className="px-1.5 py-0.5 rounded-md bg-zinc-800 font-mono text-[0.8em] text-violet-300 border border-white/8"
        {...props}
      >
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="overflow-x-auto my-4 rounded-xl border border-white/10 shadow-sm">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead:      ({ children }) => <thead className="bg-white/5">{children}</thead>,
  th:         ({ children }) => <th className="border-b border-white/10 px-4 py-2.5 text-left text-xs font-semibold text-zinc-300 uppercase tracking-wider">{children}</th>,
  td:         ({ children }) => <td className="border-b border-white/6 px-4 py-2.5 text-sm text-zinc-200">{children}</td>,
  tr:         ({ children }) => <tr className="hover:bg-white/3 transition-colors duration-150">{children}</tr>,
  blockquote: ({ children }) => <blockquote className="border-l-[3px] border-violet-500/60 pl-4 my-3 text-zinc-400 italic bg-violet-500/5 py-2 pr-3 rounded-r-lg">{children}</blockquote>,
  h1:         ({ children }) => <h1 className="nova-heading text-2xl font-bold mt-6 mb-3 text-white border-b border-white/10 pb-2">{children}</h1>,
  h2:         ({ children }) => <h2 className="nova-heading text-lg font-bold mt-5 mb-2.5 text-zinc-100">{children}</h2>,
  h3:         ({ children }) => <h3 className="nova-heading text-base font-semibold mt-4 mb-2 text-zinc-200">{children}</h3>,
  h4:         ({ children }) => <h4 className="nova-heading text-sm font-semibold mt-3 mb-1 text-zinc-300">{children}</h4>,
  ul:         ({ children }) => <ul className="list-none pl-0 space-y-1 my-2.5">{children}</ul>,
  ol:         ({ children }) => <ol className="list-none pl-0 space-y-1 my-2.5 nova-ol">{children}</ol>,
  li: ({ children, ...props }) => (
    <li className="nova-li flex gap-2.5 leading-7 text-zinc-200" {...props}>
      <span className="mt-[0.35em] w-1.5 h-1.5 rounded-full bg-violet-400/70 shrink-0" aria-hidden />
      <span className="flex-1 min-w-0">{children}</span>
    </li>
  ),
  a: ({ href, children }) => (
    <a href={href ?? '#'} target="_blank" rel="noopener noreferrer"
      className="text-violet-400 hover:text-violet-300 underline underline-offset-2 decoration-violet-400/40 hover:decoration-violet-300/60 transition-colors duration-150 cursor-pointer">
      {children}
    </a>
  ),
  p:      ({ children }) => <p className="nova-para my-2 leading-7 text-zinc-100">{children}</p>,
  hr:     ()             => <hr className="my-5 border-white/10" />,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em:     ({ children }) => <em className="italic text-zinc-300">{children}</em>,
};

// ── Live text (word-by-word entrance, Grok style) ─────────────────────────────
const prevTokenCount = { current: 0 };

function LiveText({ text }: { text: string }) {
  if (!text) return null;
  const tokens   = text.split(/(\s+)/);
  const prevCount = prevTokenCount.current;
  prevTokenCount.current = tokens.length;
  return (
    <p className="nova-para my-2 leading-7 text-zinc-100">
      {tokens.map((tok, i) => (
        <span key={i} className={i >= prevCount && tok.trim().length > 0 ? 'nova-word-enter' : undefined}>
          {tok}
        </span>
      ))}
    </p>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export const StreamingText = memo(
  function StreamingText({ content, isStreaming }: StreamingTextProps) {
    const displayed = useSmoothDisplay(content, isStreaming);

    if (isStreaming) {
      const { settled, live } = splitBlocks(displayed);
      return (
        <div className="nova-streaming-root text-sm leading-7">
          {settled && (
            <div className="prose prose-invert prose-sm max-w-none nova-md">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>{settled}</ReactMarkdown>
            </div>
          )}
          <LiveText text={live} />
          <span className="claude-cursor" aria-hidden />
        </div>
      );
    }

    prevTokenCount.current = 0;
    return (
      <div className="nova-streaming-root text-sm leading-7 nova-md-revealed">
        <div className="prose prose-invert prose-sm max-w-none nova-md">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>{content}</ReactMarkdown>
        </div>
      </div>
    );
  },
  (prev, next) => prev.content === next.content && prev.isStreaming === next.isStreaming,
);
