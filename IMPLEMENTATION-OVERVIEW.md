# DealWithIt — implementation overview

This document summarizes what the [Yhacks Contract App](https://github.com/vighanesh2/Yhacks-contractapp) implements today so the team can track scope and onboard quickly. It reflects the **main** app layout (Next.js App Router, no `src/` folder).

---

## Stack

| Area | Choice |
|------|--------|
| Framework | Next.js **16** (App Router, **Node** runtime on API routes that need `Buffer` / PDF / DB) |
| UI | React **19**, Tailwind CSS **4** |
| Documents | **pdf-parse** v2 (`PDFParse`), **mammoth** (DOCX) |
| Vectors / DB | **Supabase** (Postgres + **pgvector**), `@supabase/supabase-js` |
| OpenAI-compatible API | **Lava** (`@lavapayments/nodejs`) gateway to `https://api.openai.com/v1` for embeddings and chat-style calls |
| Chunk + contract analysis | **Anthropic** Messages API (chunk analysis + synthesis) |

---

## User-facing pages (`app/`)

| Route | Purpose |
|-------|---------|
| `/` | Landing / entry to the app |
| `/upload` | Upload contracts (PDF/DOCX), run ingestion + analysis pipeline |
| `/dashboard` | Dashboard UI (briefing data from API) |
| `/contracts` | List contracts |
| `/contracts/[id]` | Single contract detail, chat, and related UI |

---

## API routes (`app/api/`)

| Endpoint | Role |
|----------|------|
| `POST /api/contracts/upload` | Full pipeline: extract text → chunk → PII redaction → embeddings → batched **chunk analysis** (Anthropic) → **contract synthesis** → Supabase inserts → JSON response. `maxDuration = 60`. |
| `GET /api/contracts` | List contracts (Supabase-backed). |
| `GET /api/contracts/[id]` | Single contract metadata. |
| `POST /api/search` | Semantic search: embed query → Supabase RPC `search_chunks`. |
| `POST /api/ask` | RAG Q&A: `askContract()` in `lib/rag-pipeline.ts` (embed question, `search_chunks`, answer via Lava → OpenAI chat). |
| `POST /api/compare` | Cross-contract comparison (implementation in route). |
| `GET` (or `POST`) `/api/dashboard/briefing` | Daily-style briefing payload for the dashboard. |
| `POST /api/actions` | Track or record user actions (implementation in route). |

---

## Library code (`lib/`)

| Module | Role |
|--------|------|
| `pdf-parser.ts` | PDF via `PDFParse`, DOCX via mammoth; **sets `PDFParse.setWorker()`** to `pdfjs-dist` worker under `node_modules` to avoid Turbopack worker path bugs; `extractText(buffer, fileName)`. |
| `chunker.ts` | Section-aware **contract chunking** (headers, preamble, long-section split, paragraph fallback). |
| `redact.ts` | Best-effort **PII redaction** on chunk text before embedding/analysis. |
| `embeddings.ts` | **Lava** → OpenAI `/v1/embeddings`, `text-embedding-3-small`; `embedText` / `embedBatch`. |
| `lava-openai.ts` | Shared **Lava** client + `OPENAI_V1_BASE` for gateway calls. |
| `ai-analyze-chunk.ts` | Per-chunk **Anthropic** analysis → structured `ChunkAnalysis`. |
| `ai-synthesize.ts` | Aggregate metrics + **Anthropic** contract-level summary (`synthesizeContract`). |
| `analysis-types.ts` | Types and normalization for chunk analysis fields. |
| `rag-pipeline.ts` | `parseAndChunkContract`, **`askContract`** (RAG), related helpers. |
| `supabase.ts` / `supabase/index.ts` | **Service-role** Supabase client when env vars are set (patterns vary slightly between files). |
| `utils.ts` | Small shared helpers. |

---

## UI components (`components/`)

| Component | Role |
|-----------|------|
| `AppShell.tsx` | App chrome / layout wrapper. |
| `ContractChat.tsx` | Chat-style UI for contract Q&A. |
| `HealthGauge.tsx` | Health / score visualization. |
| `useCountUp.ts` | Animated number hook for metrics. |

---

## Database (`supabase/schema.sql`)

- **`contracts`**: metadata (file name, type, summary, health, money at risk, leverage, chunks count, status, dates, counterparty, etc.).
- **`contract_chunks`**: per-chunk text, section labels, **`vector(1536)`** embedding, analysis fields (clause type, category, severity, dollar fields, deadlines, titles, recommendations).

**Note:** Search and `/api/ask` expect a Supabase RPC such as **`search_chunks`** (parameters like `query_embedding`, `match_count`, optional filters). Define or migrate that in Supabase to match production; the repo SQL file may only include tables—confirm RPCs in your project.

---

## Scripts (`scripts/`)

| Script | Purpose |
|--------|---------|
| `test-embeddings.ts` | Local check for embedding path (`npm run test:embeddings`). |
| `test-analyze-chunk.ts` | Local check for chunk analysis behavior. |

---

## Configuration

| File | Notes |
|------|--------|
| `next.config.ts` | **Turbopack** root; **`serverExternalPackages`** includes `pdf-parse`, `pdfjs-dist`, `mammoth`, `@napi-rs/canvas` so PDF.js worker resolution works in dev/build. |
| `.env.example` | Safe template; copy to **`.env.local`** (gitignored via `.env*`). |
| `.gitignore` | Ignores `.env*` but allows **`.env.example`**. |

Typical secrets: **`NEXT_PUBLIC_SUPABASE_URL`**, **`SUPABASE_SERVICE_ROLE_KEY`**, **`ANTHROPIC_API_KEY`**, Lava/OpenAI-related keys as required by your Lava setup (see teammate docs).

---

## Implemented pipeline (upload)

1. **Extract** plain text from PDF/DOCX.  
2. **Chunk** with structure-aware logic.  
3. **Redact** PII on chunk text.  
4. **Embed** chunks (Lava → OpenAI embeddings).  
5. **Analyze** chunks in parallel batches (Anthropic).  
6. **Synthesize** contract-level summary + scores (Anthropic).  
7. **Persist** to Supabase (`contracts` + `contract_chunks`).  
8. **Return** JSON (success, contract, chunk-level analysis, stats).

If Supabase env is missing, the upload route returns **503** with a clear message (current `main` behavior).

---

## Maintenance

- Update this file when you add routes, change env vars, or alter the ingestion/RAG flow.
- Keep **`package.json` / lockfile** in sync with imports (`@supabase/supabase-js`, `@lavapayments/nodejs`, `pdf-parse`, etc.).

---

*Last aligned with repo layout: app router under `app/`, libraries under `lib/`, no `src/` directory.*
