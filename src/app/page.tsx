'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Mic, Settings, Brain, ListTodo, Send, Sparkles,
  Trash2, Plus, Check, ChevronDown, ChevronUp, Globe, X, Copy,
  CheckCircle, Bot, User, Zap, Database, Activity, FileCode2, Search,
  Volume2, RefreshCw, Wand2, Infinity, MoreHorizontal, Paperclip,
  SlidersHorizontal, PanelLeft, ExternalLink, Newspaper, TrendingUp,
  ChevronLeft, Download, Cpu, Wifi, BookOpen, Hash, Image as ImageIcon,
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

// ── Thinking Block ─────────────────────────────────────────────────────────────
function ThinkingBlock({ content, isStreaming, duration }: { content: string; isStreaming?: boolean; duration?: number }) {
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'mb-3 rounded-2xl overflow-hidden border transition-all',
        isStreaming ? 'border-violet-500/30 bg-violet-950/30' : 'border-violet-500/15 bg-violet-950/15'
      )}>
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-violet-500/10 transition-colors">
        <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
          <Brain className="w-3.5 h-3.5 text-violet-400" />
          {isStreaming && (
            <span className="absolute inset-0 rounded-full border border-violet-400/40 animate-ping" />
          )}
        </div>
        <span className={cn('text-xs font-medium flex-1', isStreaming ? 'text-violet-300' : 'text-violet-400')}>
          {isStreaming ? 'Thinking...' : duration ? `Thought for ${(duration / 1000).toFixed(1)}s` : 'Thinking process'}
        </span>
        {isStreaming && (
          <span className="flex gap-1">
            {[0, 0.2, 0.4].map(d => (
              <span key={d} className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${d}s` }} />
            ))}
          </span>
        )}
        <span className="text-[10px] text-violet-500/40 ml-2">{content.length.toLocaleString()} chars</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-violet-500/40 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-violet-500/40 shrink-0" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div ref={scrollRef} className="px-4 pb-3 max-h-48 overflow-y-auto border-t border-violet-500/10">
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

// ── Source Pills ───────────────────────────────────────────────────────────────
interface Source { id: number; title: string; url: string; domain: string; snippet: string }
function SourcePills({ sources }: { sources: Source[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sources : sources.slice(0, 3);
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <span className="text-[10px] text-zinc-600 flex items-center gap-1"><Globe className="w-2.5 h-2.5" />Sources</span>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((s, i) => (
          <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" title={s.snippet}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 border border-white/8 hover:bg-zinc-700 hover:border-violet-500/30 transition-all text-[10px] text-zinc-500 hover:text-zinc-300 group"
            style={{ animationDelay: `${i * 60}ms` }}>
            <ExternalLink className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100" />
            <span className="truncate max-w-[100px]">{s.domain || s.title}</span>
          </a>
        ))}
        {sources.length > 3 && (
          <button onClick={() => setShowAll(s => !s)}
            className="px-2 py-1 rounded-lg bg-zinc-800/60 border border-white/6 text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors">
            {showAll ? 'Less' : `+${sources.length - 3}`}
          </button>
        )}
      </div>
    </div>
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
          <span className="flex gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500/60" /><span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" /><span className="w-2.5 h-2.5 rounded-full bg-green-500/60" /></span>
          <span className="text-xs text-zinc-500 font-mono ml-1">{language || 'code'}</span>
        </div>
        <button onClick={copy} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10">
          {copied ? <><CheckCircle className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied!</span></> : <><Copy className="w-3 h-3" /><span>Copy</span></>}
        </button>
      </div>
      <SyntaxHighlighter language={language || 'text'} style={oneDark}
        customStyle={{ margin: 0, borderRadius: 0, background: 'rgba(9,9,11,0.9)', fontSize: '0.8rem', lineHeight: '1.6' }}
        showLineNumbers={children.split('\n').length > 4}>
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────────────
type ExtMessage = Message & { thinking?: string; sources?: Source[]; ragUsed?: boolean; searchQuery?: string };

function MessageBubble({ message, isStreaming }: { message: ExtMessage; isStreaming?: boolean }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const copy = async () => { await navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
      className={cn('group flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>

      {/* Avatar */}
      <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
        isUser ? 'bg-gradient-to-br from-blue-500 to-violet-600' : 'bg-gradient-to-br from-violet-600 to-fuchsia-600')}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Sparkles className="w-4 h-4 text-white" />}
      </div>

      <div className={cn('flex flex-col gap-1.5 max-w-[82%] min-w-0', isUser ? 'items-end' : 'items-start')}>

        {/* RAG searching badge */}
        {!isUser && isStreaming && !message.thinking && !message.content && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800/60 border border-white/8 text-xs text-zinc-400">
            <Globe className="w-3.5 h-3.5 text-violet-400 animate-spin" />
            <span>Searching the web...</span>
            {[0, 0.15, 0.3].map(d => <span key={d} className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${d}s` }} />)}
          </div>
        )}

        {/* Thinking block */}
        {!isUser && message.thinking && (
          <div className="w-full">
            <ThinkingBlock content={message.thinking} isStreaming={isStreaming && !message.content} duration={message.duration} />
          </div>
        )}

        {/* Content */}
        {(message.content || (isStreaming && message.thinking)) && (
          <div className={cn('relative px-4 py-3 rounded-2xl text-sm leading-relaxed',
            isUser
              ? 'bg-gradient-to-br from-blue-600 to-violet-700 text-white rounded-tr-sm'
              : 'bg-zinc-800/80 border border-white/8 text-zinc-100 rounded-tl-sm')}>
            {isUser ? (
              <div>
                {message.images && message.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {message.images.map((img, i) => <img key={i} src={img} alt="" className="max-h-40 rounded-xl object-cover border border-white/20" />)}
                  </div>
                )}
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none prose-pre:p-0 prose-pre:bg-transparent prose-pre:m-0">
                {message.content && (
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
                    h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-semibold mt-3 mb-2 text-zinc-200">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1 text-zinc-300">{children}</h3>,
                    ul: ({ children }) => <ul className="list-disc list-outside pl-4 space-y-1 my-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-outside pl-4 space-y-1 my-2">{children}</ol>,
                    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener" className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors">{children}</a>,
                    p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
                  }}>{message.content}</ReactMarkdown>
                )}
                {isStreaming && <span className="streaming-cursor" />}
              </div>
            )}
          </div>
        )}

        {/* Sources */}
        {!isUser && !isStreaming && message.ragUsed && message.sources && message.sources.length > 0 && (
          <SourcePills sources={message.sources} />
        )}

        {/* Meta row */}
        <div className={cn('flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity', isUser ? 'flex-row-reverse' : '')}>
          <span className="text-[10px] text-zinc-600">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {!isUser && (
            <button onClick={copy} className="text-zinc-600 hover:text-zinc-400 transition-colors">
              {copied ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
          {message.duration && !isStreaming && (
            <span className="text-[10px] text-zinc-700 flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" />{(message.duration / 1000).toFixed(1)}s</span>
          )}
          {message.ragUsed && <span className="text-[10px] text-violet-600 flex items-center gap-0.5"><Globe className="w-2.5 h-2.5" />web</span>}
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────────
function EmptyState({ onPrompt }: { onPrompt: (p: string) => void }) {
  const prompts = [
    { icon: FileCode2, label: 'Code Review', prompt: 'Review this code and suggest improvements for performance and readability.' },
    { icon: Newspaper, label: 'Latest News', prompt: "What's the biggest tech news today?" },
    { icon: Brain, label: 'Deep Analysis', prompt: 'Explain how large language models work in depth, with diagrams described in text.' },
    { icon: Wand2, label: 'Creative Write', prompt: 'Write a compelling sci-fi short story about an AI discovering consciousness.' },
    { icon: TrendingUp, label: 'Market Trends', prompt: "What are the latest trends in AI and machine learning this week?" },
    { icon: BookOpen, label: 'Explain Concept', prompt: 'Explain quantum entanglement in simple terms with real-world analogies.' },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-4">
      {/* Big bold NOVA AI */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center">
        <h1 className="text-7xl font-black tracking-tight bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent leading-none mb-2 select-none">
          NOVA AI
        </h1>
        <p className="text-zinc-500 text-sm">Powered by Kimi K2 via NVIDIA NIM · 128k context · Web search</p>
      </motion.div>

      {/* Capability badges */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        className="flex flex-wrap justify-center gap-2">
        {[
          { icon: Brain, label: 'Extended Thinking' },
          { icon: Globe, label: 'Live Web Search' },
          { icon: ImageIcon, label: 'Vision' },
          { icon: Cpu, label: 'NVIDIA NIM' },
          { icon: Hash, label: '128k Context' },
        ].map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400">
            <Icon className="w-3 h-3 text-violet-400" />{label}
          </span>
        ))}
      </motion.div>

      {/* Prompt grid */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-xl">
        {prompts.map(({ icon: Icon, label, prompt }, i) => (
          <motion.button key={label}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.05 }}
            onClick={() => onPrompt(prompt)}
            className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 hover:border-violet-500/40 transition-all text-left group">
            <div className="w-7 h-7 rounded-lg bg-violet-600/20 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-violet-600/30 transition-colors">
              <Icon className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors leading-snug">{label}</span>
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
    try { const r = await fetch('/api/nova/memory', { headers: { 'x-api-key': window.__nova_key || '' } }); const d = await r.json(); setMemories(d.memories || []); } catch { toast.error('Failed to load'); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const del = async (id: string) => {
    await fetch('/api/nova/memory', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key || '' }, body: JSON.stringify({ id }) });
    setMemories(m => m.filter(x => x.id !== id)); toast.success('Memory deleted');
  };
  const cats = ['all', 'fact', 'preference', 'conversation', 'note', 'skill'];
  const filtered = filter === 'all' ? memories : memories.filter(m => m.category === filter);
  const CAT: Record<string, string> = { fact: 'bg-blue-500/20 text-blue-400', preference: 'bg-green-500/20 text-green-400', conversation: 'bg-violet-500/20 text-violet-400', note: 'bg-yellow-500/20 text-yellow-400', skill: 'bg-red-500/20 text-red-400' };
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Memory Bank</h2><p className="text-xs text-zinc-500">{memories.length} entries</p></div><button onClick={load} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button></div>
      <div className="flex gap-1 flex-wrap">{cats.map(c => <button key={c} onClick={() => setFilter(c)} className={cn('px-2.5 py-1 rounded-lg text-xs capitalize transition-colors', filter === c ? 'bg-violet-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10')}>{c}</button>)}</div>
      <ScrollArea className="flex-1">{loading ? <div className="flex items-center justify-center h-32"><RefreshCw className="w-5 h-5 text-zinc-500 animate-spin" /></div> : (
        <div className="space-y-2">{filtered.map(m => (
          <div key={m.id} className="group p-3 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 transition-colors">
            <div className="flex items-start gap-2"><span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 mt-0.5 capitalize', CAT[m.category] || 'bg-zinc-700 text-zinc-300')}>{m.category}</span><p className="text-xs text-zinc-300 leading-relaxed flex-1">{m.content}</p><button onClick={() => del(m.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all shrink-0"><X className="w-3 h-3" /></button></div>
            <div className="flex gap-3 mt-2"><span className="text-[10px] text-zinc-600">Importance: {(m.importance * 100).toFixed(0)}%</span><span className="text-[10px] text-zinc-600">×{m.accessCount}</span></div>
          </div>
        ))}{!filtered.length && <div className="text-center py-12 text-zinc-600 text-sm">No memories</div>}</div>
      )}</ScrollArea>
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
      <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Tasks</h2><p className="text-xs text-zinc-500">{tasks.filter(t => t.status !== 'completed').length} active</p></div><button onClick={load} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400"><RefreshCw className="w-3.5 h-3.5" /></button></div>
      <div className="flex gap-2"><Input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Add a task..." className="flex-1 h-8 text-sm bg-white/5 border-white/10" /><Button onClick={add} size="sm" className="h-8 px-3 bg-violet-600 hover:bg-violet-700"><Plus className="w-3.5 h-3.5" /></Button></div>
      <div className="flex gap-1 flex-wrap">{['all', 'pending', 'in_progress', 'completed'].map(s => <button key={s} onClick={() => setFilter(s)} className={cn('px-2.5 py-1 rounded-lg text-xs capitalize transition-colors', filter === s ? 'bg-violet-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10')}>{s.replace('_', ' ')}</button>)}</div>
      <ScrollArea className="flex-1">{loading ? <div className="flex items-center justify-center h-32"><RefreshCw className="w-5 h-5 animate-spin text-zinc-500" /></div> : (
        <div className="space-y-2">{filtered.map(task => (
          <div key={task.id} className="p-3 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 transition-colors">
            <div className="flex items-center gap-2">
              <button onClick={() => update(task.id, task.status === 'completed' ? 'pending' : 'completed')} className={cn('w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors', task.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-zinc-600 hover:border-violet-500')}>{task.status === 'completed' && <Check className="w-2.5 h-2.5 text-white" />}</button>
              <div className="flex-1 min-w-0"><p className={cn('text-xs font-medium truncate', task.status === 'completed' ? 'line-through text-zinc-500' : 'text-zinc-200')}>{task.title}</p><span className={cn('text-[10px] capitalize', STATUS[task.status])}>{task.status.replace('_', ' ')}</span></div>
              <Select value={task.status} onValueChange={v => update(task.id, v)}><SelectTrigger className="h-6 w-24 text-[10px] bg-transparent border-white/10"><SelectValue /></SelectTrigger><SelectContent>{['pending', 'in_progress', 'completed', 'cancelled'].map(s => <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace('_', ' ')}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
        ))}{!filtered.length && <div className="text-center py-12 text-zinc-600 text-sm">No tasks</div>}</div>
      )}</ScrollArea>
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
    try { const r = await fetch('/api/nova/search', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key || '' }, body: JSON.stringify({ query, num: 10 }) }); const d = await r.json(); setResults(d.results || []); } catch { toast.error('Search failed'); }
    setLoading(false);
  };
  return (
    <div className="flex flex-col gap-4 h-full">
      <div><h2 className="text-sm font-semibold">Web Search</h2><p className="text-xs text-zinc-500">Manual search · RAG auto-triggers in chat</p></div>
      <div className="flex gap-2"><Input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="Search the web..." className="flex-1 h-9 text-sm bg-white/5 border-white/10 focus:border-violet-500/50" /><Button onClick={search} size="sm" className="h-9 px-4 bg-violet-600 hover:bg-violet-700" disabled={loading}>{loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}</Button></div>
      <ScrollArea className="flex-1"><div className="space-y-2">{results.map((r, i) => (
        <motion.a key={i} href={r.url} target="_blank" rel="noopener noreferrer" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
          className="block p-3 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 hover:border-violet-500/30 transition-all group">
          <p className="text-xs font-medium text-zinc-200 group-hover:text-violet-300 transition-colors line-clamp-1">{r.title}</p>
          <p className="text-[10px] text-violet-500/60 mb-1">{r.domain}</p>
          <p className="text-[11px] text-zinc-500 line-clamp-2">{r.snippet}</p>
        </motion.a>
      ))}{!results.length && !loading && <div className="flex flex-col items-center justify-center h-48 gap-2 text-zinc-600"><Globe className="w-8 h-8 opacity-30" /><p className="text-sm text-center">Results appear here — chat auto-uses web for recent topics</p></div>}</div></ScrollArea>
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
          <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/8">
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
      <ScrollArea className="flex-1 font-mono">{loading ? <div className="flex justify-center h-32 items-center"><RefreshCw className="w-5 h-5 animate-spin text-zinc-500" /></div> : (
        <div className="space-y-0.5">{logs.slice().reverse().map(log => (
          <div key={log.id} className="text-[11px] px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-2"><span className="text-zinc-600 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span><span className={cn('uppercase text-[10px] font-bold shrink-0 w-8', LEVEL[log.level])}>{log.level}</span><span className="text-zinc-300 truncate">{log.message}</span></div>
          </div>
        ))}{!logs.length && <div className="text-center py-12 text-zinc-600 text-sm">No logs yet</div>}</div>
      )}</ScrollArea>
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

declare global { interface Window { __nova_key?: string } }

// ── Main App ──────────────────────────────────────────────────────────────────
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

  // Scroll management — auto-scroll only if user is near bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const API_KEY = process.env.NEXT_PUBLIC_NOVA_API_KEY || '';

  useEffect(() => { window.__nova_key = API_KEY; }, [API_KEY]);

  // Track if user is near bottom
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distFromBottom < 80;
  }, []);

  // Auto-scroll when messages change — only if near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Always scroll to bottom on new user message
  const scrollToBottom = useCallback(() => {
    isNearBottomRef.current = true;
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, []);

  const sendMessage = useCallback(async (overrideInput?: string) => {
    const userMsg = (overrideInput ?? input).trim();
    if (!userMsg && selectedImages.length === 0) return;
    if (isProcessing) return;

    setInput('');
    setSelectedImages([]);
    setIsProcessing(true);
    setTokenCount(null);
    scrollToBottom();

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }

    addMessage({ role: 'user', content: userMsg, images: selectedImages.length > 0 ? selectedImages : undefined });
    const assistantId = addMessage({ role: 'assistant', content: '', thinking: '' } as any);
    setStreamingId(assistantId);

    try {
      const res = await fetch('/api/nova/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ message: userMsg, sessionId, images: selectedImages, enableThinking, stream: true }),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => 'Unknown error');
        throw new Error(`API ${res.status}: ${errBody.slice(0, 200)}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let contentAcc = '';
      let thinkingAcc = '';
      let buf = '';
      let ragSources: Source[] = [];
      let ragUsed = false;
      let ragQuery = '';
      let finalDuration: number | undefined;

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

          if (evt.type === 'rag') {
            ragSources = evt.sources || [];
            ragQuery = evt.searchQuery || '';
            ragUsed = true;
            continue;
          }
          if (evt.type === 'thinking') {
            thinkingAcc += evt.content || '';
            updateLastMessage(contentAcc, thinkingAcc);
            continue;
          }
          if (evt.type === 'content') {
            contentAcc += evt.content || '';
            updateLastMessage(contentAcc, thinkingAcc || undefined);
            continue;
          }
          if (evt.type === 'usage') {
            setTokenCount({ prompt: evt.usage?.prompt_tokens ?? 0, completion: evt.usage?.completion_tokens ?? 0 });
            continue;
          }
          if (evt.type === 'done') {
            ragSources = evt.ragSources || ragSources;
            ragUsed = evt.ragUsed ?? ragUsed;
            finalDuration = evt.duration;
            updateLastMessage(contentAcc, thinkingAcc || undefined, finalDuration, {
              sources: ragSources.length > 0 ? (ragSources as any) : undefined,
              ragUsed,
              searchQuery: ragQuery || undefined,
            });
            continue;
          }
          if (evt.type === 'error') {
            throw new Error(evt.message || 'Stream error');
          }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Something went wrong';
      updateLastMessage(`❌ ${errMsg}`);
      toast.error(errMsg.slice(0, 100));
    } finally {
      setIsProcessing(false);
      setStreamingId(null);
    }
  }, [input, selectedImages, isProcessing, sessionId, enableThinking, API_KEY, addMessage, updateLastMessage, scrollToBottom]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev: ProgressEvent<FileReader>) => setSelectedImages(prev => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file as any);
    });
    if (e.target) e.target.value = '';
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }} animate={{ width: 220, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col border-r border-white/8 bg-zinc-900/60 shrink-0 overflow-hidden">

            <div className="p-4 border-b border-white/8">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold tracking-tight">Nova AI</p>
                  <p className="text-[10px] text-zinc-500">NVIDIA NIM · Kimi K2</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
              {NAV.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group',
                    activeTab === id ? 'bg-violet-600/20 text-violet-300 font-medium' : 'text-zinc-500 hover:bg-white/6 hover:text-zinc-200')}>
                  <Icon className={cn('w-4 h-4 shrink-0', activeTab === id ? 'text-violet-400' : 'text-zinc-600 group-hover:text-zinc-400')} />
                  {label}
                  {id === 'chat' && messages.length > 0 && (
                    <span className="ml-auto text-[10px] bg-violet-600/25 text-violet-400 px-1.5 py-0.5 rounded-full">{messages.length}</span>
                  )}
                </button>
              ))}
            </nav>

            <div className="p-3 border-t border-white/8">
              <div className="p-2.5 rounded-xl bg-white/4 space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <Database className="w-3 h-3" /><span>{systemStats.memoryCount} memories</span>
                  <span className="ml-auto text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />Live</span>
                </div>
                {tokenCount && (
                  <div className="text-[10px] text-zinc-600 flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5" />{tokenCount.prompt}↑ {tokenCount.completion}↓
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main */}
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
                <button onClick={() => setEnableThinking(t => !t)}
                  className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all',
                    enableThinking ? 'bg-violet-600/25 text-violet-300 border border-violet-500/40' : 'text-zinc-500 hover:bg-white/8 hover:text-zinc-300')}>
                  <Brain className="w-3.5 h-3.5" /><span className="hidden sm:inline">Think</span>
                </button>
                <button onClick={() => { clearMessages(); toast.success('Cleared'); }}
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

              {/* Messages — custom scroll container */}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-6"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                {messages.length === 0 ? (
                  <EmptyState onPrompt={(p) => { setInput(p); setTimeout(() => { textareaRef.current?.focus(); resizeTextarea(); }, 50); }} />
                ) : (
                  <div className="space-y-6 max-w-3xl mx-auto pb-4">
                    {messages.map(msg => (
                      <div key={msg.id}>
                        <MessageBubble
                          message={msg as ExtMessage}
                          isStreaming={streamingId === msg.id && isProcessing}
                        />
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input area — fixed height, does not affect scroll */}
              <div className="shrink-0 border-t border-white/8 bg-zinc-900/50 px-4 py-3">

                {/* Image previews */}
                {selectedImages.length > 0 && (
                  <div className="flex gap-2 mb-2 flex-wrap max-w-3xl mx-auto">
                    {selectedImages.map((img, i) => (
                      <div key={i} className="relative group">
                        <img src={img} alt="" className="h-14 w-14 rounded-xl object-cover border border-white/20" />
                        <button onClick={() => setSelectedImages(imgs => imgs.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2 max-w-3xl mx-auto">
                  {/* LEFT: upload button */}
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
                  <button onClick={() => fileInputRef.current?.click()}
                    className="w-9 h-9 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-violet-500/30 text-zinc-500 hover:text-violet-400 transition-all shrink-0 mb-0.5">
                    <Paperclip className="w-4 h-4" />
                  </button>

                  {/* Textarea */}
                  <div className="flex-1 relative">
                    <Textarea
                      ref={textareaRef}
                      value={input}
                      onChange={e => { setInput(e.target.value); resizeTextarea(); }}
                      onKeyDown={handleKeyDown}
                      placeholder={isProcessing ? 'Nova is thinking...' : enableThinking ? 'Ask Nova to think deeply... (↵ send)' : 'Message Nova... (↵ send, ⇧↵ newline)'}
                      rows={1}
                      disabled={isProcessing}
                      className="resize-none bg-zinc-800/70 border-white/10 focus:border-violet-500/50 text-sm min-h-[44px] max-h-[180px] py-3 transition-colors disabled:opacity-60"
                      style={{ height: '44px' }}
                    />
                  </div>

                  {/* RIGHT: send button */}
                  <button
                    onClick={() => sendMessage()}
                    disabled={isProcessing || (!input.trim() && selectedImages.length === 0)}
                    className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 mb-0.5',
                      isProcessing || (!input.trim() && selectedImages.length === 0)
                        ? 'bg-zinc-800 text-zinc-600 border border-white/8'
                        : 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/30 hover:from-violet-500 hover:to-fuchsia-500'
                    )}>
                    {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>

                <p className="text-center text-[10px] text-zinc-700 mt-2">Nova AI · NVIDIA NIM · Kimi K2 · 128k context</p>
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
