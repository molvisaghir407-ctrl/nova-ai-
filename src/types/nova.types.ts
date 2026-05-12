export interface Source {
  id: number;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  date?: string;
}

export interface StreamEvent {
  type: 'content' | 'thinking' | 'usage' | 'rag' | 'error' | 'done' | 'artifact';
  content?: string;
  thinking?: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
  sources?: Source[];
  searchQuery?: string;
  message?: string;
  code?: string;
  duration?: number;
  sessionId?: string;
  messageCount?: number;
  ragUsed?: boolean;
  artifact?: ArtifactData;
}

export interface ArtifactData {
  id: string;
  type: 'code' | 'file' | 'table' | 'chart' | 'html' | 'markdown';
  title: string;
  language?: string;
  content: string;
  fileName?: string;
}

export interface ExtMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  thinkingDuration?: number;
  images?: string[];
  sources?: Source[];
  ragUsed?: boolean;
  duration?: number;
  timestamp: Date;
  artifacts?: ArtifactData[];
  isThinking?: boolean;
}

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview: string;
}

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

export type QueryIntent =
  | 'weather'
  | 'finance'
  | 'news'
  | 'sports'
  | 'code'
  | 'math'
  | 'science'
  | 'medical'
  | 'legal'
  | 'history'
  | 'geography'
  | 'comparison'
  | 'howto'
  | 'factual'
  | 'conversational'
  | 'creative'
  | 'general';
