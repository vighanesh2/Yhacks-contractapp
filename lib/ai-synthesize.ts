import type { ChunkAnalysis } from "./analysis-types";
import { lavaOpenAI, OPENAI_V1_BASE } from "./lava-openai";

const OPENAI_CHAT_URL = `${OPENAI_V1_BASE}/chat/completions`;
const SYNTHESIS_MODEL = "gpt-4.1";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

// ─── Contract-type inference ──────────────────────────────────────────────────

const CLAUSE_TO_CONTRACT_TYPE: Record<string, string> = {
  auto_renewal: "vendor",
  price_escalation: "sales",
  sla_penalty: "service_provider",
  ip_ownership: "service_provider",
  non_compete: "employment",
  rate_lock: "license",
  scope_definition: "service_provider",
  late_payment: "invoice",
  early_payment: "invoice",
  minimum_commitment: "sales",
  payment_terms: "sales",
  termination_fee: "vendor",
  exclusivity: "distribution",
};

function inferContractType(chunks: ChunkAnalysis[]): string {
  const counts: Record<string, number> = {};
  for (const c of chunks) {
    if (c.clause_type !== "general") {
      counts[c.clause_type] = (counts[c.clause_type] ?? 0) + 1;
    }
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top) return "vendor";
  return CLAUSE_TO_CONTRACT_TYPE[top[0]] ?? "vendor";
}

// ─── Health score ─────────────────────────────────────────────────────────────

// ─── Dollar totals ────────────────────────────────────────────────────────────

function computeDollarTotals(chunks: ChunkAnalysis[]): {
  money_at_risk: number;
  leverage_total: number;
} {
  const money_at_risk = chunks
    .filter((c) => c.category === "risk")
    .reduce((sum, c) => sum + (Number(c.dollar_impact) || 0), 0);

  const leverage_total = chunks
    .filter((c) => c.category === "leverage")
    .reduce((sum, c) => sum + (Number(c.dollar_impact) || 0), 0);

  return { money_at_risk, leverage_total };
}

// ─── Eight-insight surface ────────────────────────────────────────────────────
// Builds a structured prompt section that guides GPT-4.2 to surface
// Henry's 8 specific actionable insights in the synthesis summary.

function buildEightInsightContext(chunks: ChunkAnalysis[]): string {
  const nonNeutral = chunks.filter((c) => c.severity !== "none");

  const byType = (type: string) =>
    nonNeutral.filter((c) => c.clause_type === type);

  const lines: string[] = [];

  const autoRenewal = byType("auto_renewal");
  if (autoRenewal.length > 0) {
    lines.push(
      `AUTO-RENEWAL TRAP: ${autoRenewal.map((c) => c.title ?? c.analysis).join("; ")}`,
    );
  }

  const priceEsc = byType("price_escalation");
  if (priceEsc.length > 0) {
    lines.push(
      `PRICE ESCALATION / TRUE-UP EXPOSURE: ${priceEsc.map((c) => c.title ?? c.analysis).join("; ")}`,
    );
  }

  const payTerms = [
    ...byType("payment_terms"),
    ...byType("late_payment"),
    ...byType("early_payment"),
  ];
  if (payTerms.length > 0) {
    lines.push(
      `PAYMENT TERMS CASH-FLOW RISK: ${payTerms.map((c) => c.title ?? c.analysis).join("; ")}`,
    );
  }

  const termination = [
    ...byType("termination_fee"),
    ...byType("cancellation_window"),
  ];
  if (termination.length > 0) {
    lines.push(
      `TERMINATION LEVERAGE GAP: ${termination.map((c) => c.title ?? c.analysis).join("; ")}`,
    );
  }

  const ip = byType("ip_ownership");
  if (ip.length > 0) {
    lines.push(
      `IP OWNERSHIP / DELIVERABLES RESTRICTION: ${ip.map((c) => c.title ?? c.analysis).join("; ")}`,
    );
  }

  const sla = byType("sla_penalty");
  if (sla.length > 0) {
    lines.push(
      `SLA PENALTY IMBALANCE: ${sla.map((c) => c.title ?? c.analysis).join("; ")}`,
    );
  }

  const minCommit = byType("minimum_commitment");
  if (minCommit.length > 0) {
    lines.push(
      `MINIMUM COMMITMENT TRUE-UP RISK: ${minCommit.map((c) => c.title ?? c.analysis).join("; ")}`,
    );
  }

  return lines.length > 0
    ? `\nKEY FINDINGS TO ADDRESS IN SUMMARY:\n${lines.join("\n")}`
    : "";
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function synthesizeContract(
  chunks: ChunkAnalysis[],
  contractName: string,
): Promise<{
  contract_type: string;
  summary: string;
  money_at_risk: number;
  leverage_total: number;
}> {
  const contract_type = inferContractType(chunks);
  const { money_at_risk, leverage_total } = computeDollarTotals(chunks);

  // Build a compact clause-level digest for the LLM
  const clauseDigest = chunks
    .filter((c) => c.severity !== "none")
    .map(
      (c) =>
        `• [${c.severity?.toUpperCase()}] ${c.title ?? "Untitled clause"}: ${c.analysis}${c.dollar_impact ? ` (~$${Number(c.dollar_impact).toLocaleString()} impact)` : ""}`,
    )
    .join("\n");

  const eightInsightContext = buildEightInsightContext(chunks);

  const systemPrompt = `You are a CFO-grade contract analyst. Write concise, financially grounded contract summaries.
Your summaries must:
- Be 3–4 plain English sentences (no markdown, no bullets, no JSON)
- Open with what the contract is and who the parties are (if known)
- Highlight the single biggest financial risk and estimated dollar exposure
- Close with the highest-priority recommended action and its deadline (if any)
- Reference specific clause findings provided — never fabricate figures
- Sound authoritative, specific, and immediately useful to a business owner or CFO`;

  const userPrompt = `Summarize this contract for a CFO / business owner.

Contract name: ${contractName}
Contract type: ${contract_type}
Total money at risk: $${money_at_risk.toLocaleString()}
Total leverage available: $${leverage_total.toLocaleString()}

Analyzed clause findings:
${clauseDigest || "(No high-severity clauses found — contract appears low-risk.)"}
${eightInsightContext}

Write a 3–4 sentence plain-English executive summary. Focus on the biggest financial risk, its dollar amount, and the one action the reader must take first. No markdown. No bullets. No JSON.`;

  let summaryData: ChatCompletionResponse;
  try {
    summaryData = (await lavaOpenAI.gateway(OPENAI_CHAT_URL, {
      body: {
        model: SYNTHESIS_MODEL,
        max_tokens: 300,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
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
    "Contract analyzed successfully. Review the clause findings for detailed risk and leverage insights.";

  return {
    contract_type,
    summary,
    money_at_risk,
    leverage_total,
  };
}
