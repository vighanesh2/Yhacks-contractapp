"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) {
        setErr("Something went wrong. Try again.");
        return;
      }
      router.push(from.startsWith("/") ? from : "/dashboard");
      router.refresh();
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  const title = mode === "signup" ? "Create an account" : "Sign in";
  const subtitle =
    mode === "signup"
      ? "Demo mode: use any email and password."
      : "Demo mode: use any email and password.";
  const submitLabel = mode === "signup" ? "Sign up" : "Sign in";
  const altHref = mode === "signup" ? "/login" : "/signup";
  const altLabel = mode === "signup" ? "Sign in" : "Sign up";
  const altPrompt = mode === "signup" ? "Already have an account?" : "New here?";

  return (
    <div className="mx-auto w-full max-w-sm space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          {title}
        </h1>
        <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none ring-emerald-500/0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none ring-emerald-500/0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            placeholder="••••••••"
          />
        </div>

        {err && (
          <p className="text-sm text-red-600" role="alert">
            {err}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-gray-900 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
        >
          {pending ? "Please wait…" : submitLabel}
        </button>
      </form>

      <p className="text-center text-sm text-gray-600">
        {altPrompt}{" "}
        <Link
          href={altHref + (from !== "/dashboard" ? `?from=${encodeURIComponent(from)}` : "")}
          className="font-semibold text-emerald-600 hover:text-emerald-700"
        >
          {altLabel}
        </Link>
      </p>

      <p className="text-center text-xs text-gray-400">
        This is a demo: credentials are not stored or validated.
      </p>
    </div>
  );
}
