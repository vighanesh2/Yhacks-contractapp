import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * GET /api/contracts/:id — single contract with chunks for the detail page.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing contract id" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("contracts")
    .select(
      `
      *,
      contract_chunks (
        id,
        chunk_text,
        chunk_index,
        section_number,
        section_title,
        page_number,
        clause_type,
        category,
        severity,
        dollar_impact,
        impact_explanation,
        trigger_date,
        action_deadline,
        is_recurring,
        title,
        analysis,
        recommended_action
      )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const chunks = data.contract_chunks;
  if (Array.isArray(chunks)) {
    chunks.sort(
      (a: { chunk_index?: number }, b: { chunk_index?: number }) =>
        (a.chunk_index ?? 0) - (b.chunk_index ?? 0),
    );
  }

  return NextResponse.json({ contract: data });
}
