"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContractChunk = {
  id?: string;
  category?: string;
  clause_type?: string;
  severity?: string;
};

type ContractRow = {
  id: string;
  file_name: string;
  counterparty_name?: string | null;
  contract_type?: string | null;

  money_at_risk?: number | null;
  leverage_total?: number | null;
  next_critical_date?: string | null;
  analyzed_at?: string | null;
  summary?: string | null;
  contract_chunks?: ContractChunk[] | null;
};

type Filter = "all" | "risks" | "leverage" | "critical";
type SortKey = "risk" | "date" | "name";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const [rows, setRows] = useState<ContractRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("risk");
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/contracts");
        const data = await res.json();
        if (!res.ok)
          throw new Error((data as { error?: string }).error || res.statusText);
        if (!cancelled) setRows(data as ContractRow[]);
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

  const filtered = useMemo(() => {
    if (!rows) return [];

    const term = q.trim().toLowerCase();

    let result = rows.filter((c) => {
      const name = (c.counterparty_name || c.file_name || "").toLowerCase();
      if (
        term &&
        !name.includes(term) &&
        !c.file_name.toLowerCase().includes(term)
      )
        return false;

      const chunks = c.contract_chunks ?? [];
      if (filter === "risks")
        return chunks.some((ch) => ch.category === "risk");
      if (filter === "leverage")
        return chunks.some((ch) => ch.category === "leverage");
      if (filter === "critical")
        return chunks.some((ch) => ch.severity === "critical");
      return true;
    });

    result = [...result].sort((a, b) => {
      if (sort === "risk")
        return (b.money_at_risk ?? 0) - (a.money_at_risk ?? 0);
      if (sort === "name")
        return (a.counterparty_name || a.file_name).localeCompare(
          b.counterparty_name || b.file_name,
        );
      if (sort === "date") {
        const da = a.analyzed_at ? new Date(a.analyzed_at).getTime() : 0;
        const db = b.analyzed_at ? new Date(b.analyzed_at).getTime() : 0;
        return db - da;
      }
      return 0;
    });

    return result;
  }, [rows, filter, sort, q]);

  // ── Aggregate stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!rows) return null;
    return {
      total: rows.length,
      totalRisk: rows.reduce((s, c) => s + (c.money_at_risk ?? 0), 0),
      totalLeverage: rows.reduce((s, c) => s + (c.leverage_total ?? 0), 0),
      criticalCount: rows.filter((c) =>
        (c.contract_chunks ?? []).some((ch) => ch.severity === "critical"),
      ).length,
    };
  }, [rows]);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl animate-pulse space-y-6">
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <div className="h-3 w-28 rounded bg-gray-200" />
            <div className="h-7 w-40 rounded bg-gray-200" />
          </div>
          <div className="h-10 w-36 rounded-xl bg-gray-200" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-200" />
          ))}
        </div>
        <div className="h-10 rounded-xl bg-gray-200" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 rounded-2xl bg-gray-200" />
        ))}
      </div>
    );
  }

  if (err) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <p className="font-semibold text-amber-900">{err}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-amber-600 px-5 text-sm font-medium text-white hover:bg-amber-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
            Portfolio
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            All Contracts
          </h1>
          {stats && (
            <p className="mt-1 text-sm text-gray-500">
              {stats.total} contract{stats.total !== 1 ? "s" : ""}
              {stats.criticalCount > 0 && (
                <span className="ml-2 font-semibold text-red-600">
                  · {stats.criticalCount} with critical clauses
                </span>
              )}
            </p>
          )}
        </div>
        <Link
          href="/upload"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-gray-900 px-5 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          <PlusIcon className="h-4 w-4" />
          Upload contract
        </Link>
      </div>

      {/* ── Portfolio summary strip ─────────────────────────────────────────── */}
      {stats && stats.total > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-red-600">
              Total at Risk
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-red-700">
              ${stats.totalRisk.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
              Total Leverage
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">
              ${stats.totalLeverage.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Contracts
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
              {stats.total}
            </p>
          </div>
        </div>
      )}

      {/* ── Search + Filters + Sort ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search by name or file…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none ring-emerald-400 transition focus:border-emerald-400 focus:ring-2"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category filter */}
          <div className="flex rounded-xl border border-gray-200 bg-white p-1">
            {(
              [
                ["all", "All"],
                ["risks", "Risks"],
                ["leverage", "Leverage"],
                ["critical", "Critical"],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  filter === key
                    ? key === "critical"
                      ? "bg-red-600 text-white shadow-sm"
                      : "bg-gray-900 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none ring-emerald-400 transition focus:ring-2"
          >
            <option value="risk">Sort: Highest Risk</option>
            <option value="date">Sort: Most Recent</option>
            <option value="name">Sort: Name A–Z</option>
          </select>
        </div>
      </div>

      {/* ── Contract list ───────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-20 text-center">
          <p className="text-2xl">🔍</p>
          <p className="mt-3 font-semibold text-gray-700">No contracts match</p>
          <p className="mt-1 text-sm text-gray-500">
            Try a different search term or filter.
          </p>
          {q || filter !== "all" ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setFilter("all");
              }}
              className="mt-4 text-sm font-medium text-emerald-600 underline underline-offset-2"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((c, i) => (
            <li
              key={c.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
            >
              <ContractCard contract={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── ContractCard ─────────────────────────────────────────────────────────────

function ContractCard({ contract: c }: { contract: ContractRow }) {
  const chunks = c.contract_chunks ?? [];

  const riskCount = chunks.filter((ch) => ch.category === "risk").length;
  const leverageCount = chunks.filter(
    (ch) => ch.category === "leverage",
  ).length;
  const criticalCount = chunks.filter(
    (ch) => ch.severity === "critical",
  ).length;

  const [now] = useState(() => Date.now());
  const deadline = c.next_critical_date ? new Date(c.next_critical_date) : null;
  const daysLeft = deadline
    ? Math.ceil((deadline.getTime() - now) / 86_400_000)
    : null;

  const riskColor =
    (c.money_at_risk ?? 0) > 50000
      ? "bg-red-500"
      : (c.money_at_risk ?? 0) > 10000
        ? "bg-amber-400"
        : "bg-emerald-500";

  const analyzedDate = c.analyzed_at
    ? new Date(c.analyzed_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Link
      href={`/contracts/${c.id}`}
      className="group block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: identity */}
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {/* Health dot */}
          <span
            className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${riskColor}`}
            aria-hidden
          />

          <div className="min-w-0 flex-1">
            {/* Name + type badge */}
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                {c.counterparty_name || c.file_name}
              </p>
              {c.contract_type && (
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                  {c.contract_type}
                </span>
              )}
              {criticalCount > 0 && (
                <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
                  {criticalCount} critical
                </span>
              )}
            </div>

            {/* File name */}
            <p className="mt-0.5 truncate text-xs text-gray-400">
              {c.file_name}
            </p>

            {/* Summary */}
            {c.summary && (
              <p className="mt-2 text-sm leading-relaxed text-gray-500 line-clamp-2">
                {c.summary}
              </p>
            )}

            {/* Meta row */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
              <span>{chunks.length} sections analyzed</span>

              {riskCount > 0 && (
                <span className="text-red-600 font-medium">
                  {riskCount} risk{riskCount !== 1 ? "s" : ""}
                </span>
              )}

              {leverageCount > 0 && (
                <span className="text-emerald-600 font-medium">
                  {leverageCount} leverage point{leverageCount !== 1 ? "s" : ""}
                </span>
              )}

              {analyzedDate && (
                <span className="text-gray-400">Analyzed {analyzedDate}</span>
              )}

              {/* Deadline indicator */}
              {deadline && daysLeft != null && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                    daysLeft < 0
                      ? "bg-red-100 text-red-700"
                      : daysLeft <= 7
                        ? "bg-red-100 text-red-700"
                        : daysLeft <= 30
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                  }`}
                >
                  <ClockIcon className="h-3 w-3" />
                  {daysLeft < 0
                    ? `${Math.abs(daysLeft)}d overdue`
                    : daysLeft === 0
                      ? "Due today"
                      : `${daysLeft}d to deadline`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: financials + gauge */}
        <div className="flex shrink-0 items-center gap-5">
          <div className="text-right text-sm">
            <p className="text-xs text-gray-400">At risk</p>
            <p className="font-bold text-red-600">
              ${Number(c.money_at_risk || 0).toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-gray-400">Leverage</p>
            <p className="font-bold text-emerald-600">
              ${Number(c.leverage_total || 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

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

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
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
