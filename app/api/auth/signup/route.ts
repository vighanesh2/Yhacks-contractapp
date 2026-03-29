import { NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_VALUE,
} from "@/lib/auth-constants";

export const runtime = "nodejs";

/** Demo signup — same as login: sets session cookie, no persistence. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE_NAME, AUTH_COOKIE_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
