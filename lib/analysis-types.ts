/** Per-chunk output from `analyzeChunk` — used by synthesis and Supabase rows. */
export type ClauseType =
  | "general"
  | "auto_renewal"
  | "price_escalation"
  | "sla_penalty"
  | "ip_ownership"
  | "non_compete"
  | "rate_lock"
  | "scope_definition"
  | "late_payment"
  | "early_payment";

export type AnalysisCategory = "risk" | "leverage" | "neutral";

export type Severity = "none" | "low" | "medium" | "high" | "critical";

export interface ChunkAnalysis {
  clause_type: ClauseType;
  category: AnalysisCategory;
  severity: Severity;
  dollar_impact: number | null;
  impact_explanation: string | null;
  trigger_date: string | null;
  action_deadline: string | null;
  is_recurring: boolean;
  title: string | null;
  analysis: string;
  recommended_action: string | null;
}

const CLAUSE_LIST: ClauseType[] = [
  "general",
  "auto_renewal",
  "price_escalation",
  "sla_penalty",
  "ip_ownership",
  "non_compete",
  "rate_lock",
  "scope_definition",
  "late_payment",
  "early_payment",
];

const CAT_LIST: AnalysisCategory[] = ["risk", "leverage", "neutral"];
const SEV_LIST: Severity[] = ["none", "low", "medium", "high", "critical"];

export function normalizeChunkAnalysisFields(
  raw: Record<string, unknown>
): ChunkAnalysis {
  const ct = String(raw.clause_type ?? "general");
  const clause_type = CLAUSE_LIST.includes(ct as ClauseType)
    ? (ct as ClauseType)
    : "general";

  const cg = String(raw.category ?? "neutral");
  const category = CAT_LIST.includes(cg as AnalysisCategory)
    ? (cg as AnalysisCategory)
    : "neutral";

  const sv = String(raw.severity ?? "none");
  const severity = SEV_LIST.includes(sv as Severity)
    ? (sv as Severity)
    : "none";

  return {
    clause_type,
    category,
    severity,
    dollar_impact:
      raw.dollar_impact === null || raw.dollar_impact === undefined
        ? null
        : Number(raw.dollar_impact),
    impact_explanation:
      raw.impact_explanation == null
        ? null
        : String(raw.impact_explanation),
    trigger_date:
      raw.trigger_date == null ? null : String(raw.trigger_date),
    action_deadline:
      raw.action_deadline == null ? null : String(raw.action_deadline),
    is_recurring: Boolean(raw.is_recurring),
    title: raw.title == null ? null : String(raw.title),
    analysis: String(raw.analysis ?? ""),
    recommended_action:
      raw.recommended_action == null
        ? null
        : String(raw.recommended_action),
  };
}
