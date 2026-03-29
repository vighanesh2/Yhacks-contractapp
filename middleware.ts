import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { AUTH_COOKIE_NAME, AUTH_COOKIE_VALUE } from "@/lib/auth-constants";

export function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (token === AUTH_COOKIE_VALUE) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  if (url.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  url.pathname = "/login";
  url.searchParams.set("from", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/upload/:path*",
    "/contracts/:path*",
    "/api/contracts/:path*",
    "/api/compare",
    "/api/search",
    "/api/ask",
    "/api/dashboard/:path*",
    "/api/actions",
  ],
};
