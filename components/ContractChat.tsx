"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChatSource = {
  section_number: string;
  section_title: string;
  chunk_text: string;
  relevance: number;
  contract_name?: string;
  clause_type?: string;
};

export type ThinkingStep = {
  node: string;
  decision: string;
  detail?: string;
};

type AssistantMessage = {
  role: "assistant";
  content: string;
  sources: ChatSource[];
  thinking?: ThinkingStep[];
  confidence?: number;
  router_decision?: "simple" | "complex";
};

type UserMessage = {
  role: "user";
  content: string;
};

type Message = UserMessage | AssistantMessage;

// ─── Suggested questions ──────────────────────────────────────────────────────

const PORTFOLIO_SUGGESTIONS = [
  "What's my total money at risk across all contracts?",
  "Show me all auto-renewal clauses",
  "Which contracts have the highest liability exposure?",
  "Where do I have the most leverage to renegotiate?",
  "Which contracts expire this quarter?",
];

const CONTRACT_SUGGESTIONS = [
  "What are the payment terms and cash-flow risk?",
  "Is there an auto-renewal clause? When must I act?",
  "What happens if I terminate early?",
  "What's my total liability exposure here?",
  "Are there any SLA penalties or minimum commitments?",
];

// ─── Node color map ───────────────────────────────────────────────────────────

