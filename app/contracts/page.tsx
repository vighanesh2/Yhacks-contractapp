"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { HealthGauge } from "@/components/HealthGauge";

type ContractChunk = {
  id?: string;
  category?: string;
  clause_type?: string;
};

type ContractRow = {
  id: string;
  file_name: string;
  counterparty_name?: string | null;
  contract_type?: string | null;
  health_score?: number | null;
  money_at_risk?: number | null;
  leverage_total?: number | null;
  next_critical_date?: string | null;
  analyzed_at?: string | null;
  contract_chunks?: ContractChunk[] | null;
};

type Filter = "all" | "risks" | "leverage";

export default function ContractsPage() {
  const [rows, setRows] = useState<ContractRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/contracts");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        if (!cancelled) setRows(data as ContractRow[]);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
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
    return rows.filter((c) => {
      const name = (c.counterparty_name || c.file_name || "").toLowerCase();
      const fname = (c.file_name || "").toLowerCase();
      if (term && !name.includes(term) && !fname.includes(term)) return false;
      const chunks = c.contract_chunks ?? [];
      if (filter === "risks") {
        return chunks.some((ch) => ch.category === "risk");
      }
      if (filter === "leverage") {
        return chunks.some((ch) => ch.category === "leverage");
      }
      return true;
    });
  }, [rows, filter, q]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl animate-pulse space-y-4">
        <div className="h-10 w-64 rounded bg-gray-200" />
        <div className="h-32 rounded-xl bg-gray-200" />
        <div className="h-32 rounded-xl bg-gray-200" />
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        {err}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Contracts</h1>
          <p className="text-sm text-gray-600">Portfolio overview</p>
        </div>
        <Link
          href="/upload"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800"
        >
          + Upload new
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          placeholder="Search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["risks", "Risks"],
              ["leverage", "Leverage"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                filter === key
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center text-sm text-gray-500">
          No contracts match.
        </p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((c) => (
            <li key={c.id}>
              <ContractCard contract={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ContractCard({ contract: c }: { contract: ContractRow }) {
  const health = c.health_score ?? 50;
  const dot =
    health < 40 ? "bg-red-500" : health < 70 ? "bg-amber-400" : "bg-emerald-500";
  const chunks = c.contract_chunks ?? [];
  const deadline = c.next_critical_date
    ? new Date(c.next_critical_date)
    : null;
  const [asOf] = useState(() => Date.now());
  const daysLeft = deadline
    ? Math.ceil((deadline.getTime() - asOf) / 86_400_000)
    : null;

  return (
    <Link
      href={`/contracts/${c.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 gap-3">
          <span
            className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${dot}`}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">
              {c.counterparty_name || c.file_name}
            </p>
            {c.contract_type && (
              <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                {c.contract_type}
              </span>
            )}
            <p className="mt-2 text-xs text-gray-500">{c.file_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <p className="text-gray-500">At risk</p>
            <p className="font-semibold text-red-700">
              ${Number(c.money_at_risk || 0).toLocaleString()}
            </p>
            <p className="mt-1 text-gray-500">Leverage</p>
            <p className="font-semibold text-emerald-700">
              ${Number(c.leverage_total || 0).toLocaleString()}
            </p>
          </div>
          <HealthGauge score={health} size={72} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 border-t border-gray-100 pt-4 text-xs text-gray-500">
        <span>{chunks.length} sections analyzed</span>
        {deadline && (
          <span>
            Next deadline: {deadline.toLocaleDateString()}
            {daysLeft != null && (
              <span className="ml-1 font-medium text-gray-700">
                ({daysLeft}d)
              </span>
            )}
          </span>
        )}
      </div>
    </Link>
  );
}
