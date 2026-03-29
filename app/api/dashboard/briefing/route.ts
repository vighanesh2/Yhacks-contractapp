import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type ContractEmbed = {
  id: string;
  counterparty_name?: string | null;
  file_name?: string;
  status?: string;
};

type ChunkRow = Record<string, unknown> & {
  action_deadline?: string | null;
  category?: string;
  contracts?: ContractEmbed | ContractEmbed[] | null;
};

type CategorizedChunk = ChunkRow & {
  days_until_action: number | null;
  contract_name?: string;
};

function unwrapContract(
  rel: ContractEmbed | ContractEmbed[] | null | undefined,
): ContractEmbed | undefined {
  if (!rel) return undefined;
  return Array.isArray(rel) ? rel[0] : rel;
}

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

  const { data: chunks, error: chunksError } = await supabaseAdmin
    .from("contract_chunks")
    .select("*, contracts!inner(id, counterparty_name, file_name, status)")
    .eq("contracts.status", "active")
    .in("category", ["risk", "leverage"])
    .order("action_deadline", { ascending: true, nullsFirst: false });

  if (chunksError) {
    return NextResponse.json({ error: chunksError.message }, { status: 500 });
  }

  const { data: contracts, error: contractsError } = await supabaseAdmin
    .from("contracts")
    .select("*")
    .eq("status", "active");

  if (contractsError) {
    return NextResponse.json(
      { error: contractsError.message },
      { status: 500 },
    );
  }

  const { data: actions, error: actionsError } = await supabaseAdmin
    .from("user_actions")
    .select("savings_amount");

  if (actionsError) {
    return NextResponse.json({ error: actionsError.message }, { status: 500 });
  }

  const now = new Date();
  const totalSaved =
    actions?.reduce((s, a) => s + (Number(a.savings_amount) || 0), 0) ?? 0;
  const totalRisk =
    contracts?.reduce((s, c) => s + (Number(c.money_at_risk) || 0), 0) ?? 0;
  const totalLeverage =
    contracts?.reduce((s, c) => s + (Number(c.leverage_total) || 0), 0) ?? 0;

  const rowList = (chunks ?? []) as ChunkRow[];
  const categorized: CategorizedChunk[] = rowList.map((c) => {
    const deadline = c.action_deadline;
    const daysLeft =
      deadline != null && deadline !== ""
        ? Math.ceil(
            (new Date(String(deadline)).getTime() - now.getTime()) / 86_400_000,
          )
        : null;
    const co = unwrapContract(c.contracts);
    const contract_name = co?.counterparty_name || co?.file_name || undefined;
    return { ...c, days_until_action: daysLeft, contract_name };
  });

  return NextResponse.json({
    stats: {
      total_money_at_risk: totalRisk,
      total_leverage: totalLeverage,
      total_contracts: contracts?.length ?? 0,
      total_saved: totalSaved,
    },
    today_actions: categorized
      .filter((c) => c.days_until_action !== null && c.days_until_action <= 1)
      .slice(0, 3),
    this_week: categorized
      .filter(
        (c) =>
          c.days_until_action !== null &&
          c.days_until_action > 1 &&
          c.days_until_action <= 7,
      )
      .slice(0, 5),
    risks: categorized.filter((c) => c.category === "risk").slice(0, 8),
    leverage: categorized.filter((c) => c.category === "leverage").slice(0, 5),
  });
}
