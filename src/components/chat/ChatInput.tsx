'use client';

import { useRef, useCallback, useState } from 'react';
import { Send, ImagePlus, X, Brain } from 'lucide-react';
import { useNovaStore } from '@/lib/nova/store';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onImageAdd: (images: string[]) => void;
  selectedImages: string[];
  onImageRemove: (index: number) => void;
  isProcessing: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onImageAdd,
  selectedImages,
  onImageRemove,
  isProcessing,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isThinkingMode = useNovaStore((s) => s.isThinkingMode);
  const setThinkingMode = useNovaStore((s) => s.setThinkingMode);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newImgs: string[] = [];
    const files = Array.from(e.target.files ?? []);
    let loaded = 0;
    if (!files.length) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        newImgs.push(ev.target?.result as string);
        if (++loaded === files.length) onImageAdd(newImgs);
      };
      reader.readAsDataURL(file);
    });
    if (e.target) e.target.value = '';
  };

  const canSend = !isProcessing && (value.trim().length > 0 || selectedImages.length > 0);

  return (
    <div className="relative">
      {selectedImages.length > 0 && (
        <div className="flex gap-2 mb-2 px-1">
          {selectedImages.map((img, i) => (
            <div key={i} className="relative group">
              <img src={img} alt="" className="w-12 h-12 rounded-lg object-cover border border-zinc-700" />
              <button
                onClick={() => onImageRemove(i)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-zinc-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 bg-zinc-900/80 border border-zinc-800/60 rounded-2xl p-2 backdrop-blur-sm">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-xl hover:bg-white/5 transition-colors text-zinc-500 hover:text-zinc-300"
          title="Add images"
        >
          <ImagePlus className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          onClick={() => setThinkingMode(!isThinkingMode)}
          className={`p-2 rounded-xl transition-all ${
            isThinkingMode
              ? 'think-button-active'
              : 'hover:bg-white/5 text-zinc-500 hover:text-zinc-300'
          }`}
          title={isThinkingMode ? 'Thinking mode ON' : 'Thinking mode OFF'}
        >
          <Brain className="w-5 h-5" />
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { onChange(e.target.value); resize(); }}
          onKeyDown={handleKeyDown}
          placeholder={isThinkingMode ? 'Ask anything — Nova will think deeply...' : 'Message Nova...'}
          className="nova-textarea flex-1 bg-transparent text-zinc-200 placeholder-zinc-600 text-[15px] resize-none outline-none px-2 py-2 max-h-[180px] min-h-[44px]"
          rows={1}
          disabled={isProcessing}
        />

        <button
          onClick={onSend}
          disabled={!canSend}
          className={`p-2.5 rounded-xl transition-all ${
            canSend
              ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20'
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
          } ${isProcessing ? 'send-processing' : ''}`}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
