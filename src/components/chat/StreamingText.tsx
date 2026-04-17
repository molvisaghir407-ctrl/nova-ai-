'use client';
import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';
import type { Components } from 'react-markdown';

interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
}

// ── Markdown component map ────────────────────────────────────────────────────
// Same rendering for both streaming and settled — no transition needed
const MD: Components = {
  code({ className, children, ...props }) {
    const lang = (className ?? '').replace('language-', '');
    if (!className) {
      return (
        <code
          className="px-1.5 py-0.5 rounded-md bg-zinc-800 font-mono text-[0.8em] text-violet-300 border border-white/8"
          {...props}
        >
          {children}
        </code>
      );
    }
    return <CodeBlock language={lang}>{String(children).replace(/\n$/, '')}</CodeBlock>;
  },
  // Tables
  table: ({ children }) => (
    <div className="overflow-x-auto my-4 rounded-xl border border-white/10">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-white/5">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-white/10 px-4 py-2.5 text-left text-xs font-semibold text-zinc-300 uppercase tracking-wider">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-white/6 px-4 py-2.5 text-sm text-zinc-200">{children}</td>
  ),
  tr: ({ children }) => <tr className="hover:bg-white/3 transition-colors">{children}</tr>,
  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="border-l-[3px] border-violet-500/60 pl-4 my-3 text-zinc-400 italic bg-violet-500/5 py-1 rounded-r-lg">
      {children}
    </blockquote>
  ),
  // Headings
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold mt-6 mb-3 text-white border-b border-white/10 pb-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-bold mt-5 mb-2.5 text-zinc-100">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold mt-4 mb-2 text-zinc-200">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold mt-3 mb-1 text-zinc-300">{children}</h4>
  ),
  // Lists
  ul: ({ children }) => (
    <ul className="list-none pl-0 space-y-1 my-2.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-none pl-0 space-y-1 my-2.5 counter-reset-[item]">{children}</ol>
  ),
  li: ({ children, ...props }) => (
    <li className="flex gap-2.5 leading-7 text-zinc-200" {...props}>
      <span className="mt-[0.35em] w-1.5 h-1.5 rounded-full bg-violet-400/70 shrink-0 leading-none" aria-hidden />
      <span className="flex-1 min-w-0">{children}</span>
    </li>
  ),
  // Links
  a: ({ href, children }) => (
    <a
      href={href ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="text-violet-400 hover:text-violet-300 underline underline-offset-2 decoration-violet-400/40 hover:decoration-violet-300/60 transition-colors"
    >
      {children}
    </a>
  ),
  // Paragraphs
  p: ({ children }) => <p className="my-2 leading-7 text-zinc-100">{children}</p>,
  // Horizontal rule
  hr: () => <hr className="my-4 border-white/10" />,
  // Strong / em
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
};

/**
 * Claude-style streaming renderer.
 *
 * Key differences from DeepSeek-style:
 *  - Markdown is rendered LIVE during streaming — bold, headers, bullets appear
 *    as soon as the closing syntax arrives (e.g. ** closes bold)
 *  - NO plain-text intermediate phase — no layout shift or "flash" at end
 *  - React re-renders on each token batch (fast with memo + remark-gfm)
 *  - Blinking cursor appended as a sibling span inside the last rendered element
 *  - When done: cursor disappears, content stays exactly as-is
 */
export const StreamingText = memo(function StreamingText({ content, isStreaming }: StreamingTextProps) {
  return (
    <div className="nova-streaming-root text-sm leading-7">
      {/* 
        Render markdown live. remark-gfm adds tables, strikethrough, task lists.
        memo ensures we only re-render when content or isStreaming changes.
      */}
      <div className="prose prose-invert prose-sm max-w-none nova-md">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>
          {content}
        </ReactMarkdown>
      </div>

      {/* Blinking cursor — positioned after all content, only while streaming */}
      {isStreaming && <span className="claude-cursor" aria-hidden />}
    </div>
  );
}, (prev, next) =>
  // Custom comparator: skip re-render only if BOTH content AND isStreaming are unchanged
  prev.content === next.content && prev.isStreaming === next.isStreaming
);
