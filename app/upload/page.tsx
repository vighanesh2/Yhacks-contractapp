"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type UploadContract = {
  id: string;
  file_name: string;
  contract_type?: string;
  money_at_risk?: number;
  leverage_total?: number;
};

type UploadSuccessResponse = {
  success: true;
  contract: UploadContract;
  stats: {
    total_chunks: number;
    risks_found: number;
    leverage_found: number;
    critical_count: number;
  };
};

// ─── Stepper config ───────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 1,
    label: "Extract",
    detail: "Reading your document and extracting text",
    icon: "📄",
  },
  {
    id: 2,
    label: "Analyze",
    detail: "GPT-4.2 analyzing every clause concurrently",
    icon: "🔍",
  },
  {
    id: 3,
    label: "Score",
    detail: "Calculating Money at Risk and Leverage score",
    icon: "💰",
  },
  {
    id: 4,
    label: "Save",
    detail: "Storing analysis securely in your vault",
    icon: "🛡️",
  },
] as const;

// Each step gets this many ms before we advance the visual indicator.
// The real pipeline determines when we actually finish — this just keeps
// the stepper moving so the user knows work is happening.
const STEP_DURATIONS = [4000, 18000, 6000, 3000];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const router = useRouter();

  type Phase = "idle" | "analyzing" | "done" | "error";
  const [phase, setPhase] = useState<Phase>("idle");
  const [stepIdx, setStepIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<UploadSuccessResponse | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState(3);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Stepper driver ──────────────────────────────────────────────────────────
  // Advances the visual step indicator on a time budget while the real API
  // call runs in the background. Stops at the last step until API resolves.
  function startStepper() {
    setStepIdx(0);
    setProgress(0);

    let accumulated = 0;
    STEP_DURATIONS.forEach((duration, i) => {
      if (i === STEPS.length - 1) return; // hold last step until done
      accumulated += duration;
      const t = setTimeout(() => setStepIdx(i + 1), accumulated);
      stepTimers.current.push(t);
    });

    // Smooth progress bar — runs at ~30fps, reaches ~92% and holds
    let p = 0;
    progressTimer.current = setInterval(() => {
      const totalDuration = STEP_DURATIONS.reduce((a, b) => a + b, 0);
      const increment = (100 / totalDuration) * (1000 / 30);
      p = Math.min(92, p + increment);
      setProgress(p);
    }, 1000 / 30);
  }

  function stopStepper(success: boolean) {
    stepTimers.current.forEach(clearTimeout);
    stepTimers.current = [];
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    if (success) {
      setStepIdx(STEPS.length - 1);
      setProgress(100);
    }
  }

  // ── Auto-redirect after success ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "done" || !result) return;

    let count = 3;

    const id = setInterval(() => {
      count -= 1;
      setRedirectCountdown(count);
      if (count <= 0) {
        clearInterval(id);
        router.push(`/contracts/${result.contract.id}`);
      }
    }, 1000);

    return () => clearInterval(id);
  }, [phase, result, router]);

  // ── File handler ─────────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) {
      setPhase("error");
      setErrorMsg("Only PDF or DOCX files are supported.");
      return;
    }

    setErrorMsg(null);
    setResult(null);
    setPhase("analyzing");
    startStepper();

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

      if (!res.ok || !("success" in data)) {
        stopStepper(false);
        setPhase("error");
        setErrorMsg(
          (data as { error?: string }).error ??
            `Upload failed (${res.status}). Please try again.`,
        );
        return;
      }

      stopStepper(true);
      setResult(data as UploadSuccessResponse);

      // Brief pause so user sees 100% progress before "done" appears
      setTimeout(() => setPhase("done"), 400);
    } catch {
      stopStepper(false);
      setPhase("error");
      setErrorMsg(
        "Network error — please check your connection and try again.",
      );
    }
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void handleFile(f);
    },
    [handleFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) void handleFile(f);
    },
    [handleFile],
  );

  const reset = () => {
    setPhase("idle");
    setErrorMsg(null);
    setResult(null);
    setStepIdx(0);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Upload Contract
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          PDF or DOCX · PII auto-redacted · Analysis in under 60 seconds
        </p>
      </div>

      {/* ── Idle: drop zone ──────────────────────────────────────────────── */}
      {phase === "idle" && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-20 transition-all duration-200 ${
            isDragging
              ? "border-emerald-400 bg-emerald-50 scale-[1.01]"
              : "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={onInputChange}
          />

          <div
            className={`mb-5 rounded-2xl p-5 transition-colors ${isDragging ? "bg-emerald-100" : "bg-gray-100"}`}
          >
            <UploadCloudIcon
              className={`h-12 w-12 transition-colors ${isDragging ? "text-emerald-600" : "text-gray-400"}`}
            />
          </div>

          <p className="text-lg font-semibold text-gray-900">
            {isDragging ? "Drop it here" : "Drop your contract here"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            or{" "}
            <span className="font-medium text-emerald-600 underline underline-offset-2">
              browse to upload
            </span>
          </p>
          <p className="mt-3 text-xs text-gray-400">PDF or DOCX · max 20 MB</p>
        </label>
      )}

      {/* ── Analyzing: stepper ───────────────────────────────────────────── */}
      {phase === "analyzing" && (
        <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 shadow-sm">
          {/* Steps */}
          <div className="mb-8 flex items-start justify-between gap-2">
            {STEPS.map((step, i) => {
              const state =
                i < stepIdx ? "done" : i === stepIdx ? "active" : "pending";
              return (
                <div
                  key={step.id}
                  className="flex flex-1 flex-col items-center gap-2 text-center"
                >
                  {/* Circle */}
                  <div
                    className={`relative flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                      state === "done"
                        ? "border-emerald-500 bg-emerald-500"
                        : state === "active"
                          ? "border-emerald-500 bg-white"
                          : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    {state === "done" ? (
                      <CheckIcon className="h-5 w-5 text-white animate-step-pop" />
                    ) : state === "active" ? (
                      <span className="text-lg animate-pulse">{step.icon}</span>
                    ) : (
                      <span className="text-sm font-semibold text-gray-300">
                        {step.id}
                      </span>
                    )}

                    {/* Connector line (not after last) */}
                    {i < STEPS.length - 1 && (
                      <div
                        aria-hidden
                        className={`absolute left-full top-1/2 h-0.5 w-full -translate-y-1/2 transition-colors duration-500 ${
                          i < stepIdx ? "bg-emerald-400" : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>

                  {/* Label */}
                  <p
                    className={`text-xs font-semibold transition-colors ${
                      state === "active"
                        ? "text-gray-900"
                        : state === "done"
                          ? "text-emerald-600"
                          : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full animate-shimmer transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Active step detail */}
          <p className="mt-5 text-center text-sm text-gray-500">
            {STEPS[stepIdx]?.detail ?? "Finishing up…"}
          </p>

          {/* Spinner */}
          <div className="mt-6 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-500" />
          </div>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {phase === "error" && (
        <div className="animate-fade-in rounded-2xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold text-red-900">Upload failed</p>
              <p className="mt-1 text-sm text-red-700">{errorMsg}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={reset}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-red-600 px-5 text-sm font-medium text-white transition hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      )}

      {/* ── Done: success + redirect countdown ───────────────────────────── */}
      {phase === "done" && result && (
        <div className="animate-scale-in rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm">
          {/* Success badge */}
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
              ✅
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">
              Analysis complete!
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {result.contract.file_name}
            </p>
          </div>

          {/* Quick stats */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-gray-50 py-3">
              <p className="text-lg font-bold text-gray-900">
                {result.stats.total_chunks}
              </p>
              <p className="text-xs text-gray-500">sections</p>
            </div>
            <div className="rounded-xl bg-red-50 py-3">
              <p className="text-lg font-bold text-red-700">
                {result.stats.risks_found}
              </p>
              <p className="text-xs text-gray-500">risks found</p>
            </div>
            <div className="rounded-xl bg-emerald-50 py-3">
              <p className="text-lg font-bold text-emerald-700">
                {result.stats.leverage_found}
              </p>
              <p className="text-xs text-gray-500">leverage points</p>
            </div>
          </div>

          {/* Dollar preview */}
          {(result.contract.money_at_risk ?? 0) > 0 && (
            <div className="mt-4 flex gap-3">
              <div className="flex-1 rounded-xl border-2 border-red-200 bg-red-50 py-3 text-center">
                <p className="text-xs font-medium text-red-700">
                  Money at Risk
                </p>
                <p className="mt-1 text-xl font-bold text-red-600">
                  ${Number(result.contract.money_at_risk ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="flex-1 rounded-xl border-2 border-emerald-200 bg-emerald-50 py-3 text-center">
                <p className="text-xs font-medium text-emerald-700">Leverage</p>
                <p className="mt-1 text-xl font-bold text-emerald-600">
                  $
                  {Number(result.contract.leverage_total ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Redirect countdown */}
          <div className="mt-6 flex flex-col items-center gap-3">
            <p className="text-sm text-gray-500">
              Redirecting to Contract Detail in{" "}
              <span className="font-semibold text-gray-900">
                {redirectCountdown}s
              </span>
              …
            </p>

            {/* Progress ring */}
            <svg
              width="36"
              height="36"
              viewBox="0 0 36 36"
              className="-rotate-90"
            >
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                className="stroke-gray-200"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                className="stroke-emerald-500"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 14}`}
                strokeDashoffset={`${2 * Math.PI * 14 * (redirectCountdown / 3)}`}
                style={{ transition: "stroke-dashoffset 0.9s linear" }}
              />
            </svg>

            <Link
              href={`/contracts/${result.contract.id}`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Go to Contract Detail now
              <ArrowRightIcon className="h-4 w-4" />
            </Link>

            <button
              type="button"
              onClick={reset}
              className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600"
            >
              Upload another contract
            </button>
          </div>
        </div>
      )}

      {/* ── Security note ─────────────────────────────────────────────────── */}
      {phase === "idle" && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="mb-2 text-xs font-semibold text-emerald-800">
            🔒 Privacy & Security
          </p>
          <ul className="space-y-1 text-xs text-emerald-700">
            {[
              "PII auto-redacted before any AI processing",
              "Embeddings stored in your own Supabase instance",
              "Zero data retention — raw text never persisted",
            ].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function UploadCloudIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 16.5V9.75m0 0l-3 3m3-3l3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.25 5.25 0 011.84 10.095H6.75z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12.75l6 6 9-13.5"
      />
    </svg>
  );
}

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
