import type { ChunkAnalysis } from "./analysis-types";
import { normalizeChunkAnalysisFields } from "./analysis-types";
import { lavaOpenAI, OPENAI_V1_BASE } from "./lava-openai";

export type { ChunkAnalysis };

const OPENAI_CHAT_URL = `${OPENAI_V1_BASE}/chat/completions`;
const ANALYSIS_MODEL = "gpt-4.1-mini";

// ─── Boilerplate fast-path ────────────────────────────────────────────────────
// Skip the LLM entirely for sections that are structurally neutral.
// This is the single biggest speed win in the upload pipeline.

const BOILERPLATE_SECTION_TITLES = new Set([
  "governing law",
  "jurisdiction",
  "entire agreement",
  "miscellaneous",
  "general provisions",
  "counterparts",
  "severability",
  "waiver",
  "amendments",
  "amendment",
  "notices",
  "notice",
  "headings",
  "recitals",
  "background",
  "definitions",
  "interpretation",
  "force majeure",
  "signature",
  "signatures",
  "execution",
  "exhibits",
  "schedules",
]);

export function isBoilerplateSection(
  text: string,
  sectionTitle?: string | null,
): boolean {
  // Very short — nothing to analyze
  if (text.trim().length < 180) return true;
  // Title-based fast-path
  if (sectionTitle) {
    const normalized = sectionTitle.toLowerCase().trim();
    if (BOILERPLATE_SECTION_TITLES.has(normalized)) return true;
  }
  // First-line heuristic — covers untitled sections whose first words are a known header
  const firstLine = text.trim().split("\n")[0].toLowerCase().trim();
  if (BOILERPLATE_SECTION_TITLES.has(firstLine)) return true;
  return false;
}

export function boilerplateAnalysis(): ChunkAnalysis {
  return normalizeChunkAnalysisFields({
    clause_type: "general",
    category: "neutral",
    severity: "none",
    title: null,
    analysis:
      "Standard boilerplate provision — no material financial or operational impact identified.",
    dollar_impact: null,
    impact_explanation: null,
    trigger_date: null,
    action_deadline: null,
    is_recurring: false,
    recommended_action: null,
  });
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const CHUNK_ANALYSIS_PROMPT = `You are a CFO-grade contract analyst with expertise from WorldCC 2025–2026 industry benchmarks and experience structuring deals at tier-1 financial institutions.

Analyze this single contract clause/section for financial risk and leverage.

FINANCIAL GROUNDING (use these benchmarks in your dollar math):
- Industry average revenue leakage: 8.6–9% of annual contract value (WorldCC 2025–2026)
- For a typical sales/distribution contract ($500K–$2M annual value): realistic total risk is $47K–$92K
- Auto-renewal traps: average 8–12% rate increase if not cancelled in time
- Payment terms: Net-60+ costs ~2–3% annual cash-flow drag vs Net-30
- SLA penalties: average $15K–$25K per incident for mid-market contracts
- Minimum commitment shortfalls: typically 15–25% of committed value becomes true-up exposure
- IP/deliverables restrictions: typically $20K–$40K in re-work or licensing cost if unfavorable

PRIORITY CLAUSE TYPES — flag these aggressively (in order of business impact):
1. auto_renewal — Flag if renewal is automatic AND notice window < 90 days OR rate increases on renewal
2. price_escalation — Flag if no CPI/annual escalation cap, or if true-up mechanism favors counterparty
3. payment_terms — Flag if Net > 45 days, late-payment interest is absent, or early-payment discount is uncaptured
4. termination_fee / cancellation_window — Flag asymmetric termination rights or punitive exit fees
5. ip_ownership — Flag if deliverables ownership is unclear, shared, or assigned to counterparty
6. sla_penalty — Flag if penalties are disproportionate or if cure periods are absent
7. minimum_commitment — Flag if annual minimums lack a cure period or ratchet upward
8. liability_cap — Flag if cap is less than 1x annual contract value (standard is 1–2x)

Return ONLY valid JSON (no markdown, no backticks, no commentary):
{
  "clause_type": "auto_renewal | price_escalation | penalty | minimum_commitment | exclusivity | termination_fee | cancellation_window | renegotiation | liability_cap | late_payment | early_payment | sla_penalty | rate_lock | audit_rights | ip_ownership | non_compete | indemnification | payment_terms | scope_definition | confidentiality | dispute_resolution | force_majeure | warranty | governing_law | general",
  "category": "risk | leverage | neutral",
  "severity": "critical | high | medium | low | none",
  "title": "Specific headline showing the financial stake — e.g. 'Auto-renewal lock-in: 90-day notice required, rate jumps 12% on rollover'",
  "analysis": "2–3 sentences: what this clause means financially, who it currently favors, and why a CFO or business owner should care. Reference the specific risk in dollar terms where possible.",
  "dollar_impact": null or number (estimated annual financial impact in USD — be realistic, not inflated),
  "impact_explanation": "Show your math step by step. E.g.: '$1.2M annual contract × 9% leakage rate (WorldCC 2025) = $108K at risk. Auto-renewal at 12% premium = additional $144K/yr if not cancelled.'",
  "trigger_date": "YYYY-MM-DD or null",
  "action_deadline": "YYYY-MM-DD or null (last date to act before financial harm kicks in)",
  "is_recurring": false,
  "recommended_action": "Specific, dated, actionable step. E.g.: 'Send written non-renewal notice by [date] to avoid the 12% rate increase — saves an estimated $X annually. Renegotiate to Net-30 terms at next renewal to recover ~$Y in cash-flow drag.'"
}

RULES:
- Never fabricate specific dates that are not in the clause text; use null if not present.
- If the clause is standard boilerplate (governing law, definitions, force majeure), set category to "neutral", severity to "none", dollar_impact to null.
- Dollar impacts must be grounded in the clause text + the benchmarks above. Never use round fantasy numbers like $2,000,000.
- recommended_action must be concrete and contract-specific — never generic like "consult a lawyer".`;

// ─── Fallback ─────────────────────────────────────────────────────────────────

function fallbackAnalysis(reason: string): ChunkAnalysis {
  return normalizeChunkAnalysisFields({
    clause_type: "general",
    category: "neutral",
    severity: "none",
    title: "Analysis unavailable",
    analysis: reason,
    dollar_impact: null,
    impact_explanation: null,
    trigger_date: null,
    action_deadline: null,
    is_recurring: false,
    recommended_action: "Review this section manually.",
  });
}

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

// ─── Main export ──────────────────────────────────────────────────────────────

export async function analyzeChunk(
  chunkText: string,
  contractContext: string,
): Promise<ChunkAnalysis> {
  const userContent = `Contract context: ${contractContext}\n\nClause to analyze:\n\n${chunkText}\n\n${CHUNK_ANALYSIS_PROMPT}`;

  let data: ChatCompletionResponse;
  try {
    data = (await lavaOpenAI.gateway(OPENAI_CHAT_URL, {
      body: {
        model: ANALYSIS_MODEL,
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a precise contract analyst. Reply with a single valid JSON object only — no markdown, no backticks, no commentary.",
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
    return fallbackAnalysis(
      "Could not parse analysis response — please review this section manually.",
    );
  }
}
