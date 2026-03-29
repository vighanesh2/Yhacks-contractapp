import { NextRequest, NextResponse } from "next/server";

import { embedText } from "@/lib/embeddings";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type SearchChunkRow = Record<string, unknown> & { contract_id?: string };

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

  let body: { query?: string; category?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = body.query?.trim();
  if (!query) {
    return NextResponse.json({ error: "No query provided" }, { status: 400 });
  }

  const embedding = await embedText(query);

  const { data, error } = await supabaseAdmin.rpc("search_chunks", {
    query_embedding: JSON.stringify(embedding),
    match_count: 15,
    filter_category: body.category ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as SearchChunkRow[];

  const grouped: Record<string, SearchChunkRow[]> = {};
  for (const chunk of rows) {
    const key = String(chunk.contract_id ?? "unknown");
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(chunk);
  }

  return NextResponse.json({ results: data, grouped });
}
