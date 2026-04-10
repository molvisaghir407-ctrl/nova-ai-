'use client';
import { useRef, useEffect, useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import { CodeBlock } from './CodeBlock';
import type { Components } from 'react-markdown';

interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
}

const MarkdownComponents: Components = {
  code({ className, children, ...props }) {
    const lang = (className ?? '').replace('language-', '');
    if (!className) {
      return <code className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-xs text-violet-300" {...props}>{children}</code>;
    }
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

// DeepSeek-style: renders words one by one with staggered animation
// Uses direct DOM writes during streaming, full ReactMarkdown after done
export const StreamingText = memo(function StreamingText({ content, isStreaming }: StreamingTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevContentRef = useRef('');
  const frameRef = useRef<number | null>(null);
  const wordBufRef = useRef('');
  const wordIndexRef = useRef(0);
  const [settled, setSettled] = useState(!isStreaming);

  // During streaming: append new text word-by-word with staggered animation
  useEffect(() => {
    if (!isStreaming) {
      prevContentRef.current = content;
      setSettled(true);
      return;
    }

    const newPart = content.slice(prevContentRef.current.length);
    if (!newPart) return;
    prevContentRef.current = content;
    wordBufRef.current += newPart;

    if (frameRef.current) return; // batch on next frame

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      if (!containerRef.current || !wordBufRef.current) return;

      const text = wordBufRef.current;
      wordBufRef.current = '';

      // Split into word+space units and animate each
      const tokens = text.match(/\S+\s*/g) ?? [text];
      const frag = document.createDocumentFragment();
      tokens.forEach((token, i) => {
        const span = document.createElement('span');
        span.className = 'nova-word';
        span.style.animationDelay = `${i * 18}ms`;
        span.textContent = token;
        frag.appendChild(span);
        wordIndexRef.current++;
      });
      containerRef.current.appendChild(frag);
    });

    return () => {
      if (frameRef.current) { cancelAnimationFrame(frameRef.current); frameRef.current = null; }
    };
  }, [content, isStreaming]);

  // When settled: switch to full markdown render
  if (settled) {
    return (
      <div className="prose prose-invert prose-sm max-w-none nova-md">
        <ReactMarkdown components={MarkdownComponents}>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="text-sm leading-7 text-zinc-100">
      <div ref={containerRef} style={{ display: 'inline' }} />
      <span className="streaming-cursor" />
    </div>
  );
});
