'use client';
import { useState, memo } from 'react';
import { Copy, CheckCircle } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps { language: string; children: string }

export const CodeBlock = memo(function CodeBlock({ language, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = children.split('\n').length;

  const copy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-white/10">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/90 border-b border-white/8">
        <div className="flex items-center gap-2">
          <span className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          </span>
          <span className="text-xs text-zinc-500 font-mono ml-1">{language || 'code'}</span>
        </div>
        <button onClick={copy} aria-label="Copy code"
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-white/8">
          {copied ? <><CheckCircle className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied</span></> : <><Copy className="w-3 h-3" /><span>Copy</span></>}
        </button>
      </div>
      <SyntaxHighlighter language={language || 'text'} style={oneDark}
        customStyle={{ margin: 0, borderRadius: 0, background: 'rgba(9,9,11,0.92)', fontSize: '0.8rem', lineHeight: '1.65' }}
        showLineNumbers={lines > 5}>
        {children}
      </SyntaxHighlighter>
    </div>
  );
});
