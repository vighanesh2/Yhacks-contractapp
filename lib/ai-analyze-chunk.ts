import {
  normalizeChunkAnalysisFields,
  type ChunkAnalysis,
} from "./analysis-types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const ANALYZE_MODEL =
  process.env.ANTHROPIC_ANALYZE_MODEL ?? "claude-3-5-haiku-20241022";

const SCHEMA_HINT = `Return ONLY a single JSON object (no markdown) with these keys:
clause_type: one of general, auto_renewal, price_escalation, sla_penalty, ip_ownership, non_compete, rate_lock, scope_definition, late_payment, early_payment
category: one of risk, leverage, neutral
severity: one of none, low, medium, high, critical
dollar_impact: number or null (estimated USD exposure if applicable)
impact_explanation: string or null
trigger_date: ISO date string or null
action_deadline: ISO date string or null
is_recurring: boolean
title: short string or null
analysis: 1-3 sentences
recommended_action: string or null`;

function parseAnthropicJson(text: string): Record<string, unknown> {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned) as Record<string, unknown>;
}

export async function analyzeChunk(
  chunkText: string,
  contractContext: string
): Promise<ChunkAnalysis> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("Missing ANTHROPIC_API_KEY for chunk analysis.");
  }

  const userContent = `${contractContext}

Chunk text:
"""
${chunkText.slice(0, 24_000)}
"""

${SCHEMA_HINT}`;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANALYZE_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic analyzeChunk failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content?.[0]?.text ?? "{}";

  try {
    const raw = parseAnthropicJson(text);
    return normalizeChunkAnalysisFields(raw);
  } catch {
    return {
      clause_type: "general",
      category: "neutral",
      severity: "none",
      dollar_impact: null,
      impact_explanation: null,
      trigger_date: null,
      action_deadline: null,
      is_recurring: false,
      title: null,
      analysis: text.slice(0, 500),
      recommended_action: null,
    };
  }
}
