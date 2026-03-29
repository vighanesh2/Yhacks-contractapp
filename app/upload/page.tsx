"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { HealthGauge } from "@/components/HealthGauge";
import { useCountUp } from "@/components/useCountUp";

type UploadStats = {
  total_chunks: number;
  risks_found: number;
  leverage_found: number;
  critical_count: number;
};

type UploadContract = {
  id: string;
  file_name: string;
  contract_type?: string;
  health_score?: number;
  money_at_risk?: number;
  leverage_total?: number;
};

type AnalyzedChunk = {
  id?: string | null;
  section_number: string | null;
  section_title: string | null;
  clause_type: string;
  category: string;
  severity: string;
  title: string | null;
  analysis: string;
  dollar_impact: number | null;
  recommended_action: string | null;
};

type UploadSuccessResponse = {
  success: true;
  contract: UploadContract;
  chunks: AnalyzedChunk[];
  stats: UploadStats;
};

const STEPS = [
  "Extracting text…",
  "Analyzing clauses…",
  "Calculating risk…",
];

export default function UploadPage() {
  const [phase, setPhase] = useState<"upload" | "analyzing" | "results" | "error">(
    "upload",
  );
  const [stepIdx, setStepIdx] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<UploadSuccessResponse | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== "analyzing") return;
    const id = window.setInterval(() => {
      setStepIdx((s) => Math.min(STEPS.length - 1, s + 1));
    }, 2800);
    return () => clearInterval(id);
  }, [phase]);

  const onFile = useCallback(async (file: File) => {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) {
      setPhase("error");
      setMessage("Only PDF or DOCX files are allowed.");
      return;
    }

    setMessage(null);
    setResult(null);
    setPhase("analyzing");
    setStepIdx(0);

    const body = new FormData();
    body.append("file", file);

    try {
      const res = await fetch("/api/contracts/upload", {
        method: "POST",
        body,
      });
      const data = (await res.json()) as
        | UploadSuccessResponse
        | { error?: string };

      if (!res.ok) {
        setPhase("error");
        setMessage(
          (data as { error?: string }).error ?? `Upload failed (${res.status})`,
        );
        return;
      }

      if (!("success" in data) || !data.success || !("contract" in data)) {
        setPhase("error");
        setMessage("Unexpected response from server.");
        return;
      }

      setResult(data);
      setPhase("results");
    } catch {
      setPhase("error");
      setMessage("Network error.");
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) void onFile(f);
    },
    [onFile],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void onFile(f);
    },
    [onFile],
  );

  const moneyAtRisk = result?.contract.money_at_risk ?? 0;
  const leverage = result?.contract.leverage_total ?? 0;
  const animRisk = useCountUp(phase === "results" ? moneyAtRisk : 0);
  const animLev = useCountUp(phase === "results" ? leverage : 0);

  const riskChunks =
    result?.chunks.filter((c) => c.category === "risk") ?? [];
  const levChunks =
    result?.chunks.filter((c) => c.category === "leverage") ?? [];

  async function takeAction(chunk: AnalyzedChunk) {
    if (!result) return;
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chunk_id: chunk.id,
          contract_id: result.contract.id,
          savings_amount: 0,
          action_type: "take_action",
        }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setMessage(j.error ?? "Could not record action.");
        return;
      }
      setFlashId(chunk.id ?? chunk.title ?? "x");
      window.setTimeout(() => setFlashId(null), 700);
    } catch {
      setMessage("Could not record action.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Upload contract
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          PDF or DOCX. We redact PII, analyze clauses, and store embeddings.
        </p>
      </div>

      {phase === "upload" && (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white px-6 py-20 transition hover:border-gray-400 hover:bg-gray-50"
        >
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={onInputChange}
          />
          <div className="mb-4 rounded-full bg-gray-100 p-4 text-gray-500">
            <FileIcon className="h-12 w-12" />
          </div>
          <p className="text-lg font-medium text-gray-900">
            Drop your contract here
          </p>
          <p className="mt-1 text-sm text-gray-500">PDF or DOCX</p>
        </label>
      )}

      {phase === "analyzing" && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-24">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
          <p className="mt-6 text-lg font-medium text-gray-900">
            Analyzing your contract…
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-500">
            {STEPS.map((label, i) => (
              <span key={label} className="flex items-center gap-2">
                {i > 0 ? <span className="text-gray-300">→</span> : null}
                <span
                  className={
                    i === stepIdx
                      ? "font-semibold text-gray-900"
                      : i < stepIdx
                        ? "text-emerald-600"
                        : ""
                  }
                >
                  {label}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {message && phase === "error" && (
        <div
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {message}
          <button
            type="button"
            className="ml-3 font-medium underline"
            onClick={() => {
              setPhase("upload");
              setMessage(null);
            }}
          >
            Try again
          </button>
        </div>
      )}

      {phase === "results" && result && (
        <div className="space-y-8">
          <header className="flex flex-col gap-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-900">
                  {result.contract.file_name}
                </h2>
                {result.contract.contract_type && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    {result.contract.contract_type}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Money at Risk report
              </p>
            </div>
            <HealthGauge score={result.contract.health_score ?? 50} />
          </header>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border-2 border-red-200 bg-red-50/80 p-6">
              <p className="text-sm font-medium text-red-800">Money at Risk</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-red-700">
                ${animRisk.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/80 p-6">
              <p className="text-sm font-medium text-emerald-800">
                Leverage found
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-700">
                ${animLev.toLocaleString()}
              </p>
            </div>
          </div>

          <p className="text-center text-sm text-gray-600">
            {result.stats.total_chunks} sections analyzed ·{" "}
            {result.stats.risks_found} risks found ·{" "}
            {result.stats.leverage_found} leverage points
          </p>

          <div className="grid gap-8 lg:grid-cols-2">
            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-red-700">
                Risks
              </h3>
              <ul className="space-y-4">
                {riskChunks.map((c, i) => (
                  <li
                    key={c.id ?? `r-${i}`}
                    className={`animate-fade-in-up rounded-xl border-l-4 border-red-500 border border-red-100 bg-white p-4 shadow-sm ${
                      c.severity === "critical" ? "animate-pulse-critical" : ""
                    } ${flashId === (c.id ?? c.title) ? "ring-2 ring-emerald-400" : ""}`}
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <SeverityBadge severity={c.severity} />
                    <p className="mt-2 font-semibold text-gray-900">
                      {c.title ?? "Clause"}
                    </p>
                    <p className="text-xs text-gray-500">
                      §{c.section_number ?? "—"}
                      {c.section_title ? ` · ${c.section_title}` : ""}
                    </p>
                    {c.dollar_impact != null && (
                      <p className="mt-2 text-sm font-medium text-red-700">
                        ${Number(c.dollar_impact).toLocaleString()} est. impact
                      </p>
                    )}
                    <p className="mt-2 text-sm text-gray-600">{c.analysis}</p>
                    {c.recommended_action && (
                      <p className="mt-2 text-sm text-gray-800">
                        <span className="font-medium">Recommended:</span>{" "}
                        {c.recommended_action}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => void takeAction(c)}
                      className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    >
                      Take Action
                    </button>
                    {flashId === (c.id ?? c.title) && (
                      <span className="pointer-events-none ml-2 text-sm font-medium text-emerald-600 animate-confetti">
                        Logged ✓
                      </span>
                    )}
                  </li>
                ))}
                {riskChunks.length === 0 && (
                  <li className="text-sm text-gray-500">No risk-tagged clauses.</li>
                )}
              </ul>
            </section>

            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-emerald-700">
                Your leverage
              </h3>
              <ul className="space-y-4">
                {levChunks.map((c, i) => (
                  <li
                    key={c.id ?? `l-${i}`}
                    className="animate-fade-in-up rounded-xl border-l-4 border-emerald-500 border border-emerald-100 bg-white p-4 shadow-sm"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <SeverityBadge severity={c.severity} />
                    <p className="mt-2 font-semibold text-gray-900">
                      {c.title ?? "Clause"}
                    </p>
                    <p className="text-xs text-gray-500">
                      §{c.section_number ?? "—"}
                      {c.section_title ? ` · ${c.section_title}` : ""}
                    </p>
                    {c.dollar_impact != null && (
                      <p className="mt-2 text-sm font-medium text-emerald-700">
                        ${Number(c.dollar_impact).toLocaleString()} est. value
                      </p>
                    )}
                    <p className="mt-2 text-sm text-gray-600">{c.analysis}</p>
                    {c.recommended_action && (
                      <p className="mt-2 text-sm text-gray-800">
                        <span className="font-medium">Recommended:</span>{" "}
                        {c.recommended_action}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => void takeAction(c)}
                      className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      Take Action
                    </button>
                  </li>
                ))}
                {levChunks.length === 0 && (
                  <li className="text-sm text-gray-500">
                    No leverage-tagged clauses.
                  </li>
                )}
              </ul>
            </section>
          </div>

          <div className="flex flex-wrap justify-center gap-4 pb-8">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center rounded-lg border border-gray-300 bg-white px-6 text-sm font-medium text-gray-900 hover:bg-gray-50"
            >
              View in Dashboard
            </Link>
            <Link
              href={`/contracts/${result.contract.id}#ask`}
              className="inline-flex h-11 items-center rounded-lg bg-gray-900 px-6 text-sm font-medium text-white hover:bg-gray-800"
            >
              Ask a Question
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: "bg-red-600 text-white",
    high: "bg-orange-500 text-white",
    medium: "bg-amber-400 text-gray-900",
    low: "bg-gray-200 text-gray-800",
    none: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase ${styles[severity] ?? styles.none}`}
    >
      {severity}
    </span>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}
