"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ContractChat } from "@/components/ContractChat";

import { useCountUp } from "@/components/useCountUp";

// ─── Types ────────────────────────────────────────────────────────────────────

type Chunk = {
  id: string;
  section_number?: string | null;
  section_title?: string | null;
  category?: string | null;
  clause_type?: string | null;
  severity?: string | null;
  title?: string | null;
  analysis?: string | null;
  dollar_impact?: number | null;
  recommended_action?: string | null;
  action_deadline?: string | null;
  trigger_date?: string | null;
  impact_explanation?: string | null;
};

type ContractDetail = {
  id: string;
  file_name: string;
  counterparty_name?: string | null;
  contract_type?: string | null;

  money_at_risk?: number | null;
  leverage_total?: number | null;
  summary?: string | null;
  contract_chunks?: Chunk[] | null;
  next_critical_date?: string | null;
};

type SimilarClause = {
  id?: string | null;
  section_number?: string | null;
  section_title?: string | null;
  chunk_text?: string | null;
  clause_type?: string | null;
  title?: string | null;
  similarity?: number | null;
  dollar_impact?: number | null;
  severity?: string | null;
  contracts?: {
    counterparty_name?: string | null;
    file_name?: string | null;
  } | null;
};

type Tab = "analysis" | "ask" | "timeline";

// ─── Severity ordering ────────────────────────────────────────────────────────

const SEV_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

function sortedChunks(chunks: Chunk[]): Chunk[] {
  const risks = chunks
    .filter((c) => c.category === "risk")
    .sort(
      (a, b) =>
        (SEV_ORDER[a.severity ?? "none"] ?? 9) -
        (SEV_ORDER[b.severity ?? "none"] ?? 9),
    );
  const leverage = chunks.filter((c) => c.category === "leverage");
  const neutral = chunks.filter(
    (c) => c.category !== "risk" && c.category !== "leverage",
  );
  return [...risks, ...leverage, ...neutral];
}

