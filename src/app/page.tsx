'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Mic, MicOff, Settings, Brain, ListTodo, Send, Sparkles,
  Trash2, Plus, Check, Clock, ChevronRight, ChevronDown, ChevronUp,
  Globe, X, Menu, ImageIcon, Copy, CheckCircle, RotateCcw, Lightbulb,
  Bot, User, Zap, Database, Activity, FileCode2, Search, Bookmark,
  Volume2, VolumeX, Download, Upload, Eye, EyeOff, Terminal, Cpu,
  MemoryStick, Wifi, Shield, Star, BookOpen, Layers, Hash, AtSign,
  ArrowRight, AlertCircle, Info, TrendingUp, Package, RefreshCw,
  SquareCode, Wand2, Infinity, LogOut, ChevronLeft, MoreHorizontal,
  Paperclip, Maximize2, Minimize2, SlidersHorizontal, PanelLeft,
  ExternalLink, Newspaper, Radio
} from 'lucide-react';
import { useNovaStore, Message } from '@/lib/nova/store';
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

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// ── Custom Cursor ──────────────────────────────────────────────────────────────
function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    let mouseX = 0, mouseY = 0, ringX = 0, ringY = 0, raf = 0;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX; mouseY = e.clientY;
      if (dotRef.current) dotRef.current.style.transform = `translate(${mouseX}px,${mouseY}px)`;
    };

    const animate = () => {
      ringX += (mouseX - ringX) * 0.14;
      ringY += (mouseY - ringY) * 0.14;
      if (ringRef.current) ringRef.current.style.transform = `translate(${ringX}px,${ringY}px)`;
      raf = requestAnimationFrame(animate);
    };

    const onOver = (e: MouseEvent) => {
      const t = e.target as Element;
      if (!ringRef.current) return;
      if (t.closest('button,a,[role="button"],input[type="submit"]')) {
        ringRef.current.setAttribute('data-hover', 'true');
        ringRef.current.removeAttribute('data-text');
      } else if (t.closest('input,textarea')) {
        ringRef.current.setAttribute('data-text', 'true');
        ringRef.current.removeAttribute('data-hover');
      } else {
        ringRef.current.removeAttribute('data-hover');
        ringRef.current.removeAttribute('data-text');
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseover', onOver);
    raf = requestAnimationFrame(animate);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  );
}

// ── Thinking Block ─────────────────────────────────────────────────────────────
function ThinkingBlock({ content, isStreaming, duration }: { content: string; isStreaming?: boolean; duration?: number }) {
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  const thinkSeconds = duration ? (duration / 1000).toFixed(1) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'mb-3 rounded-2xl overflow-hidden border transition-all',
        isStreaming
          ? 'border-violet-500/30 bg-violet-950/30 thinking-glow'
          : 'border-violet-500/15 bg-violet-950/15'
      )}>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-violet-500/10 transition-colors">

        {/* Icon area */}
        <div className="relative w-6 h-6 shrink-0 flex items-center justify-center">
          {isStreaming ? (
            <>
              <Brain className="w-3.5 h-3.5 text-violet-400 z-10 relative" />
              <span className="orbit-dot-1 absolute w-1.5 h-1.5 rounded-full bg-violet-400/60" />
              <span className="orbit-dot-2 absolute w-1.5 h-1.5 rounded-full bg-fuchsia-400/60" />
              <span className="orbit-dot-3 absolute w-1.5 h-1.5 rounded-full bg-indigo-400/60" />
            </>
          ) : (
            <Brain className="w-3.5 h-3.5 text-violet-400" />
          )}
        </div>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          {isStreaming ? (
            <span className="text-xs font-medium thinking-shimmer">Thinking deeply...</span>
          ) : (
            <span className="text-xs font-medium text-violet-400">
              {thinkSeconds ? `Thought for ${thinkSeconds}s` : 'Thinking process'}
            </span>
          )}
          <span className="text-[10px] text-violet-500/50 ml-auto shrink-0">{content.length.toLocaleString()} chars</span>
        </div>

        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-violet-500/50 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-violet-500/50 shrink-0" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden">
            <div
              ref={scrollRef}
              className="px-4 pb-3 max-h-52 overflow-y-auto border-t border-violet-500/10">
              <p className="text-[11px] text-violet-300/60 whitespace-pre-wrap font-mono leading-relaxed pt-2">
                {content}
                {isStreaming && <span className="streaming-cursor" />}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Source Pills (RAG) ─────────────────────────────────────────────────────────
