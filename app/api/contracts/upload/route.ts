import { NextRequest, NextResponse } from "next/server";

import {
  analyzeChunk,
  boilerplateAnalysis,
  isBoilerplateSection,
} from "@/lib/ai-analyze-chunk";
import type { ChunkAnalysis } from "@/lib/analysis-types";
import { synthesizeContract } from "@/lib/ai-synthesize";
import { chunkContract } from "@/lib/chunker";
import { embedBatch } from "@/lib/embeddings";
import { extractText } from "@/lib/pdf-parser";
import { redactPII } from "@/lib/redact";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow up to 60s for Vercel

// ─── Concurrency limiter ──────────────────────────────────────────────────────
// Runs `fn` over all `items` with at most `concurrency` in-flight at once.
// Preserves result order — no external deps needed.

async function runConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

// ─── Route handler ────────────────────────────────────────────────────────────

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

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // ── Step 1: Extract text ────────────────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());
    const rawText = await extractText(buffer, file.name);
    if (!rawText || rawText.trim().length < 50) {
      return NextResponse.json(
        { error: "Could not extract readable text from this file." },
        { status: 400 },
      );
    }

    // ── Step 2: Chunk ───────────────────────────────────────────────────────
    const chunks = chunkContract(rawText);

    // ── Step 3: Redact PII ──────────────────────────────────────────────────
    const redactedChunks = chunks.map((c) => ({
      ...c,
      text: redactPII(c.text),
    }));

    // ── Step 4: Embed all chunks in one batched call ────────────────────────
    const chunkTexts = redactedChunks.map((c) => c.text);
    const embeddings = await embedBatch(chunkTexts);

    // ── Step 5: Analyze chunks concurrently (concurrency = 10) ─────────────
    // Boilerplate sections get a fast-path hardcoded result — no LLM call.
    // All remaining sections run in parallel, capped at 10 in-flight.
    const contractContext = `File: ${file.name}. Total sections: ${chunks.length}.`;

    const analysisResults: ChunkAnalysis[] = await runConcurrent(
      redactedChunks,
      10,
      async (chunk) => {
        if (isBoilerplateSection(chunk.text, chunk.sectionTitle)) {
          return boilerplateAnalysis();
        }
        return analyzeChunk(chunk.text, contractContext);
      },
    );

    // ── Step 6: Synthesize contract-level summary ───────────────────────────
    const synthesis = await synthesizeContract(analysisResults, file.name);

    // ── Step 7: Insert contract record ──────────────────────────────────────
    const { data: contract, error: cErr } = await supabaseAdmin
      .from("contracts")
      .insert({
        file_name: file.name,
        contract_type: synthesis.contract_type,
        summary: synthesis.summary,

        money_at_risk: synthesis.money_at_risk,
        leverage_total: synthesis.leverage_total,
        total_chunks: chunks.length,
        status: "active",
        analyzed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (cErr) throw cErr;

    // ── Step 8: Insert chunks with embeddings + analysis ────────────────────
    const chunkRows = redactedChunks.map((chunk, i) => ({
      contract_id: contract.id,
      chunk_text: chunk.text,
      chunk_index: chunk.index,
      section_number: chunk.sectionNumber,
      section_title: chunk.sectionTitle,
      page_number: chunk.pageEstimate,
      embedding: JSON.stringify(embeddings[i]),
      clause_type: analysisResults[i]?.clause_type ?? "general",
      category: analysisResults[i]?.category ?? "neutral",
      severity: analysisResults[i]?.severity ?? "none",
      dollar_impact: analysisResults[i]?.dollar_impact ?? null,
      impact_explanation: analysisResults[i]?.impact_explanation ?? null,
      trigger_date: analysisResults[i]?.trigger_date ?? null,
      action_deadline: analysisResults[i]?.action_deadline ?? null,
      is_recurring: analysisResults[i]?.is_recurring ?? false,
      title: analysisResults[i]?.title ?? null,
      analysis: analysisResults[i]?.analysis ?? null,
      recommended_action: analysisResults[i]?.recommended_action ?? null,
    }));

    // Insert in batches of 10 to stay within Supabase payload limits
    for (let i = 0; i < chunkRows.length; i += 10) {
      const batch = chunkRows.slice(i, i + 10);
      const { error: chunkErr } = await supabaseAdmin
        .from("contract_chunks")
        .insert(batch);
      if (chunkErr) console.error("Chunk insert error:", chunkErr.message);
    }

    // ── Step 9: Back-fill next_critical_date + counterparty hint ────────────
    const deadlines = analysisResults
      .map((a) => a.action_deadline)
      .filter((d): d is string => !!d)
      .sort();

    // Best-effort counterparty extraction from the raw text (first proper noun pair)
    const counterpartyMatch = rawText.match(
      /(?:between|party|parties)[^\n]{0,60}?([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/,
    );
    const counterpartyHint = counterpartyMatch?.[1] ?? null;

    if (deadlines.length > 0 || counterpartyHint) {
      await supabaseAdmin
        .from("contracts")
        .update({
          ...(deadlines.length > 0 ? { next_critical_date: deadlines[0] } : {}),
          ...(counterpartyHint ? { counterparty_name: counterpartyHint } : {}),
        })
        .eq("id", contract.id);
    }

    // ── Step 10: Fetch saved chunk IDs for response ──────────────────────────
    const { data: savedChunks } = await supabaseAdmin
      .from("contract_chunks")
      .select("id, chunk_index")
      .eq("contract_id", contract.id)
      .order("chunk_index", { ascending: true });

    const idByChunkIndex = new Map(
      (savedChunks ?? []).map((row) => [
        row.chunk_index as number,
        row.id as string,
      ]),
    );

    return NextResponse.json({
      success: true,
      contract: { ...contract, ...synthesis },
      chunks: redactedChunks.map((chunk, i) => ({
        id: idByChunkIndex.get(chunk.index) ?? null,
        section_number: chunk.sectionNumber,
        section_title: chunk.sectionTitle,
        ...analysisResults[i],
      })),
      stats: {
        total_chunks: chunks.length,
        risks_found: analysisResults.filter((a) => a.category === "risk")
          .length,
        leverage_found: analysisResults.filter((a) => a.category === "leverage")
          .length,
        critical_count: analysisResults.filter((a) => a.severity === "critical")
          .length,
      },
    });
  } catch (error: unknown) {
    console.error("Upload pipeline error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
