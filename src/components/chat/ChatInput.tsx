'use client';
import { useRef, useCallback } from 'react';
import { Send, Paperclip, Brain, RefreshCw, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  isProcessing: boolean;
  enableThinking: boolean;
  onThinkingToggle: () => void;
  selectedImages: string[];
  onImageAdd: (images: string[]) => void;
  onImageRemove: (i: number) => void;
  messageCount: number;
}

export function ChatInput({ value, onChange, onSend, isProcessing, enableThinking, onThinkingToggle, selectedImages, onImageAdd, onImageRemove, messageCount }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newImgs: string[] = [];
    const files = Array.from(e.target.files ?? []);
    let loaded = 0;
    if (!files.length) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        newImgs.push(ev.target?.result as string);
        if (++loaded === files.length) onImageAdd(newImgs);
      };
      reader.readAsDataURL(file as unknown as Blob);
    });
    if (e.target) e.target.value = '';
  };

  const canSend = !isProcessing && (value.trim().length > 0 || selectedImages.length > 0);

  return (
    <div className="shrink-0 border-t border-white/8 bg-zinc-900/60 px-4 py-3">
      {selectedImages.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap max-w-3xl mx-auto">
          {selectedImages.map((img, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="attachment" className="h-14 w-14 rounded-xl object-cover border border-white/20" />
              <button onClick={() => onImageRemove(i)} aria-label="Remove image"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 max-w-3xl mx-auto">
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
        <button onClick={() => fileInputRef.current?.click()} aria-label="Attach image"
          className="w-9 h-9 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-violet-500/30 text-zinc-500 hover:text-violet-400 transition-all shrink-0 mb-0.5">
          <Paperclip className="w-4 h-4" />
        </button>
        <button onClick={onThinkingToggle} aria-label="Toggle thinking"
          className={cn('w-9 h-9 rounded-xl border flex items-center justify-center transition-all shrink-0 mb-0.5', enableThinking ? 'bg-violet-600/20 border-violet-500/40 text-violet-400' : 'bg-zinc-800 border-white/10 text-zinc-500 hover:text-violet-400 hover:border-violet-500/30')}>
          <Brain className="w-4 h-4" />
        </button>
        <Textarea ref={textareaRef} value={value}
          onChange={e => { onChange(e.target.value); resize(); }}
          onKeyDown={handleKeyDown}
          placeholder={isProcessing ? 'Nova is responding...' : enableThinking ? 'Ask Nova to think deeply...' : 'Message Nova... (↵ send)'}
          rows={1} disabled={isProcessing}
          className="flex-1 resize-none bg-zinc-800/70 border-white/10 focus:border-violet-500/50 text-sm min-h-[44px] max-h-[180px] py-3 transition-colors disabled:opacity-50"
          style={{ height: '44px' }} />
        <button onClick={onSend} disabled={!canSend} aria-label="Send message"
          className={cn('w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 mb-0.5', canSend ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/30 hover:from-violet-500 hover:to-fuchsia-500' : 'bg-zinc-800 text-zinc-600 border border-white/8')}>
          {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-center text-[10px] text-zinc-700 mt-2">Nova AI · NVIDIA NIM · Kimi K2 · 128k context · {messageCount > 0 ? `${messageCount} messages` : 'New conversation'}</p>
    </div>
  );
}
