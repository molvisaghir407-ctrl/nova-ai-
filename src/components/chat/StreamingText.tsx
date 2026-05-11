'use client';
import { memo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';
import type { Components } from 'react-markdown';
import { cn } from '@/lib/utils';

interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
}

// ── Markdown component map ────────────────────────────────────────────────────
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

  table: ({ children }) => (
    <div className="overflow-x-auto my-4 rounded-xl border border-white/10 shadow-sm">
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
  tr: ({ children }) => (
    <tr className="hover:bg-white/3 transition-colors duration-150">{children}</tr>
  ),

  blockquote: ({ children }) => (
    <blockquote className="border-l-[3px] border-violet-500/60 pl-4 my-3 text-zinc-400 italic bg-violet-500/5 py-2 pr-3 rounded-r-lg">
      {children}
    </blockquote>
  ),

  h1: ({ children }) => (
    <h1 className="nova-heading text-2xl font-bold mt-6 mb-3 text-white border-b border-white/10 pb-2">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="nova-heading text-lg font-bold mt-5 mb-2.5 text-zinc-100">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="nova-heading text-base font-semibold mt-4 mb-2 text-zinc-200">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="nova-heading text-sm font-semibold mt-3 mb-1 text-zinc-300">{children}</h4>
  ),

  ul: ({ children }) => <ul className="list-none pl-0 space-y-1 my-2.5">{children}</ul>,
  ol: ({ children }) => (
    <ol className="list-none pl-0 space-y-1 my-2.5 nova-ol">{children}</ol>
  ),
  li: ({ children, ...props }) => (
    <li className="nova-li flex gap-2.5 leading-7 text-zinc-200" {...props}>
      <span className="mt-[0.35em] w-1.5 h-1.5 rounded-full bg-violet-400/70 shrink-0 leading-none" aria-hidden />
      <span className="flex-1 min-w-0">{children}</span>
    </li>
  ),

  a: ({ href, children }) => (
    <a
      href={href ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="text-violet-400 hover:text-violet-300 underline underline-offset-2 decoration-violet-400/40 hover:decoration-violet-300/60 transition-colors duration-150 cursor-pointer"
    >
      {children}
    </a>
  ),

  p: ({ children }) => (
    <p className="nova-para my-2 leading-7 text-zinc-100">{children}</p>
  ),

  hr: () => <hr className="my-5 border-white/10" />,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
};

/**
 * Nova streaming text renderer — word-by-word live animation.
 *
 * TWO-PHASE rendering:
 *   1. STREAMING  → plain text with word-by-word animation.
 *      Each word token is a <span key={i}> so React only creates NEW
 *      DOM nodes for newly-arrived words — they get the `word-appear`
 *      CSS animation. Previously rendered nodes are stable and silent.
 *
 *   2. DONE       → full ReactMarkdown render (headings, code blocks,
 *      tables, etc.) with a soft fade-in reveal.
 *
 * This eliminates the "glitch / flicker" caused by ReactMarkdown
 * re-parsing the entire AST on every streamed character.
 */
export const StreamingText = memo(
  function StreamingText({ content, isStreaming }: StreamingTextProps) {
    // Tracks how many tokens were shown at the previous render.
    // New tokens (index >= prevCount) are DOM-new → get the animation.
    const prevTokenCountRef = useRef(0);

    if (isStreaming) {
      // Split on whitespace, preserving the whitespace tokens so layout
      // is identical to normal text flow (no words run together).
      const tokens = content.split(/(\s+)/);
      const prevCount = prevTokenCountRef.current;
      prevTokenCountRef.current = tokens.length;

      return (
        <div className="text-sm leading-7 text-zinc-100 whitespace-pre-wrap break-words min-h-[1.4em]">
          {tokens.map((token, i) => (
            <span
              key={i}
              // Only non-whitespace NEW tokens get the entrance animation.
              // Whitespace tokens always appear instantly (avoids jitter).
              className={i >= prevCount && token.trim().length > 0 ? 'word-appear' : undefined}
            >
              {token}
            </span>
          ))}
          <span className="claude-cursor" aria-hidden />
        </div>
      );
    }

    // Streaming finished — reset token counter for the next streaming session.
    prevTokenCountRef.current = 0;

    // Render full markdown with a subtle reveal fade.
    return (
      <div className={cn('nova-streaming-root text-sm leading-7 nova-md-revealed')}>
        <div className="prose prose-invert prose-sm max-w-none nova-md">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.content === next.content && prev.isStreaming === next.isStreaming,
);
