"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ContractChat } from "@/components/ContractChat";
import { HealthGauge } from "@/components/HealthGauge";

type Chunk = {
  id: string;
  section_number?: string | null;
  section_title?: string | null;
  category?: string | null;
  severity?: string | null;
  title?: string | null;
  analysis?: string | null;
  dollar_impact?: number | null;
  recommended_action?: string | null;
};

type ContractDetail = {
  id: string;
  file_name: string;
  counterparty_name?: string | null;
  contract_type?: string | null;
  health_score?: number | null;
  money_at_risk?: number | null;
  leverage_total?: number | null;
  contract_chunks?: Chunk[] | null;
};

const SEV_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

function orderedChunks(chunks: Chunk[]): Chunk[] {
  const risks = chunks
    .filter((c) => c.category === "risk")
    .sort(
      (a, b) =>
        (SEV_ORDER[a.severity ?? "none"] ?? 9) -
        (SEV_ORDER[b.severity ?? "none"] ?? 9),
    );
  const lev = chunks.filter((c) => c.category === "leverage");
  return [...risks, ...lev];
}

export default function ContractDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"analysis" | "ask">("analysis");
  const [modalOpen, setModalOpen] = useState(false);
  const [similar, setSimilar] = useState<unknown[] | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareErr, setCompareErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#ask") {
      setTab("ask");
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/contracts/${id}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || res.statusText);
        if (!cancelled) setContract(j.contract as ContractDetail);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const chunks = useMemo(
    () => orderedChunks(contract?.contract_chunks ?? []),
    [contract],
  );

  const openCompare = useCallback(async (chunkId: string) => {
    setCompareErr(null);
    setSimilar(null);
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
      setSimilar(Array.isArray(j.similar) ? j.similar : []);
    } catch (e) {
      setCompareErr(e instanceof Error ? e.message : "Compare failed");
    } finally {
      setCompareLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl animate-pulse space-y-4">
        <div className="h-40 rounded-xl bg-gray-200" />
        <div className="h-64 rounded-xl bg-gray-200" />
      </div>
    );
  }

  if (err || !contract) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        {err || "Not found"}
        <div className="mt-4">
          <Link href="/contracts" className="text-sm font-medium underline">
            ← All contracts
          </Link>
        </div>
      </div>
    );
  }

  const health = contract.health_score ?? 50;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link
        href="/contracts"
        className="text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        ← All contracts
      </Link>

      <header className="flex flex-col gap-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {contract.counterparty_name || contract.file_name}
          </h1>
          <p className="text-sm text-gray-500">{contract.file_name}</p>
          {contract.contract_type && (
            <span className="mt-2 inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              {contract.contract_type}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-sm">
            <p className="text-gray-500">Money at risk</p>
            <p className="text-lg font-bold text-red-700">
              ${Number(contract.money_at_risk || 0).toLocaleString()}
            </p>
            <p className="mt-2 text-gray-500">Leverage</p>
            <p className="text-lg font-bold text-emerald-700">
              ${Number(contract.leverage_total || 0).toLocaleString()}
            </p>
          </div>
          <HealthGauge score={health} />
        </div>
      </header>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab("analysis")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            tab === "analysis"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Analysis
        </button>
        <button
          type="button"
          onClick={() => setTab("ask")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            tab === "ask"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Ask anything
        </button>
      </div>

      {tab === "analysis" && (
        <ul className="space-y-4">
          {chunks.map((c, i) => (
            <li
              key={c.id}
              className="animate-fade-in-up rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={c.severity ?? "none"} />
                <span className="text-xs text-gray-500">
                  §{c.section_number ?? "—"}
                  {c.section_title ? ` · ${c.section_title}` : ""}
                </span>
              </div>
              <h3 className="mt-2 font-semibold text-gray-900">
                {c.title || "Clause"}
              </h3>
              {c.dollar_impact != null && (
                <p className="mt-1 text-sm font-medium text-gray-800">
                  ${Number(c.dollar_impact).toLocaleString()}
                </p>
              )}
              <p className="mt-2 text-sm text-gray-600">{c.analysis}</p>
              {c.recommended_action && (
                <p className="mt-3 text-sm text-gray-800">
                  <span className="font-medium">Recommended:</span>{" "}
                  {c.recommended_action}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void openCompare(c.id)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
                >
                  Find similar in other contracts
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void fetch("/api/actions", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chunk_id: c.id,
                        contract_id: contract.id,
                        savings_amount: 0,
                        action_type: "take_action",
                      }),
                    })
                  }
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                >
                  Take Action
                </button>
              </div>
            </li>
          ))}
          {chunks.length === 0 && (
            <li className="text-sm text-gray-500">No analyzed chunks.</li>
          )}
        </ul>
      )}

      {tab === "ask" && <ContractChat contractId={contract.id} />}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal
          onClick={() => setModalOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                Similar clauses
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {compareLoading && (
              <p className="mt-4 text-sm text-gray-500">Loading…</p>
            )}
            {compareErr && (
              <p className="mt-4 text-sm text-red-600">{compareErr}</p>
            )}
            {!compareLoading && similar && (
              <ul className="mt-4 space-y-3 text-sm">
                {similar.length === 0 && (
                  <li className="text-gray-500">No similar clauses found.</li>
                )}
                {similar.map((row, idx) => (
                  <li
                    key={idx}
                    className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                  >
                    <pre className="whitespace-pre-wrap font-sans text-xs text-gray-700">
                      {JSON.stringify(row, null, 2)}
                    </pre>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "bg-red-600 text-white",
    high: "bg-orange-500 text-white",
    medium: "bg-amber-400 text-gray-900",
    low: "bg-gray-200 text-gray-800",
    none: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${map[severity] ?? map.none}`}
    >
      {severity}
    </span>
  );
}