interface Source { id: number; title: string; url: string; domain: string; snippet: string }
function SourcePills({ sources }: { sources: Source[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sources : sources.slice(0, 3);
  return (
    <div className="mt-2.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
        <Globe className="w-3 h-3" />
        <span>Sources</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((s, i) => (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            title={s.snippet}
            className="source-pill flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 border border-white/8 hover:bg-zinc-700 hover:border-violet-500/30 transition-all text-[10px] text-zinc-400 hover:text-zinc-200 group"
            style={{ animationDelay: `${i * 60}ms` }}>
            <ExternalLink className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />
            <span className="truncate max-w-[120px]">{s.domain || s.title}</span>
          </a>
        ))}
        {sources.length > 3 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="source-pill px-2 py-1 rounded-lg bg-zinc-800/60 border border-white/6 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors">
            {showAll ? 'Less' : `+${sources.length - 3} more`}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Searching Indicator ────────────────────────────────────────────────────────
function SearchingIndicator({ query }: { query: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800/60 border border-white/8 text-xs text-zinc-400 w-fit">
      <Globe className="w-3.5 h-3.5 text-violet-400 animate-spin" />
      <span>Searching the web</span>
      {query && <span className="text-zinc-600 truncate max-w-[180px]">"{query.slice(0, 40)}"</span>}
      <span className="flex gap-0.5 ml-1">
        {[0, 0.2, 0.4].map(d => (
          <span key={d} className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${d}s` }} />
        ))}
      </span>
    </motion.div>
  );
}

// ── Code Block ─────────────────────────────────────────────────────────────────
function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-white/10">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          </div>
          <span className="text-xs text-zinc-400 font-mono ml-1">{language || 'code'}</span>
        </div>
        <button onClick={copy}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10">
          {copied
            ? <><CheckCircle className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied!</span></>
            : <><Copy className="w-3 h-3" /><span>Copy</span></>}
        </button>
      </div>
      <SyntaxHighlighter language={language} style={oneDark}
        customStyle={{ margin: 0, borderRadius: 0, background: 'rgba(9,9,11,0.85)', fontSize: '0.8rem', lineHeight: '1.6' }}
        showLineNumbers={children.split('\n').length > 4}>
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────────────
type ExtMessage = Message & { thinking?: string; sources?: Source[]; ragUsed?: boolean; searchQuery?: string };

function MessageBubble({ message, isStreaming, isSearching }: {
  message: ExtMessage; isStreaming?: boolean; isSearching?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn('group flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>

      {/* Avatar */}
      <div className={cn(
        'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1 ring-1',
        isUser
          ? 'bg-gradient-to-br from-blue-500 to-violet-600 ring-blue-500/30'
          : 'bg-gradient-to-br from-violet-600 to-fuchsia-600 ring-violet-500/30'
      )}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Sparkles className="w-4 h-4 text-white" />}
      </div>

      <div className={cn('flex flex-col gap-1.5 max-w-[84%] min-w-0', isUser ? 'items-end' : 'items-start')}>
        {/* Searching indicator */}
        {!isUser && isSearching && (
          <AnimatePresence>
            <SearchingIndicator query={message.searchQuery || ''} />
          </AnimatePresence>
        )}

        {/* Thinking block */}
        {!isUser && message.thinking && (
          <div className="w-full">
            <ThinkingBlock
              content={message.thinking}
              isStreaming={isStreaming && !message.content}
              duration={message.duration}
            />
          </div>
        )}

        {/* Content bubble */}
        {(message.content || (isStreaming && !message.thinking)) && (
          <div className={cn(
            'relative px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-full',
            isUser
              ? 'bg-gradient-to-br from-blue-600 to-violet-700 text-white rounded-tr-sm'
              : 'bg-zinc-800/80 border border-white/8 text-zinc-100 rounded-tl-sm'
          )}>
            {isUser ? (
              <div>
                {message.images && message.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {message.images.map((img, i) => (
                      <img key={i} src={img} alt="" className="max-h-40 rounded-xl object-cover border border-white/20" />
                    ))}
                  </div>
                )}
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none prose-pre:p-0 prose-pre:bg-transparent prose-pre:m-0">
                <ReactMarkdown
                  components={{
                    code({ className, children, ...props }: any) {
                      const inline = !className;
                      const lang = (className || '').replace('language-', '');
                      if (inline) return (
                        <code className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-xs text-violet-300" {...props}>
                          {children}
                        </code>
                      );
                      return <CodeBlock language={lang}>{String(children).replace(/\n$/, '')}</CodeBlock>;
                    },
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-3">
                        <table className="w-full text-xs border-collapse">{children}</table>
                      </div>
                    ),
                    th: ({ children }) => <th className="border border-white/20 px-3 py-2 text-left bg-white/10 font-semibold">{children}</th>,
                    td: ({ children }) => <td className="border border-white/10 px-3 py-2">{children}</td>,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-violet-500 pl-3 my-2 text-zinc-400 italic">{children}</blockquote>
                    ),
                    h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-2 text-zinc-200">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1 text-zinc-300">{children}</h3>,
                    ul: ({ children }) => <ul className="list-disc list-outside pl-4 space-y-1 my-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-outside pl-4 space-y-1 my-2">{children}</ol>,
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener" className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors">
                        {children}
                      </a>
                    ),
                    p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
                  }}>
                  {message.content}
                </ReactMarkdown>
                {isStreaming && <span className="streaming-cursor" />}
              </div>
            )}
          </div>
        )}

        {/* RAG Sources */}
        {!isUser && message.ragUsed && message.sources && message.sources.length > 0 && !isStreaming && (
          <div className="w-full pl-1">
            <SourcePills sources={message.sources} />
          </div>
        )}

        {/* Message meta row */}
        <div className={cn(
          'flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200',
          isUser ? 'flex-row-reverse' : ''
        )}>
          <span className="text-[10px] text-zinc-600">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!isUser && (
            <button onClick={copy} className="text-zinc-600 hover:text-zinc-400 transition-colors">
              {copied ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
          {message.duration && !isStreaming && (
            <span className="text-[10px] text-zinc-600 flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" />{(message.duration / 1000).toFixed(1)}s
            </span>
          )}
          {message.ragUsed && (
            <span className="text-[10px] text-violet-500/70 flex items-center gap-1">
              <Globe className="w-2.5 h-2.5" />web
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────────
function EmptyState({ onPrompt }: { onPrompt: (p: string) => void }) {
  const prompts = [
    { icon: FileCode2, text: 'Review my code', prompt: 'Review this code and suggest improvements for performance and readability.' },
    { icon: Newspaper, text: "What's in the news?", prompt: "What's the latest tech news today?" },
    { icon: Wand2, text: 'Write something', prompt: 'Write a compelling short story about AI and human creativity.' },
    { icon: Brain, text: 'Deep analysis', prompt: 'Explain how large language models work in depth, step by step.' },
    { icon: TrendingUp, text: 'Market insight', prompt: "What's happening in the stock market this week?" },
    { icon: Globe, text: 'Research', prompt: 'Give me a comprehensive overview of quantum computing breakthroughs in 2025.' },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-2xl shadow-violet-900/50">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-600 -z-10"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center">
        <h2 className="text-2xl font-bold mb-2 bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-transparent">
          Nova AI
        </h2>
        <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
          Powered by Kimi K2 via NVIDIA NIM · 128k context · Web search · Extended thinking
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-lg">
        {prompts.map(({ icon: Icon, text, prompt }, i) => (
          <motion.button
            key={text}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.05 }}
            onClick={() => onPrompt(prompt)}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 hover:border-violet-500/40 transition-all text-left group">
            <div className="w-7 h-7 rounded-lg bg-violet-600/20 flex items-center justify-center shrink-0 group-hover:bg-violet-600/30 transition-colors">
              <Icon className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors leading-snug">{text}</span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}

// ── Panels ─────────────────────────────────────────────────────────────────────
function MemoryPanel() {
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch('/api/nova/memory', { headers: { 'x-api-key': window.__nova_key || '' } }); const d = await r.json(); setMemories(d.memories || []); } catch { toast.error('Failed to load memories'); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const del = async (id: string) => {
    await fetch('/api/nova/memory', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key || '' }, body: JSON.stringify({ id }) });
    setMemories(m => m.filter(x => x.id !== id)); toast.success('Memory deleted');
  };
  const categories = ['all', 'fact', 'preference', 'conversation', 'note', 'skill'];
  const filtered = filter === 'all' ? memories : memories.filter(m => m.category === filter);
  const CAT: Record<string, string> = { fact: 'bg-blue-500/20 text-blue-400', preference: 'bg-green-500/20 text-green-400', conversation: 'bg-violet-500/20 text-violet-400', note: 'bg-yellow-500/20 text-yellow-400', skill: 'bg-red-500/20 text-red-400' };
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Memory Bank</h2><p className="text-xs text-zinc-500">{memories.length} entries</p></div><button onClick={load} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button></div>
      <div className="flex gap-1 flex-wrap">{categories.map(c => <button key={c} onClick={() => setFilter(c)} className={cn('px-2.5 py-1 rounded-lg text-xs transition-colors capitalize', filter === c ? 'bg-violet-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10')}>{c}</button>)}</div>
      <ScrollArea className="flex-1">
        {loading ? <div className="flex items-center justify-center h-32"><RefreshCw className="w-5 h-5 text-zinc-500 animate-spin" /></div> : (
          <div className="space-y-2">{filtered.map(m => (
            <div key={m.id} className="group p-3 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 transition-colors">
              <div className="flex items-start gap-2"><span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 mt-0.5 capitalize', CAT[m.category] || 'bg-zinc-700 text-zinc-300')}>{m.category}</span><p className="text-xs text-zinc-300 leading-relaxed flex-1">{m.content}</p><button onClick={() => del(m.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all shrink-0"><X className="w-3 h-3" /></button></div>
              <div className="flex items-center gap-3 mt-2"><span className="text-[10px] text-zinc-600">Importance: {(m.importance * 100).toFixed(0)}%</span><span className="text-[10px] text-zinc-600">Accessed {m.accessCount}x</span><span className="text-[10px] text-zinc-600">{new Date(m.createdAt).toLocaleDateString()}</span></div>
            </div>
          ))}{!filtered.length && <div className="text-center py-12 text-zinc-600 text-sm">No memories here</div>}</div>
        )}
      </ScrollArea>
    </div>
  );
}

function TasksPanel() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [filter, setFilter] = useState('all');
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch('/api/nova/tasks', { headers: { 'x-api-key': window.__nova_key || '' } }); const d = await r.json(); setTasks(d.tasks || []); } catch { }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    if (!newTitle.trim()) return;
    const r = await fetch('/api/nova/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key || '' }, body: JSON.stringify({ title: newTitle }) });
    const d = await r.json();
    if (d.task) { setTasks(t => [d.task, ...t]); setNewTitle(''); toast.success('Task added'); }
  };
  const update = async (id: string, status: string) => {
    await fetch('/api/nova/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key || '' }, body: JSON.stringify({ id, status }) });
    setTasks(t => t.map(x => x.id === id ? { ...x, status } : x));
  };
  const STATUS: Record<string, string> = { pending: 'text-yellow-400', in_progress: 'text-blue-400', completed: 'text-green-400', cancelled: 'text-red-400' };
  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Task Manager</h2><p className="text-xs text-zinc-500">{tasks.filter(t => t.status !== 'completed').length} active</p></div><button onClick={load} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400"><RefreshCw className="w-3.5 h-3.5" /></button></div>
      <div className="flex gap-2"><Input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="New task..." className="flex-1 h-8 text-sm bg-white/5 border-white/10" /><Button onClick={add} size="sm" className="h-8 px-3 bg-violet-600 hover:bg-violet-700"><Plus className="w-3.5 h-3.5" /></Button></div>
      <div className="flex gap-1 flex-wrap">{['all', 'pending', 'in_progress', 'completed'].map(s => <button key={s} onClick={() => setFilter(s)} className={cn('px-2.5 py-1 rounded-lg text-xs transition-colors capitalize', filter === s ? 'bg-violet-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10')}>{s.replace('_', ' ')}</button>)}</div>
      <ScrollArea className="flex-1">
        {loading ? <div className="flex items-center justify-center h-32"><RefreshCw className="w-5 h-5 animate-spin text-zinc-500" /></div> : (
          <div className="space-y-2">{filtered.map(task => (
            <div key={task.id} className="p-3 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 transition-colors">
              <div className="flex items-center gap-2"><button onClick={() => update(task.id, task.status === 'completed' ? 'pending' : 'completed')} className={cn('w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors', task.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-zinc-600 hover:border-violet-500')}>{task.status === 'completed' && <Check className="w-2.5 h-2.5 text-white" />}</button><div className="flex-1 min-w-0"><p className={cn('text-xs font-medium truncate', task.status === 'completed' ? 'line-through text-zinc-500' : 'text-zinc-200')}>{task.title}</p><div className="flex items-center gap-2 mt-0.5"><span className={cn('text-[10px] capitalize', STATUS[task.status])}>{task.status.replace('_', ' ')}</span><span className="text-[10px] text-zinc-600">{new Date(task.createdAt).toLocaleDateString()}</span></div></div><Select value={task.status} onValueChange={v => update(task.id, v)}><SelectTrigger className="h-6 w-24 text-[10px] bg-transparent border-white/10"><SelectValue /></SelectTrigger><SelectContent>{['pending', 'in_progress', 'completed', 'cancelled'].map(s => <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
            </div>
          ))}{!filtered.length && <div className="text-center py-12 text-zinc-600 text-sm">No tasks</div>}</div>
        )}
      </ScrollArea>
    </div>
  );
}

function SettingsPanel() {
  const { settings, updateSettings } = useNovaStore();
  return (
    <div className="flex flex-col gap-4">
      <div><h2 className="text-sm font-semibold">Settings</h2><p className="text-xs text-zinc-500">Configure Nova's behaviour</p></div>
      <div className="space-y-3">
        {[{ key: 'voiceEnabled', label: 'Voice Input', desc: 'Enable microphone', icon: Mic }, { key: 'ttsEnabled', label: 'Text to Speech', desc: 'Nova speaks aloud', icon: Volume2 }, { key: 'proactiveEnabled', label: 'Proactive Mode', desc: 'Nova suggests actions', icon: Sparkles }, { key: 'offlineMode', label: 'Offline Mode', desc: 'Use cached only', icon: Wifi }].map(({ key, label, desc, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/8">
            <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center"><Icon className="w-4 h-4 text-zinc-400" /></div><div><p className="text-xs font-medium">{label}</p><p className="text-[11px] text-zinc-500">{desc}</p></div></div>
            <Switch checked={!!(settings as any)[key]} onCheckedChange={v => updateSettings({ [key]: v } as any)} />
          </div>
        ))}
        <div className="p-3 rounded-xl bg-white/5 border border-white/8"><div className="flex items-center gap-3 mb-3"><div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center"><SlidersHorizontal className="w-4 h-4 text-zinc-400" /></div><div><p className="text-xs font-medium">TTS Speed</p><p className="text-[11px] text-zinc-500">Rate: {settings.ttsSpeed}x</p></div></div><Slider min={0.5} max={2} step={0.1} value={[settings.ttsSpeed]} onValueChange={([v]) => updateSettings({ ttsSpeed: v })} /></div>
        <div className="p-3 rounded-xl bg-gradient-to-br from-violet-950/60 to-fuchsia-950/40 border border-violet-500/20">
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
  useEffect(() => {
    fetch('/api/nova/logs', { headers: { 'x-api-key': window.__nova_key || '' } })
      .then(r => r.json()).then(d => { setLogs(d.logs || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  return (
    <div className="flex flex-col gap-4 h-full">
      <div><h2 className="text-sm font-semibold">System Logs</h2><p className="text-xs text-zinc-500">{logs.length} entries</p></div>
      <ScrollArea className="flex-1 font-mono">
        {loading ? <div className="flex items-center justify-center h-32"><RefreshCw className="w-5 h-5 animate-spin text-zinc-500" /></div> : (
          <div className="space-y-0.5">{logs.slice().reverse().map(log => (
            <div key={log.id} className="text-[11px] px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2"><span className="text-zinc-600 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span><span className={cn('uppercase text-[10px] font-bold shrink-0 w-8', LEVEL[log.level])}>{log.level}</span><span className="text-zinc-500 shrink-0">[{log.category}]</span><span className="text-zinc-300 truncate">{log.message}</span></div>
            </div>
          ))}{!logs.length && <div className="text-center py-12 text-zinc-600 text-sm">No logs yet</div>}</div>
        )}
      </ScrollArea>
    </div>
  );
}

function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const r = await fetch('/api/nova/search', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key || '' }, body: JSON.stringify({ query, num: 10 }) });
      const d = await r.json();
      setResults(d.results || []);
    } catch { toast.error('Search failed'); }
    setLoading(false);
  };
  return (
    <div className="flex flex-col gap-4 h-full">
      <div><h2 className="text-sm font-semibold">Web Search</h2><p className="text-xs text-zinc-500">Real-time web search · RAG auto-triggers in chat</p></div>
      <div className="flex gap-2">
        <Input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="Search the web..." className="flex-1 h-9 text-sm bg-white/5 border-white/10 focus:border-violet-500/50" />
        <Button onClick={search} size="sm" className="h-9 px-4 bg-violet-600 hover:bg-violet-700" disabled={loading}>
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-3">
          {results.map((r, i) => (
            <motion.a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="block p-3 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 hover:border-violet-500/30 transition-all group">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-200 group-hover:text-violet-300 transition-colors line-clamp-1">{r.title}</p>
                  <p className="text-[10px] text-violet-500/70 mb-1">{r.domain}</p>
                  <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">{r.snippet}</p>
                </div>
                <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-violet-400 shrink-0 mt-0.5 transition-colors" />
              </div>
            </motion.a>
          ))}
          {!results.length && !loading && (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-zinc-600">
              <Globe className="w-8 h-8 opacity-30" />
              <p className="text-sm">Search for anything — results feed into Nova's context automatically</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Nav ────────────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'search', label: 'Search', icon: Globe },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'logs', label: 'Logs', icon: Activity },
] as const;
type Tab = typeof NAV[number]['id'];

// ── Main App ──────────────────────────────────────────────────────────────────
declare global { interface Window { __nova_key?: string } }

export default function NovaApp() {
  const { messages, addMessage, updateLastMessage, clearMessages, settings, systemStats } = useNovaStore();
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [enableThinking, setEnableThinking] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState<{ prompt: number; completion: number } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchingQuery, setSearchingQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const API_KEY = process.env.NEXT_PUBLIC_NOVA_API_KEY || '';

  useEffect(() => { window.__nova_key = API_KEY; }, [API_KEY]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (overrideInput?: string) => {
    const userMsg = (overrideInput ?? input).trim();
    if (!userMsg && selectedImages.length === 0) return;
    if (isProcessing) return;

    setInput('');
    setSelectedImages([]);
    setIsProcessing(true);
    setTokenCount(null);
    setIsSearching(false);
    setSearchingQuery('');

    addMessage({ role: 'user', content: userMsg, images: selectedImages.length > 0 ? selectedImages : undefined });
    const assistantId = addMessage({ role: 'assistant', content: '', thinking: '' } as any);
    setStreamingId(assistantId);

    try {
      const res = await fetch('/api/nova/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ message: userMsg, sessionId, images: selectedImages, enableThinking, stream: true }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let contentAcc = '';
      let thinkingAcc = '';
      let buf = '';
      let ragSources: Source[] = [];
      let ragUsed = false;
      let ragQuery = '';

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
          try {
            const evt = JSON.parse(jsonStr);
            if (evt.type === 'rag') {
              // RAG event — show searching indicator
              ragSources = evt.sources || [];
              ragQuery = evt.searchQuery || '';
              ragUsed = true;
              setIsSearching(true);
              setSearchingQuery(ragQuery);
              // Update message with search state
              updateLastMessage(contentAcc, thinkingAcc || undefined);
            }
            if (evt.type === 'thinking') { thinkingAcc += evt.content; }
            if (evt.type === 'content') {
              contentAcc += evt.content;
              setIsSearching(false); // Hide searching once content starts
            }
            if (evt.type === 'usage') setTokenCount({ prompt: evt.usage.prompt_tokens, completion: evt.usage.completion_tokens });
            if (evt.type === 'done') {
              ragSources = evt.ragSources || ragSources;
              ragUsed = evt.ragUsed || ragUsed;
              // Final update with sources
              (updateLastMessage as any)(contentAcc, thinkingAcc || undefined, evt.duration, {
                sources: ragSources, ragUsed, searchQuery: ragQuery,
              });
            }
            if (evt.type !== 'done' && evt.type !== 'rag') {
              updateLastMessage(contentAcc, thinkingAcc || undefined);
            }
            if (evt.type === 'error') throw new Error(evt.message);
          } catch { }
        }
      }
    } catch (err) {
      updateLastMessage(`Error: ${err instanceof Error ? err.message : 'Something went wrong'}`);
      toast.error('Failed to get response');
    } finally {
      setIsProcessing(false);
      setStreamingId(null);
      setIsSearching(false);
      setSearchingQuery('');
    }
  }, [input, selectedImages, isProcessing, sessionId, enableThinking, API_KEY, addMessage, updateLastMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev: ProgressEvent<FileReader>) => setSelectedImages(prev => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file as unknown as Blob);
    });
  };

  const adjustTextarea = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <CustomCursor />

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 220, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="flex flex-col border-r border-white/8 bg-zinc-900/60 backdrop-blur-sm shrink-0 overflow-hidden">

            {/* Logo */}
            <div className="p-4 border-b border-white/8">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold tracking-tight">Nova</p>
                  <p className="text-[10px] text-zinc-500">NVIDIA NIM · Kimi K2</p>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 p-2 space-y-0.5">
              {NAV.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group',
                    activeTab === id
                      ? 'bg-violet-600/20 text-violet-300 font-medium'
                      : 'text-zinc-500 hover:bg-white/6 hover:text-zinc-200'
                  )}>
                  <Icon className={cn('w-4 h-4 shrink-0 transition-colors', activeTab === id ? 'text-violet-400' : 'text-zinc-600 group-hover:text-zinc-400')} />
                  {label}
                  {id === 'chat' && messages.length > 0 && (
                    <span className="ml-auto text-[10px] bg-violet-600/25 text-violet-400 px-1.5 py-0.5 rounded-full">{messages.length}</span>
                  )}
                </button>
              ))}
            </nav>

            {/* Stats */}
            <div className="p-3 border-t border-white/8">
              <div className="p-2.5 rounded-xl bg-white/4 space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <Database className="w-3 h-3" />
                  <span>{systemStats.memoryCount} memories</span>
                  <span className="ml-auto text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />Live
                  </span>
                </div>
                {tokenCount && (
                  <div className="text-[10px] text-zinc-600 flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5" />
                    {tokenCount.prompt}↑ {tokenCount.completion}↓ tokens
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 h-12 border-b border-white/8 bg-zinc-900/40 backdrop-blur-sm shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white transition-colors">
            <PanelLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium capitalize">{activeTab}</span>
            {activeTab === 'chat' && (
              <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-400/70 h-5 px-1.5">
                <Infinity className="w-2.5 h-2.5 mr-1" />128k
              </Badge>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {activeTab === 'chat' && (
              <>
                <button
                  onClick={() => setEnableThinking(!enableThinking)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all',
                    enableThinking
                      ? 'bg-violet-600/25 text-violet-300 border border-violet-500/40'
                      : 'text-zinc-500 hover:bg-white/8 hover:text-zinc-300'
                  )}>
                  <Brain className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Think</span>
                </button>
                <button
                  onClick={() => { clearMessages(); toast.success('Conversation cleared'); }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chat' ? (
            <div className="flex flex-col h-full">
              {/* Messages */}
              <ScrollArea className="flex-1 px-4 py-4">
                {messages.length === 0 ? (
                  <EmptyState onPrompt={(p) => { setInput(p); setTimeout(() => textareaRef.current?.focus(), 50); }} />
                ) : (
                  <div className="space-y-6 max-w-3xl mx-auto pb-2">
                    {messages.map((msg) => (
                      <div key={msg.id}>
                        <MessageBubble
                          message={msg as ExtMessage}
                          isStreaming={streamingId === msg.id && isProcessing}
                          isSearching={streamingId === msg.id && isSearching}
                        />
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t border-white/8 bg-zinc-900/40 backdrop-blur-sm shrink-0">
                {selectedImages.length > 0 && (
                  <div className="flex gap-2 mb-3 flex-wrap max-w-3xl mx-auto">
                    {selectedImages.map((img, i) => (
                      <div key={i} className="relative group">
                        <img src={img} alt="" className="h-16 w-16 rounded-xl object-cover border border-white/20" />
                        <button onClick={() => setSelectedImages(imgs => imgs.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 items-end max-w-3xl mx-auto">
                  <div className="flex-1 relative">
                    <Textarea
                      ref={textareaRef}
                      value={input}
                      onChange={e => { setInput(e.target.value); adjustTextarea(e.target); }}
                      onKeyDown={handleKeyDown}
                      placeholder={enableThinking ? 'Ask Nova to think deeply...' : 'Message Nova... (⏎ to send, ⇧⏎ newline)'}
                      rows={1}
                      className="resize-none bg-zinc-800/60 border-white/10 focus:border-violet-500/50 text-sm min-h-[44px] max-h-[200px] py-3 pr-3 transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
                    <button onClick={() => fileInputRef.current?.click()}
                      className="w-9 h-9 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-violet-500/30 text-zinc-500 hover:text-white transition-all">
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => sendMessage()}
                      disabled={isProcessing || (!input.trim() && selectedImages.length === 0)}
                      className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                        isProcessing || (!input.trim() && selectedImages.length === 0)
                          ? 'bg-zinc-800 text-zinc-600 border border-white/8'
                          : 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/30 hover:from-violet-500 hover:to-fuchsia-500 hover:shadow-violet-700/40'
                      )}>
                      {isProcessing
                        ? <RefreshCw className="w-4 h-4 animate-spin" />
                        : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <p className="text-center text-[10px] text-zinc-700 mt-2">
                  Nova · NVIDIA NIM · Kimi K2 · RAG auto-search enabled
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 h-full overflow-hidden flex flex-col">
              {activeTab === 'memory' && <MemoryPanel />}
              {activeTab === 'tasks' && <TasksPanel />}
              {activeTab === 'settings' && <SettingsPanel />}
              {activeTab === 'logs' && <LogsPanel />}
              {activeTab === 'search' && <SearchPanel />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
