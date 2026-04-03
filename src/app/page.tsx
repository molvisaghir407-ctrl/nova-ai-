'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Mic, Settings, Brain, ListTodo,
  Send, Sparkles, RefreshCw, Trash2, Plus, Check, Clock,
  ChevronRight, Lightbulb, Code, FileText, BookOpen, ChevronDown,
  Globe, X, Menu, Image as ImageIcon, Copy, CheckCircle, ThumbsUp,
  ThumbsDown, RotateCcw
} from 'lucide-react';
import { useNovaStore, Message } from '@/lib/nova/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Utility function for class names
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// ============ IMAGE UPLOADER ============
function ImageUploader({ onImageSelect, selectedImages, onRemoveImage }: {
  onImageSelect: (images: string[]) => void;
  selectedImages: string[];
  onRemoveImage: (index: number) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const newImages: string[] = [];
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          newImages.push(base64);
          if (newImages.length === files.length) {
            onImageSelect([...selectedImages, ...newImages]);
          }
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  return (
    <div
      className={`relative ${isDragging ? 'ring-2 ring-violet-500 ring-offset-2 rounded-xl' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {selectedImages.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 p-3 bg-muted/30 rounded-xl">
          {selectedImages.map((img, idx) => (
            <motion.div
              key={idx}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative group"
            >
              <img src={img} alt={`Upload ${idx + 1}`} className="w-20 h-20 object-cover rounded-xl border border-border/50 shadow-md" />
              <button
                onClick={() => onRemoveImage(idx)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer hover:scale-110 shadow-lg"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
          <button
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.multiple = true;
              input.onchange = (e) => handleFileSelect((e.target as HTMLInputElement).files);
              input.click();
            }}
            className="w-20 h-20 border-2 border-dashed border-muted-foreground/30 rounded-xl flex items-center justify-center hover:border-violet-500 hover:bg-violet-500/10 transition-all cursor-pointer"
          >
            <Plus className="w-6 h-6 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}

// ============ TYPING CURSOR ============
function TypingCursor() {
  return (
    <motion.span
      animate={{ opacity: [1, 0] }}
      transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
      className="inline-block w-2 h-5 bg-violet-500 rounded-sm ml-0.5 align-middle"
    />
  );
}

// ============ THINKING DISPLAY ============
function ThinkingDisplay({ thinking, isExpanded }: { thinking: string; isExpanded: boolean }) {
  if (!thinking) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
      className="overflow-hidden"
    >
      <div className="mb-4 p-4 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-violet-500/10 border border-violet-500/20 rounded-2xl">
        <div className="flex items-center gap-2 mb-3 text-violet-400">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Lightbulb className="w-4 h-4" />
          </motion.div>
          <span className="text-sm font-medium">Thinking Process</span>
        </div>
        <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {thinking}
        </div>
      </div>
    </motion.div>
  );
}

// ============ MESSAGE BUBBLE ============
function MessageBubble({ message, onCopy, isStreaming = false }: {
  message: Message;
  onCopy: (text: string) => void;
  isStreaming?: boolean;
}) {
  const [showThinking, setShowThinking] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasThinking = message.thinking;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    onCopy(text);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatContent = (content: string, streaming: boolean) => {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              const isInline = !match;
              
              if (isInline) {
                return (
                  <code className="px-1.5 py-0.5 bg-muted/80 rounded-md text-sm font-mono text-violet-300" {...props}>
                    {children}
                  </code>
                );
              }
              
              return (
                <div className="relative group my-4 -mx-2">
                  <div className="absolute top-0 left-0 right-0 bg-muted/90 backdrop-blur px-4 py-2.5 rounded-t-xl flex items-center justify-between border-b border-border/50">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{match[1]}</span>
                    <button
                      onClick={() => handleCopy(String(children).replace(/\n$/, ''))}
                      className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {copied ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    className="!mt-0 !pt-12 !rounded-xl !rounded-t-none"
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              );
            },
            p({ children }) {
              return <p className="mb-4 last:mb-0 leading-relaxed">{children}{streaming && <TypingCursor />}</p>;
            },
            h1({ children }) {
              return <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0 bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">{children}</h1>;
            },
            h2({ children }) {
              return <h2 className="text-xl font-bold mb-3 mt-5 first:mt-0 text-violet-300">{children}</h2>;
            },
            h3({ children }) {
              return <h3 className="text-lg font-semibold mb-2 mt-4 first:mt-0 text-violet-200">{children}</h3>;
            },
            ul({ children }) {
              return <ul className="list-disc pl-5 mb-4 space-y-1.5">{children}</ul>;
            },
            ol({ children }) {
              return <ol className="list-decimal pl-5 mb-4 space-y-1.5">{children}</ol>;
            },
            li({ children }) {
              return <li className="leading-relaxed">{children}</li>;
            },
            blockquote({ children }) {
              return (
                <blockquote className="border-l-4 border-violet-500 pl-4 my-4 italic text-muted-foreground bg-muted/30 py-2 rounded-r-lg">
                  {children}
                </blockquote>
              );
            },
            a({ href, children }) {
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors cursor-pointer">
                  {children}
                </a>
              );
            },
            strong({ children }) {
              return <strong className="font-bold text-foreground">{children}</strong>;
            },
            em({ children }) {
              return <em className="italic text-violet-300">{children}</em>;
            },
            hr() {
              return <hr className="my-6 border-border/50" />;
            },
            table({ children }) {
              return (
                <div className="overflow-x-auto my-4 rounded-xl border border-border/50">
                  <table className="min-w-full">{children}</table>
                </div>
              );
            },
            th({ children }) {
              return <th className="bg-muted/80 px-4 py-3 text-left font-semibold border-b border-border/50">{children}</th>;
            },
            td({ children }) {
              return <td className="px-4 py-3 border-b border-border/30">{children}</td>;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn('group flex gap-4', message.role === 'user' && 'flex-row-reverse')}
    >
      {/* Avatar */}
      <motion.div
        whileHover={{ scale: 1.1, rotate: message.role === 'user' ? -5 : 5 }}
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg',
          message.role === 'user'
            ? 'bg-gradient-to-br from-blue-500 to-cyan-400'
            : 'bg-gradient-to-br from-violet-500 to-purple-600'
        )}
      >
        {message.role === 'user' ? (
          <span className="text-sm font-bold text-white">U</span>
        ) : (
          <Sparkles className="w-5 h-5 text-white" />
        )}
      </motion.div>

      {/* Content */}
      <div className={cn('flex-1 max-w-[85%]', message.role === 'user' && 'flex flex-col items-end')}>
        {/* Images */}
        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {message.images.map((img, idx) => (
              <img key={idx} src={img} alt="Attached" className="max-w-[200px] rounded-xl border border-border/50 shadow-lg" />
            ))}
          </div>
        )}

        {/* Thinking Toggle */}
        {hasThinking && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowThinking(!showThinking)}
            className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 mb-3 transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-violet-500/10"
          >
            <Lightbulb className="w-4 h-4" />
            <span>{showThinking ? 'Hide' : 'Show'} thinking process</span>
            <motion.span animate={{ rotate: showThinking ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="w-4 h-4" />
            </motion.span>
          </motion.button>
        )}

        {/* Thinking Display */}
        {hasThinking && <ThinkingDisplay thinking={message.thinking || ''} isExpanded={showThinking} />}

        {/* Main Bubble */}
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className={cn(
            'rounded-2xl px-5 py-4 shadow-lg',
            message.role === 'user'
              ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white'
              : 'bg-card border border-border/50 backdrop-blur-sm'
          )}
        >
          {message.role === 'assistant' ? (
            formatContent(message.content, isStreaming)
          ) : (
            <p className="text-sm leading-relaxed">{message.content}</p>
          )}
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn('flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity', message.role === 'user' && 'flex-row-reverse')}
        >
          <button onClick={() => handleCopy(message.content)} className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer" title="Copy">
            {copied ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
          </button>
          {message.role === 'assistant' && (
            <>
              <button className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer" title="Good response">
                <ThumbsUp className="w-4 h-4 text-muted-foreground hover:text-emerald-500" />
              </button>
              <button className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer" title="Bad response">
                <ThumbsDown className="w-4 h-4 text-muted-foreground hover:text-red-500" />
              </button>
              <button className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer" title="Regenerate">
                <RotateCcw className="w-4 h-4 text-muted-foreground" />
              </button>
            </>
          )}
          <span className="text-xs text-muted-foreground ml-2 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {message.timestamp.toLocaleTimeString()}
            {message.duration && <span className="text-violet-400">· {message.duration}ms</span>}
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ============ CHAT PANEL ============
function ChatPanel() {
  const { messages, addMessage, updateLastMessage, isProcessing, setIsProcessing, settings, sessionId, clearMessages } = useNovaStore();
  const [input, setInput] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [enableThinking, setEnableThinking] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, streamingContent]);

  const sendMessage = async () => {
    if ((!input.trim() && selectedImages.length === 0) || isProcessing) return;

    const userMessage = input.trim();
    const images = [...selectedImages];
    
    addMessage({
      role: 'user',
      content: userMessage || 'Analyze this image',
      images: images.length > 0 ? images : undefined,
    });
    
    setInput('');
    setSelectedImages([]);
    setIsProcessing(true);
    setStreamingContent('');
    setStreamingThinking('');

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/nova/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          sessionId,
          images,
          enableThinking,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let fullContent = '';
      let thinking = '';
      let duration = 0;
      let msgCount = 0;

      // Add placeholder message for streaming
      const placeholderId = addMessage({
        role: 'assistant',
        content: '',
        duration: 0,
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'thinking') {
                thinking = data.content;
                setStreamingThinking(thinking);
              } else if (data.type === 'metadata') {
                duration = data.duration;
                msgCount = data.messageCount;
              } else if (data.type === 'content') {
                fullContent += data.content;
                setStreamingContent(fullContent);
                // Update the last message in real-time
                updateLastMessage(fullContent, thinking, duration);
              } else if (data.type === 'done') {
                // Final update
                updateLastMessage(fullContent, thinking, duration);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      // Clear streaming state
      setStreamingContent('');
      setStreamingThinking('');

    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast.info('Request cancelled');
      } else {
        toast.error('Failed to get response');
        addMessage({
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        });
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleCopy = () => {
    toast.success('Copied to clipboard');
  };

  const quickActions = [
    { icon: Lightbulb, label: 'Explain', prompt: 'Explain in detail: ', color: 'from-amber-500 to-orange-500' },
    { icon: Code, label: 'Code', prompt: 'Write code for: ', color: 'from-emerald-500 to-teal-500' },
    { icon: FileText, label: 'Summarize', prompt: 'Summarize: ', color: 'from-blue-500 to-cyan-500' },
    { icon: BookOpen, label: 'Research', prompt: 'Research and explain: ', color: 'from-violet-500 to-purple-500' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ rotate: 15, scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25 cursor-pointer"
          >
            <Sparkles className="w-5 h-5 text-white" />
          </motion.div>
          <div>
            <h2 className="font-bold text-lg bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">Nova AI</h2>
            <div className="flex items-center gap-2">
              <motion.span 
                animate={{ scale: [1, 1.2, 1] }} 
                transition={{ duration: 2, repeat: Infinity }} 
                className="w-2 h-2 rounded-full bg-emerald-500" 
              />
              <p className="text-xs text-muted-foreground">Always here to help</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setEnableThinking(!enableThinking)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer font-medium text-sm',
              enableThinking
                ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                : 'hover:bg-muted text-muted-foreground border border-transparent'
            )}
          >
            <Lightbulb className="w-4 h-4" />
            <span>Think</span>
          </motion.button>
          <Button variant="ghost" size="icon" onClick={clearMessages} title="Clear chat" className="cursor-pointer hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center"
            >
              <motion.div
                whileHover={{ rotate: 15, scale: 1.1 }}
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="w-28 h-28 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-8 shadow-2xl shadow-violet-500/30 cursor-pointer"
              >
                <Sparkles className="w-14 h-14 text-white" />
              </motion.div>
              
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl font-bold mb-4 bg-gradient-to-r from-violet-400 via-purple-400 to-violet-400 bg-clip-text text-transparent"
              >
                Hello, I&apos;m Nova
              </motion.h2>
              
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-muted-foreground max-w-md mb-10 text-lg leading-relaxed"
              >
                Your advanced AI assistant with deep thinking, image understanding, and real-time streaming responses.
              </motion.p>

              {/* Quick Actions */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl"
              >
                {quickActions.map((action, idx) => (
                  <motion.button
                    key={action.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + idx * 0.1 }}
                    whileHover={{ scale: 1.03, y: -3 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setInput(action.prompt)}
                    className={`flex flex-col items-center gap-3 p-5 rounded-2xl bg-gradient-to-br ${action.color} bg-opacity-10 border border-white/10 hover:border-white/20 hover:shadow-xl transition-all cursor-pointer group`}
                  >
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                      <action.icon className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-medium text-foreground">{action.label}</span>
                  </motion.button>
                ))}
              </motion.div>

              {/* Feature badges */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex flex-wrap justify-center gap-2 mt-10"
              >
                {[
                  { icon: ImageIcon, label: 'Image Analysis' },
                  { icon: Lightbulb, label: 'Deep Thinking' },
                  { icon: Code, label: 'Code Generation' },
                  { icon: Globe, label: 'Web Search' },
                ].map((feature) => (
                  <Badge key={feature.label} variant="secondary" className="px-3 py-1.5 cursor-pointer hover:bg-violet-500/20 hover:text-violet-400 transition-colors">
                    <feature.icon className="w-3 h-3 mr-1.5" /> {feature.label}
                  </Badge>
                ))}
              </motion.div>
            </motion.div>
          )}

          <AnimatePresence mode="popLayout">
            {messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onCopy={handleCopy}
                isStreaming={isProcessing && idx === messages.length - 1 && msg.role === 'assistant'}
              />
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto">
          {/* Image Uploader */}
          <ImageUploader
            selectedImages={selectedImages}
            onImageSelect={setSelectedImages}
            onRemoveImage={(idx) => setSelectedImages(selectedImages.filter((_, i) => i !== idx))}
          />

          {/* Input Row */}
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={selectedImages.length > 0 ? "Ask about the images..." : "Message Nova..."}
                className="min-h-[56px] max-h-[200px] resize-none pr-14 rounded-2xl border-border/50 focus:border-violet-500 focus:ring-violet-500/20 bg-muted/30 text-base"
                disabled={isProcessing}
                rows={1}
              />
              <button
                onClick={() => {
                  const inputEl = document.createElement('input');
                  inputEl.type = 'file';
                  inputEl.accept = 'image/*';
                  inputEl.multiple = true;
                  inputEl.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files;
                    if (files) {
                      Array.from(files).forEach(file => {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const base64 = ev.target?.result as string;
                          setSelectedImages(prev => [...prev, base64]);
                        };
                        reader.readAsDataURL(file);
                      });
                    }
                  };
                  inputEl.click();
                }}
                className="absolute right-4 bottom-3.5 p-2 rounded-lg hover:bg-violet-500/20 transition-colors cursor-pointer text-muted-foreground hover:text-violet-400"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
            </div>
            
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={sendMessage}
                disabled={(!input.trim() && selectedImages.length === 0) || isProcessing}
                className="h-[56px] px-8 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25 cursor-pointer text-base font-medium"
              >
                {isProcessing ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </motion.div>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-3">
            Nova responds with streaming text • Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground">Enter</kbd> to send • <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground">Shift+Enter</kbd> for new line
          </p>
        </div>
      </div>
    </div>
  );
}

// ============ MEMORY PANEL ============
function MemoryPanel() {
  const { memories, setMemories, addMemory } = useNovaStore();
  const [newMemory, setNewMemory] = useState({ category: 'fact', content: '' });

  useEffect(() => {
    fetch('/api/nova/memory?limit=50')
      .then(res => res.json())
      .then(data => data.success && setMemories(data.memories))
      .catch(() => toast.error('Failed to load memories'));
  }, [setMemories]);

  const addNewMemory = async () => {
    if (!newMemory.content.trim()) return;
    try {
      const res = await fetch('/api/nova/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMemory),
      });
      const data = await res.json();
      if (data.success) {
        addMemory(data.memory);
        setNewMemory({ category: 'fact', content: '' });
        toast.success('Memory stored');
      }
    } catch {
      toast.error('Failed to store memory');
    }
  };

  const categoryColors: Record<string, string> = {
    fact: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    preference: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    conversation: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    note: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    skill: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-border/50 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-violet-400" /> Add Memory
            </CardTitle>
            <CardDescription>Store information for Nova to remember</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={newMemory.category} onValueChange={(v) => setNewMemory({ ...newMemory, category: v })}>
              <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fact" className="cursor-pointer">Fact</SelectItem>
                <SelectItem value="preference" className="cursor-pointer">Preference</SelectItem>
                <SelectItem value="note" className="cursor-pointer">Note</SelectItem>
              </SelectContent>
            </Select>
            <Textarea value={newMemory.content} onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })} placeholder="What should Nova remember..." rows={3} className="resize-none cursor-text" />
            <Button onClick={addNewMemory} disabled={!newMemory.content.trim()} className="cursor-pointer"><Plus className="w-4 h-4 mr-2" /> Store</Button>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-border/50 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Brain className="w-5 h-5 text-violet-400" /> Memory Bank <Badge variant="secondary" className="ml-auto cursor-pointer">{memories.length}</Badge></CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {memories.map((memory, idx) => (
                  <motion.div key={memory.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }} className="p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-all group cursor-default">
                    <Badge variant="outline" className={cn('mb-2', categoryColors[memory.category])}>{memory.category}</Badge>
                    <p className="text-sm">{memory.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">{new Date(memory.createdAt).toLocaleDateString()}</p>
                  </motion.div>
                ))}
                {memories.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Brain className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>No memories yet</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ============ TASKS PANEL ============
function TasksPanel() {
  const { tasks, setTasks, addTask, updateTask } = useNovaStore();
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 5 });
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  useEffect(() => {
    fetch('/api/nova/tasks')
      .then(res => res.json())
      .then(data => data.success && setTasks(data.tasks))
      .catch(() => toast.error('Failed to load tasks'));
  }, [setTasks]);

  const createTask = async () => {
    if (!newTask.title.trim()) return;
    try {
      const res = await fetch('/api/nova/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      const data = await res.json();
      if (data.success) {
        addTask(data.task);
        setNewTask({ title: '', description: '', priority: 5 });
        toast.success('Task created');
      }
    } catch {
      toast.error('Failed to create task');
    }
  };

  const toggleTask = async (task: any) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await fetch('/api/nova/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, status: newStatus }),
    });
    updateTask(task.id, { status: newStatus });
  };

  const filteredTasks = tasks.filter((t) => filter === 'all' || t.status === filter);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-border/50 shadow-xl">
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-violet-400" /> New Task</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Task title..." className="cursor-text" />
            <Textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Description..." rows={2} className="resize-none cursor-text" />
            <div className="flex items-center gap-4">
              <Select value={String(newTask.priority)} onValueChange={(v) => setNewTask({ ...newTask, priority: Number(v) })}>
                <SelectTrigger className="w-24 cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>{[1,2,3,4,5,6,7,8,9,10].map(p => <SelectItem key={p} value={String(p)} className="cursor-pointer">P{p}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={createTask} disabled={!newTask.title.trim()} className="cursor-pointer"><Plus className="w-4 h-4 mr-2" /> Add</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-border/50 shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><ListTodo className="w-5 h-5 text-violet-400" /> Tasks</CardTitle>
              <div className="flex gap-1">{(['all', 'pending', 'completed'] as const).map(f => (
                <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="cursor-pointer">{f}</Button>
              ))}</div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredTasks.map((task) => (
                  <motion.div key={task.id} className={cn('p-4 rounded-xl border border-border/50 transition-all group cursor-default', task.status === 'completed' && 'opacity-60')}>
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="icon" className={cn('w-6 h-6 rounded-full cursor-pointer', task.status === 'completed' && 'bg-emerald-500 text-white')} onClick={() => toggleTask(task)}>
                        {task.status === 'completed' && <Check className="w-4 h-4" />}
                      </Button>
                      <p className={cn('flex-1', task.status === 'completed' && 'line-through')}>{task.title}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ============ SETTINGS PANEL ============
function SettingsPanel() {
  const { settings, updateSettings } = useNovaStore();

  useEffect(() => {
    fetch('/api/nova/settings')
      .then(res => res.json())
      .then(data => data.success && updateSettings(data.settings));
  }, [updateSettings]);

  const save = async (updates: any) => {
    updateSettings(updates);
    await fetch('/api/nova/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    toast.success('Saved');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Card className="border-border/50 shadow-xl">
        <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5 text-violet-400" /> Settings</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between"><p>Text-to-Speech</p><Switch checked={settings.ttsEnabled} onCheckedChange={(v) => save({ ttsEnabled: v })} className="cursor-pointer" /></div>
          <div className="flex items-center justify-between"><p>Proactive Suggestions</p><Switch checked={settings.proactiveEnabled} onCheckedChange={(v) => save({ proactiveEnabled: v })} className="cursor-pointer" /></div>
          <div className="space-y-2">
            <p>TTS Voice</p>
            <Select value={settings.ttsVoice} onValueChange={(v) => save({ ttsVoice: v })}>
              <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tongtong" className="cursor-pointer">Tongtong</SelectItem>
                <SelectItem value="chuichui" className="cursor-pointer">Chuichui</SelectItem>
                <SelectItem value="jam" className="cursor-pointer">Jam</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><p>Speed</p><span>{settings.ttsSpeed.toFixed(1)}x</span></div>
            <Slider value={[settings.ttsSpeed]} min={0.5} max={2} step={0.1} onValueCommit={([v]) => save({ ttsSpeed: v })} className="cursor-pointer" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ MAIN PAGE ============
export default function NovaDashboard() {
  const [activeTab, setActiveTab] = useState<'chat' | 'memory' | 'tasks' | 'settings'>('chat');
  const { systemStats } = useNovaStore();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ rotate: 15, scale: 1.1 }} className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25 cursor-pointer">
              <Sparkles className="w-5 h-5 text-white" />
            </motion.div>
            <div>
              <h1 className="font-bold text-xl bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">Nova AI</h1>
              <p className="text-xs text-muted-foreground">Streaming AI Assistant</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <motion.span whileHover={{ scale: 1.05 }} className="text-sm cursor-pointer flex items-center gap-2"><MessageSquare className="w-4 h-4 text-violet-400" /><b>{systemStats.messageCount}</b> messages</motion.span>
            <motion.span whileHover={{ scale: 1.05 }} className="text-sm cursor-pointer flex items-center gap-2"><Brain className="w-4 h-4 text-blue-400" /><b>{systemStats.memoryCount}</b> memories</motion.span>
          </div>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 cursor-pointer"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />Online</Badge>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden lg:block w-60 border-r border-border/50 bg-muted/10 p-4">
          <nav className="space-y-1">
            {[
              { id: 'chat', icon: MessageSquare, label: 'Chat' },
              { id: 'memory', icon: Brain, label: 'Memory' },
              { id: 'tasks', icon: ListTodo, label: 'Tasks' },
              { id: 'settings', icon: Settings, label: 'Settings' },
            ].map((item) => (
              <motion.button
                key={item.id}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab(item.id as any)}
                className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer', activeTab === item.id ? 'bg-violet-500/15 text-violet-400' : 'hover:bg-muted text-muted-foreground')}
              >
                <item.icon className="w-5 h-5" /><span className="font-medium">{item.label}</span>
              </motion.button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
              {activeTab === 'chat' && <ChatPanel />}
              {activeTab === 'memory' && <MemoryPanel />}
              {activeTab === 'tasks' && <TasksPanel />}
              {activeTab === 'settings' && <SettingsPanel />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border flex justify-around p-2">
        {[{ id: 'chat', icon: MessageSquare }, { id: 'memory', icon: Brain }, { id: 'tasks', icon: ListTodo }, { id: 'settings', icon: Settings }].map((item) => (
          <motion.button key={item.id} whileTap={{ scale: 0.9 }} onClick={() => setActiveTab(item.id as any)} className={cn('flex flex-col items-center gap-1 p-2 rounded-xl cursor-pointer', activeTab === item.id && 'text-violet-400 bg-violet-500/10')}>
            <item.icon className="w-5 h-5" />
          </motion.button>
        ))}
      </nav>
    </div>
  );
}
