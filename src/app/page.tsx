'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
  Paperclip, Maximize2, Minimize2, SlidersHorizontal, PanelLeft
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

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// ── Thinking Block ─────────────────────────────────────────────────────────────
function ThinkingBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="mb-3 rounded-xl border border-violet-500/20 bg-violet-950/20 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-violet-500/10 transition-colors">
        <Brain className="w-3.5 h-3.5 text-violet-400 shrink-0" />
        <span className="text-xs font-medium text-violet-400">
          {isStreaming ? 'Thinking...' : 'Thinking process'}
        </span>
        {isStreaming && (
          <span className="flex gap-1 ml-1">
            {[0, 0.15, 0.3].map(d => (
              <span key={d} className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${d}s` }} />
            ))}
          </span>
        )}
        <span className="ml-auto text-violet-500/60 text-xs">{content.length} chars</span>
        {expanded ? <ChevronUp className="w-3 h-3 text-violet-500/60" /> : <ChevronDown className="w-3 h-3 text-violet-500/60" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden">
            <div className="px-4 pb-3 max-h-64 overflow-y-auto">
              <p className="text-xs text-violet-300/70 whitespace-pre-wrap font-mono leading-relaxed">{content}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Code Block ─────────────────────────────────────────────────────────────────
function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-white/10">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-white/10">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-xs text-zinc-400 font-mono">{language || 'code'}</span>
        </div>
        <button onClick={copy}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10">
          {copied ? <><CheckCircle className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied</span></> : <><Copy className="w-3 h-3" /><span>Copy</span></>}
        </button>
      </div>
      <SyntaxHighlighter language={language} style={oneDark}
        customStyle={{ margin: 0, borderRadius: 0, background: 'rgba(9,9,11,0.8)', fontSize: '0.8rem', lineHeight: '1.6' }}
        showLineNumbers={children.split('\n').length > 5}>
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────────────
function MessageBubble({ message, isStreaming }: { message: Message & { thinking?: string }; isStreaming?: boolean }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className={cn('group flex gap-3 px-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1',
        isUser ? 'bg-gradient-to-br from-blue-500 to-violet-600' : 'bg-gradient-to-br from-violet-600 to-fuchsia-600')}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>

      <div className={cn('flex flex-col gap-1 max-w-[82%]', isUser ? 'items-end' : 'items-start')}>
        {/* Thinking block */}
        {message.thinking && (
          <div className="w-full">
            <ThinkingBlock content={message.thinking} isStreaming={isStreaming && !message.content} />
          </div>
        )}

        {/* Content bubble */}
        {(message.content || (isStreaming && !message.thinking)) && (
          <div className={cn('relative px-4 py-3 rounded-2xl text-sm leading-relaxed',
            isUser
              ? 'bg-gradient-to-br from-blue-600 to-violet-700 text-white rounded-tr-md'
              : 'bg-zinc-800/80 border border-white/8 text-zinc-100 rounded-tl-md')}>
            {isUser ? (
              <div>
                {message.images && message.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {message.images.map((img, i) => (
                      <img key={i} src={img} alt="" className="max-h-40 rounded-lg object-cover border border-white/20" />
                    ))}
                  </div>
                )}
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none prose-pre:p-0 prose-pre:bg-transparent prose-pre:m-0">
                <ReactMarkdown
                  components={{
                    code({ node, className, children, ...props }: any) {
                      const inline = !className;
                      const lang = (className || '').replace('language-', '');
                      if (inline) return <code className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-xs text-violet-300" {...props}>{children}</code>;
                      return <CodeBlock language={lang}>{String(children).replace(/\n$/, '')}</CodeBlock>;
                    },
                    table: ({ children }) => <div className="overflow-x-auto my-3"><table className="w-full text-xs border-collapse">{children}</table></div>,
                    th: ({ children }) => <th className="border border-white/20 px-3 py-2 text-left bg-white/10 font-semibold">{children}</th>,
                    td: ({ children }) => <td className="border border-white/10 px-3 py-2">{children}</td>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 border-violet-500 pl-3 my-2 text-zinc-400 italic">{children}</blockquote>,
                    h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-2 text-zinc-200">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1 text-zinc-300">{children}</h3>,
                    ul: ({ children }) => <ul className="list-disc list-outside pl-4 space-y-1 my-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-outside pl-4 space-y-1 my-2">{children}</ol>,
                    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener" className="text-violet-400 hover:underline">{children}</a>,
                  }}>
                  {message.content}
                </ReactMarkdown>
                {isStreaming && (
                  <span className="inline-block w-2 h-4 bg-violet-400 rounded-sm animate-pulse ml-0.5 align-middle" />
                )}
              </div>
            )}
          </div>
        )}

        {/* Message meta */}
        <div className={cn('flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity', isUser ? 'flex-row-reverse' : '')}>
          <span className="text-[10px] text-zinc-500">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!isUser && (
            <button onClick={copy} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              {copied ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
          {message.duration && (
            <span className="text-[10px] text-zinc-600 flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" />{(message.duration / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Sidebar Nav ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'search', label: 'Search', icon: Globe },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'logs', label: 'Logs', icon: Activity },
] as const;

type Tab = typeof NAV_ITEMS[number]['id'];

// ── Memory Panel ───────────────────────────────────────────────────────────────
function MemoryPanel() {
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/nova/memory', { headers: { 'x-api-key': window.__nova_key || '' } });
      const d = await r.json();
      setMemories(d.memories || []);
    } catch { toast.error('Failed to load memories'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = async (id: string) => {
    await fetch('/api/nova/memory', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key || '' }, body: JSON.stringify({ id }) });
    setMemories(m => m.filter(x => x.id !== id));
    toast.success('Memory deleted');
  };

  const categories = ['all', 'fact', 'preference', 'conversation', 'note', 'skill'];
  const filtered = filter === 'all' ? memories : memories.filter(m => m.category === filter);
  const CATEGORY_COLORS: Record<string, string> = { fact: 'bg-blue-500/20 text-blue-400', preference: 'bg-green-500/20 text-green-400', conversation: 'bg-violet-500/20 text-violet-400', note: 'bg-yellow-500/20 text-yellow-400', skill: 'bg-red-500/20 text-red-400' };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Memory Bank</h2>
          <p className="text-xs text-zinc-500">{memories.length} entries stored</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="flex gap-1 flex-wrap">
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={cn('px-2 py-1 rounded-lg text-xs transition-colors capitalize', filter === c ? 'bg-violet-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10')}>
            {c}
          </button>
        ))}
      </div>
      <ScrollArea className="flex-1">
        {loading ? <div className="flex items-center justify-center h-32"><RefreshCw className="w-5 h-5 text-zinc-500 animate-spin" /></div> : (
          <div className="space-y-2">
            {filtered.map(m => (
              <div key={m.id} className="group p-3 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 transition-colors">
                <div className="flex items-start gap-2">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 mt-0.5 capitalize', CATEGORY_COLORS[m.category] || 'bg-zinc-700 text-zinc-300')}>{m.category}</span>
                  <p className="text-xs text-zinc-300 leading-relaxed flex-1">{m.content}</p>
                  <button onClick={() => del(m.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] text-zinc-600">Importance: {(m.importance * 100).toFixed(0)}%</span>
                  <span className="text-[10px] text-zinc-600">Accessed {m.accessCount}x</span>
                  <span className="text-[10px] text-zinc-600">{new Date(m.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {!filtered.length && <div className="text-center py-12 text-zinc-600 text-sm">No memories in this category</div>}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ── Tasks Panel ────────────────────────────────────────────────────────────────
function TasksPanel() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/nova/tasks', { headers: { 'x-api-key': window.__nova_key || '' } });
      const d = await r.json();
      setTasks(d.tasks || []);
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!newTitle.trim()) return;
    const r = await fetch('/api/nova/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key || '' }, body: JSON.stringify({ title: newTitle }) });
    const d = await r.json();
    if (d.task) { setTasks(t => [d.task, ...t]); setNewTitle(''); toast.success('Task created'); }
  };

  const update = async (id: string, status: string) => {
    await fetch('/api/nova/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-api-key': window.__nova_key || '' }, body: JSON.stringify({ id, status }) });
    setTasks(t => t.map(x => x.id === id ? { ...x, status } : x));
  };

  const STATUS_COLORS: Record<string, string> = { pending: 'text-yellow-400', in_progress: 'text-blue-400', completed: 'text-green-400', cancelled: 'text-red-400' };
  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div><h2 className="text-sm font-semibold">Task Manager</h2><p className="text-xs text-zinc-500">{tasks.filter(t => t.status !== 'completed').length} active</p></div>
        <button onClick={load} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex gap-2">
        <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="New task..." className="flex-1 h-8 text-sm bg-white/5 border-white/10" />
        <Button onClick={add} size="sm" className="h-8 px-3 bg-violet-600 hover:bg-violet-700"><Plus className="w-3.5 h-3.5" /></Button>
      </div>
      <div className="flex gap-1 flex-wrap">
        {['all', 'pending', 'in_progress', 'completed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={cn('px-2 py-1 rounded-lg text-xs transition-colors capitalize', filter === s ? 'bg-violet-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10')}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>
      <ScrollArea className="flex-1">
        {loading ? <div className="flex items-center justify-center h-32"><RefreshCw className="w-5 h-5 animate-spin text-zinc-500" /></div> : (
          <div className="space-y-2">
            {filtered.map(task => (
              <div key={task.id} className="p-3 rounded-xl bg-white/5 border border-white/8">
                <div className="flex items-start gap-2">
                  <button onClick={() => update(task.id, task.status === 'completed' ? 'pending' : 'completed')}
                    className={cn('w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center transition-colors', task.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-zinc-600 hover:border-violet-500')}>
                    {task.status === 'completed' && <Check className="w-2.5 h-2.5 text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-medium truncate', task.status === 'completed' ? 'line-through text-zinc-500' : 'text-zinc-200')}>{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn('text-[10px] capitalize', STATUS_COLORS[task.status])}>{task.status.replace('_', ' ')}</span>
                      <span className="text-[10px] text-zinc-600">{new Date(task.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Select value={task.status} onValueChange={v => update(task.id, v)}>
                    <SelectTrigger className="h-6 w-24 text-[10px] bg-transparent border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['pending', 'in_progress', 'completed', 'cancelled'].map(s => (
                        <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            {!filtered.length && <div className="text-center py-12 text-zinc-600 text-sm">No tasks</div>}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ── Settings Panel ────────────────────────────────────────────────────────────
function SettingsPanel() {
  const { settings, updateSettings } = useNovaStore();
  return (
    <div className="flex flex-col gap-4">
      <div><h2 className="text-sm font-semibold">Settings</h2><p className="text-xs text-zinc-500">Configure Nova's behaviour</p></div>
      <div className="space-y-3">
        {[
          { key: 'voiceEnabled', label: 'Voice Input', desc: 'Enable microphone for speech', icon: Mic },
          { key: 'ttsEnabled', label: 'Text to Speech', desc: 'Nova speaks responses aloud', icon: Volume2 },
          { key: 'proactiveEnabled', label: 'Proactive Mode', desc: 'Nova suggests actions', icon: Sparkles },
          { key: 'offlineMode', label: 'Offline Mode', desc: 'Use cached responses only', icon: Wifi },
        ].map(({ key, label, desc, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center"><Icon className="w-4 h-4 text-zinc-400" /></div>
              <div><p className="text-xs font-medium">{label}</p><p className="text-[11px] text-zinc-500">{desc}</p></div>
            </div>
            <Switch checked={!!(settings as any)[key]} onCheckedChange={v => updateSettings({ [key]: v } as any)} />
          </div>
        ))}
        <div className="p-3 rounded-xl bg-white/5 border border-white/8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center"><SlidersHorizontal className="w-4 h-4 text-zinc-400" /></div>
            <div><p className="text-xs font-medium">TTS Speed</p><p className="text-[11px] text-zinc-500">Speech rate: {settings.ttsSpeed}x</p></div>
          </div>
          <Slider min={0.5} max={2} step={0.1} value={[settings.ttsSpeed]}
            onValueChange={([v]) => updateSettings({ ttsSpeed: v })} className="w-full" />
        </div>
        <div className="p-3 rounded-xl bg-white/5 border border-white/8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center"><Brain className="w-4 h-4 text-zinc-400" /></div>
            <div><p className="text-xs font-medium">Safety Level</p><p className="text-[11px] text-zinc-500">Content filter intensity</p></div>
          </div>
          <Select value={(settings as any).safetyLevel || 'balanced'}
            onValueChange={v => updateSettings({ safetyLevel: v } as any)}>
            <SelectTrigger className="h-8 text-xs bg-transparent border-white/10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="strict" className="text-xs">Strict</SelectItem>
              <SelectItem value="balanced" className="text-xs">Balanced</SelectItem>
              <SelectItem value="permissive" className="text-xs">Permissive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="p-3 rounded-xl bg-violet-950/40 border border-violet-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-3.5 h-3.5 text-violet-400" />
            <p className="text-xs font-medium text-violet-300">Model: Kimi K2.5</p>
          </div>
          <p className="text-[11px] text-violet-400/60">128k context · Extended thinking · Vision</p>
        </div>
      </div>
    </div>
  );
}

// ── Logs Panel ────────────────────────────────────────────────────────────────
function LogsPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const LEVEL_COLORS: Record<string, string> = { debug: 'text-zinc-500', info: 'text-blue-400', warn: 'text-yellow-400', error: 'text-red-400' };

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
          <div className="space-y-1">
            {logs.slice().reverse().map(log => (
              <div key={log.id} className="text-[11px] px-2 py-1.5 rounded-lg hover:bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-600 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className={cn('uppercase text-[10px] font-bold shrink-0 w-8', LEVEL_COLORS[log.level])}>{log.level}</span>
                  <span className="text-zinc-400 shrink-0 text-[10px]">[{log.category}]</span>
                  <span className="text-zinc-300 truncate">{log.message}</span>
                </div>
              </div>
            ))}
            {!logs.length && <div className="text-center py-12 text-zinc-600 text-sm">No logs yet</div>}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
declare global { interface Window { __nova_key?: string } }

export default function NovaApp() {
  const { messages, addMessage, updateLastMessage, clearMessages, settings, systemStats } = useNovaStore();
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [enableThinking, setEnableThinking] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [thinkingBuffer, setThinkingBuffer] = useState('');
  const [tokenCount, setTokenCount] = useState<{ prompt: number; completion: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const API_KEY = process.env.NEXT_PUBLIC_NOVA_API_KEY || '';

  useEffect(() => { window.__nova_key = API_KEY; }, [API_KEY]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() && selectedImages.length === 0) return;
    if (isProcessing) return;

    const userMsg = input.trim();
    setInput('');
    setSelectedImages([]);
    setIsProcessing(true);
    setThinkingBuffer('');
    setTokenCount(null);

    addMessage({ role: 'user', content: userMsg, images: selectedImages.length > 0 ? selectedImages : undefined });

    const assistantId = addMessage({ role: 'assistant', content: '', thinking: '' });
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
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim().startsWith('data:')) continue;
          const jsonStr = line.slice(line.indexOf(':') + 1).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'thinking') { thinkingAcc += event.content; setThinkingBuffer(thinkingAcc); }
            if (event.type === 'content') { contentAcc += event.content; }
            if (event.type === 'usage') setTokenCount({ prompt: event.usage.prompt_tokens, completion: event.usage.completion_tokens });
            if (event.type === 'done') { }
            if (event.type === 'error') throw new Error(event.message);
            updateLastMessage(contentAcc, thinkingAcc || undefined);
          } catch { }
        }
      }
    } catch (err) {
      updateLastMessage(`Error: ${err instanceof Error ? err.message : 'Something went wrong'}`, undefined);
      toast.error('Failed to get response');
    } finally {
      setIsProcessing(false);
      setStreamingId(null);
      setThinkingBuffer('');
    }
  }, [input, selectedImages, isProcessing, sessionId, enableThinking, API_KEY, addMessage, updateLastMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setSelectedImages(prev => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 240, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="flex flex-col border-r border-white/8 bg-zinc-900/50 shrink-0 overflow-hidden">
            {/* Logo */}
            <div className="p-4 border-b border-white/8">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold tracking-tight">Nova</p>
                  <p className="text-[10px] text-zinc-500">Kimi K2.5 · 128k ctx</p>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
                    activeTab === id ? 'bg-violet-600/20 text-violet-300 font-medium' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200')}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                  {id === 'chat' && messages.length > 0 && (
                    <span className="ml-auto text-[10px] bg-violet-600/30 text-violet-400 px-1.5 py-0.5 rounded-full">{messages.length}</span>
                  )}
                </button>
              ))}
            </nav>

            {/* Stats */}
            <div className="p-3 border-t border-white/8">
              <div className="p-2.5 rounded-xl bg-white/4 space-y-2">
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <Database className="w-3 h-3" /><span>{systemStats.memoryCount} memories</span>
                  <span className="ml-auto text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />Live</span>
                </div>
                {tokenCount && (
                  <div className="text-[10px] text-zinc-600">
                    Tokens: {tokenCount.prompt}↑ {tokenCount.completion}↓
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
        <header className="flex items-center gap-3 px-4 h-12 border-b border-white/8 bg-zinc-900/30 shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
            <PanelLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium capitalize">{activeTab}</span>
            {activeTab === 'chat' && (
              <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-400 h-5">
                <Infinity className="w-2.5 h-2.5 mr-1" />128k
              </Badge>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {activeTab === 'chat' && (
              <>
                <button onClick={() => setEnableThinking(!enableThinking)}
                  className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all', enableThinking ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-zinc-400 hover:bg-white/8')}>
                  <Brain className="w-3.5 h-3.5" />
                  <span>Think</span>
                </button>
                <button onClick={() => { clearMessages(); toast.success('Conversation cleared'); }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-red-400 transition-colors">
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
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-center">
                      <h2 className="text-xl font-semibold mb-1">Nova AI</h2>
                      <p className="text-sm text-zinc-400 max-w-sm">Powered by Kimi K2.5 with 128k context. Ask me anything — I think deeply before answering.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 w-full max-w-md mt-2">
                      {[
                        { icon: FileCode2, text: 'Review my code', prompt: 'Can you review this code and suggest improvements?' },
                        { icon: BookOpen, text: 'Explain a concept', prompt: 'Explain how transformers work in detail' },
                        { icon: Wand2, text: 'Write something', prompt: 'Write a compelling short story about AI and humanity' },
                        { icon: Search, text: 'Research a topic', prompt: 'Give me a comprehensive overview of quantum computing' },
                      ].map(({ icon: Icon, text, prompt }) => (
                        <button key={text} onClick={() => { setInput(prompt); textareaRef.current?.focus(); }}
                          className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 hover:border-violet-500/30 transition-all text-left">
                          <Icon className="w-4 h-4 text-violet-400 shrink-0" />
                          <span className="text-xs text-zinc-300">{text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5 max-w-4xl mx-auto">
                    {messages.map((msg, i) => (
                      <MessageBubble key={msg.id} message={msg as any} isStreaming={streamingId === msg.id && isProcessing} />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Input area */}
              <div className="p-4 border-t border-white/8 bg-zinc-900/30 shrink-0">
                {/* Image previews */}
                {selectedImages.length > 0 && (
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {selectedImages.map((img, i) => (
                      <div key={i} className="relative group">
                        <img src={img} alt="" className="h-16 w-16 rounded-xl object-cover border border-white/20" />
                        <button onClick={() => setSelectedImages(imgs => imgs.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 items-end max-w-4xl mx-auto">
                  <div className="flex-1 relative">
                    <Textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                      placeholder={enableThinking ? "Ask Nova to think deeply..." : "Message Nova... (Shift+Enter for new line)"}
                      rows={1} className="resize-none pr-10 bg-zinc-800/50 border-white/10 focus:border-violet-500/50 text-sm min-h-[44px] max-h-48 py-3"
                      style={{ height: 'auto', overflow: 'auto' }}
                      onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 192) + 'px'; }} />
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
                    <button onClick={() => fileInputRef.current?.click()}
                      className="w-9 h-9 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button onClick={sendMessage} disabled={isProcessing || (!input.trim() && selectedImages.length === 0)}
                      className={cn('w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                        isProcessing ? 'bg-zinc-700 text-zinc-500' : 'bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-900/30')}>
                      {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <p className="text-center text-[10px] text-zinc-600 mt-2">Nova may make mistakes · Kimi K2.5 · 128k context</p>
              </div>
            </div>
          ) : (
            <div className="p-4 h-full overflow-hidden flex flex-col">
              {activeTab === 'memory' && <MemoryPanel />}
              {activeTab === 'tasks' && <TasksPanel />}
              {activeTab === 'settings' && <SettingsPanel />}
              {activeTab === 'logs' && <LogsPanel />}
              {activeTab === 'search' && (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3">
                  <Globe className="w-10 h-10 opacity-30" />
                  <p className="text-sm">Web search — ask Nova in chat to search the web</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
