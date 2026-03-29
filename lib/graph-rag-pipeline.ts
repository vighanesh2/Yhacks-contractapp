import { embedText } from "./embeddings";
import { lavaOpenAI, OPENAI_V1_BASE } from "./lava-openai";
import { supabaseAdmin } from "./supabase";

const OPENAI_CHAT_URL = `${OPENAI_V1_BASE}/chat/completions`;
const GRAPH_RAG_MODEL = "gpt-4.1";

// ─── Public types ────────────────────────────────────────────────────────────

export type ThinkingStep = {
  node: string;
  decision: string;
  detail?: string;
};

export type GraphRAGSource = {
  section_number: string;
  section_title: string;
  chunk_text: string;
  relevance: number;
  contract_name?: string;
  clause_type?: string;
};

// ─── Internal types ──────────────────────────────────────────────────────────

type SearchChunkRow = {
  id?: string;
  section_number: string | null;
  section_title: string | null;
  chunk_text: string;
  similarity: number;
  counterparty_name?: string | null;
  clause_type?: string | null;
  category?: string | null;
  severity?: string | null;
  dollar_impact?: number | null;
};

type GraphRAGState = {
  question: string;
  contractId?: string;
  queryEmbedding: number[];
  routerDecision: "simple" | "complex";
  retrievedChunks: SearchChunkRow[];
  graphChunks: SearchChunkRow[];
  context: string;
  answer: string;
  sources: GraphRAGSource[];
  confidence: number;
  thinkingSteps: ThinkingStep[];
  attemptCount: number;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

// ─── Node: Router ─────────────────────────────────────────────────────────────
// Decides "simple" (focused, single-contract) vs "complex" (cross-contract,
// multi-clause, portfolio-wide) using lightweight pattern matching — no LLM call.

function routerNode(state: GraphRAGState): GraphRAGState {
  const complexPatterns = [
    /compar/i,
    /all contracts?/i,
    /across/i,
    /similar/i,
    /portfolio/i,
    /relationship/i,
    /related/i,
    /multi/i,
    /several/i,
    /what.*(all|every)/i,
    /find all/i,
    /show all/i,
    /total.*across/i,
    /how many/i,
    /which contracts?/i,
    /between/i,
    /pattern/i,
  ];

  const isComplex = complexPatterns.some((p) => p.test(state.question));
  const decision: "simple" | "complex" = isComplex ? "complex" : "simple";

  return {
    ...state,
    routerDecision: decision,
    thinkingSteps: [
      ...state.thinkingSteps,
      {
        node: "Router",
        decision: isComplex
          ? "Complex query — activating graph traversal mode"
          : "Focused query — using direct vector retrieval",
        detail: isComplex
          ? "Cross-contract or multi-clause pattern detected"
          : "Single-contract clause lookup",
      },
    ],
  };
}

// ─── Node: Simple Retrieval ───────────────────────────────────────────────────
// Pure vector search — fast path for focused single-contract questions.

async function simpleRetrievalNode(
  state: GraphRAGState,
): Promise<GraphRAGState> {
  if (!supabaseAdmin) return state;

  const { data, error } = await supabaseAdmin.rpc("search_chunks", {
    query_embedding: JSON.stringify(state.queryEmbedding),
    match_count: 6,
    filter_contract_id: state.contractId ?? null,
  });

  if (error) {
    return {
      ...state,
      thinkingSteps: [
        ...state.thinkingSteps,
        {
          node: "Vector Retrieval",
          decision: "Search failed — returning empty context",
          detail: error.message,
        },
      ],
    };
  }

  const chunks = (data ?? []) as SearchChunkRow[];

  return {
    ...state,
    retrievedChunks: chunks,
    thinkingSteps: [
      ...state.thinkingSteps,
      {
        node: "Vector Retrieval",
        decision: `Retrieved ${chunks.length} semantically relevant sections`,
        detail:
          chunks.length > 0
            ? `Top match: §${chunks[0].section_number ?? "?"} — ${Math.round((chunks[0].similarity ?? 0) * 100)}% relevance`
            : "No sections found",
      },
    ],
  };
}

// ─── Node: Graph Traversal ────────────────────────────────────────────────────
// Broader vector search + clause-type relationship expansion.
// Used for complex, cross-contract, or multi-clause questions.

async function graphTraversalNode(
  state: GraphRAGState,
): Promise<GraphRAGState> {
  if (!supabaseAdmin) return state;

  // Step 1 — Broad vector search
  const { data: vectorData } = await supabaseAdmin.rpc("search_chunks", {
    query_embedding: JSON.stringify(state.queryEmbedding),
    match_count: 8,
    filter_contract_id: state.contractId ?? null,
  });
  const vectorChunks = (vectorData ?? []) as SearchChunkRow[];

  // Step 2 — Expand via clause_type relationships
  const clauseTypes = [
    ...new Set(vectorChunks.map((c) => c.clause_type).filter(Boolean)),
  ] as string[];

  let relatedChunks: SearchChunkRow[] = [];

  if (clauseTypes.length > 0) {
    const { data: related } = await supabaseAdmin
      .from("contract_chunks")
      .select(
        "id, section_number, section_title, chunk_text, clause_type, category, severity, dollar_impact",
      )
      .in("clause_type", clauseTypes.slice(0, 3))
      .limit(10);

    const seenSections = new Set(
      vectorChunks.map((c) => c.section_number).filter(Boolean),
    );

    relatedChunks = (related ?? [])
      .filter((r) => !seenSections.has(r.section_number))
      .map((r) => ({
        ...r,
        similarity: 0.65,
        counterparty_name: null,
      }));
  }

  return {
    ...state,
    retrievedChunks: vectorChunks,
    graphChunks: relatedChunks,
    thinkingSteps: [
      ...state.thinkingSteps,
      {
        node: "Vector Retrieval",
        decision: `${vectorChunks.length} direct semantic matches`,
        detail:
          vectorChunks.length > 0
            ? `Top: §${vectorChunks[0].section_number ?? "?"} — ${Math.round((vectorChunks[0].similarity ?? 0) * 100)}% match`
            : "No matches found",
      },
      {
        node: "Graph Traversal",
        decision: `Expanded by ${relatedChunks.length} related clauses via type graph`,
        detail:
          clauseTypes.length > 0
            ? `Related clause types: ${clauseTypes.slice(0, 4).join(", ")}`
            : "No clause-type expansion available",
      },
    ],
  };
}

// ─── Node: Context Assembly ───────────────────────────────────────────────────
// Merges vector + graph chunks, deduplicates, and builds the context string
// with rich metadata (clause type, severity, dollar impact) for the LLM.

function contextAssemblyNode(state: GraphRAGState): GraphRAGState {
  const all = [...state.retrievedChunks, ...state.graphChunks];
  const seen = new Set<string>();

  const unique = all.filter((c) => {
    const key = c.section_number ?? c.chunk_text.slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const context = unique
    .map((c, i) => {
      const label = `§${c.section_number ?? "?"}${c.section_title ? `: ${c.section_title}` : ""}`;
      const meta = [
        c.clause_type ? `[${c.clause_type}]` : null,
        c.severity && c.severity !== "none" ? `severity:${c.severity}` : null,
        c.dollar_impact != null
          ? `impact:$${Number(c.dollar_impact).toLocaleString()}`
          : null,
      ]
        .filter(Boolean)
        .join(" ");
      return `[Source ${i + 1} — ${label}${meta ? " " + meta : ""}]\n${c.chunk_text}`;
    })
    .join("\n\n---\n\n");

  const sources: GraphRAGSource[] = unique.map((c) => ({
    section_number: c.section_number ?? "",
    section_title: c.section_title ?? "",
    chunk_text:
      c.chunk_text.length > 220
        ? `${c.chunk_text.slice(0, 220)}…`
        : c.chunk_text,
    relevance: Math.round((c.similarity ?? 0.65) * 100),
    contract_name: c.counterparty_name ?? undefined,
    clause_type: c.clause_type ?? undefined,
  }));

  return {
    ...state,
    context,
    sources,
    thinkingSteps: [
      ...state.thinkingSteps,
      {
        node: "Context Assembly",
        decision: `Merged ${unique.length} unique sections into context window`,
        detail:
          unique.length > 0
            ? `Sections: ${unique.map((c) => `§${c.section_number ?? "?"}`).join(", ")}`
            : "Empty context",
      },
    ],
  };
}

// ─── Node: Answer Generation ──────────────────────────────────────────────────
// Calls GPT-4.2 with the assembled context. The model self-reports a
// CONFIDENCE score (0–100) at the end of its response.

async function answerGenerationNode(
  state: GraphRAGState,
): Promise<GraphRAGState> {
  if (!state.context.trim()) {
    return {
      ...state,
      answer:
        "I could not find relevant information in your contract to answer this question. Try rephrasing or uploading additional contract documents.",
      confidence: 0,
      thinkingSteps: [
        ...state.thinkingSteps,
        {
          node: "Answer Generation",
          decision: "Empty context — no answer generated",
        },
      ],
    };
  }

  let data: ChatCompletionResponse;
  try {
    data = (await lavaOpenAI.gateway(OPENAI_CHAT_URL, {
      body: {
        model: GRAPH_RAG_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: "system",
            content: `You are an expert contract analyst with deep financial and legal expertise.
Answer questions based ONLY on the provided contract sections — never invent facts.
Always cite specific section numbers (e.g. "§3.2").
For any dollar amounts, show your calculation clearly.
Be direct, specific, and actionable — avoid generic advice.
After your complete answer, on a new line write exactly: CONFIDENCE: <number 0-100>`,
          },
          {
            role: "user",
            content: `CONTRACT SECTIONS:\n${state.context}\n\nQUESTION: ${state.question}\n\nProvide a precise answer citing specific sections. Show dollar math where relevant.\nEnd with: CONFIDENCE: <0-100>`,
          },
        ],
      },
    })) as ChatCompletionResponse;
  } catch (err) {
    const msg =
      err instanceof Error
        ? `Model error: ${err.message}`
        : "Could not reach the model.";
    return {
      ...state,
      answer: msg,
      confidence: 0,
      thinkingSteps: [
        ...state.thinkingSteps,
        { node: "Answer Generation", decision: "LLM call failed", detail: msg },
      ],
    };
  }

  if (data.error?.message) {
    return {
      ...state,
      answer: `Model error: ${data.error.message}`,
      confidence: 0,
      thinkingSteps: [
        ...state.thinkingSteps,
        {
          node: "Answer Generation",
          decision: "Model returned error",
          detail: data.error.message,
        },
      ],
    };
  }

  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
  const confMatch = raw.match(/\nCONFIDENCE:\s*(\d+)\s*$/i);
  const confidence = confMatch
    ? Math.min(100, Math.max(0, parseInt(confMatch[1], 10)))
    : 55;
  const answer = raw.replace(/\nCONFIDENCE:\s*\d+\s*$/i, "").trim();

  return {
    ...state,
    answer,
    confidence,
    thinkingSteps: [
      ...state.thinkingSteps,
      {
        node: "Answer Generation",
        decision: `Generated answer — ${confidence}% confidence`,
        detail:
          confidence >= 80
            ? "High confidence — accepted"
            : "Below 80% threshold — will re-query with broader context",
      },
    ],
  };
}

// ─── Node: Confidence Check ───────────────────────────────────────────────────
// Decides whether to accept the answer or loop back for a broader re-query.
// Hard cap at 2 total attempts to keep latency bounded.

function confidenceCheckNode(
  state: GraphRAGState,
): GraphRAGState & { done: boolean } {
  const pass = state.confidence >= 80;
  const maxed = state.attemptCount >= 2;
  const done = pass || maxed;

  return {
    ...state,
    done,
    thinkingSteps: [
      ...state.thinkingSteps,
      {
        node: "Confidence Check",
        decision: pass
          ? `${state.confidence}% ≥ 80% — answer accepted ✓`
          : maxed
            ? `Max retries reached — returning best answer at ${state.confidence}%`
            : `${state.confidence}% < 80% — re-querying with broader context`,
        detail: done ? undefined : `Attempt ${state.attemptCount + 1} of 2`,
      },
    ],
  };
}

// ─── Main export: askWithGraphRAG ─────────────────────────────────────────────

export async function askWithGraphRAG(
  question: string,
  contractId?: string,
): Promise<{
  answer: string;
  sources: GraphRAGSource[];
  thinking: ThinkingStep[];
  confidence: number;
  router_decision: "simple" | "complex";
}> {
  if (!supabaseAdmin) {
    return {
      answer:
        "Search unavailable: Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).",
      sources: [],
      thinking: [],
      confidence: 0,
      router_decision: "simple",
    };
  }

  // Embed question once — reused across all nodes
  const queryEmbedding = await embedText(question);

  let state: GraphRAGState = {
    question,
    contractId,
    queryEmbedding,
    routerDecision: "simple",
    retrievedChunks: [],
    graphChunks: [],
    context: "",
    answer: "",
    sources: [],
    confidence: 0,
    thinkingSteps: [],
    attemptCount: 0,
  };

  // ── Node 1: Route ──────────────────────────────────────────────────────────
  state = routerNode(state);

  // ── Node 2: Retrieve ───────────────────────────────────────────────────────
  if (state.routerDecision === "complex") {
    state = await graphTraversalNode(state);
  } else {
    state = await simpleRetrievalNode(state);
  }

  // ── Node 3: Assemble context ───────────────────────────────────────────────
  state = contextAssemblyNode(state);

  // ── Nodes 4 + 5: Generate → Check confidence (max 2 attempts) ─────────────
  while (true) {
    state = await answerGenerationNode(state);
    state = { ...state, attemptCount: state.attemptCount + 1 };

    const checked = confidenceCheckNode(state);
    state = checked;

    if (checked.done) break;

    // Re-retrieve with broader search before next attempt
    const { data } = await supabaseAdmin.rpc("search_chunks", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_count: 12,
      filter_contract_id: contractId ?? null,
    });

    state = {
      ...state,
      retrievedChunks: (data ?? []) as SearchChunkRow[],
      graphChunks: [],
    };
    state = contextAssemblyNode(state);
  }

  return {
    answer: state.answer,
    sources: state.sources,
    thinking: state.thinkingSteps,
    confidence: state.confidence,
    router_decision: state.routerDecision,
  };
}
