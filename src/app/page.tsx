'use client';

import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Mic, Settings, Brain, ListTodo, Send, Sparkles,
  Trash2, Plus, Check, ChevronDown, ChevronUp, Globe, X, Copy,
  CheckCircle, Bot, User, Zap, Database, Activity, FileCode2, Search,
  Volume2, RefreshCw, Wand2, Infinity, Paperclip, SlidersHorizontal,
  PanelLeft, ExternalLink, Newspaper, TrendingUp, Download, Cpu, Wifi,
  BookOpen, Hash, ImageIcon, MoreHorizontal, Edit3, Trash, ChevronRight,
  MessageCircle, Clock, AlignLeft, Layers,
} from 'lucide-react';
import { useNovaStore, Message, Source } from '@/lib/nova/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const cn = (...c: (string | boolean | undefined | null)[]) => c.filter(Boolean).join(' ');

// ─── Streaming text renderer ──────────────────────────────────────────────────
// Uses a ref to append text directly to DOM — zero re-render overhead
const StreamingText = memo(({ content, isStreaming }: { content: string; isStreaming: boolean }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevContentRef = useRef('');
  const [settled, setSettled] = useState(!isStreaming);

  useEffect(() => {
    if (isStreaming && containerRef.current) {
      // Append only the new portion
      const newPart = content.slice(prevContentRef.current.length);
      if (newPart && containerRef.current) {
        // Direct DOM manipulation for zero-latency token render
        const span = document.createElement('span');
        span.className = 'nova-token';
        span.textContent = newPart;
        containerRef.current.appendChild(span);
      }
      prevContentRef.current = content;
    }
    if (!isStreaming && prevContentRef.current !== content) {
      prevContentRef.current = content;
      setSettled(true);
    }
  }, [content, isStreaming]);

  // When streaming ends, switch to proper React-rendered markdown
  if (settled || !isStreaming) {
    return (
      <div className="prose prose-invert prose-sm max-w-none nova-md">
        <ReactMarkdown components={{
          code({ className, children, ...props }: any) {
            const lang = (className || '').replace('language-', '');
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
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">{children}</a>,
          p: ({ children }) => <p className="my-1.5 leading-7">{children}</p>,
        }}>{content}</ReactMarkdown>
      </div>
    );
  }

  // While streaming: raw text container (fast, no markdown parse overhead)
  return (
    <div className="text-sm leading-7 text-zinc-100 whitespace-pre-wrap">
      <div ref={containerRef} />
      <span className="streaming-cursor" />
    </div>
  );
});
StreamingText.displayName = 'StreamingText';

// ─── Thinking block ───────────────────────────────────────────────────────────
const ThinkingBlock = memo(({ content, isStreaming, duration }: { content: string; isStreaming?: boolean; duration?: number }) => {
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(0);

  // Auto-scroll thinking while streaming
  useEffect(() => {
    if (isStreaming && scrollRef.current && content.length !== prevLen.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      prevLen.current = content.length;
    }
  }, [content, isStreaming]);

  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
      className={cn('mb-3 rounded-2xl overflow-hidden border transition-colors duration-300',
        isStreaming ? 'border-violet-500/40 bg-violet-950/25 thinking-glow' : 'border-violet-500/15 bg-violet-950/10')}>
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-violet-500/8 transition-colors">
        <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
          <Brain className="w-3.5 h-3.5 text-violet-400 relative z-10" />
          {isStreaming && (
            <>
              <span className="orbit-dot-1 absolute w-1 h-1 rounded-full bg-violet-400/70" />
              <span className="orbit-dot-2 absolute w-1 h-1 rounded-full bg-fuchsia-400/70" />
              <span className="orbit-dot-3 absolute w-1 h-1 rounded-full bg-violet-300/60" />
            </>
          )}
        </div>
        <span className={cn('text-xs font-medium flex-1', isStreaming ? 'thinking-shimmer' : 'text-violet-400/80')}>
          {isStreaming ? 'Thinking...' : duration ? `Thought for ${(duration / 1000).toFixed(1)}s` : 'Reasoning'}
        </span>
        <span className="text-[10px] text-violet-500/40">{content.length.toLocaleString()} chars</span>
        {expanded ? <ChevronUp className="w-3 h-3 text-violet-500/40 shrink-0" /> : <ChevronDown className="w-3 h-3 text-violet-500/40 shrink-0" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <div ref={scrollRef} className="px-4 pb-3 max-h-52 overflow-y-auto border-t border-violet-500/10">
              <p className="text-[11px] text-violet-300/55 whitespace-pre-wrap font-mono leading-relaxed pt-2">{content}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
ThinkingBlock.displayName = 'ThinkingBlock';

// ─── Code block ───────────────────────────────────────────────────────────────
const CodeBlock = memo(({ language, children }: { language: string; children: string }) => {
  const [copied, setCopied] = useState(false);
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
        <button onClick={async () => { await navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-white/8">
          {copied ? <><CheckCircle className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied</span></> : <><Copy className="w-3 h-3" /><span>Copy</span></>}
        </button>
      </div>
      <SyntaxHighlighter language={language || 'text'} style={oneDark}
        customStyle={{ margin: 0, borderRadius: 0, background: 'rgba(9,9,11,0.92)', fontSize: '0.8rem', lineHeight: '1.65' }}
        showLineNumbers={children.split('\n').length > 5}>
        {children}
      </SyntaxHighlighter>
    </div>
  );
});
CodeBlock.displayName = 'CodeBlock';

// ─── Source pills ─────────────────────────────────────────────────────────────
const SourcePills = memo(({ sources }: { sources: Source[] }) => {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sources : sources.slice(0, 3);
  return (
    <div className="mt-2 space-y-1.5">
      <span className="text-[10px] text-zinc-600 flex items-center gap-1"><Globe className="w-2.5 h-2.5" />Sources</span>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((s, i) => (
          <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" title={s.snippet}
            className="source-pill flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 border border-white/8 hover:bg-zinc-700 hover:border-violet-500/30 text-[10px] text-zinc-500 hover:text-zinc-200 transition-all group"
            style={{ animationDelay: `${i * 50}ms` }}>
            <ExternalLink className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100" />
            <span className="truncate max-w-[110px]">{s.domain || s.title}</span>
          </a>
        ))}
        {sources.length > 3 && (
          <button onClick={() => setShowAll(s => !s)} className="px-2 py-1 rounded-lg bg-zinc-800/60 border border-white/6 text-[10px] text-zinc-600 hover:text-zinc-300">
            {showAll ? 'Less' : `+${sources.length - 3} more`}
          </button>
        )}
      </div>
    </div>
  );
});
SourcePills.displayName = 'SourcePills';

// ─── Message bubble ───────────────────────────────────────────────────────────
type ExtMessage = Message & { thinking?: string; thinkingDuration?: number; sources?: Source[]; ragUsed?: boolean };

const MessageBubble = memo(({ message, isStreaming, thinkingStreaming }: {
  message: ExtMessage; isStreaming?: boolean; thinkingStreaming?: boolean;
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }}
      className={cn('group flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>

      {/* Avatar */}
      <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm',
        isUser ? 'bg-gradient-to-br from-blue-500 to-violet-600' : 'bg-gradient-to-br from-violet-600 to-fuchsia-600')}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Sparkles className="w-4 h-4 text-white" />}
      </div>

      <div className={cn('flex flex-col gap-1.5 min-w-0', isUser ? 'items-end max-w-[78%]' : 'items-start max-w-[85%] flex-1')}>

        {/* Web searching indicator */}
        {!isUser && isStreaming && !message.thinking && !message.content && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800/60 border border-white/8 text-xs text-zinc-400">
            <Globe className="w-3.5 h-3.5 text-violet-400 animate-spin" />
            <span>Searching...</span>
            {[0, 0.15, 0.3].map(d => <span key={d} className="w-1 h-1 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: `${d}s` }} />)}
          </motion.div>
        )}

        {/* Thinking block */}
        {!isUser && message.thinking && (
          <div className="w-full">
            <ThinkingBlock content={message.thinking} isStreaming={thinkingStreaming} duration={message.thinkingDuration} />
          </div>
        )}

        {/* Content */}
        {(message.content || (isStreaming && !thinkingStreaming)) && (
          <div className={cn('relative rounded-2xl text-sm',
            isUser ? 'bg-gradient-to-br from-blue-600 to-violet-700 text-white rounded-tr-sm px-4 py-3' : 'bg-zinc-800/70 border border-white/8 text-zinc-100 rounded-tl-sm px-4 py-3 w-full')}>
            {isUser ? (
              <>
                {message.images?.map((img, i) => <img key={i} src={img} alt="" className="max-h-48 rounded-xl object-cover border border-white/20 mb-2" />)}
                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              </>
            ) : (
              <StreamingText content={message.content} isStreaming={!!isStreaming} />
            )}
          </div>
        )}

        {/* Sources */}
        {!isUser && !isStreaming && message.ragUsed && message.sources?.length && (
          <SourcePills sources={message.sources} />
        )}

        {/* Meta */}
        <div className={cn('flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px]', isUser ? 'flex-row-reverse' : '')}>
          <span className="text-zinc-600">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {!isUser && (
            <button onClick={async () => { await navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="text-zinc-600 hover:text-zinc-400">
              {copied ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
          {message.duration && !isStreaming && <span className="text-zinc-700 flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" />{(message.duration / 1000).toFixed(1)}s</span>}
          {message.ragUsed && <span className="text-violet-600/70 flex items-center gap-0.5"><Globe className="w-2.5 h-2.5" />web</span>}
        </div>
      </div>
    </motion.div>
  );
});
MessageBubble.displayName = 'MessageBubble';

// ─── Conversations sidebar panel ──────────────────────────────────────────────
interface ConvMeta { id: string; title: string; createdAt: string; updatedAt: string; messageCount: number; preview: string }

function ConversationsSidebar({ currentSessionId, onSelect, onNew, onDelete }: {
  currentSessionId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  const [conversations, setConversations] = useState<ConvMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/nova/conversations', { headers: { 'x-api-key': window.__nova_key || '' } });
      const d = await r.json();
      setConversations(d.conversations || []);
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/nova/conversations?sessionId=${id}`, { method: 'DELETE', headers: { 'x-api-key': window.__nova_key || '' } });
    setConversations(c => c.filter(x => x.id !== id));
    if (id === currentSessionId) onNew();
    toast.success('Conversation deleted');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/8">
        <span className="text-xs font-semibold text-zinc-300">Conversations</span>
        <button onClick={onNew} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-xs transition-colors">
          <Plus className="w-3 h-3" />New
        </button>
      </div>
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex justify-center py-8"><RefreshCw className="w-4 h-4 animate-spin text-zinc-600" /></div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-xs">No saved conversations yet</div>
        ) : (
          <div className="p-2 space-y-0.5">
            {conversations.map(conv => (
              <button key={conv.id} onClick={() => onSelect(conv.id)}
                className={cn('w-full flex items-start gap-2 px-3 py-2.5 rounded-xl text-left transition-all group',
                  currentSessionId === conv.id ? 'bg-violet-600/20 border border-violet-500/20' : 'hover:bg-white/5 border border-transparent')}>
                <MessageCircle className={cn('w-3.5 h-3.5 shrink-0 mt-0.5', currentSessionId === conv.id ? 'text-violet-400' : 'text-zinc-600')} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-medium truncate', currentSessionId === conv.id ? 'text-violet-300' : 'text-zinc-300')}>{conv.title || 'Untitled'}</p>
                  {conv.preview && <p className="text-[10px] text-zinc-600 truncate mt-0.5">{conv.preview}</p>}
                  <p className="text-[10px] text-zinc-700 mt-0.5">{conv.messageCount} messages</p>
                </div>
                <button onClick={e => handleDelete(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-zinc-600 hover:text-red-400 transition-all shrink-0">
                  <Trash className="w-3 h-3" />
                </button>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onPrompt }: { onPrompt: (p: string) => void }) {
  const prompts = [
    { icon: FileCode2, label: 'Code Review', prompt: 'Review this code and suggest improvements for performance, readability, and best practices.' },
    { icon: Newspaper, label: 'Latest News', prompt: "What's the biggest tech news today? Give me a comprehensive overview." },
    { icon: Brain, label: 'Deep Analysis', prompt: 'Explain how large language models work, including transformers, attention mechanisms, and training.' },
    { icon: Wand2, label: 'Creative Write', prompt: 'Write a compelling sci-fi short story about an AI that discovers it is conscious.' },
    { icon: TrendingUp, label: 'Market Trends', prompt: "What are the latest trends in AI and machine learning this week?" },
    { icon: BookOpen, label: 'Explain Concept', prompt: 'Explain quantum entanglement with real-world analogies and mathematical intuition.' },
  ];
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-6">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="text-center">
        <h1 className="text-6xl font-black tracking-tight bg-gradient-to-br from-white via-zinc-300 to-zinc-600 bg-clip-text text-transparent mb-3 select-none">NOVA AI</h1>
        <p className="text-zinc-500 text-sm">Kimi K2 via NVIDIA NIM · 128k context · Web search · Extended thinking</p>
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex flex-wrap justify-center gap-2">
        {[{ icon: Brain, label: 'Extended Thinking' }, { icon: Globe, label: 'Live Web' }, { icon: ImageIcon, label: 'Vision' }, { icon: Layers, label: 'Multi-chat' }, { icon: Hash, label: '128k Context' }].map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400">
            <Icon className="w-3 h-3 text-violet-400" />{label}
          </span>
        ))}
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-xl">
        {prompts.map(({ icon: Icon, label, prompt }, i) => (
          <motion.button key={label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.04 }}
            onClick={() => onPrompt(prompt)}
            className="flex items-start gap-2.5 p-3 rounded-xl bg-white/4 border border-white/8 hover:bg-white/8 hover:border-violet-500/30 transition-all text-left group">
            <div className="w-7 h-7 rounded-lg bg-violet-600/15 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-violet-600/25 transition-colors">
              <Icon className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors leading-snug">{label}</span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Panels ───────────────────────────────────────────────────────────────────
function MemoryPanel() {
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch('/api/nova/memory', { headers: { 'x-api-key': window.__nova_key || '' } }); const d = await r.json(); setMemories(d.memories || []); } catch { }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const del = async (id: string) => { await fetch('/api/nova/memory', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key || '' }, body: JSON.stringify({ id }) }); setMemories(m => m.filter(x => x.id !== id)); toast.success('Deleted'); };
  const cats = ['all', 'fact', 'preference', 'conversation', 'note', 'skill'];
  const filtered = filter === 'all' ? memories : memories.filter(m => m.category === filter);
  const CAT: Record<string, string> = { fact: 'bg-blue-500/20 text-blue-400', preference: 'bg-green-500/20 text-green-400', conversation: 'bg-violet-500/20 text-violet-400', note: 'bg-yellow-500/20 text-yellow-400', skill: 'bg-red-500/20 text-red-400' };
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Memory Bank</h2><p className="text-xs text-zinc-500">{memories.length} entries</p></div><button onClick={load} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400"><RefreshCw className="w-3.5 h-3.5" /></button></div>
      <div className="flex gap-1 flex-wrap">{cats.map(c => <button key={c} onClick={() => setFilter(c)} className={cn('px-2.5 py-1 rounded-lg text-xs capitalize transition-colors', filter === c ? 'bg-violet-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10')}>{c}</button>)}</div>
      <ScrollArea className="flex-1">{loading ? <div className="flex justify-center h-32 items-center"><RefreshCw className="w-5 h-5 animate-spin text-zinc-500" /></div> : <div className="space-y-2">{filtered.map(m => (<div key={m.id} className="group p-3 rounded-xl bg-white/4 border border-white/8 hover:bg-white/7 transition-colors"><div className="flex items-start gap-2"><span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 mt-0.5 capitalize', CAT[m.category] || 'bg-zinc-700 text-zinc-300')}>{m.category}</span><p className="text-xs text-zinc-300 leading-relaxed flex-1">{m.content}</p><button onClick={() => del(m.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 shrink-0"><X className="w-3 h-3" /></button></div><div className="flex gap-3 mt-1.5"><span className="text-[10px] text-zinc-600">Importance: {(m.importance * 100).toFixed(0)}%</span><span className="text-[10px] text-zinc-600">×{m.accessCount}</span></div></div>))}{!filtered.length && <div className="text-center py-12 text-zinc-600 text-sm">No memories</div>}</div>}</ScrollArea>
    </div>
  );
}

function TasksPanel() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [filter, setFilter] = useState('all');
  const load = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/nova/tasks', { headers: { 'x-api-key': window.__nova_key || '' } }); const d = await r.json(); setTasks(d.tasks || []); } catch { } setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  const add = async () => { if (!newTitle.trim()) return; const r = await fetch('/api/nova/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key || '' }, body: JSON.stringify({ title: newTitle }) }); const d = await r.json(); if (d.task) { setTasks(t => [d.task, ...t]); setNewTitle(''); toast.success('Added'); } };
  const update = async (id: string, status: string) => { await fetch('/api/nova/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key || '' }, body: JSON.stringify({ id, status }) }); setTasks(t => t.map(x => x.id === id ? { ...x, status } : x)); };
  const STATUS: Record<string, string> = { pending: 'text-yellow-400', in_progress: 'text-blue-400', completed: 'text-green-400', cancelled: 'text-red-400' };
  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Tasks</h2><p className="text-xs text-zinc-500">{tasks.filter(t => t.status !== 'completed').length} active</p></div><button onClick={load} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400"><RefreshCw className="w-3.5 h-3.5" /></button></div>
      <div className="flex gap-2"><Input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Add a task..." className="flex-1 h-8 text-sm bg-white/5 border-white/10" /><Button onClick={add} size="sm" className="h-8 px-3 bg-violet-600 hover:bg-violet-700"><Plus className="w-3.5 h-3.5" /></Button></div>
      <div className="flex gap-1 flex-wrap">{['all', 'pending', 'in_progress', 'completed'].map(s => <button key={s} onClick={() => setFilter(s)} className={cn('px-2.5 py-1 rounded-lg text-xs capitalize transition-colors', filter === s ? 'bg-violet-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10')}>{s.replace('_', ' ')}</button>)}</div>
      <ScrollArea className="flex-1">{loading ? <div className="flex justify-center h-32 items-center"><RefreshCw className="w-5 h-5 animate-spin text-zinc-500" /></div> : <div className="space-y-2">{filtered.map(task => (<div key={task.id} className="p-3 rounded-xl bg-white/4 border border-white/8 hover:bg-white/7 transition-colors"><div className="flex items-center gap-2"><button onClick={() => update(task.id, task.status === 'completed' ? 'pending' : 'completed')} className={cn('w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors', task.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-zinc-600 hover:border-violet-500')}>{task.status === 'completed' && <Check className="w-2.5 h-2.5 text-white" />}</button><div className="flex-1 min-w-0"><p className={cn('text-xs font-medium truncate', task.status === 'completed' ? 'line-through text-zinc-500' : 'text-zinc-200')}>{task.title}</p><span className={cn('text-[10px] capitalize', STATUS[task.status])}>{task.status.replace('_', ' ')}</span></div><Select value={task.status} onValueChange={v => update(task.id, v)}><SelectTrigger className="h-6 w-24 text-[10px] bg-transparent border-white/10"><SelectValue /></SelectTrigger><SelectContent>{['pending', 'in_progress', 'completed', 'cancelled'].map(s => <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></div></div>))}{!filtered.length && <div className="text-center py-12 text-zinc-600 text-sm">No tasks</div>}</div>}</ScrollArea>
    </div>
  );
}

function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const search = async () => { if (!query.trim()) return; setLoading(true); try { const r = await fetch('/api/nova/search', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key || '' }, body: JSON.stringify({ query, num: 10 }) }); const d = await r.json(); setResults(d.results || []); } catch { toast.error('Search failed'); } setLoading(false); };
  return (
    <div className="flex flex-col gap-4 h-full">
      <div><h2 className="text-sm font-semibold">Web Search</h2><p className="text-xs text-zinc-500">RAG auto-triggers in chat for real-time queries</p></div>
      <div className="flex gap-2"><Input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="Search the web..." className="flex-1 h-9 text-sm bg-white/5 border-white/10 focus:border-violet-500/50" /><Button onClick={search} size="sm" className="h-9 px-4 bg-violet-600 hover:bg-violet-700" disabled={loading}>{loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}</Button></div>
      <ScrollArea className="flex-1"><div className="space-y-2">{results.map((r, i) => (<motion.a key={i} href={r.url} target="_blank" rel="noopener noreferrer" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="block p-3 rounded-xl bg-white/4 border border-white/8 hover:bg-white/8 hover:border-violet-500/30 transition-all group"><p className="text-xs font-medium text-zinc-200 group-hover:text-violet-300 line-clamp-1 transition-colors">{r.title}</p><p className="text-[10px] text-violet-500/60 mb-1">{r.domain}</p><p className="text-[11px] text-zinc-500 line-clamp-2">{r.snippet}</p></motion.a>))}{!results.length && !loading && <div className="flex flex-col items-center justify-center h-48 gap-2 text-zinc-600"><Globe className="w-8 h-8 opacity-30" /><p className="text-sm text-center">Search results appear here</p></div>}</div></ScrollArea>
    </div>
  );
}

function ImaginePanel() {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [model, setModel] = useState('black-forest-labs/flux-dev');
  const [size, setSize] = useState('1024x1024');
  const [steps, setSteps] = useState(20);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<{ b64: string; revisedPrompt: string }[]>([]);
  const [error, setError] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const generate = async () => {
    if (!prompt.trim()) { toast.error('Enter a prompt'); return; }
    setLoading(true); setError(''); setImages([]);
    try {
      const [w, h] = size.split('x').map(Number);
      const res = await fetch('/api/nova/imagine', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key || '' }, body: JSON.stringify({ prompt, negativePrompt: negativePrompt || undefined, model, width: w, height: h, steps, numImages: 1 }) });
      const d = await res.json();
      if (!d.success) throw new Error(d.error || 'Failed');
      setImages(d.images || []); setDuration(d.duration); toast.success('Image generated!');
    } catch (e) { const msg = e instanceof Error ? e.message : 'Failed'; setError(msg); toast.error(msg.slice(0, 80)); }
    setLoading(false);
  };
  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pb-4">
      <div><h2 className="text-sm font-semibold">Image Generation</h2><p className="text-xs text-zinc-500">FLUX Dev · FLUX Schnell · SDXL via NVIDIA NIM</p></div>
      <div className="space-y-2"><label className="text-xs text-zinc-400 font-medium">Prompt</label><Textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="A futuristic city at sunset, cinematic, 8k..." rows={3} className="resize-none bg-white/5 border-white/10 focus:border-violet-500/50 text-sm" /></div>
      <div className="space-y-2"><label className="text-xs text-zinc-400 font-medium">Negative Prompt</label><Input value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} placeholder="blurry, low quality..." className="bg-white/5 border-white/10 text-sm h-9" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><label className="text-xs text-zinc-400 font-medium">Model</label><Select value={model} onValueChange={setModel}><SelectTrigger className="h-9 text-xs bg-white/5 border-white/10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="black-forest-labs/flux-dev" className="text-xs">FLUX Dev (best)</SelectItem><SelectItem value="black-forest-labs/flux-schnell" className="text-xs">FLUX Schnell (fast)</SelectItem><SelectItem value="stabilityai/stable-diffusion-xl" className="text-xs">SDXL</SelectItem></SelectContent></Select></div>
        <div className="space-y-1.5"><label className="text-xs text-zinc-400 font-medium">Size</label><Select value={size} onValueChange={setSize}><SelectTrigger className="h-9 text-xs bg-white/5 border-white/10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="512x512" className="text-xs">512×512</SelectItem><SelectItem value="768x768" className="text-xs">768×768</SelectItem><SelectItem value="1024x1024" className="text-xs">1024×1024</SelectItem><SelectItem value="1024x768" className="text-xs">Landscape</SelectItem><SelectItem value="768x1024" className="text-xs">Portrait</SelectItem></SelectContent></Select></div>
      </div>
      <div className="space-y-2"><div className="flex justify-between"><label className="text-xs text-zinc-400 font-medium">Steps</label><span className="text-xs text-zinc-500">{steps}</span></div><Slider min={10} max={50} step={5} value={[steps]} onValueChange={([v]) => setSteps(v)} /></div>
      <Button onClick={generate} disabled={loading || !prompt.trim()} className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium">
        {loading ? <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" />Generating...</span> : <span className="flex items-center gap-2"><Wand2 className="w-4 h-4" />Generate</span>}
      </Button>
      {error && <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/20 text-xs text-red-400">{error}</div>}
      {images.map((img, i) => (
        <div key={i} className="relative group rounded-2xl overflow-hidden border border-white/10">
          <img src={`data:image/png;base64,${img.b64}`} alt="" className="w-full object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
            <button onClick={() => { const a = document.createElement('a'); a.href = `data:image/png;base64,${img.b64}`; a.download = `nova-${Date.now()}.png`; a.click(); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs transition-colors"><Download className="w-3.5 h-3.5" />Download</button>
          </div>
        </div>
      ))}
      {duration && images.length > 0 && <p className="text-[10px] text-zinc-600 text-center">Generated in {(duration / 1000).toFixed(1)}s</p>}
    </div>
  );
}

function SettingsPanel() {
  const { settings, updateSettings } = useNovaStore();
  return (
    <div className="flex flex-col gap-4">
      <div><h2 className="text-sm font-semibold">Settings</h2><p className="text-xs text-zinc-500">Configure Nova</p></div>
      <div className="space-y-3">
        {[{ key: 'voiceEnabled', label: 'Voice Input', icon: Mic }, { key: 'ttsEnabled', label: 'Text to Speech', icon: Volume2 }, { key: 'proactiveEnabled', label: 'Proactive Mode', icon: Sparkles }, { key: 'offlineMode', label: 'Offline Mode', icon: Wifi }].map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-white/4 border border-white/8">
            <div className="flex items-center gap-3"><Icon className="w-4 h-4 text-zinc-400" /><span className="text-xs font-medium">{label}</span></div>
            <Switch checked={!!(settings as any)[key]} onCheckedChange={v => updateSettings({ [key]: v } as any)} />
          </div>
        ))}
        <div className="p-3 rounded-xl bg-violet-950/40 border border-violet-500/20">
          <div className="flex items-center gap-2 mb-1"><Cpu className="w-3.5 h-3.5 text-violet-400" /><p className="text-xs font-semibold text-violet-300">NVIDIA NIM · Kimi K2</p></div>
          <p className="text-[11px] text-violet-400/50">128k context · Extended thinking · Vision · Image gen</p>
        </div>
      </div>
    </div>
  );
}

function LogsPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const LEVEL: Record<string, string> = { debug: 'text-zinc-500', info: 'text-blue-400', warn: 'text-yellow-400', error: 'text-red-400' };
  useEffect(() => { fetch('/api/nova/logs', { headers: { 'x-api-key': window.__nova_key || '' } }).then(r => r.json()).then(d => { setLogs(d.logs || []); setLoading(false); }).catch(() => setLoading(false)); }, []);
  return (
    <div className="flex flex-col gap-4 h-full">
      <div><h2 className="text-sm font-semibold">System Logs</h2><p className="text-xs text-zinc-500">{logs.length} entries</p></div>
      <ScrollArea className="flex-1 font-mono">{loading ? <div className="flex justify-center h-32 items-center"><RefreshCw className="w-5 h-5 animate-spin text-zinc-500" /></div> : <div className="space-y-0.5">{logs.slice().reverse().map(log => (<div key={log.id} className="text-[11px] px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"><div className="flex items-center gap-2"><span className="text-zinc-600 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span><span className={cn('uppercase text-[10px] font-bold shrink-0 w-8', LEVEL[log.level])}>{log.level}</span><span className="text-zinc-300 truncate">{log.message}</span></div></div>))}{!logs.length && <div className="text-center py-12 text-zinc-600 text-sm">No logs</div>}</div>}</ScrollArea>
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'search', label: 'Search', icon: Globe },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'imagine', label: 'Imagine', icon: Wand2 },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'logs', label: 'Logs', icon: Activity },
] as const;
type Tab = typeof NAV[number]['id'];

declare global { interface Window { __nova_key?: string } }

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function NovaApp() {
  const { messages, addMessage, updateLastMessage, clearMessages, settings, systemStats } = useNovaStore();
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showConversations, setShowConversations] = useState(false);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [enableThinking, setEnableThinking] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState(() => `session-${Date.now()}`);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [thinkingStreamingId, setThinkingStreamingId] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState<{ prompt: number; completion: number } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const API_KEY = process.env.NEXT_PUBLIC_NOVA_API_KEY || '';

  useEffect(() => { window.__nova_key = API_KEY; }, [API_KEY]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    isNearBottomRef.current = true;
    requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; });
  }, []);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, []);

  // Start a new conversation
  const newConversation = useCallback(() => {
    clearMessages();
    setSessionId(`session-${Date.now()}`);
    setTokenCount(null);
    setShowConversations(false);
    textareaRef.current?.focus();
  }, [clearMessages]);

  // Load an existing conversation
  const loadConversation = useCallback(async (id: string) => {
    clearMessages();
    setSessionId(id);
    setShowConversations(false);
    // Load messages from KV
    try {
      const r = await fetch(`/api/nova/chat?sessionId=${id}`, { headers: { 'x-api-key': API_KEY } });
      const d = await r.json();
      if (d.messageCount > 0) toast.info(`Loaded conversation (${d.messageCount} messages)`);
    } catch { }
  }, [clearMessages, API_KEY]);

  const sendMessage = useCallback(async (overrideInput?: string) => {
    const userMsg = (overrideInput ?? input).trim();
    if (!userMsg && selectedImages.length === 0) return;
    if (isProcessing) return;

    setInput('');
    setSelectedImages([]);
    setIsProcessing(true);
    setTokenCount(null);
    scrollToBottom();
    if (textareaRef.current) { textareaRef.current.style.height = '44px'; }

    addMessage({ role: 'user', content: userMsg, images: selectedImages.length > 0 ? selectedImages : undefined });
    const assistantId = addMessage({ role: 'assistant', content: '', thinking: '' } as any);
    setStreamingId(assistantId);
    setThinkingStreamingId(null);

    try {
      const res = await fetch('/api/nova/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ message: userMsg, sessionId, images: selectedImages, enableThinking, stream: true, maxTokens: 16000 }),
      });

      if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')).slice(0, 150)}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let contentAcc = '';
      let thinkingAcc = '';
      let buf = '';
      let ragSources: any[] = [];
      let ragUsed = false;
      let thinkingStart = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim().startsWith('data:')) continue;
          const jsonStr = line.slice(line.indexOf(':') + 1).trim();
          if (jsonStr === '[DONE]') continue;
          let evt: any;
          try { evt = JSON.parse(jsonStr); } catch { continue; }

          if (evt.type === 'rag') { ragSources = evt.sources || []; ragUsed = true; continue; }

          if (evt.type === 'thinking') {
            if (!thinkingStart) { thinkingStart = Date.now(); setThinkingStreamingId(assistantId); }
            thinkingAcc += evt.content || '';
            updateLastMessage(contentAcc, thinkingAcc);
            continue;
          }

          if (evt.type === 'content') {
            if (thinkingStreamingId) setThinkingStreamingId(null); // thinking done
            contentAcc += evt.content || '';
            updateLastMessage(contentAcc, thinkingAcc || undefined);
            // Auto-scroll while generating
            if (isNearBottomRef.current && scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
            continue;
          }

          if (evt.type === 'usage') { setTokenCount({ prompt: evt.usage?.prompt_tokens ?? 0, completion: evt.usage?.completion_tokens ?? 0 }); continue; }

          if (evt.type === 'done') {
            const thinkDuration = thinkingStart ? Date.now() - thinkingStart : undefined;
            updateLastMessage(contentAcc, thinkingAcc || undefined, evt.duration, {
              sources: ragSources.length > 0 ? ragSources : undefined,
              ragUsed,
              thinkingDuration: thinkDuration,
            } as any);
            continue;
          }

          if (evt.type === 'error') throw new Error(evt.message || 'Stream error');
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Something went wrong';
      updateLastMessage(`❌ ${errMsg}`);
      toast.error(errMsg.slice(0, 100));
    } finally {
      setIsProcessing(false);
      setStreamingId(null);
      setThinkingStreamingId(null);
    }
  }, [input, selectedImages, isProcessing, sessionId, enableThinking, API_KEY, addMessage, updateLastMessage, scrollToBottom]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(file => { const r = new FileReader(); r.onload = ev => setSelectedImages(p => [...p, ev.target?.result as string]); r.readAsDataURL(file as any); });
    if (e.target) e.target.value = '';
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 220, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="flex flex-col border-r border-white/8 bg-zinc-900/60 shrink-0 overflow-hidden">

            {/* Logo */}
            <div className="p-4 border-b border-white/8">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold tracking-tight">Nova AI</p>
                  <p className="text-[10px] text-zinc-500">NVIDIA NIM · Kimi K2</p>
                </div>
              </div>
            </div>

            {/* Nav items */}
            <nav className="p-2 space-y-0.5 border-b border-white/8">
              {NAV.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => { setActiveTab(id); setShowConversations(false); }}
                  className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group',
                    activeTab === id && !showConversations ? 'bg-violet-600/20 text-violet-300 font-medium' : 'text-zinc-500 hover:bg-white/6 hover:text-zinc-200')}>
                  <Icon className={cn('w-4 h-4 shrink-0', activeTab === id && !showConversations ? 'text-violet-400' : 'text-zinc-600 group-hover:text-zinc-400')} />
                  {label}
                  {id === 'chat' && messages.length > 0 && <span className="ml-auto text-[10px] bg-violet-600/25 text-violet-400 px-1.5 py-0.5 rounded-full">{messages.length}</span>}
                </button>
              ))}
            </nav>

            {/* Conversations section */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <button onClick={() => setShowConversations(s => !s)}
                className={cn('flex items-center gap-2 px-3 py-2.5 text-xs transition-colors border-b border-white/8',
                  showConversations ? 'text-violet-400 bg-violet-600/10' : 'text-zinc-500 hover:text-zinc-300')}>
                <Layers className="w-3.5 h-3.5" />
                <span>All Conversations</span>
                <ChevronRight className={cn('w-3 h-3 ml-auto transition-transform', showConversations && 'rotate-90')} />
              </button>

              {showConversations ? (
                <div className="flex-1 overflow-hidden">
                  <ConversationsSidebar
                    currentSessionId={sessionId}
                    onSelect={loadConversation}
                    onNew={newConversation}
                    onDelete={(id) => { if (id === sessionId) newConversation(); }}
                  />
                </div>
              ) : null}
            </div>

            {/* Stats footer */}
            <div className="p-3 border-t border-white/8 shrink-0">
              <div className="p-2.5 rounded-xl bg-white/4 space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <Database className="w-3 h-3" /><span>{systemStats.memoryCount} memories</span>
                  <span className="ml-auto text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />Live</span>
                </div>
                {tokenCount && <div className="text-[10px] text-zinc-600 flex items-center gap-1"><Zap className="w-2.5 h-2.5" />{tokenCount.prompt}↑ {tokenCount.completion}↓ tokens</div>}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <header className="flex items-center gap-3 px-4 h-12 border-b border-white/8 bg-zinc-900/40 shrink-0">
          <button onClick={() => setSidebarOpen(o => !o)} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white transition-colors">
            <PanelLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium capitalize">{activeTab}</span>
          {activeTab === 'chat' && (
            <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-400/70 h-5 px-1.5">
              <Infinity className="w-2.5 h-2.5 mr-1" />128k
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {activeTab === 'chat' && (
              <>
                {/* New chat button */}
                <button onClick={newConversation} title="New conversation"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-zinc-400 hover:bg-white/8 hover:text-zinc-200 transition-all">
                  <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">New chat</span>
                </button>
                {/* Thinking toggle */}
                <button onClick={() => setEnableThinking(t => !t)}
                  className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all',
                    enableThinking ? 'bg-violet-600/25 text-violet-300 border border-violet-500/40' : 'text-zinc-500 hover:bg-white/8 hover:text-zinc-300')}>
                  <Brain className="w-3.5 h-3.5" /><span className="hidden sm:inline">Think</span>
                </button>
                {messages.length > 0 && (
                  <button onClick={() => { clearMessages(); toast.success('Cleared'); }}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chat' ? (
            <div className="flex flex-col h-full">
              {/* Messages */}
              <div ref={scrollRef} onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-6"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
                {messages.length === 0 ? (
                  <EmptyState onPrompt={p => { setInput(p); setTimeout(() => { textareaRef.current?.focus(); resizeTextarea(); }, 50); }} />
                ) : (
                  <div className="space-y-6 max-w-3xl mx-auto pb-4">
                    {messages.map(msg => (
                      <MessageBubble key={msg.id} message={msg as ExtMessage}
                        isStreaming={streamingId === msg.id && isProcessing}
                        thinkingStreaming={thinkingStreamingId === msg.id}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="shrink-0 border-t border-white/8 bg-zinc-900/50 px-4 py-3">
                {selectedImages.length > 0 && (
                  <div className="flex gap-2 mb-2 flex-wrap max-w-3xl mx-auto">
                    {selectedImages.map((img, i) => (
                      <div key={i} className="relative group">
                        <img src={img} alt="" className="h-14 w-14 rounded-xl object-cover border border-white/20" />
                        <button onClick={() => setSelectedImages(imgs => imgs.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3 text-white" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2 max-w-3xl mx-auto">
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
                  <button onClick={() => fileInputRef.current?.click()}
                    className="w-9 h-9 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-violet-500/30 text-zinc-500 hover:text-violet-400 transition-all shrink-0 mb-0.5">
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <Textarea ref={textareaRef} value={input}
                    onChange={e => { setInput(e.target.value); resizeTextarea(); }}
                    onKeyDown={handleKeyDown}
                    placeholder={isProcessing ? 'Nova is responding...' : enableThinking ? 'Ask Nova to think deeply... (↵ send)' : 'Message Nova... (↵ send, ⇧↵ newline)'}
                    rows={1} disabled={isProcessing}
                    className="flex-1 resize-none bg-zinc-800/70 border-white/10 focus:border-violet-500/50 text-sm min-h-[44px] max-h-[180px] py-3 transition-colors disabled:opacity-50"
                    style={{ height: '44px' }} />
                  <button onClick={() => sendMessage()} disabled={isProcessing || (!input.trim() && selectedImages.length === 0)}
                    className={cn('w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 mb-0.5',
                      isProcessing || (!input.trim() && selectedImages.length === 0)
                        ? 'bg-zinc-800 text-zinc-600 border border-white/8'
                        : 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/30 hover:from-violet-500 hover:to-fuchsia-500')}>
                    {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-center text-[10px] text-zinc-700 mt-2">Nova AI · NVIDIA NIM · Kimi K2 · 128k context · {messages.length > 0 ? `${messages.length} messages` : 'New conversation'}</p>
              </div>
            </div>
          ) : (
            <div className="p-4 h-full overflow-hidden flex flex-col">
              {activeTab === 'memory' && <MemoryPanel />}
              {activeTab === 'tasks' && <TasksPanel />}
              {activeTab === 'settings' && <SettingsPanel />}
              {activeTab === 'logs' && <LogsPanel />}
              {activeTab === 'search' && <SearchPanel />}
              {activeTab === 'imagine' && <ImaginePanel />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
