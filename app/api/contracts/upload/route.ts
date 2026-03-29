import { NextRequest, NextResponse } from "next/server";

import { analyzeChunk } from "@/lib/ai-analyze-chunk";
import type { ChunkAnalysis } from "@/lib/analysis-types";
import { synthesizeContract } from "@/lib/ai-synthesize";
import { chunkContract } from "@/lib/chunker";
import { embedBatch } from "@/lib/embeddings";
import { extractText } from "@/lib/pdf-parser";
import { redactPII } from "@/lib/redact";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow up to 60s for Vercel

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
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    // 1. Extract text
    const buffer = Buffer.from(await file.arrayBuffer());
    const rawText = await extractText(buffer, file.name);
    if (!rawText || rawText.trim().length < 50) {
      return NextResponse.json(
        { error: "Could not extract text" },
        { status: 400 },
      );
    }

    // 2. Smart chunking
    const chunks = chunkContract(rawText);

    // 3. Redact PII from each chunk
    const redactedChunks = chunks.map((c) => ({
      ...c,
      text: redactPII(c.text),
    }));

    // 4. Generate embeddings for all chunks (batched)
    const chunkTexts = redactedChunks.map((c) => c.text);
    const embeddings = await embedBatch(chunkTexts);

    // 5. Analyze each chunk with AI (parallel, batches of 5)
    const contractContext = `File: ${file.name}. Total sections: ${chunks.length}.`;
    const analysisResults: ChunkAnalysis[] = [];

    for (let i = 0; i < redactedChunks.length; i += 5) {
      const batch = redactedChunks.slice(i, i + 5);
      const batchResults = await Promise.all(
        batch.map((chunk) => analyzeChunk(chunk.text, contractContext)),
      );
      analysisResults.push(...batchResults);
    }

    // 6. Synthesize contract-level summary
    const synthesis = await synthesizeContract(analysisResults, file.name);

    // 7. Insert contract record
    const { data: contract, error: cErr } = await supabaseAdmin
      .from("contracts")
      .insert({
        file_name: file.name,
        contract_type: synthesis.contract_type,
        summary: synthesis.summary,
        health_score: synthesis.health_score,
        money_at_risk: synthesis.money_at_risk,
        leverage_total: synthesis.leverage_total,
        total_chunks: chunks.length,
        status: "active",
        analyzed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (cErr) throw cErr;

    // 8. Insert all chunks with embeddings and analysis
    const chunkRows = redactedChunks.map((chunk, i) => ({
      contract_id: contract.id,
      chunk_text: chunk.text,
      chunk_index: chunk.index,
      section_number: chunk.sectionNumber,
      section_title: chunk.sectionTitle,
      page_number: chunk.pageEstimate,
      embedding: JSON.stringify(embeddings[i]), // pgvector accepts JSON array
      clause_type: analysisResults[i]?.clause_type || "general",
      category: analysisResults[i]?.category || "neutral",
      severity: analysisResults[i]?.severity || "none",
      dollar_impact: analysisResults[i]?.dollar_impact ?? null,
      impact_explanation: analysisResults[i]?.impact_explanation ?? null,
      trigger_date: analysisResults[i]?.trigger_date ?? null,
      action_deadline: analysisResults[i]?.action_deadline ?? null,
      is_recurring: analysisResults[i]?.is_recurring || false,
      title: analysisResults[i]?.title ?? null,
      analysis: analysisResults[i]?.analysis ?? null,
      recommended_action: analysisResults[i]?.recommended_action ?? null,
    }));

    // Insert in batches to avoid payload size limits
    for (let i = 0; i < chunkRows.length; i += 10) {
      const batch = chunkRows.slice(i, i + 10);
      const { error: chunkErr } = await supabaseAdmin
        .from("contract_chunks")
        .insert(batch);
      if (chunkErr) console.error("Chunk insert error:", chunkErr);
    }

    // 9. Set next critical date
    const deadlines = analysisResults
      .filter((a) => a.action_deadline)
      .map((a) => a.action_deadline as string)
      .sort();

    if (deadlines.length > 0) {
      await supabaseAdmin
        .from("contracts")
        .update({
          next_critical_date: deadlines[0],
          counterparty_name:
            analysisResults
              .find((a) => a.title)
              ?.title?.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+/)?.[0] ?? null,
        })
        .eq("id", contract.id);
    }

    const { data: savedChunks } = await supabaseAdmin
      .from("contract_chunks")
      .select("id, chunk_index")
      .eq("contract_id", contract.id)
      .order("chunk_index", { ascending: true });

    const idByChunkIndex = new Map(
      (savedChunks ?? []).map((row) => [row.chunk_index as number, row.id as string]),
    );

    // 10. Return full result
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
        risks_found: analysisResults.filter((a) => a.category === "risk").length,
        leverage_found: analysisResults.filter((a) => a.category === "leverage")
          .length,
        critical_count: analysisResults.filter((a) => a.severity === "critical")
          .length,
      },
    });
  } catch (error: unknown) {
    console.error("Upload pipeline error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
