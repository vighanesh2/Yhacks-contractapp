import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10 py-4">
      <div className="space-y-3">
        <p className="text-sm font-medium text-emerald-700">ContractGuard 🛡️</p>
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Contract intelligence in one place
        </h1>
        <p className="text-lg leading-relaxed text-gray-600">
          Upload agreements, surface money at risk and leverage, then ask
          natural-language questions across your portfolio.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/dashboard"
          className="inline-flex h-12 items-center justify-center rounded-xl bg-gray-900 px-6 text-sm font-medium text-white hover:bg-gray-800"
        >
          Open dashboard
        </Link>
        <Link
          href="/upload"
          className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-300 bg-white px-6 text-sm font-medium text-gray-900 hover:bg-gray-50"
        >
          Upload a contract
        </Link>
        <Link
          href="/contracts"
          className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-300 bg-white px-6 text-sm font-medium text-gray-900 hover:bg-gray-50"
        >
          View contracts
        </Link>
      </div>
    </div>
  );
}