function deadlineChunks(chunks: Chunk[]): Chunk[] {
  return chunks
    .filter((c) => c.action_deadline)
    .sort(
      (a, b) =>
        new Date(a.action_deadline!).getTime() -
        new Date(b.action_deadline!).getTime(),
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContractDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("analysis");

  // Similar clauses modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalClauseTitle, setModalClauseTitle] = useState<string | null>(null);
  const [similar, setSimilar] = useState<SimilarClause[] | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareErr, setCompareErr] = useState<string | null>(null);

  // Switch to Ask tab if URL hash says so
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#ask") {
      setTab("ask");
    }
  }, []);

  // Fetch contract data
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/contracts/${id}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || res.statusText);
        if (!cancelled) setContract(j.contract as ContractDetail);
      } catch (e) {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const chunks = useMemo(
    () => sortedChunks(contract?.contract_chunks ?? []),
    [contract],
  );

  const riskChunks = useMemo(
    () => chunks.filter((c) => c.category === "risk"),
    [chunks],
  );

  const leverageChunks = useMemo(
    () => chunks.filter((c) => c.category === "leverage"),
    [chunks],
  );

  const timelineChunks = useMemo(
    () => deadlineChunks(contract?.contract_chunks ?? []),
    [contract],
  );

  // Animated dollar totals
  const moneyAtRisk = contract?.money_at_risk ?? 0;
  const leverageTotal = contract?.leverage_total ?? 0;
  const animRisk = useCountUp(loading ? 0 : moneyAtRisk);
  const animLev = useCountUp(loading ? 0 : leverageTotal);

  // ── Similar clauses handler ─────────────────────────────────────────────────
  const openSimilar = useCallback(
    async (chunkId: string, title: string | null) => {
      setCompareErr(null);
      setSimilar(null);
      setModalClauseTitle(title);
      setModalOpen(true);
      setCompareLoading(true);
      try {
        const res = await fetch("/api/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chunk_id: chunkId }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || res.statusText);
        setSimilar(
          Array.isArray(j.similar) ? (j.similar as SimilarClause[]) : [],
        );
      } catch (e) {
        setCompareErr(e instanceof Error ? e.message : "Compare failed");
      } finally {
        setCompareLoading(false);
      }
    },
    [],
  );

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 animate-pulse">
        <div className="h-4 w-32 rounded bg-gray-200" />
        <div className="h-48 rounded-2xl bg-gray-200" />
        <div className="h-10 w-64 rounded bg-gray-200" />
        <div className="h-64 rounded-2xl bg-gray-200" />
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (err || !contract) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-lg font-semibold text-red-900">
            {err || "Contract not found"}
          </p>
          <Link
            href="/contracts"
            className="mt-4 inline-flex h-10 items-center rounded-lg border border-gray-200 bg-white px-5 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            ← All contracts
          </Link>
        </div>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Breadcrumb */}
      <Link
        href="/contracts"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        All contracts
      </Link>

      {/* ── Header card ──────────────────────────────────────────────────── */}
      <header className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm animate-fade-in-up">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          {/* Contract identity */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {contract.counterparty_name || contract.file_name}
              </h1>
              {contract.contract_type && (
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                  {contract.contract_type}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-400">{contract.file_name}</p>
            {contract.summary && (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">
                {contract.summary}
              </p>
            )}
          </div>
        </div>

        {/* Stat cards row */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-6 py-5">
            <p className="text-sm font-semibold text-red-700">
              💸 Money at Risk
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-red-600 animate-number-pop">
              ${animRisk.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-red-500">
              {riskChunks.length} risk clause
              {riskChunks.length !== 1 ? "s" : ""} identified
            </p>
          </div>

          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-6 py-5">
            <p className="text-sm font-semibold text-emerald-700">
              ⚡ Your Leverage
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-600 animate-number-pop">
              ${animLev.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-emerald-600">
              {leverageChunks.length} leverage point
              {leverageChunks.length !== 1 ? "s" : ""} found
            </p>
          </div>
        </div>
      </header>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {(
          [
            { key: "analysis", label: "Analysis", icon: "🔍" },
            { key: "ask", label: "Ask Anything", icon: "💬" },
            { key: "timeline", label: "Timeline", icon: "📅" },
          ] as { key: Tab; label: string; icon: string }[]
        ).map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-150 ${
              tab === key
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <span aria-hidden>{icon}</span>
            {label}
            {key === "analysis" && chunks.length > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  tab === "analysis"
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {
                  chunks.filter(
                    (c) => c.severity !== "none" && c.category !== "neutral",
                  ).length
                }
              </span>
            )}
            {key === "timeline" && timelineChunks.length > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  tab === "timeline"
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {timelineChunks.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Analysis ────────────────────────────────────────────────── */}
      {tab === "analysis" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Risks column */}
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-red-700">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              Risks
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                {riskChunks.length}
              </span>
            </h2>

            {riskChunks.length === 0 ? (
              <EmptyState
                icon="✅"
                title="No risk clauses found"
                body="This contract appears clean — no high-risk provisions were identified."
              />
            ) : (
              <ul className="space-y-3">
                {riskChunks.map((c, i) => (
                  <li key={c.id}>
                    <ClauseCard
                      chunk={c}
                      index={i}
                      onFindSimilar={() =>
                        void openSimilar(c.id, c.title ?? null)
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Leverage column */}
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-emerald-700">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              Leverage
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                {leverageChunks.length}
              </span>
            </h2>

            {leverageChunks.length === 0 ? (
              <EmptyState
                icon="📋"
                title="No leverage points found"
                body="Upload more contracts or re-analyze to surface renegotiation opportunities."
              />
            ) : (
              <ul className="space-y-3">
                {leverageChunks.map((c, i) => (
                  <li key={c.id}>
                    <ClauseCard
                      chunk={c}
                      index={i}
                      onFindSimilar={() =>
                        void openSimilar(c.id, c.title ?? null)
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* ── Tab: Ask Anything ────────────────────────────────────────────── */}
      {tab === "ask" && (
        <div className="animate-fade-in-up">
          <ContractChat contractId={contract.id} />
        </div>
      )}

      {/* ── Tab: Timeline ────────────────────────────────────────────────── */}
      {tab === "timeline" && (
        <div className="animate-fade-in-up space-y-6">
          <p className="text-sm text-gray-500">
            All clauses with action deadlines, sorted by urgency.
          </p>

          {timelineChunks.length === 0 ? (
            <EmptyState
              icon="📅"
              title="No deadlines found"
              body="No clauses with action deadlines were identified in this contract."
            />
          ) : (
            <>
              {/* Horizontal scroll strip */}
              <div className="scroll-x -mx-1 flex gap-3 px-1 pb-2">
                {timelineChunks.map((c) => (
                  <TimelineCard key={c.id} chunk={c} />
                ))}
              </div>

              {/* Detail list below */}
              <ul className="space-y-3">
                {timelineChunks.map((c, i) => (
                  <li key={c.id}>
                    <ClauseCard
                      chunk={c}
                      index={i}
                      onFindSimilar={() =>
                        void openSimilar(c.id, c.title ?? null)
                      }
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* ── Similar Clauses Modal ─────────────────────────────────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal
          aria-label="Similar clauses"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="animate-scale-in flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Similar clauses
                </h2>
                {modalClauseTitle && (
                  <p className="mt-0.5 text-sm text-gray-500 line-clamp-1">
                    Based on: {modalClauseTitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close modal"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body — flex-1 + min-h-0 so this region scrolls inside max-h */}
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              {compareLoading && (
                <div className="flex flex-col items-center gap-3 py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-500" />
                  <p className="text-sm text-gray-500">
                    Searching similar clauses…
                  </p>
                </div>
              )}

              {compareErr && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  {compareErr}
                </div>
              )}

              {!compareLoading && similar && similar.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-2xl">🔍</p>
                  <p className="mt-2 font-semibold text-gray-700">
                    No similar clauses found
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Upload more contracts to enable cross-portfolio comparisons.
                  </p>
                </div>
              )}

              {!compareLoading && similar && similar.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    {similar.length} match{similar.length !== 1 ? "es" : ""}{" "}
                    found
                  </p>
                  {similar.map((row, idx) => (
                    <SimilarClauseRow key={idx} row={row} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ClauseCard ───────────────────────────────────────────────────────────────

function ClauseCard({
  chunk: c,
  index,
  onFindSimilar,
}: {
  chunk: Chunk;
  index: number;
  onFindSimilar: () => void;
}) {
  const isRisk = c.category === "risk";
  const isCritical = c.severity === "critical";

  const borderColor = isRisk
    ? isCritical
      ? "border-l-red-600"
      : "border-l-red-400"
    : "border-l-emerald-500";

  return (
    <div
      className={`animate-fade-in-up rounded-xl border border-gray-200 border-l-4 bg-white p-5 shadow-sm transition-all duration-200 ${borderColor} ${
        isCritical ? "animate-pulse-critical" : ""
      }`}
      style={{ animationDelay: `${Math.min(index, 10) * 50}ms` }}
    >
      {/* Top row */}
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={c.severity ?? "none"} />
        {c.clause_type && c.clause_type !== "general" && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
            {c.clause_type.replace(/_/g, " ")}
          </span>
        )}
        <span className="text-xs text-gray-400">
          §{c.section_number ?? "—"}
          {c.section_title ? ` · ${c.section_title}` : ""}
        </span>
      </div>

      {/* Title */}
      <h3 className="mt-2 font-semibold text-gray-900">
        {c.title || "Clause"}
      </h3>

      {/* Dollar impact */}
      {c.dollar_impact != null && (
        <div className="mt-2 flex items-center gap-2">
          <p
            className={`text-base font-bold tabular-nums ${
              isRisk ? "text-red-600" : "text-emerald-600"
            }`}
          >
            ${Number(c.dollar_impact).toLocaleString()}
          </p>
          <span className="text-xs text-gray-400">est. annual impact</span>
        </div>
      )}

      {/* Analysis */}
      {c.analysis && (
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          {c.analysis}
        </p>
      )}

      {/* Impact explanation (collapsible if present) */}
      {c.impact_explanation && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-700">
            See math ↓
          </summary>
          <p className="mt-1 rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
            {c.impact_explanation}
          </p>
        </details>
      )}

      {/* Recommended action */}
      {c.recommended_action && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold text-amber-800">
            Recommended action
          </p>
          <p className="mt-0.5 text-sm text-amber-900">
            {c.recommended_action}
          </p>
        </div>
      )}

      {/* Deadline badge */}
      {c.action_deadline && <DeadlineBadge deadline={c.action_deadline} />}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onFindSimilar}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <SearchIcon className="h-3.5 w-3.5" />
          Find similar
        </button>
      </div>
    </div>
  );
}

// ─── TimelineCard ─────────────────────────────────────────────────────────────

function TimelineCard({ chunk: c }: { chunk: Chunk }) {
  const [now] = useState(() => Date.now());
  const deadline = c.action_deadline ? new Date(c.action_deadline) : null;
  const daysLeft = deadline
    ? Math.ceil((deadline.getTime() - now) / 86_400_000)
    : null;

  const urgency =
    daysLeft === null
      ? "neutral"
      : daysLeft < 0
        ? "overdue"
        : daysLeft <= 7
          ? "critical"
          : daysLeft <= 30
            ? "soon"
            : "ok";

  const urgencyStyles = {
    overdue: "border-red-500 bg-red-50",
    critical: "border-red-400 bg-red-50",
    soon: "border-amber-400 bg-amber-50",
    ok: "border-emerald-400 bg-emerald-50",
    neutral: "border-gray-300 bg-gray-50",
  };

  const urgencyText = {
    overdue: { label: "OVERDUE", className: "bg-red-600 text-white" },
    critical: {
      label: `${daysLeft}d left`,
      className: "bg-red-500 text-white",
    },
    soon: {
      label: `${daysLeft}d left`,
      className: "bg-amber-500 text-white",
    },
    ok: {
      label: `${daysLeft}d left`,
      className: "bg-emerald-600 text-white",
    },
    neutral: { label: "No date", className: "bg-gray-400 text-white" },
  };

  return (
    <div
      className={`min-w-[200px] max-w-[220px] shrink-0 rounded-xl border-2 p-4 ${urgencyStyles[urgency]}`}
    >
      <span
        className={`rounded px-2 py-0.5 text-[10px] font-bold ${urgencyText[urgency].className}`}
      >
        {urgencyText[urgency].label}
      </span>
      <p className="mt-2 text-sm font-semibold text-gray-900 line-clamp-2">
        {c.title || "Deadline"}
      </p>
      {deadline && (
        <p className="mt-1 text-xs text-gray-500">
          {deadline.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      )}
      {c.dollar_impact != null && (
        <p className="mt-2 text-sm font-bold text-red-600">
          ${Number(c.dollar_impact).toLocaleString()}
        </p>
      )}
    </div>
  );
}

// ─── SimilarClauseRow ─────────────────────────────────────────────────────────

function similarClauseHeading(row: SimilarClause): string {
  const cp = row.contracts?.counterparty_name?.trim();
  if (cp) return cp;
  const raw = row.contracts?.file_name?.trim();
  if (raw) return raw.replace(/\.[^./\\]+$/, "");
  const title = row.title?.trim();
  if (title) return title;
  const section = row.section_title?.trim();
  if (section) return section;
  if (row.clause_type && row.clause_type !== "general") {
    return row.clause_type.replace(/_/g, " ");
  }
  return "Similar clause";
}

function SimilarClauseRow({ row }: { row: SimilarClause }) {
  const heading = similarClauseHeading(row);
  const similarity =
    row.similarity != null ? Math.round(row.similarity * 100) : null;

  return (
    <div className="animate-fade-in-up rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Counterparty + section */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900">{heading}</span>
            {row.section_number && (
              <span className="text-xs text-gray-500">
                §{row.section_number}
                {row.section_title ? ` · ${row.section_title}` : ""}
              </span>
            )}
          </div>

          {/* Clause type + similarity */}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {row.clause_type && row.clause_type !== "general" && (
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                {row.clause_type.replace(/_/g, " ")}
              </span>
            )}
            {row.severity && row.severity !== "none" && (
              <SeverityBadge severity={row.severity} small />
            )}
            {similarity !== null && (
              <span
                className={`text-xs font-semibold ${
                  similarity >= 80
                    ? "text-emerald-600"
                    : similarity >= 60
                      ? "text-amber-600"
                      : "text-gray-500"
                }`}
              >
                {similarity}% match
              </span>
            )}
          </div>
        </div>

        {/* Dollar impact */}
        {row.dollar_impact != null && (
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-red-600">
              ${Number(row.dollar_impact).toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-400">est. impact</p>
          </div>
        )}
      </div>

      {/* Snippet */}
      {row.chunk_text && (
        <p className="mt-2 line-clamp-3 text-sm text-gray-600">
          {row.chunk_text}
        </p>
      )}
    </div>
  );
}

// ─── DeadlineBadge ────────────────────────────────────────────────────────────

function DeadlineBadge({ deadline }: { deadline: string }) {
  const [now] = useState(() => Date.now());
  const date = new Date(deadline);
  const daysLeft = Math.ceil((date.getTime() - now) / 86_400_000);

  const color =
    daysLeft < 0
      ? "border-red-300 bg-red-100 text-red-800"
      : daysLeft <= 7
        ? "border-red-200 bg-red-50 text-red-700"
        : daysLeft <= 30
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800";

  const label =
    daysLeft < 0
      ? `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? "s" : ""}`
      : daysLeft === 0
        ? "Due today"
        : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`;

  return (
    <div
      className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${color}`}
    >
      <ClockIcon className="h-3.5 w-3.5" />
      {label} ·{" "}
      {date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}
    </div>
  );
}

// ─── SeverityBadge ────────────────────────────────────────────────────────────

function SeverityBadge({
  severity,
  small = false,
}: {
  severity: string;
  small?: boolean;
}) {
  const styles: Record<string, string> = {
    critical: "bg-red-600 text-white",
    high: "bg-orange-500 text-white",
    medium: "bg-amber-400 text-gray-900",
    low: "bg-gray-200 text-gray-700",
    none: "bg-gray-100 text-gray-500",
  };
  const size = small ? "px-1.5 py-px text-[9px]" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`rounded font-bold uppercase tracking-wide ${size} ${styles[severity] ?? styles.none}`}
    >
      {severity}
    </span>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
      <p className="text-3xl">{icon}</p>
      <p className="mt-3 font-semibold text-gray-700">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{body}</p>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 17l-5-5m0 0l5-5m-5 5h12"
      />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
