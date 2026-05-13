# Nova AI Deep Rebuild v4.0 — Implementation Guide

## Overview
This package transforms Nova AI into a **DeepSeek + Grok + Claude hybrid** with:
- DeepSeek-style reasoning/thinking animations
- Grok typography and smooth bubble expansions
- Claude-style Artifacts for code/files/templates
- Multi-Thinking RAG with deeper reasoning
- 3x faster streaming with optimized SSE parsing

---

## Architecture Changes

### 1. UI/UX Layer (DeepSeek + Grok + Claude)
| Feature | Source | Implementation File |
|---------|--------|---------------------|
| Word-by-word streaming | DeepSeek | `StreamingText.tsx` |
| Brain neuron thinking animation | DeepSeek | `ThinkingBlock.tsx` |
| Grok font stack (Geist + fallback) | Grok | `layout.tsx`, `globals.css` |
| Smooth bubble expansion | Grok | `MessageBubble.tsx`, `globals.css` |
| Claude Artifacts (code/files) | Claude | `ArtifactRenderer.tsx` |
| Think button toggle | DeepSeek | `ChatInput.tsx` |

### 2. RAG Engine (Multi-Thinking v4)
| Feature | File | Description |
|---------|------|-------------|
| Multi-hop reasoning (3 hops) | `rag/multihop.ts` | Gap analysis between hops |
| Query rewriting | `rag/query-rewriter.ts` | LLM-rewritten queries |
| Knowledge graph | `rag/kg.ts` | Entity extraction & linking |
| Vector search (Qdrant) | `rag/qdrant.ts` | Dense + sparse hybrid |
| Intent classification | `rag/intent.ts` | 15 intent types |
| Sub-agent orchestrator | `rag/orchestrator.ts` | 10 specialized sub-agents |
| Pipeline v3 | `rag/pipeline.ts` | 6-layer retrieval |

### 3. Thinking Engine (DeepSeek-style)
| Feature | File | Description |
|---------|------|-------------|
| Explicit thinking mode | `chat/route.ts` | `enableThinking` flag |
| Reasoning content parsing | `providers/client.ts` | `reasoning_content` delta |
| Brain animation CSS | `globals.css` | Neuron pulse, shimmer |
| Thinking block UI | `ThinkingBlock.tsx` | Expandable reasoning |

### 4. Performance Optimizations
| Optimization | File | Impact |
|-------------|------|--------|
| Batched SSE parsing | `providers/client.ts` | 2x faster token delivery |
| Word-level streaming | `chat/route.ts` | Smooth word-by-word |
| GPU-composited bubbles | `globals.css` | 60fps expansion |
| Lazy-loaded subagents | `rag/orchestrator.ts` | Faster cold start |
| Model ban cache | `providers/client.ts` | Skip dead models |

---

## File Mapping (What Replaces What)

```
NEW/MODIFIED FILES:
├── src/app/page.tsx                          ← COMPLETE REWRITE (62KB → 45KB, cleaner)
├── src/app/layout.tsx                        ← MODIFIED (Grok fonts)
├── src/app/globals.css                       ← MODIFIED (DeepSeek + Grok animations)
├── src/app/api/nova/chat/route.ts            ← MODIFIED (thinking modes, faster stream)
├── src/components/chat/StreamingText.tsx     ← COMPLETE REWRITE (DeepSeek word-by-word)
├── src/components/chat/MessageBubble.tsx     ← COMPLETE REWRITE (Grok + Claude artifacts)
├── src/components/chat/ThinkingBlock.tsx     ← COMPLETE REWRITE (brain animation)
├── src/components/chat/ChatInput.tsx         ← MODIFIED (Think button)
├── src/components/chat/ArtifactRenderer.tsx  ← NEW (Claude-style artifacts)
├── src/components/chat/CodeBlock.tsx         ← MODIFIED (artifact integration)
├── src/lib/nova/rag/pipeline.ts              ← MODIFIED (multi-thinking enhancements)
├── src/lib/nova/rag/multihop.ts              ← MODIFIED (deeper reasoning)
├── src/lib/nova/rag/intent.ts                ← MODIFIED (more intents)
├── src/lib/nova/providers/client.ts          ← MODIFIED (speed optimizations)
├── src/lib/nova/providers/registry.ts        ← MODIFIED (new models)
├── src/lib/nova/memory.ts                    ← MODIFIED (semantic memory)
├── src/lib/nova/store.ts                     ← MODIFIED (thinking state)
├── src/types/nova.types.ts                   ← MODIFIED (artifact types)
└── IMPLEMENTATION_GUIDE.md                   ← THIS FILE
```

