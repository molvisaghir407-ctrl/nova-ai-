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
    const isBlock = Boolean(className);
    if (!isBlock) return <code className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-xs text-violet-300" {...props}>{children}</code>;
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

export const StreamingText = memo(function StreamingText({ content, isStreaming }: StreamingTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevContentRef = useRef('');
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef('');
  const [settled, setSettled] = useState(!isStreaming);

  useEffect(() => {
    if (!isStreaming) {
      prevContentRef.current = content;
      setSettled(true);
      return;
    }

    const newPart = content.slice(prevContentRef.current.length);
    if (newPart) {
      pendingRef.current += newPart;
      prevContentRef.current = content;

      // Batch DOM writes on animation frames for smooth rendering
      if (!frameRef.current) {
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = null;
          if (containerRef.current && pendingRef.current) {
            const span = document.createElement('span');
            span.className = 'nova-token';
            span.textContent = pendingRef.current;
            containerRef.current.appendChild(span);
            pendingRef.current = '';
          }
        });
      }
    }

    return () => {
      if (frameRef.current) { cancelAnimationFrame(frameRef.current); frameRef.current = null; }
    };
  }, [content, isStreaming]);

  if (settled) {
    return (
      <div className="prose prose-invert prose-sm max-w-none nova-md">
        <ReactMarkdown components={MarkdownComponents}>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="text-sm leading-7 text-zinc-100 whitespace-pre-wrap">
      <div ref={containerRef} />
      <span className="streaming-cursor" />
    </div>
  );
});
