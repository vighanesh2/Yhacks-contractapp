import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-6 py-24 font-sans dark:bg-black">
      <main className="flex w-full max-w-lg flex-col gap-8 text-center sm:text-left">
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            ContractGuard
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Contract review &amp; daily insights
          </h1>
          <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            Upload agreements, extract text, and chunk by contract structure for
            search and Q&amp;A.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-start">
          <Link
            href="/upload"
            className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Upload a contract
          </Link>
        </div>
      </main>
    </div>
  );
}
