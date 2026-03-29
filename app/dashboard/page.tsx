"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { HealthGauge } from "@/components/HealthGauge";
import { useCountUp } from "@/components/useCountUp";

type BriefingChunk = Record<string, unknown> & {
  id?: string;
  days_until_action?: number | null;
  contract_name?: string;
  title?: string | null;
  analysis?: string;
  dollar_impact?: number | null;
  category?: string;
  contract_id?: string;
  recommended_action?: string | null;
};

type BriefingPayload = {
  stats: {
    total_money_at_risk: number;
    total_leverage: number;
    portfolio_health: number;
    total_contracts: number;
    total_saved: number;
  };
  today_actions: BriefingChunk[];
  this_week: BriefingChunk[];
  risks: BriefingChunk[];
  leverage: BriefingChunk[];
};

export default function DashboardPage() {
  const [data, setData] = useState<BriefingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/dashboard/briefing");
        const j = await res.json();
        if (!res.ok) {
          throw new Error(j.error || res.statusText);
        }
        if (!cancelled) setData(j as BriefingPayload);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Failed to load briefing");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = !loading && data && !err;
  const riskAnim = useCountUp(
    ready ? (data?.stats.total_money_at_risk ?? 0) : 0,
  );
  const levAnim = useCountUp(ready ? (data?.stats.total_leverage ?? 0) : 0);
  const savedAnim = useCountUp(ready ? (data?.stats.total_saved ?? 0) : 0);

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
      /* ignore */
    }
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (err) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <p className="font-medium">Could not load dashboard</p>
        <p className="mt-1 text-sm opacity-90">{err}</p>
      </div>
    );
  }

  if (data && data.stats.total_contracts === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-3xl">
          📄
        </div>
        <h1 className="text-xl font-semibold text-gray-900">
          No contracts yet
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Upload your first contract to unlock daily intelligence, risk alerts,
          and Q&amp;A.
        </p>
        <Link
          href="/upload"
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-gray-900 px-6 text-sm font-medium text-white hover:bg-gray-800"
        >
          Upload a contract
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-gray-600">
        No data.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Command center
        </h1>
        <p className="text-sm text-gray-600">
          Daily contract intelligence across your portfolio.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Money at risk"
          value={`$${riskAnim.toLocaleString()}`}
          sub={`across ${data.stats.total_contracts} contracts`}
          className="border-red-100 bg-red-50/80"
          valueClass="text-red-700"
        />
        <StatCard
          label="Leverage available"
          value={`$${levAnim.toLocaleString()}`}
          sub="Opportunities identified"
          className="border-emerald-100 bg-emerald-50/80"
          valueClass="text-emerald-700"
        />
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-gray-500">Portfolio health</p>
            <p className="mt-1 text-xs text-gray-400">Average score</p>
          </div>
          <HealthGauge score={data.stats.portfolio_health} size={88} />
        </div>
        <StatCard
          label="Total saved"
          value={`$${savedAnim.toLocaleString()}`}
          sub="From logged actions"
          className="border-emerald-100 bg-white"
          valueClass="text-emerald-600"
        />
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Today&apos;s actions
        </h2>
        <ul className="space-y-3">
          {data.today_actions.map((c, i) => (
            <ActionCard
              key={(c.id as string) ?? `t-${i}`}
              row={c}
              urgency="today"
              onAction={() => void takeAction(c)}
            />
          ))}
          {data.today_actions.length === 0 && (
            <EmptyLine text="Nothing due today." />
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">This week</h2>
        <ul className="space-y-3">
          {data.this_week.map((c, i) => (
            <ActionCard
              key={(c.id as string) ?? `w-${i}`}
              row={c}
              urgency="week"
              onAction={() => void takeAction(c)}
            />
          ))}
          {data.this_week.length === 0 && (
            <EmptyLine text="No deadlines in the next 7 days." />
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Your leverage
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {data.leverage.map((c, i) => (
            <li
              key={(c.id as string) ?? `l-${i}`}
              className="animate-fade-in-up rounded-xl border-l-4 border-emerald-500 border border-gray-100 bg-white p-4 shadow-sm"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <p className="font-medium text-gray-900">
                {(c.title as string) || "Opportunity"}
              </p>
              <p className="text-xs text-gray-500">
                {c.contract_name || "Contract"}
              </p>
              {c.dollar_impact != null && (
                <p className="mt-2 text-sm font-semibold text-emerald-700">
                  ${Number(c.dollar_impact).toLocaleString()}
                </p>
              )}
              <button
                type="button"
                onClick={() => void takeAction(c)}
                className="mt-3 text-sm font-medium text-emerald-700 underline"
              >
                Take Action
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  className,
  valueClass,
}: {
  label: string;
  value: string;
  sub: string;
  className?: string;
  valueClass?: string;
}) {
  return (
    <div
      className={`rounded-xl border p-5 shadow-sm ${className ?? "border-gray-200 bg-white"}`}
    >
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${valueClass ?? "text-gray-900"}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-gray-500">{sub}</p>
    </div>
  );
}

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
          text: days != null ? `${days} DAYS LEFT` : "SOON",
          className: "bg-amber-500 text-white",
        };

  return (
    <li className="flex flex-col gap-2 rounded-xl border-l-4 border-red-500 border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <span
          className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${badge.className}`}
        >
          {badge.text}
        </span>
        <p className="mt-2 font-medium text-gray-900">
          {(row.title as string) || "Clause"}
        </p>
        <p className="text-sm text-gray-500">{row.contract_name || "—"}</p>
        {row.dollar_impact != null && (
          <p className="mt-1 text-sm font-semibold text-red-700">
            ${Number(row.dollar_impact).toLocaleString()}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onAction}
        className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Take Action
      </button>
    </li>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <li className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
      {text}
    </li>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-8">
      <div className="h-8 w-48 rounded bg-gray-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-gray-200" />
        ))}
      </div>
      <div className="h-6 w-40 rounded bg-gray-200" />
      <div className="space-y-3">
        <div className="h-24 rounded-xl bg-gray-200" />
        <div className="h-24 rounded-xl bg-gray-200" />
      </div>
    </div>
  );
}
