import { NextRequest, NextResponse } from "next/server";

import { requestMagicLink } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/sign-in", request.url));
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { key: "auth-signin", limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  const form = await request.formData();
  const email = String(form.get("email") || "");
  try {
    await requestMagicLink(email, request.nextUrl.origin);
  } catch {
    return NextResponse.redirect(new URL("/sign-in?error=invalid-email", request.url));
  }

  return NextResponse.redirect(new URL("/sign-in?sent=1", request.url));
}
