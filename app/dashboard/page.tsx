"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useCountUp } from "@/components/useCountUp";

// ─── Types ────────────────────────────────────────────────────────────────────

type BriefingChunk = {
  id?: string | null;
  days_until_action?: number | null;
  contract_name?: string | null;
  contract_id?: string | null;
  title?: string | null;
  analysis?: string | null;
  dollar_impact?: number | null;
  category?: string | null;
  severity?: string | null;
  recommended_action?: string | null;
};

type ContractRow = {
  id: string;
  file_name: string;
  counterparty_name?: string | null;
  contract_type?: string | null;
  money_at_risk?: number | null;
  leverage_total?: number | null;
  next_critical_date?: string | null;
};

type BriefingPayload = {
  stats: {
    total_money_at_risk: number;
    total_leverage: number;
    total_contracts: number;
    total_saved: number;
  };
  today_actions: BriefingChunk[];
  this_week: BriefingChunk[];
  risks: BriefingChunk[];
  leverage: BriefingChunk[];
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<BriefingPayload | null>(null);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [briefRes, contractsRes] = await Promise.all([
          fetch("/api/dashboard/briefing"),
          fetch("/api/contracts"),
        ]);

        const briefJson = await briefRes.json();
        if (!briefRes.ok)
          throw new Error(briefJson.error || briefRes.statusText);

        const contractsJson = await contractsRes.json();

        if (!cancelled) {
          setData(briefJson as BriefingPayload);
          setContracts(
            Array.isArray(contractsJson)
              ? (contractsJson as ContractRow[])
              : [],
          );
        }
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
  }, []);

  const takeAction = useCallback(async (row: BriefingChunk) => {
    try {
      await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chunk_id: row.id ?? null,
          contract_id: row.contract_id ?? null,
          savings_amount: 0,
          action_type: "take_action",
        }),
      });
    } catch {
      /* non-critical */
    }
  }, []);

  // ── Animated counters ───────────────────────────────────────────────────────
  const ready = !loading && !!data;
  const animRisk = useCountUp(
    ready ? (data?.stats.total_money_at_risk ?? 0) : 0,
  );
  const animLev = useCountUp(ready ? (data?.stats.total_leverage ?? 0) : 0);
  const animSaved = useCountUp(ready ? (data?.stats.total_saved ?? 0) : 0);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return <DashboardSkeleton />;

  // ── Error ───────────────────────────────────────────────────────────────────
  if (err) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <p className="text-lg font-semibold text-amber-900">
            Could not load dashboard
          </p>
          <p className="mt-2 text-sm text-amber-700">{err}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-amber-600 px-5 text-sm font-medium text-white transition hover:bg-amber-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!data || data.stats.total_contracts === 0) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100 text-4xl">
          📄
        </div>
        <h1 className="text-2xl font-bold text-gray-900">No contracts yet</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-500">
          Upload your first contract to unlock daily risk intelligence, deadline
          alerts, and GraphRAG-powered Q&amp;A.
        </p>
        <Link
          href="/upload"
          className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-gray-900 px-7 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800"
        >
          <UploadIcon className="h-4 w-4" />
          Upload your first contract
        </Link>
      </div>
    );
  }

  const todayCount = data.today_actions.length;
  const weekCount = data.this_week.length;

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-12">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
            Command Center
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            {data.stats.total_contracts} contract
            {data.stats.total_contracts !== 1 ? "s" : ""} ·{" "}
            {todayCount > 0 ? (
              <span className="font-semibold text-red-600">
                {todayCount} action{todayCount !== 1 ? "s" : ""} due today
              </span>
            ) : (
              "Nothing due today"
            )}
          </p>
        </div>
        <Link
          href="/upload"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-gray-900 px-5 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          <UploadIcon className="h-4 w-4" />
          Upload contract
        </Link>
      </div>

      {/* ── 4 Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Money at Risk"
          value={`$${animRisk.toLocaleString()}`}
          sub={`Across ${data.stats.total_contracts} contract${data.stats.total_contracts !== 1 ? "s" : ""}`}
          icon="💸"
          className="border-red-100 bg-red-50/80"
          valueClass="text-red-700"
          subClass="text-red-400"
        />
        <StatCard
          label="Leverage Available"
          value={`$${animLev.toLocaleString()}`}
          sub="Renegotiation opportunities"
          icon="⚡"
          className="border-emerald-100 bg-emerald-50/80"
          valueClass="text-emerald-700"
          subClass="text-emerald-500"
        />

        <StatCard
          label="Total Saved"
          value={`$${animSaved.toLocaleString()}`}
          sub="From logged actions"
          icon="✅"
          className="border-gray-200 bg-white"
          valueClass="text-emerald-600"
          subClass="text-gray-400"
        />
      </div>

      {/* ── Today's Actions ───────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">
              Today&apos;s Actions
            </h2>
            {todayCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                {todayCount}
              </span>
            )}
          </div>
        </div>

        {data.today_actions.length === 0 ? (
          <EmptySection
            icon="🎉"
            text="Nothing due today — you're all caught up!"
          />
        ) : (
          <ul className="space-y-3">
            {data.today_actions.map((c, i) => (
              <li
                key={c.id ?? `t-${i}`}
                className="animate-fade-in-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <ActionCard
                  row={c}
                  urgency="today"
                  onAction={() => void takeAction(c)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── This Week ────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900">This Week</h2>
          {weekCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {weekCount} deadline{weekCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {data.this_week.length === 0 ? (
          <EmptySection icon="📅" text="No deadlines in the next 7 days." />
        ) : (
          /* Horizontal scroll on mobile, grid on larger screens */
          <div className="scroll-x -mx-1 flex gap-3 px-1 pb-2 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3">
            {data.this_week.map((c, i) => (
              <div
                key={c.id ?? `w-${i}`}
                className="min-w-[280px] md:min-w-0 animate-fade-in-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <WeekCard row={c} onAction={() => void takeAction(c)} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Portfolio Grid ────────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            Portfolio ({contracts.length})
          </h2>
          <Link
            href="/contracts"
            className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
          >
            View all →
          </Link>
        </div>

        {contracts.length === 0 ? (
          <EmptySection icon="📋" text="No contracts yet." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {contracts.slice(0, 6).map((c, i) => (
              <div
                key={c.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <PortfolioCard contract={c} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Your Leverage ────────────────────────────────────────────────── */}
      {data.leverage.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-bold text-gray-900">
            Your Leverage Opportunities
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {data.leverage.map((c, i) => (
              <div
                key={c.id ?? `l-${i}`}
                className="animate-fade-in-up rounded-xl border-l-4 border-emerald-500 border border-gray-100 bg-white p-4 shadow-sm"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <p className="font-semibold text-gray-900">
                  {c.title ?? "Leverage opportunity"}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {c.contract_name ?? "—"}
                </p>
                {c.dollar_impact != null && (
                  <p className="mt-2 text-lg font-bold text-emerald-600">
                    ${Number(c.dollar_impact).toLocaleString()}
                  </p>
                )}
                {c.analysis && (
                  <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                    {c.analysis}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  className,
  valueClass,
  subClass,
}: {
  label: string;
  value: string;
  sub: string;
  icon: string;
  className?: string;
  valueClass?: string;
  subClass?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${className ?? "border-gray-200 bg-white"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          {label}
        </p>
        <span className="text-lg" aria-hidden>
          {icon}
        </span>
      </div>
      <p
        className={`mt-3 text-2xl font-bold tabular-nums ${valueClass ?? "text-gray-900"}`}
      >
        {value}
      </p>
      <p className={`mt-1 text-xs ${subClass ?? "text-gray-400"}`}>{sub}</p>
    </div>
  );
}

// ─── ActionCard ───────────────────────────────────────────────────────────────

function ActionCard({
  row,
  urgency,
  onAction,
}: {
  row: BriefingChunk;
  urgency: "today" | "week";
  onAction: () => void;
}) {
  const days = row.days_until_action;
  const badge =
    urgency === "today"
      ? { text: "TODAY", className: "bg-red-600 text-white" }
      : {
          text: days != null ? `${days}D LEFT` : "SOON",
          className: "bg-amber-500 text-white",
        };

  const severityDot: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-amber-400",
    low: "bg-gray-300",
    none: "bg-gray-200",
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border-l-4 border-red-500 border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
            severityDot[row.severity ?? "none"] ?? severityDot.none
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${badge.className}`}
            >
              {badge.text}
            </span>
            <p className="font-semibold text-gray-900 truncate">
              {row.title ?? "Action required"}
            </p>
          </div>
          <p className="mt-0.5 text-sm text-gray-500 truncate">
            {row.contract_name ?? "—"}
          </p>
          {row.dollar_impact != null && (
            <p className="mt-1 text-sm font-bold text-red-600">
              ${Number(row.dollar_impact).toLocaleString()} at risk
            </p>
          )}
          {row.recommended_action && (
            <p className="mt-1 text-xs text-gray-500 line-clamp-2">
              {row.recommended_action}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="shrink-0 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700"
      >
        Take Action
      </button>
    </div>
  );
}

// ─── WeekCard ─────────────────────────────────────────────────────────────────

function WeekCard({
  row,
  onAction,
}: {
  row: BriefingChunk;
  onAction: () => void;
}) {
  const days = row.days_until_action;

  const urgencyColor =
    days == null
      ? "border-gray-200"
      : days <= 2
        ? "border-red-400"
        : days <= 4
          ? "border-amber-400"
          : "border-emerald-400";

  return (
    <div
      className={`flex h-full flex-col rounded-xl border-t-4 border border-gray-100 bg-white p-4 shadow-sm ${urgencyColor}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-900 line-clamp-2">
          {row.title ?? "Upcoming deadline"}
        </p>
        {days != null && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
            {days}d
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500 truncate">
        {row.contract_name ?? "—"}
      </p>
      {row.dollar_impact != null && (
        <p className="mt-2 text-base font-bold text-red-600">
          ${Number(row.dollar_impact).toLocaleString()}
        </p>
      )}
      {row.analysis && (
        <p className="mt-1 flex-1 text-xs text-gray-500 line-clamp-2">
          {row.analysis}
        </p>
      )}
      <button
        type="button"
        onClick={onAction}
        className="mt-3 w-full rounded-lg border border-gray-200 bg-gray-50 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
      >
        Take Action
      </button>
    </div>
  );
}

// ─── PortfolioCard ────────────────────────────────────────────────────────────

function PortfolioCard({ contract: c }: { contract: ContractRow }) {
  const riskDot =
    (c.money_at_risk ?? 0) > 50000
      ? "bg-red-500"
      : (c.money_at_risk ?? 0) > 10000
        ? "bg-amber-400"
        : "bg-emerald-500";

  const [now] = useState(() => Date.now());
  const deadline = c.next_critical_date ? new Date(c.next_critical_date) : null;
  const daysLeft = deadline
    ? Math.ceil((deadline.getTime() - now) / 86_400_000)
    : null;

  return (
    <Link
      href={`/contracts/${c.id}`}
      className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${riskDot}`} />
            <p className="truncate font-semibold text-gray-900">
              {c.counterparty_name || c.file_name}
            </p>
          </div>
          {c.contract_type && (
            <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {c.contract_type}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between gap-2 border-t border-gray-100 pt-3">
        <div className="text-sm">
          <p className="text-xs text-gray-400">At risk</p>
          <p className="font-bold text-red-600">
            ${Number(c.money_at_risk || 0).toLocaleString()}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-xs text-gray-400">Leverage</p>
          <p className="font-bold text-emerald-600">
            ${Number(c.leverage_total || 0).toLocaleString()}
          </p>
        </div>
        {daysLeft != null && (
          <div
            className={`rounded-full px-2 py-1 text-[10px] font-bold ${
              daysLeft <= 7
                ? "bg-red-100 text-red-700"
                : daysLeft <= 30
                  ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-600"
            }`}
          >
            {daysLeft <= 0 ? "OVERDUE" : `${daysLeft}d`}
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── EmptySection ─────────────────────────────────────────────────────────────

function EmptySection({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-6 text-sm text-gray-500">
      <span className="text-xl" aria-hidden>
        {icon}
      </span>
      {text}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-10">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-3 w-28 rounded bg-gray-200" />
          <div className="h-7 w-36 rounded bg-gray-200" />
          <div className="h-3 w-52 rounded bg-gray-200" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-gray-200" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-gray-200" />
        ))}
      </div>

      <div className="space-y-3">
        <div className="h-5 w-40 rounded bg-gray-200" />
        <div className="h-20 rounded-xl bg-gray-200" />
        <div className="h-20 rounded-xl bg-gray-200" />
      </div>

      <div className="space-y-3">
        <div className="h-5 w-32 rounded bg-gray-200" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-gray-200" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function UploadIcon({ className }: { className?: string }) {
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
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  );
}
