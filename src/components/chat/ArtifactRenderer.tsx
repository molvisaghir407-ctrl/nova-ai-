'use client';

import { useState } from 'react';
import { Copy, Check, Download, FileCode, FileText, Table, BarChart3, Globe } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { ArtifactData } from '@/types/nova.types';

interface ArtifactRendererProps {
  artifact: ArtifactData;
}

export function ArtifactRenderer({ artifact }: ArtifactRendererProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = artifact.fileName || `artifact.${artifact.language || 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getIcon = () => {
    switch (artifact.type) {
      case 'code': return <FileCode className="w-4 h-4 text-violet-400" />;
      case 'table': return <Table className="w-4 h-4 text-violet-400" />;
      case 'chart': return <BarChart3 className="w-4 h-4 text-violet-400" />;
      case 'html': return <Globe className="w-4 h-4 text-violet-400" />;
      default: return <FileText className="w-4 h-4 text-violet-400" />;
    }
  };

  return (
    <div className="artifact-card my-3">
      <div className="artifact-header">
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className="text-sm font-medium text-zinc-200">{artifact.title}</span>
          {artifact.language && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
              {artifact.language}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
            title="Copy"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
            title="Download"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>
      </div>
      <div className="artifact-body">
        {artifact.type === 'code' && artifact.language ? (
          <SyntaxHighlighter
            language={artifact.language}
            style={vscDarkPlus}
            customStyle={{ margin: 0, borderRadius: 8, fontSize: 13 }}
            showLineNumbers
          >
            {artifact.content}
          </SyntaxHighlighter>
        ) : artifact.type === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-zinc-300">
              <tbody dangerouslySetInnerHTML={{ __html: artifact.content }} />
            </table>
          </div>
        ) : (
          <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono">{artifact.content}</pre>
        )}
      </div>
    </div>
  );
}

export function ArtifactGallery({ artifacts }: { artifacts: ArtifactData[] }) {
  if (!artifacts.length) return null;
  return (
    <div className="artifact-gallery">
      {artifacts.map((artifact) => (
        <div key={artifact.id} className="w-[400px] max-w-[85vw]">
          <ArtifactRenderer artifact={artifact} />
        </div>
      ))}
    </div>
  );
}
