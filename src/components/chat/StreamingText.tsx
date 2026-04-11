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
 * Smooth streaming text renderer:
 * 
 * DURING streaming:
 *   - Renders raw text with a blinking cursor (no markdown parsing = no layout shift)
 *   - New characters appended via direct DOM write (zero React re-render per token)
 *   - Word-by-word fade-in using CSS animation
 * 
 * AFTER streaming done:
 *   - Crossfades to full ReactMarkdown (opacity transition over 200ms)
 *   - The crossfade happens ONCE at the end, not on every token
 *   - This is the only moment bold/italic/headers appear → one smooth transition
 */
export const StreamingText = memo(function StreamingText({ content, isStreaming }: StreamingTextProps) {
  const rawRef = useRef<HTMLDivElement>(null);
  const prevContentRef = useRef('');
  const frameRef = useRef<number | null>(null);
  const bufRef = useRef('');
  const [done, setDone] = useState(!isStreaming);
  const [fading, setFading] = useState(false);

  // Streaming: append new text directly to DOM
  useEffect(() => {
    if (!isStreaming) {
      // Stream ended — trigger crossfade
      if (!done) {
        setFading(true);
        // Small delay so the last tokens render before we switch
        const t = setTimeout(() => setDone(true), 50);
        return () => clearTimeout(t);
      }
      return;
    }

    const newPart = content.slice(prevContentRef.current.length);
    if (!newPart) return;
    prevContentRef.current = content;
    bufRef.current += newPart;

    if (frameRef.current) return;

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const el = rawRef.current;
      if (!el || !bufRef.current) return;

      const text = bufRef.current;
      bufRef.current = '';

      // Append words with fade-in animation
      const tokens = text.match(/\S+\s*/g) ?? [text];
      const frag = document.createDocumentFragment();
      tokens.forEach((token, i) => {
        const span = document.createElement('span');
        span.className = 'nova-word';
        span.style.animationDelay = `${i * 15}ms`;
        span.textContent = token;
        frag.appendChild(span);
      });
      el.appendChild(frag);
    });

    return () => {
      if (frameRef.current) { cancelAnimationFrame(frameRef.current); frameRef.current = null; }
    };
  }, [content, isStreaming, done]);

  return (
    <div className="relative">
      {/* Raw text layer — visible during streaming, fades out when done */}
      {!done && (
        <div
          className="text-sm leading-7 text-zinc-100 transition-opacity duration-200"
          style={{ opacity: fading ? 0 : 1 }}>
          <div ref={rawRef} style={{ display: 'inline' }} />
          {!fading && <span className="streaming-cursor" />}
        </div>
      )}

      {/* Markdown layer — fades in when done, positioned on top */}
      {done && (
        <div className="prose prose-invert prose-sm max-w-none nova-md animate-in fade-in duration-200">
          <ReactMarkdown components={MD}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
});
