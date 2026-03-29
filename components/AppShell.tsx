"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const APP_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload" },
  { href: "/contracts", label: "Contracts" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = (await res.json()) as { authenticated?: boolean };
      setAuthed(!!data.authenticated);
    } catch {
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [pathname, refreshAuth]);

  const onLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthed(false);
    router.push("/");
    router.refresh();
  };

  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isHome = pathname === "/";

  return (
    <div className="flex min-h-full flex-col bg-white">
      <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-gray-950"
          >
            DealWithIt
          </Link>
          <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
            {!isAuthPage && (
              <Link
                href="/"
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  isHome
                    ? "bg-emerald-600 text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                Home
              </Link>
            )}

            {authed === true &&
              APP_LINKS.map(({ href, label }) => {
                const active =
                  pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? "bg-emerald-600 text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}

            {authed === false && !isAuthPage && (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800"
                >
                  Sign up
                </Link>
              </>
            )}

            {authed === true && (
              <button
                type="button"
                onClick={() => void onLogout()}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
              >
                Sign out
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 pt-6 sm:pt-8">{children}</main>
    </div>
  );
}
