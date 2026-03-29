import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, AUTH_COOKIE_VALUE } from "@/lib/auth-constants";

export const runtime = "nodejs";

export async function GET() {
  const jar = await cookies();
  const ok = jar.get(AUTH_COOKIE_NAME)?.value === AUTH_COOKIE_VALUE;
  return NextResponse.json({ authenticated: ok });
}
