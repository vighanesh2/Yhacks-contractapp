import type { ChunkAnalysis } from "./analysis-types";
import { lavaOpenAI, OPENAI_V1_BASE } from "./lava-openai";

const OPENAI_CHAT_URL = `${OPENAI_V1_BASE}/chat/completions`;
/** Same stack as `ai-analyze-chunk` — Lava gateway + OpenAI. */
const SYNTHESIS_MODEL = "gpt-4o-mini";

export async function synthesizeContract(
  chunks: ChunkAnalysis[],
  contractName: string
): Promise<{
  contract_type: string;
  summary: string;
  health_score: number;
  money_at_risk: number;
  leverage_total: number;
}> {
  const riskClauses = chunks.filter((c) => c.category === "risk");
  const leverageClauses = chunks.filter((c) => c.category === "leverage");

  const moneyAtRisk = riskClauses.reduce(
    (sum, c) => sum + (Number(c.dollar_impact) || 0),
    0
  );
  const leverageTotal = leverageClauses.reduce(
    (sum, c) => sum + (Number(c.dollar_impact) || 0),
    0
  );

  const criticalCount = chunks.filter((c) => c.severity === "critical").length;
  const highCount = chunks.filter((c) => c.severity === "high").length;
  const leverageCount = leverageClauses.length;

  let healthScore = 80;
  healthScore -= criticalCount * 15;
  healthScore -= highCount * 8;
  healthScore += leverageCount * 5;
  healthScore = Math.max(5, Math.min(100, healthScore));

  const typeCounts: Record<string, number> = {};
  chunks.forEach((c) => {
    if (c.clause_type !== "general") {
      typeCounts[c.clause_type] = (typeCounts[c.clause_type] || 0) + 1;
    }
  });

  const contractTypeMap: Record<string, string> = {
    auto_renewal: "vendor",
    price_escalation: "vendor",
    sla_penalty: "service_provider",
    ip_ownership: "service_provider",
    non_compete: "employment",
    rate_lock: "license",
    scope_definition: "service_provider",
    late_payment: "invoice",
    early_payment: "invoice",
  };

  const mostCommonType = Object.entries(typeCounts).sort(
    (a, b) => b[1] - a[1]
  )[0];
  const contractType = mostCommonType
    ? contractTypeMap[mostCommonType[0]] || "vendor"
    : "vendor";

  const clauseSummaries = chunks
    .filter((c) => c.severity !== "none")
    .map((c) => `- ${c.title ?? "Section"}: ${c.analysis}`)
    .join("\n");

  type ChatCompletionResponse = {
    choices?: Array<{ message?: { content?: string | null } }>;
    error?: { message?: string };
  };

  let summaryData: ChatCompletionResponse;
  try {
    summaryData = (await lavaOpenAI.gateway(OPENAI_CHAT_URL, {
      body: {
        model: SYNTHESIS_MODEL,
        max_tokens: 256,
        messages: [
          {
            role: "system",
            content:
              "You write concise contract summaries. Reply with plain prose only — no markdown, no JSON.",
          },
          {
            role: "user",
            content: `Summarize this contract in 2-3 plain English sentences. Focus on what the contract is for, the key financial terms, and the biggest risk or opportunity.

Contract: ${contractName}
Key findings:
${clauseSummaries || "(No non-neutral severity clauses — summarize from overall context if needed.)"}

Return ONLY the summary text, nothing else.`,
          },
        ],
      },
    })) as ChatCompletionResponse;
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Lava gateway request failed.";
    throw new Error(`synthesizeContract: ${msg}`);
  }

  if (summaryData.error?.message) {
    throw new Error(`synthesizeContract: ${summaryData.error.message}`);
  }

  const summary =
    summaryData.choices?.[0]?.message?.content?.trim() ||
    "Contract analyzed successfully.";

  return {
    contract_type: contractType,
    summary,
    health_score: healthScore,
    money_at_risk: moneyAtRisk,
    leverage_total: leverageTotal,
  };
}
