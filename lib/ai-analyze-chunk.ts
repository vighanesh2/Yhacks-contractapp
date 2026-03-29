import type { ChunkAnalysis } from "./analysis-types";
import { normalizeChunkAnalysisFields } from "./analysis-types";
import { lavaOpenAI, OPENAI_V1_BASE } from "./lava-openai";

export type { ChunkAnalysis };

const OPENAI_CHAT_URL = `${OPENAI_V1_BASE}/chat/completions`;

/** Same provider family as embeddings; chat completions produce the structured analysis (not vectors). */
const ANALYSIS_MODEL = "gpt-4o-mini";

const CHUNK_ANALYSIS_PROMPT = `You are a contract analyst. Analyze this single contract clause/section and classify it.

Return ONLY valid JSON (no markdown, no backticks):
{
  "clause_type": "auto_renewal | price_escalation | penalty | minimum_commitment | exclusivity | termination_fee | cancellation_window | renegotiation | liability_cap | late_payment | early_payment | sla_penalty | rate_lock | audit_rights | ip_ownership | non_compete | indemnification | payment_terms | scope_definition | confidentiality | dispute_resolution | force_majeure | warranty | governing_law | general",
  "category": "risk | leverage | neutral",
  "severity": "critical | high | medium | low | none",
  "title": "Short headline summarizing the financial impact, e.g. 'Auto-renewal at 8% higher rate in 22 days'",
  "analysis": "2-3 sentence explanation of what this means for the business and why it matters financially",
  "dollar_impact": null or number (estimated annual financial impact in USD),
  "impact_explanation": "Show your math if dollar_impact is set",
  "trigger_date": "YYYY-MM-DD or null (when does this clause activate?)",
  "action_deadline": "YYYY-MM-DD or null (last date to take action)",
  "is_recurring": false,
  "recommended_action": "Specific actionable step the business should take. Be concrete, not generic."
}

If the section is just boilerplate with no financial implications (e.g. governing law, definitions), set category to "neutral", severity to "none", and dollar_impact to null. Still provide a brief analysis.

IMPORTANT: Calculate real dollar impacts wherever possible. If the section mentions specific amounts, percentages, or timeframes, do the math.`;

const FALLBACK_FIELDS = {
  clause_type: "general",
  category: "neutral",
  severity: "none",
  title: "Unable to analyze",
  analysis: "This section could not be automatically analyzed.",
  dollar_impact: null,
  impact_explanation: null,
  trigger_date: null,
  action_deadline: null,
  is_recurring: false,
  recommended_action: "Review manually.",
} as const satisfies Record<string, unknown>;

function fallbackAnalysis(message: string): ChunkAnalysis {
  return normalizeChunkAnalysisFields({
    ...FALLBACK_FIELDS,
    analysis: message,
  });
}

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

export async function analyzeChunk(
  chunkText: string,
  contractContext: string,
): Promise<ChunkAnalysis> {
  const userContent = `Contract context: ${contractContext}\n\nAnalyze this specific section:\n\n${chunkText}\n\n${CHUNK_ANALYSIS_PROMPT}`;

  let data: ChatCompletionResponse;
  try {
    data = (await lavaOpenAI.gateway(OPENAI_CHAT_URL, {
      body: {
        model: ANALYSIS_MODEL,
        max_tokens: 1024,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a precise contract analyst. Reply with a single JSON object only, matching the user's schema. No markdown.",
          },
          { role: "user", content: userContent },
        ],
      },
    })) as ChatCompletionResponse;
  } catch (err) {
    return fallbackAnalysis(
      err instanceof Error ? err.message : "Lava gateway request failed.",
    );
  }

  if (data.error?.message) {
    return fallbackAnalysis(data.error.message);
  }

  const text = data.choices?.[0]?.message?.content ?? "{}";
  const cleaned = text
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    const raw = JSON.parse(cleaned) as Record<string, unknown>;
    return normalizeChunkAnalysisFields(raw);
  } catch {
    return fallbackAnalysis("This section could not be automatically analyzed.");
  }
}
