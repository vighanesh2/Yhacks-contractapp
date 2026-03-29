import { NextRequest, NextResponse } from "next/server";

import { embedText } from "@/lib/embeddings";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type SearchRow = {
  id?: string | number;
  section_number?: string | null;
  section_title?: string | null;
  chunk_text?: string | null;
  clause_type?: string | null;
  title?: string | null;
  similarity?: number | null;
  dollar_impact?: number | null;
  severity?: string | null;
  counterparty_name?: string | null;
  file_name?: string | null;
  contract_id?: string | null;
};

type ContractEmbed = {
  file_name?: string | null;
  counterparty_name?: string | null;
};

function parseVector(raw: unknown): number[] | null {
  if (Array.isArray(raw) && raw.every((x) => typeof x === "number")) {
    return raw;
  }
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw) as unknown;
      if (Array.isArray(v) && v.every((x) => typeof x === "number")) {
        return v;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * POST /api/compare — cross-contract similar chunks (other PDFs only).
 * Body: { chunk_id: string | number }
 */
export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 },
    );
  }

  let body: { chunk_id?: string | number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawId = body.chunk_id;
  if (rawId === undefined || rawId === null || rawId === "") {
    return NextResponse.json({ error: "chunk_id is required" }, { status: 400 });
  }

  const { data: source, error: sourceErr } = await supabaseAdmin
    .from("contract_chunks")
    .select("id, chunk_text, embedding, contract_id")
    .eq("id", rawId)
    .maybeSingle();

  if (sourceErr) {
    return NextResponse.json({ error: sourceErr.message }, { status: 500 });
  }

  if (!source) {
    return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
  }

  const text = (source.chunk_text as string) ?? "";
  let embedding = parseVector(source.embedding);

  if (!embedding || embedding.length === 0) {
    if (!text.trim()) {
      return NextResponse.json(
        { error: "Chunk has no text or embedding to compare" },
        { status: 422 },
      );
    }
    try {
      embedding = await embedText(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Embedding failed";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  const { data: rows, error: rpcErr } = await supabaseAdmin.rpc("search_chunks", {
    query_embedding: JSON.stringify(embedding),
    match_count: 50,
    filter_contract_id: null,
  });

  if (rpcErr) {
    return NextResponse.json(
      { error: rpcErr.message },
      { status: 500 },
    );
  }

  const list = (rows ?? []) as SearchRow[];
  const sourceId = String(source.id);
  const sourceContractId =
    source.contract_id != null ? String(source.contract_id) : null;

  const withoutSelf = list.filter((r) => String(r.id) !== sourceId);

  const lookupIds = withoutSelf
    .map((r) => r.id)
    .filter((id): id is string | number => id != null);

  const contractIdByChunkId = new Map<string, string>();
  const metaByChunkId = new Map<
    string,
    { file_name: string | null; counterparty_name: string | null }
  >();

  if (lookupIds.length > 0) {
    const { data: metas, error: metaErr } = await supabaseAdmin
      .from("contract_chunks")
      .select("id, contract_id, contracts(file_name, counterparty_name)")
      .in("id", lookupIds);

    if (!metaErr && metas) {
      for (const row of metas) {
        const id = String(row.id as string | number);
        if (row.contract_id != null) {
          contractIdByChunkId.set(id, String(row.contract_id));
        }
        const rel = row.contracts as ContractEmbed | ContractEmbed[] | null;
        const c = Array.isArray(rel) ? rel[0] : rel;
        metaByChunkId.set(id, {
          file_name: c?.file_name ?? null,
          counterparty_name: c?.counterparty_name ?? null,
        });
      }
    }
  }

  function rowContractId(r: SearchRow): string | undefined {
    if (r.contract_id != null) return String(r.contract_id);
    if (r.id == null) return undefined;
    return contractIdByChunkId.get(String(r.id));
  }

  const otherContracts =
    sourceContractId == null
      ? withoutSelf
      : withoutSelf.filter((r) => rowContractId(r) !== sourceContractId);

  const filtered = otherContracts.slice(0, 12);

  const similar = filtered.map((r) => {
    const idKey = r.id != null ? String(r.id) : "";
    const fromJoin = idKey ? metaByChunkId.get(idKey) : undefined;
    const fileName = fromJoin?.file_name ?? r.file_name ?? null;
    const counterparty =
      fromJoin?.counterparty_name ?? r.counterparty_name ?? null;

    return {
      id: r.id ?? null,
      section_number: r.section_number ?? null,
      section_title: r.section_title ?? null,
      chunk_text: r.chunk_text ?? null,
      clause_type: r.clause_type ?? null,
      title: r.title ?? null,
      similarity: r.similarity ?? null,
      dollar_impact: r.dollar_impact ?? null,
      severity: r.severity ?? null,
      contracts: {
        counterparty_name: counterparty,
        file_name: fileName,
      },
    };
  });

  return NextResponse.json({ similar });
}
