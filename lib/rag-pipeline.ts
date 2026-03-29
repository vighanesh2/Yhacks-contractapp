import { embedText } from "./embeddings";
import { lavaOpenAI, OPENAI_V1_BASE } from "./lava-openai";
import { supabaseAdmin } from "./supabase";
import { chunkContract } from "./chunker";
import { extractText } from "./pdf-parser";

const OPENAI_CHAT_URL = `${OPENAI_V1_BASE}/chat/completions`;
const RAG_MODEL = "gpt-4o-mini";

export type ParsedContractForRag = {
  fileName: string;
  fullText: string;
  chunks: ReturnType<typeof chunkContract>;
};

type SearchChunkRow = {
  section_number: string | null;
  section_title: string | null;
  chunk_text: string;
  similarity: number;
  counterparty_name?: string | null;
};

export type AskContractSource = {
  section_number: string;
  section_title: string;
  chunk_text: string;
  relevance: number;
  contract_name?: string;
};

/**
 * End-to-end: binary upload → plain text → section-aware chunks for embeddings / retrieval.
 */
export async function parseAndChunkContract(
  buffer: Buffer,
  fileName: string,
): Promise<ParsedContractForRag> {
  const fullText = await extractText(buffer, fileName);
  const chunks = chunkContract(fullText);
  return { fileName, fullText, chunks };
}

/**
 * RAG: embed question → Supabase `search_chunks` RPC → OpenAI answer (via Lava gateway).
 */
export async function askContract(
  question: string,
  contractId?: string,
): Promise<{
  answer: string;
  sources: AskContractSource[];
}> {
  if (!supabaseAdmin) {
    return {
      answer:
        "Search is unavailable: Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).",
      sources: [],
    };
  }

  const questionEmbedding = await embedText(question);

  const { data: relevantChunks, error } = await supabaseAdmin.rpc(
    "search_chunks",
    {
      query_embedding: JSON.stringify(questionEmbedding),
      match_count: 5,
      filter_contract_id: contractId ?? null,
    },
  );

  const rows = (relevantChunks ?? []) as SearchChunkRow[];

  if (error || rows.length === 0) {
    return {
      answer:
        "I could not find relevant information in your contracts to answer this question.",
      sources: [],
    };
  }

  const context = rows
    .map((c, i) => {
      const label =
        `${c.section_number ?? "Unknown Section"}` +
        (c.section_title ? `: ${c.section_title}` : "");
      return `[Source ${i + 1} — ${label}]\n${c.chunk_text}`;
    })
    .join("\n\n---\n\n");

  type ChatCompletionResponse = {
    choices?: Array<{ message?: { content?: string | null } }>;
    error?: { message?: string };
  };

  let data: ChatCompletionResponse;
  try {
    data = (await lavaOpenAI.gateway(OPENAI_CHAT_URL, {
      body: {
        model: RAG_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: "system",
            content:
              "You are a contract analyst. Answer using only the provided sections; cite section numbers. If information is missing, say so. For dollar math, show reasoning briefly.",
          },
          {
            role: "user",
            content: `Use ONLY the provided contract sections to answer. Always cite which section(s) your answer comes from.
If you calculate a dollar amount, show your math.
If the answer isn't in the provided sections, say so.

RELEVANT CONTRACT SECTIONS:
${context}

QUESTION: ${question}

Answer clearly and concisely. Always reference the specific section number.`,
          },
        ],
      },
    })) as ChatCompletionResponse;
  } catch (err) {
    return {
      answer:
        err instanceof Error
          ? `Could not reach the model: ${err.message}`
          : "Could not reach the model.",
      sources: rows.map((c) => sourceFromRow(c)),
    };
  }

  if (data.error?.message) {
    return {
      answer: `Model error: ${data.error.message}`,
      sources: rows.map((c) => sourceFromRow(c)),
    };
  }

  const answer =
    data.choices?.[0]?.message?.content?.trim() ||
    "Unable to generate answer.";

  return {
    answer,
    sources: rows.map((c) => sourceFromRow(c)),
  };
}

function sourceFromRow(c: SearchChunkRow): AskContractSource {
  const text = c.chunk_text ?? "";
  const preview =
    text.length > 200 ? `${text.slice(0, 200)}…` : text || "…";
  return {
    section_number: c.section_number ?? "",
    section_title: c.section_title ?? "",
    chunk_text: preview,
    relevance: Math.round((c.similarity ?? 0) * 100),
    contract_name: c.counterparty_name ?? undefined,
  };
}
