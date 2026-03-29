import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type ChunkLite = {
  action_deadline?: string | null;
};

type ContractRow = Record<string, unknown> & {
  next_critical_date?: string | null;
  contract_chunks?: ChunkLite[] | null;
};

/**
 * Earliest *action* deadline for portfolio cards: contract row + chunk
 * action_deadlines only. We intentionally omit trigger_date — it is often a
 * past lease start, which would wrongly show as "overdue" vs a future renewal.
 */
function earliestDisplayDeadline(
  contract: ContractRow,
  chunks: ChunkLite[] | undefined,
): string | null {
  const candidates: { t: number; s: string }[] = [];
  const push = (raw: string | null | undefined) => {
    if (raw == null || String(raw).trim() === "") return;
    const t = new Date(raw).getTime();
    if (!Number.isNaN(t)) candidates.push({ t, s: raw });
  };

  push(contract.next_critical_date);
  for (const ch of chunks ?? []) {
    push(ch.action_deadline);
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.t - b.t);
  return candidates[0].s;
}

/**
 * GET /api/contracts — list contracts (dashboard + /contracts page).
 */
export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("contracts")
    .select(
      "*, contract_chunks(id, category, clause_type, severity, action_deadline)",
    )
    .eq("status", "active")
    .order("analyzed_at", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as ContractRow[];
  const enriched = rows.map((row) => {
    const earliest = earliestDisplayDeadline(row, row.contract_chunks ?? []);
    return {
      ...row,
      next_critical_date: earliest,
    };
  });

  return NextResponse.json(enriched);
}
