import { NextRequest, NextResponse } from "next/server";

import { askWithGraphRAG } from "@/lib/graph-rag-pipeline";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { question?: string; contract_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json(
      { error: "No question provided" },
      { status: 400 },
    );
  }

  const result = await askWithGraphRAG(question, body.contract_id);

  return NextResponse.json({
    answer: result.answer,
    sources: result.sources,
    thinking: result.thinking,
    confidence: result.confidence,
    router_decision: result.router_decision,
  });
}