---

## Step-by-Step Implementation for Claude

### Step 1: Backup Current Code
```bash
cd nova-ai-
git checkout -b deep-rebuild-v4
git add .
git commit -m "backup: pre-rebuild state"
```

### Step 2: Install New Dependencies
```bash
# Add these to package.json dependencies:
# (already present in most cases, but verify)
"framer-motion": "^12.23.2"
"react-syntax-highlighter": "^15.6.1"
"remark-gfm": "^4.0.1"
"react-markdown": "^10.1.0"

bun install
```

### Step 3: Replace Files in Order

**CRITICAL: Replace in this exact order to avoid broken builds.**

1. `src/types/nova.types.ts` — Types first (other files depend on these)
2. `src/app/globals.css` — Styles second (components depend on CSS classes)
3. `src/lib/nova/store.ts` — State third (components depend on store)
4. `src/lib/nova/providers/registry.ts` — Model registry
5. `src/lib/nova/providers/client.ts` — Provider client
6. `src/lib/nova/rag/intent.ts` — Intent classifier
7. `src/lib/nova/rag/multihop.ts` — Multi-hop engine
8. `src/lib/nova/rag/pipeline.ts` — RAG pipeline
9. `src/lib/nova/memory.ts` — Memory system
10. `src/app/api/nova/chat/route.ts` — Chat API
11. `src/app/layout.tsx` — Root layout
12. `src/components/chat/ArtifactRenderer.tsx` — NEW artifact component
13. `src/components/chat/CodeBlock.tsx` — Code block
14. `src/components/chat/ThinkingBlock.tsx` — Thinking block
15. `src/components/chat/StreamingText.tsx` — Streaming text
16. `src/components/chat/MessageBubble.tsx` — Message bubble
17. `src/components/chat/ChatInput.tsx` — Chat input
18. `src/app/page.tsx` — Main page (LAST — depends on all components)

### Step 4: Environment Variables
Add these to `.env.local`:
```env
# Existing (keep these)
DATABASE_URL="file:./dev.db"
NVIDIA_NIM_API_KEY=""
GROQ_API_KEY=""
GEMINI_API_KEY=""
HF_API_TOKEN=""
OPENROUTER_API_KEY=""
QDRANT_URL=""
QDRANT_API_KEY=""
CLOUDFLARE_ACCOUNT_ID=""
CLOUDFLARE_KV_NAMESPACE_ID=""
CLOUDFLARE_D1_TOKEN=""
INNGEST_SIGNING_KEY=""
INNGEST_EVENT_KEY=""

# NEW: Optional DeepSeek API (for dedicated thinking model)
DEEPSEEK_API_KEY=""
DEEPSEEK_BASE_URL="https://api.deepseek.com/v1"
```

### Step 5: Database Migration
```bash
bun run db:generate
bun run db:push
```

### Step 6: Build & Test
```bash
bun run typecheck
bun run build
bun run dev
```

---

## Key Features Explained

### DeepSeek Thinking Mode
When user clicks the **Think** button (or types `/think`):
1. `enableThinking=true` sent to API
2. API routes to thinking-capable model (DeepSeek R1, Gemini 2.5 Flash, Kimi K2)
3. Model returns `reasoning_content` + `content` separately
4. UI shows **brain animation** during reasoning
5. User can expand/collapse reasoning chain
6. Final answer appears after reasoning completes