const NODE_STYLES: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  Router: {
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  "Vector Retrieval": {
    bg: "bg-purple-50",
    text: "text-purple-800",
    border: "border-purple-200",
    dot: "bg-purple-500",
  },
  "Graph Traversal": {
    bg: "bg-indigo-50",
    text: "text-indigo-800",
    border: "border-indigo-200",
    dot: "bg-indigo-500",
  },
  "Context Assembly": {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  "Answer Generation": {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  "Confidence Check": {
    bg: "bg-gray-50",
    text: "text-gray-700",
    border: "border-gray-200",
    dot: "bg-gray-400",
  },
};

const DEFAULT_NODE_STYLE = {
  bg: "bg-gray-50",
  text: "text-gray-700",
  border: "border-gray-200",
  dot: "bg-gray-400",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ThinkingTrace({
  steps,
  confidence,
  router_decision,
}: {
  steps: ThinkingStep[];
  confidence?: number;
  router_decision?: "simple" | "complex";
}) {
  const [open, setOpen] = useState(false);

  if (steps.length === 0) return null;

  const routerLabel =
    router_decision === "complex"
      ? { text: "Graph mode", className: "bg-indigo-100 text-indigo-700" }
      : { text: "Direct lookup", className: "bg-blue-100 text-blue-700" };

  const confidenceColor =
    confidence === undefined
      ? "text-gray-500"
      : confidence >= 80
        ? "text-emerald-600"
        : confidence >= 60
          ? "text-amber-600"
          : "text-red-500";

  return (
    <div className="mt-2 rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          {/* Animated pipeline dots */}
          <div className="flex items-center gap-1">
            {steps.slice(0, Math.min(steps.length, 6)).map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-thinking-in"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>

          <span className="text-xs font-semibold text-gray-600">
            GraphRAG trace
          </span>

          {router_decision && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${routerLabel.className}`}
            >
              {routerLabel.text}
            </span>
          )}

          {confidence !== undefined && (
            <span className={`text-[10px] font-semibold ${confidenceColor}`}>
              {confidence}% confidence
            </span>
          )}
        </div>

        <ChevronIcon
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Steps panel */}
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {steps.map((step, i) => {
            const style = NODE_STYLES[step.node] ?? DEFAULT_NODE_STYLE;
            return (
              <div
                key={i}
                className={`flex gap-3 px-4 py-3 animate-thinking-in ${style.bg}`}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {/* Timeline dot + line */}
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`}
                  />
                  {i < steps.length - 1 && (
                    <span className="w-px flex-1 bg-gray-200" />
                  )}
                </div>

                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${style.bg} ${style.text} ${style.border}`}
                    >
                      {step.node}
                    </span>
                  </div>
                  <p className={`mt-0.5 text-xs font-medium ${style.text}`}>
                    {step.decision}
                  </p>
                  {step.detail && (
                    <p className="mt-0.5 text-xs text-gray-500 truncate">
                      {step.detail}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SourcesPanel({ sources }: { sources: ChatSource[] }) {
  const [open, setOpen] = useState(false);
  if (sources.length === 0) return null;

  return (
    <details
      className="ml-1 mt-1 text-xs"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer list-none">
        <span className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-800 transition-colors">
          <span className="font-medium">
            {sources.length} source{sources.length !== 1 ? "s" : ""}
          </span>
          <ChevronIcon
            className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </summary>
      <ul className="mt-2 space-y-2">
        {sources.map((s, j) => (
          <li
            key={j}
            className="rounded-lg border border-gray-200 bg-white p-2.5 text-gray-600 animate-fade-in"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-gray-800">
                  §{s.section_number || "?"}{" "}
                  {s.section_title ? `· ${s.section_title}` : ""}
                </span>
                {s.contract_name && (
                  <span className="ml-1 text-gray-400">
                    · {s.contract_name}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {s.clause_type && s.clause_type !== "general" && (
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-600">
                    {s.clause_type}
                  </span>
                )}
                <span
                  className={`text-[10px] font-semibold ${
                    s.relevance >= 80
                      ? "text-emerald-600"
                      : s.relevance >= 60
                        ? "text-amber-600"
                        : "text-gray-500"
                  }`}
                >
                  {s.relevance}%
                </span>
              </div>
            </div>
            <p className="mt-1 line-clamp-2 text-gray-500">{s.chunk_text}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ContractChat({ contractId }: { contractId?: string | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = contractId ? CONTRACT_SUGGESTIONS : PORTFOLIO_SUGGESTIONS;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || loading) return;

      setError(null);
      setInput("");
      setMessages((m) => [...m, { role: "user", content: q }]);
      setLoading(true);

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: q,
            contract_id: contractId ?? undefined,
          }),
        });

        const data = (await res.json()) as {
          answer?: string;
          sources?: ChatSource[];
          thinking?: ThinkingStep[];
          confidence?: number;
          router_decision?: "simple" | "complex";
          error?: string;
        };

        if (!res.ok) {
          throw new Error(data.error || `Request failed (${res.status})`);
        }

        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: data.answer || "No answer returned.",
            sources: data.sources ?? [],
            thinking: data.thinking ?? [],
            confidence: data.confidence,
            router_decision: data.router_decision,
          },
        ]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong.";
        setError(msg);
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "I couldn't complete that request. Please check your connection and try again.",
            sources: [],
            thinking: [],
          },
        ]);
      } finally {
        setLoading(false);
        // Return focus to input after response
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [contractId, loading],
  );

  return (
    <div className="flex h-[min(72vh,680px)] flex-col rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Messages area */}
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-2xl">
              💬
            </div>
            <div>
              <p className="font-semibold text-gray-800">
                Ask anything about your {contractId ? "contract" : "contracts"}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Powered by GraphRAG — I route, retrieve, and verify before
                answering.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) =>
          msg.role === "user" ? (
            /* ── User bubble ── */
            <div key={i} className="flex justify-end animate-fade-in-up">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gray-900 px-4 py-2.5 text-sm text-white shadow-sm">
                {msg.content}
              </div>
            </div>
          ) : (
            /* ── Assistant bubble ── */
            <div
              key={i}
              className="space-y-2 animate-fade-in-up"
              style={{ animationDelay: "50ms" }}
            >
              {/* Answer */}
              <div className="flex justify-start">
                <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-800 leading-relaxed shadow-sm">
                  {/* Preserve newlines in the answer */}
                  {msg.content.split("\n").map((line, li) =>
                    line.trim() === "" ? (
                      <br key={li} />
                    ) : (
                      <p key={li} className={li > 0 ? "mt-2" : ""}>
                        {line}
                      </p>
                    ),
                  )}
                </div>
              </div>

              {/* GraphRAG thinking trace */}
              {msg.thinking && msg.thinking.length > 0 && (
                <div className="pl-1">
                  <ThinkingTrace
                    steps={msg.thinking}
                    confidence={msg.confidence}
                    router_decision={msg.router_decision}
                  />
                </div>
              )}

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="pl-1">
                  <SourcesPanel sources={msg.sources} />
                </div>
              )}
            </div>
          ),
        )}

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-center gap-1.5 pl-2 animate-fade-in">
            <span
              className="h-2 w-2 rounded-full bg-gray-400 animate-chat-dot"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="h-2 w-2 rounded-full bg-gray-400 animate-chat-dot"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="h-2 w-2 rounded-full bg-gray-400 animate-chat-dot"
              style={{ animationDelay: "300ms" }}
            />
            <span className="ml-2 text-xs text-gray-400">
              GraphRAG is thinking…
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-100 bg-white p-3">
        {/* Suggestion chips */}
        {messages.length === 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={loading}
                onClick={() => void send(s)}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700 transition hover:border-gray-300 hover:bg-gray-100 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span>⚠️</span>
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-amber-600 hover:text-amber-800"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input row */}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              contractId
                ? "Ask about this contract…"
                : "Ask across all contracts…"
            }
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none ring-emerald-500 transition focus:border-emerald-400 focus:bg-white focus:ring-2 disabled:opacity-50"
            disabled={loading}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white transition hover:bg-gray-700 disabled:opacity-40"
            aria-label="Send"
          >
            <SendIcon className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
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
        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5"
      />
    </svg>
  );
}
