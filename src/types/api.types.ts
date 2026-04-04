import type { Source, SubagentResult } from './nova.types';

export interface ChatRequest {
  message: string;
  sessionId?: string;
  images?: string[];
  enableThinking?: boolean;
  stream?: boolean;
  maxTokens?: number;
  clearSession?: boolean;
  includeContext?: boolean;
  userId?: string;
  enableRAG?: boolean;
  task?: string;
}

export interface ChatResponse {
  success: boolean;
  response?: string;
  thinking?: string | null;
  sessionId: string;
  duration: number;
  messageCount?: number;
  ragSources?: Source[];
  ragUsed?: boolean;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export interface APIError {
  success: false;
  error: string;
  code: string;
  requestId?: string;
  duration?: number;
  retryAfter?: number;
}

export interface MemoryRequest {
  category: string;
  content: string;
  importance?: number;
  metadata?: Record<string, unknown>;
}

export interface TaskRequest {
  title: string;
  description?: string;
  priority?: number;
  dueDate?: string;
}

export interface ImagineRequest {
  prompt: string;
  negativePrompt?: string;
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  numImages?: number;
}
