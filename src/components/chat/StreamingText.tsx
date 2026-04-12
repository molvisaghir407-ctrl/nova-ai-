'use client';
import { useRef, useEffect, useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import { CodeBlock } from './CodeBlock';
import type { Components } from 'react-markdown';

interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
}

const MD: Components = {
  code({ className, children, ...props }) {
    const lang = (className ?? '').replace('language-', '');
    if (!className) return <code className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-xs text-violet-300" {...props}>{children}</code>;
    return <CodeBlock language={lang}>{String(children).replace(/\n$/, '')}</CodeBlock>;
  },
  table: ({ children }) => <div className="overflow-x-auto my-3"><table className="w-full text-xs border-collapse">{children}</table></div>,
  th: ({ children }) => <th className="border border-white/20 px-3 py-2 text-left bg-white/10 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-white/10 px-3 py-2">{children}</td>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-violet-500 pl-3 my-2 text-zinc-400 italic">{children}</blockquote>,
  h1: ({ children }) => <h1 className="text-xl font-bold mt-5 mb-3">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold mt-4 mb-2 text-zinc-200">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1 text-zinc-300">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc list-outside pl-5 space-y-1 my-2">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside pl-5 space-y-1 my-2">{children}</ol>,
  a: ({ href, children }) => <a href={href ?? '#'} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">{children}</a>,
  p: ({ children }) => <p className="my-1.5 leading-7">{children}</p>,
};

/**
 * Two-phase renderer:
 *
 * Phase 1 (streaming): Direct DOM writes, zero React re-renders.
 *   - New characters batched every 16ms (one animation frame).
 *   - Word-by-word fade-in via CSS animation.
 *   - NO markdown parsing during streaming → zero layout shift.
 *   - Blinking cursor at end of text.
 *
 * Phase 2 (settled): Single opacity crossfade to ReactMarkdown.
 *   - Happens ONCE, 50ms after stream ends.
 *   - Bold/italic/code blocks appear exactly once, in one smooth transition.
 */
export const StreamingText = memo(function StreamingText({ content, isStreaming }: StreamingTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const bufRef = useRef('');
  const [phase, setPhase] = useState<'streaming' | 'fading' | 'settled'>(
    isStreaming ? 'streaming' : 'settled'
  );

  useEffect(() => {
    if (!isStreaming) {
      // Stream ended → short delay then crossfade to ReactMarkdown
      if (phase === 'streaming') {
        setPhase('fading');
        const t = setTimeout(() => setPhase('settled'), 200);
        return () => clearTimeout(t);
      }
      return;
    }

    // Accumulate new chars into buffer
    const newChars = content.slice(prevLenRef.current);
    if (!newChars) return;
    prevLenRef.current = content.length;
    bufRef.current += newChars;

    // Batch writes on next animation frame (prevents multiple reflows per second)
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = containerRef.current;
      if (!el || !bufRef.current) return;

      const text = bufRef.current;
      bufRef.current = '';

      // Split by word boundaries and animate each word in
      const tokens = text.match(/\S+\s*/g) ?? [text];
      const frag = document.createDocumentFragment();
      tokens.forEach((tok, i) => {
        const span = document.createElement('span');
        span.className = 'nova-word';
        // Stagger: first few words animate in immediately, rest have slight delay
        span.style.animationDelay = i < 3 ? '0ms' : `${(i - 2) * 12}ms`;
        span.textContent = tok;
        frag.appendChild(span);
      });
      el.appendChild(frag);
    });

    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [content, isStreaming, phase]);

  return (
    <div className="relative min-h-[1.5em]">
      {/* Raw text layer */}
      {phase !== 'settled' && (
        <div
          className="text-sm leading-7 text-zinc-100 transition-opacity duration-200"
          style={{ opacity: phase === 'fading' ? 0 : 1, pointerEvents: 'none' }}
        >
          <div ref={containerRef} style={{ display: 'inline' }} />
          {phase === 'streaming' && <span className="streaming-cursor" />}
        </div>
      )}
      {/* Markdown layer — fades in when settled */}
      {phase === 'settled' && (
        <div className="prose prose-invert prose-sm max-w-none nova-md animate-in fade-in duration-150">
          <ReactMarkdown components={MD}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
});
