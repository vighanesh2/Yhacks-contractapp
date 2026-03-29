import type { ChunkAnalysis } from "./analysis-types";

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
    .map((c) => `- ${c.title}: ${c.analysis}`)
    .join("\n");

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("Missing ANTHROPIC_API_KEY for contract synthesis.");
  }

  const summaryResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Summarize this contract in 2-3 plain English sentences. Focus on what the contract is for, the key financial terms, and the biggest risk or opportunity.\n\nContract: ${contractName}\nKey findings:\n${clauseSummaries}\n\nReturn ONLY the summary text, nothing else.`,
        },
      ],
    }),
  });

  if (!summaryResponse.ok) {
    const err = await summaryResponse.text();
    throw new Error(`Anthropic synthesizeContract failed: ${summaryResponse.status} ${err}`);
  }

  const summaryData = (await summaryResponse.json()) as {
    content?: Array<{ text?: string }>;
  };
  const summary =
    summaryData.content?.[0]?.text || "Contract analyzed successfully.";

  return {
    contract_type: contractType,
    summary,
    health_score: healthScore,
    money_at_risk: moneyAtRisk,
    leverage_total: leverageTotal,
  };
}
