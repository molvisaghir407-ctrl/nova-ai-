// ── Shared Nova AI Types ────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Source {
  id: number;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  date: string;
}

export interface ExtMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  thinking?: string;
  thinkingDuration?: number;
  images?: string[];
  sources?: Source[];
  ragUsed?: boolean;
  searchQuery?: string;
  duration?: number;
  isVoice?: boolean;
}

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview: string;
}

export type MemoryCategory =
  | 'fact' | 'preference' | 'conversation'
  | 'note' | 'skill' | 'entity' | 'code_snippet' | 'url';

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  content: string;
  importance: number;
  contentHash?: string;
  metadata?: Record<string, unknown>;
  accessedAt: Date;
  accessCount: number;
  createdAt: Date;
}

export interface MemorySearchResult {
  id: string;
  content: string;
  category: string;
  importance: number;
  relevanceScore: number;
}

export type StreamEvent =
  | { type: 'thinking'; content: string }
  | { type: 'content'; content: string }
  | { type: 'usage'; usage: { prompt_tokens: number; completion_tokens: number; total_tokens?: number } }
  | { type: 'rag'; sources: Source[]; searchQuery: string }
  | { type: 'agent_update'; agentId: string; status: 'running' | 'done' | 'error'; resultCount?: number }
  | { type: 'error'; message: string; code?: string }
  | { type: 'done'; sessionId: string; duration: number; messageCount: number; ragSources?: Source[]; ragUsed?: boolean };

export type QueryIntent =
  | 'factual' | 'news' | 'code' | 'math'
  | 'weather' | 'finance' | 'medical'
  | 'conversational' | 'creative' | 'general';

export interface SubagentResult {
  agentId: string;
  source: string;
  results: Source[];
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface RAGContext {
  sources: Source[];
  searchQuery: string;
  subqueries: string[];
  agentResults: SubagentResult[];
  fromCache: boolean;
  totalDurationMs: number;
}
