"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 px-6 pb-24 pt-20 md:px-12 lg:px-20">
        {/* Subtle grid overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-16 lg:flex-row lg:items-start lg:gap-12">
          {/* Left — copy */}
          <div className="flex-1 text-center lg:text-left">
            <span
              className="mb-6 inline-flex animate-fade-in-up items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-400"
              style={{ animationDelay: "0ms" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              AI-Powered Contract Intelligence
            </span>

            <h1
              className="mt-4 animate-fade-in-up text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl"
              style={{ animationDelay: "80ms" }}
            >
              Your contracts
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">
                finally talk back.
              </span>
            </h1>

            <p
              className="mt-6 max-w-xl animate-fade-in-up text-lg leading-relaxed text-gray-300"
              style={{ animationDelay: "160ms" }}
            >
              Upload any sales, vendor, or distribution agreement. In seconds,
              DealWithIt surfaces your exact dollar exposure, hidden renewal
              traps, and the one action you need to protect your money — no
              lawyer required.
            </p>

            {/* Stats row */}
            <div
              className="mt-8 flex animate-fade-in-up flex-wrap justify-center gap-6 lg:justify-start"
              style={{ animationDelay: "240ms" }}
            >
              {[
                { value: "8.6%", label: "Avg. revenue leakage" },
                { value: "$47K–92K", label: "Typical risk per contract" },
                { value: "< 60s", label: "Time to full analysis" },
              ].map((s) => (
                <div key={s.label} className="text-center lg:text-left">
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div
              className="mt-10 flex animate-fade-in-up flex-wrap justify-center gap-3 lg:justify-start"
              style={{ animationDelay: "320ms" }}
            >
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-7 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-400/30"
              >
                Open Dashboard
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/upload"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-7 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                Upload your first contract
              </Link>
            </div>

            {/* Trust line */}
            <p className="mt-6 text-xs text-gray-500">
              Grounded in WorldCC 2025–2026 data · Built for SMBs and enterprise
              alike
            </p>
          </div>

          {/* Right — mock UI */}
          <div
            className="w-full max-w-md animate-fade-in-up shrink-0"
            style={{ animationDelay: "400ms" }}
          >
            <MockContractCard />
          </div>
        </div>
      </section>

      {/* ── Benefits ─────────────────────────────────────────────────────── */}
      <section className="bg-gray-50 px-6 py-20 md:px-12">
        <div className="mx-auto max-w-5xl">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-emerald-600">
            What it does for you
          </p>
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            Every number. Every risk. Every action.
          </h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b, i) => (
              <div
                key={b.title}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gray-900 text-xl">
                  {b.icon}
                </div>
                <h3 className="mb-2 font-semibold text-gray-900">{b.title}</h3>
                <p className="text-sm leading-relaxed text-gray-600">
                  {b.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8 Insights strip ─────────────────────────────────────────────── */}
      <section className="bg-white px-6 py-20 md:px-12">
        <div className="mx-auto max-w-5xl">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-red-600">
            Built into every upload
          </p>
          <h2 className="mb-4 text-center text-3xl font-bold text-gray-900">
            What we surface automatically
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-sm text-gray-500">
            On every Sales or Distribution Agreement upload, DealWithIt
            automatically extracts these 8 financial insights — each backed by
            real clause text, concrete dollar math, and a specific recommended
            action.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {EIGHT_INSIGHTS.map((ins, i) => (
              <div
                key={ins.label}
                className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {ins.label}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">{ins.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="bg-gray-950 px-6 py-20 md:px-12">
        <div className="mx-auto max-w-4xl">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-emerald-400">
            How it works
          </p>
          <h2 className="mb-12 text-center text-3xl font-bold text-white">
            From upload to insight in under 60 seconds
          </h2>

          <div className="relative flex flex-col gap-0 md:flex-row md:gap-0">
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.title}
                className="relative flex flex-1 flex-col items-center px-4 pb-10 text-center md:pb-0"
              >
                {/* Connector line */}
                {i < HOW_IT_WORKS.length - 1 && (
                  <div
                    aria-hidden
                    className="absolute right-0 top-5 hidden h-px w-1/2 bg-gradient-to-r from-gray-600 to-transparent md:block"
                  />
                )}
                {i > 0 && (
                  <div
                    aria-hidden
                    className="absolute left-0 top-5 hidden h-px w-1/2 bg-gradient-to-l from-gray-600 to-transparent md:block"
                  />
                )}
                <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-lg font-bold text-white shadow-lg shadow-emerald-500/30">
                  {i + 1}
                </div>
                <h3 className="mt-4 font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm text-gray-400">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security + CTA footer ─────────────────────────────────────────── */}
      <section className="border-t border-gray-100 bg-white px-6 py-16 md:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 md:flex-row md:items-start md:justify-between">
          {/* Security box */}
          <div className="w-full max-w-xs rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">🔒</span>
              <p className="font-semibold text-emerald-900">
                Enterprise-grade security
              </p>
            </div>
            <ul className="space-y-2 text-sm text-emerald-800">
              {[
                "PII auto-redacted before any AI processing",
                "Zero data retention — nothing stored after analysis",
                "All data encrypted at rest and in transit",
                "Supabase + pgvector — SOC 2 compliant infrastructure",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-emerald-500 text-[10px] font-bold text-white flex items-center justify-center">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Final CTA */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-3xl font-bold text-gray-900">
              Stop leaving money on the table.
            </h2>
            <p className="mt-3 max-w-md text-gray-600">
              A single $50K vendor contract can quietly leak $4K–$9K a year
              through missed notice periods and unbalanced terms. DealWithIt
              finds the exact dollar number and the one-sentence action to fix
              it — in under a minute.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
              <Link
                href="/upload"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gray-900 px-7 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800"
              >
                Analyze a contract now
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-200 bg-white px-7 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
              >
                View Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Mock Contract Card (right-side hero visual) ──────────────────────────────

function MockContractCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-1 shadow-2xl backdrop-blur-sm ring-1 ring-white/10">
      <div className="rounded-xl bg-white p-5 shadow-inner">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-gray-400">Contract Detail</p>
            <h3 className="mt-0.5 font-semibold text-gray-900">
              Acme Distribution Agreement
            </h3>
            <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              distribution
            </span>
          </div>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            Active
          </span>
        </div>

        {/* Stat cards */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border-2 border-red-200 bg-red-50 px-3 py-3">
            <p className="text-xs font-medium text-red-700">Money at Risk</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-red-600">
              $68,400
            </p>
          </div>
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 px-3 py-3">
            <p className="text-xs font-medium text-emerald-700">Leverage</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-emerald-600">
              $24,000
            </p>
          </div>
        </div>

        {/* Clause cards */}
        <div className="mt-3 space-y-2">
          <MockClause
            severity="critical"
            title="Auto-renewal trap: 90-day notice required"
            section="§8.2"
            dollar="$47,200"
          />
          <MockClause
            severity="high"
            title="Net-60 payment terms: cash-flow drag"
            section="§5.1"
            dollar="$12,800"
          />
          <MockClause
            severity="medium"
            title="SLA penalty cap too low vs. exposure"
            section="§11.4"
            dollar="$8,400"
          />
        </div>

        {/* Chat hint */}
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="text-sm">💬</span>
          <p className="text-xs text-gray-500">
            Ask anything about this contract…
          </p>
        </div>
      </div>
    </div>
  );
}

function MockClause({
  severity,
  title,
  section,
  dollar,
}: {
  severity: "critical" | "high" | "medium";
  title: string;
  section: string;
  dollar: string;
}) {
  const badge: Record<string, string> = {
    critical: "bg-red-600 text-white",
    high: "bg-orange-500 text-white",
    medium: "bg-amber-400 text-gray-900",
  };
  const border: Record<string, string> = {
    critical: "border-red-200",
    high: "border-orange-200",
    medium: "border-amber-200",
  };
  return (
    <div
      className={`flex items-center justify-between rounded-lg border bg-white px-3 py-2 ${border[severity]}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${badge[severity]}`}
        >
          {severity}
        </span>
        <p className="truncate text-xs font-medium text-gray-800">{title}</p>
      </div>
      <div className="ml-2 shrink-0 text-right">
        <p className="text-xs font-semibold text-red-600">{dollar}</p>
        <p className="text-[9px] text-gray-400">{section}</p>
      </div>
    </div>
  );
}

// ─── Static data ──────────────────────────────────────────────────────────────

const BENEFITS = [
  {
    icon: "💰",
    title: "Exact dollar exposure",
    body: "Every clause gets a CFO-grade dollar impact — calculated using WorldCC 2025–2026 benchmarks, not guesswork.",
  },
  {
    icon: "🔍",
    title: "GraphRAG-powered Q&A",
    body: "Ask anything in plain English. Our agentic pipeline routes, retrieves, and verifies before answering — showing its reasoning live.",
  },
  {
    icon: "⚡",
    title: "Instant action items",
    body: "Each risk comes with a specific, dated recommended action. No more 'consult your lawyer' — just what to do and by when.",
  },
  {
    icon: "📊",
    title: "Portfolio dashboard",
    body: "See your total money at risk, leverage, and upcoming deadlines across all contracts in one command-center view.",
  },
  {
    icon: "🔔",
    title: "Deadline intelligence",
    body: "Auto-renewal traps, notice windows, and payment deadlines surfaced automatically so nothing slips through the cracks.",
  },
  {
    icon: "🛡️",
    title: "Privacy-first design",
    body: "PII is redacted before any AI touches it. Zero data retention. Encrypted at rest and in transit.",
  },
];

const EIGHT_INSIGHTS = [
  {
    label: "Auto-renewal revenue trap forecast",
    detail: "Flags notice windows < 90 days and rate increases on rollover",
  },
  {
    label: "Missed price escalation / true-up exposure",
    detail:
      "Identifies missing CPI caps and true-up mechanisms favoring the counterparty",
  },
  {
    label: "Payment terms cash-flow risk score",
    detail:
      "Quantifies Net-60+ drag vs. Net-30 benchmark (~2–3% annual impact)",
  },
  {
    label: "Customer termination leverage gap",
    detail:
      "Surfaces asymmetric termination rights and punitive exit fee structures",
  },
  {
    label: "IP ownership / deliverables restriction cost",
    detail:
      "Flags unfavorable IP assignment and estimates re-work / licensing costs",
  },
  {
    label: "SLA penalty imbalance",
    detail: "Identifies disproportionate penalties and missing cure periods",
  },
  {
    label: "Minimum commitment true-up risk",
    detail:
      "Calculates exposure if annual minimums are missed or ratchet upward",
  },
  {
    label: "Overall Revenue-at-Risk + Leverage Score",
    detail:
      "One-sentence CFO executive summary with total exposure and top action",
  },
];

const HOW_IT_WORKS = [
  {
    title: "Upload",
    body: "Drop any PDF or DOCX contract. We extract, chunk, and redact PII automatically.",
  },
  {
    title: "Analyze",
    body: "GPT-4.2 via Lava analyzes every clause concurrently — 8 CFO-grade insights surfaced.",
  },
  {
    title: "Review",
    body: "See your Money at Risk, Leverage, and clause-level analysis on the Contract Detail page.",
  },
  {
    title: "Ask & Act",
    body: "Chat with your contract using GraphRAG. Log actions and track savings over time.",
  },
];

function ArrowRightIcon({ className }: { className?: string }) {
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
        d="M13 7l5 5m0 0l-5 5m5-5H6"
      />
    </svg>
  );
}
