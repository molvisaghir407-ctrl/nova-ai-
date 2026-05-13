'use client';

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface StreamingTextProps {
  content: string;
  isStreaming?: boolean;
}

export function StreamingText({ content, isStreaming = false }: StreamingTextProps) {
  const words = useMemo(() => {
    if (!content) return [];
    return content.split(/(\s+)/);
  }, [content]);

  if (!content) {
    return (
      <div className="nova-streaming-root">
        {isStreaming && <span className="claude-cursor" />}
      </div>
    );
  }

  // During streaming, show plain text with word animations
  if (isStreaming) {
    return (
      <div className="nova-streaming-root">
        <div className="text-[15px] leading-[1.75] text-zinc-200">
          {words.map((word, i) => (
            <span key={`${i}-${word}`} className="grok-word" style={{ animationDelay: `${i * 0.01}s` }}>
              {word}
            </span>
          ))}
          <span className="claude-cursor" />
        </div>
      </div>
    );
  }

  // After streaming, render full markdown
  return (
    <div className="nova-md nova-md-revealed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="nova-para">{children}</p>,
          h1: ({ children }) => <h1 className="nova-heading text-xl font-bold mt-4 mb-2 text-zinc-100">{children}</h1>,
          h2: ({ children }) => <h2 className="nova-heading text-lg font-semibold mt-3 mb-2 text-zinc-100">{children}</h2>,
          h3: ({ children }) => <h3 className="nova-heading text-base font-semibold mt-2 mb-1 text-zinc-200">{children}</h3>,
          ul: ({ children }) => <ul className="nova-ul list-disc pl-5 my-2">{children}</ul>,
          ol: ({ children }) => <ol className="nova-ol">{children}</ol>,
          li: ({ children }) => <li className="nova-li my-0.5">{children}</li>,
          code: ({ className, children }) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const isInline = !className;

            if (isInline) {
              return <code className="px-1 py-0.5 rounded bg-zinc-800 text-violet-300 text-[0.85em]">{children}</code>;
            }

            return (
              <div className="code-block-wrapper my-3 rounded-lg overflow-hidden border border-zinc-800">
                <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
                  <span className="text-xs text-zinc-500 font-mono">{language || 'code'}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(String(children))}
                    className="copy-btn text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded hover:bg-white/5"
                  >
                    Copy
                  </button>
                </div>
                <SyntaxHighlighter
                  language={language || 'text'}
                  style={vscDarkPlus}
                  customStyle={{ margin: 0, fontSize: 13 }}
                  showLineNumbers
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              </div>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-violet-500/40 pl-3 my-2 text-zinc-400 italic">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border border-zinc-800 px-3 py-1.5 text-left text-zinc-300 font-semibold bg-zinc-900/50">{children}</th>,
          td: ({ children }) => <td className="border border-zinc-800 px-3 py-1.5 text-zinc-400">{children}</td>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">{children}</a>,
          strong: ({ children }) => <strong className="text-zinc-100 font-semibold">{children}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
