export type ClauseType =
  | "auto_renewal"
  | "price_escalation"
  | "penalty"
  | "minimum_commitment"
  | "exclusivity"
  | "termination_fee"
  | "cancellation_window"
  | "renegotiation"
  | "liability_cap"
  | "late_payment"
  | "early_payment"
  | "sla_penalty"
  | "rate_lock"
  | "audit_rights"
  | "ip_ownership"
  | "non_compete"
  | "indemnification"
  | "payment_terms"
  | "scope_definition"
  | "confidentiality"
  | "dispute_resolution"
  | "force_majeure"
  | "warranty"
  | "governing_law"
  | "general";

export type AnalysisCategory = "risk" | "leverage" | "neutral";
export type AnalysisSeverity = "critical" | "high" | "medium" | "low" | "none";

export type ChunkAnalysis = {
  clause_type: ClauseType;
  category: AnalysisCategory;
  severity: AnalysisSeverity;
  title: string | null;
  analysis: string;
  dollar_impact: number | null;
  impact_explanation: string | null;
  trigger_date: string | null;
  action_deadline: string | null;
  is_recurring: boolean;
  recommended_action: string | null;
};

const CLAUSE_TYPES = new Set<string>([
  "auto_renewal",
  "price_escalation",
  "penalty",
  "minimum_commitment",
  "exclusivity",
  "termination_fee",
  "cancellation_window",
  "renegotiation",
  "liability_cap",
  "late_payment",
  "early_payment",
  "sla_penalty",
  "rate_lock",
  "audit_rights",
  "ip_ownership",
  "non_compete",
  "indemnification",
  "payment_terms",
  "scope_definition",
  "confidentiality",
  "dispute_resolution",
  "force_majeure",
  "warranty",
  "governing_law",
  "general",
]);

const CATEGORIES = new Set<AnalysisCategory>(["risk", "leverage", "neutral"]);
const SEVERITIES = new Set<AnalysisSeverity>([
  "critical",
  "high",
  "medium",
  "low",
  "none",
]);

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function bool(v: unknown): boolean {
  return v === true;
}

export function normalizeChunkAnalysisFields(
  raw: Record<string, unknown>,
): ChunkAnalysis {
  const clauseRaw = str(raw.clause_type);
  const clause_type: ClauseType =
    clauseRaw && CLAUSE_TYPES.has(clauseRaw)
      ? (clauseRaw as ClauseType)
      : "general";

  const catRaw = str(raw.category);
  const category: AnalysisCategory = CATEGORIES.has(catRaw as AnalysisCategory)
    ? (catRaw as AnalysisCategory)
    : "neutral";

  const sevRaw = str(raw.severity);
  const severity: AnalysisSeverity = SEVERITIES.has(sevRaw as AnalysisSeverity)
    ? (sevRaw as AnalysisSeverity)
    : "none";

  return {
    clause_type,
    category,
    severity,
    title: str(raw.title),
    analysis: str(raw.analysis) ?? "",
    dollar_impact: num(raw.dollar_impact),
    impact_explanation: str(raw.impact_explanation),
    trigger_date: str(raw.trigger_date),
    action_deadline: str(raw.action_deadline),
    is_recurring: bool(raw.is_recurring),
    recommended_action: str(raw.recommended_action),
  };
}