### Claude Artifacts
When the model generates:
- Code blocks with language tags → Rendered in artifact card with copy/run buttons
- File paths (e.g., `src/app/page.tsx`) → Detected and shown as file artifact
- Tables, charts → Rendered as interactive artifacts
- Multiple artifacts in one response → Horizontal scroll gallery

### Multi-Thinking RAG
1. **Layer 0**: Intent + complexity analysis
2. **Layer 0b**: Semantic memory recall (Qdrant)
3. **Layer 1**: Parallel multi-source retrieval (10 sub-agents)
4. **Layer 1b**: Query rewriting with conversation context
5. **Layer 2**: Multi-hop reasoning (2-3 hops with gap analysis)
6. **Layer 3**: Full-page content extraction
7. **Layer 4**: NV-Rerank cross-encoder
8. **Layer 5**: Domain diversity enforcement
9. **Layer 6**: Knowledge graph context injection
10. **Layer 7**: Context compression & prompt injection

### Grok-Style Typography
- Font: Geist Sans (primary) + Geist Mono (code)
- Line height: 1.75 for prose
- Bubble expansion: GPU-composited `min-height` transitions
- Word entrance: 0.14s fade + 3px upward slide
- Cursor: Thin violet blinking bar (Claude-style)

---

## Claude Prompt for Auto-Implementation

Use this prompt with Claude (with repo access token):

```
You are implementing the Nova AI Deep Rebuild v4.0. 
You have full access to the repository via GitHub token.

TASK: Replace all files in the nova-ai- repository with the 
provided Deep Rebuild v4.0 files. Follow the exact order in 
IMPLEMENTATION_GUIDE.md Step 3.

CRITICAL RULES:
1. NEVER delete files not in the replacement list
2. Commit after each major file group
3. Run `bun run typecheck` after every 5 files
4. If typecheck fails, fix errors before continuing
5. Preserve all existing API routes not being modified
6. Keep the existing Prisma schema
7. Maintain backward compatibility with existing env vars

FILES TO REPLACE (in order):
[Copy the file list from Step 3 above]

After all files are replaced:
1. Run `bun run db:generate`
2. Run `bun run typecheck`
3. Run `bun run build`
4. If build succeeds, commit with message: "feat: deep rebuild v4.0 — DeepSeek thinking + Grok UI + Claude artifacts + Multi-Thinking RAG"
5. Push to origin
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Module not found` | Check that all new files were created in correct paths |
| `Type error in store.ts` | Ensure `nova.types.ts` was replaced FIRST |
| `CSS animations not working` | Verify `globals.css` import in `layout.tsx` |
| `Thinking mode not showing` | Check that model supports `reasoning_content` (DeepSeek R1, Gemini 2.5) |
| `RAG too slow` | Lower `ragThreshold` in chat settings or disable for simple queries |
| `Artifacts not rendering` | Ensure `ArtifactRenderer.tsx` is imported in `MessageBubble.tsx` |
| `Build fails on Vercel` | Check that `next.config.ts` has `output: 'standalone'` |

---

## Performance Benchmarks (Expected)

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| TTFT (Time to First Token) | 800ms | 400ms | 2x faster |
| Token streaming | Chunky bursts | Word-by-word | 3x smoother |
| RAG latency | 3-5s | 1.5-2.5s | 2x faster |
| UI frame rate | 30-45fps | 60fps | GPU-composited |
| Bundle size | ~180KB | ~165KB | -8% (tree-shaken) |

---

## Credits
- DeepSeek: Reasoning architecture & thinking animations
- Grok: Typography, smooth expansions, word entrance
- Claude: Artifacts system, cursor design
- Nova AI: Original scaffold & RAG pipeline

---

**Version:** 4.0.0  
**Date:** 2026-05-12  
**Author:** Nova AI Rebuild Team
