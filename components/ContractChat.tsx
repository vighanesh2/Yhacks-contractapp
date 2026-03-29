"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ChatSource = {
  section_number: string;
  section_title: string;
  chunk_text: string;
  relevance: number;
  contract_name?: string;
};

type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; sources: ChatSource[] };

const ALL_SUGGESTIONS = [
  "What happens if I pay late?",
  "Show me all auto-renewal clauses",
  "What's my total liability exposure?",
  "Which contracts expire this quarter?",
  "Where do I have leverage to renegotiate?",
];

const CONTRACT_SUGGESTIONS = [
  "What are the payment terms?",
  "What happens if I terminate early?",
  "Are there any hidden fees?",
  "When does this contract expire?",
];

export function ContractChat({ contractId }: { contractId?: string | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const suggestions = contractId ? CONTRACT_SUGGESTIONS : ALL_SUGGESTIONS;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || loading) return;
      setError(null);
      setMessages((m) => [...m, { role: "user", content: q }]);
      setInput("");
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
          },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "Sorry — I couldn’t complete that request. Check your connection and API configuration.",
            sources: [],
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [contractId, loading],
  );

  return (
    <div className="flex h-[min(70vh,640px)] flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-500">
            Ask anything about your{" "}
            {contractId ? "contract" : "contracts"}. Suggested questions below.
          </p>
        )}
        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gray-900 px-4 py-2 text-sm text-white">
                {msg.content}
              </div>
            </div>
          ) : (
            <div key={i} className="space-y-2">
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-800">
                  {msg.content}
                </div>
              </div>
              {msg.sources.length > 0 && (
                <details className="ml-1 text-xs">
                  <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-900">
                    Sources ({msg.sources.length})
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {msg.sources.map((s, j) => (
                      <li
                        key={j}
                        className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600"
                      >
                        <span className="font-medium text-gray-800">
                          §{s.section_number || "?"} {s.section_title}
                        </span>
                        {s.contract_name ? (
                          <span className="text-gray-400"> · {s.contract_name}</span>
                        ) : null}
                        <span className="ml-2 text-emerald-600">
                          {s.relevance}% match
                        </span>
                        <p className="mt-1 line-clamp-2 text-gray-500">{s.chunk_text}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ),
        )}
        {loading && (
          <div className="flex items-center gap-1.5 pl-2">
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
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-100 p-3">
        <div className="mb-2 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={loading}
              onClick={() => void send(s)}
              className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        {error && (
          <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none ring-gray-900 focus:ring-2"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
