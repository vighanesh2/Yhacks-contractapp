import Link from "next/link";
import { Suspense } from "react";

import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <p className="mb-8 text-center">
        <Link
          href="/"
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          ← Back to home
        </Link>
      </p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-gray-100" />}>
        <AuthForm mode="login" />
      </Suspense>
    </div>
  );
}
