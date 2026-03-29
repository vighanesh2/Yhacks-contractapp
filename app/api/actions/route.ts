import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

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

  let body: {
    chunk_id?: string | null;
    contract_id?: string | null;
    savings_amount?: number | null;
    action_type?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = {
    chunk_id: body.chunk_id ?? null,
    contract_id: body.contract_id ?? null,
    savings_amount: body.savings_amount ?? 0,
    action_type: body.action_type ?? "take_action",
  };

  const { data, error } = await supabaseAdmin
    .from("user_actions")
    .insert(payload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, action: data });
}
