"use client";

import { useState } from "react";
import Link from "next/link";

type UploadResponse = {
  fileName: string;
  textLength: number;
  chunkCount: number;
  chunks: Array<{
    index: number;
    sectionNumber: string | null;
    sectionTitle: string | null;
    pageEstimate: number;
    text: string;
  }>;
};

export default function UploadPage() {
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem(
      "file"
    ) as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      setStatus("error");
      setMessage("Choose a PDF or DOCX file.");
      return;
    }

    setStatus("uploading");
    setMessage(null);
    setResult(null);

    const body = new FormData();
    body.append("file", file);

    try {
      const res = await fetch("/api/contracts/upload", {
        method: "POST",
        body,
      });
      const data = (await res.json()) as UploadResponse & { error?: string };
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? `Upload failed (${res.status})`);
        return;
      }
      setStatus("done");
      setResult(data);
    } catch {
      setStatus("error");
      setMessage("Network error.");
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          ContractGuard
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Upload a contract
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          PDF or DOCX. Text is extracted and split into section-aware chunks for
          the RAG pipeline.
        </p>
        <Link
          href="/"
          className="inline-block text-sm font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
        >
          ← Back home
        </Link>
      </header>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          File
          <input
            name="file"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="text-sm font-normal file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-zinc-900 dark:file:bg-zinc-800 dark:file:text-zinc-100"
          />
        </label>
        <button
          type="submit"
          disabled={status === "uploading"}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {status === "uploading" ? "Processing…" : "Upload & chunk"}
        </button>
      </form>

      {message && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {message}
        </p>
      )}

      {result && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Result
          </h2>
          <dl className="grid grid-cols-1 gap-2 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-3">
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">File</dt>
              <dd className="font-medium">{result.fileName}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Characters</dt>
              <dd className="font-medium">{result.textLength}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Chunks</dt>
              <dd className="font-medium">{result.chunkCount}</dd>
            </div>
          </dl>
          <ul className="max-h-[480px] space-y-3 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            {result.chunks.map((c) => (
              <li
                key={c.index}
                className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="mb-2 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>#{c.index}</span>
                  {c.sectionNumber && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                      {c.sectionNumber}
                    </span>
                  )}
                  {c.sectionTitle && <span>{c.sectionTitle}</span>}
                  <span>~p.{c.pageEstimate}</span>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-zinc-800 dark:text-zinc-200">
                  {c.text.length > 600 ? `${c.text.slice(0, 600)}…` : c.text}
                </pre>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
