import { NextRequest, NextResponse } from "next/server";

import { signInWithPassword } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/sign-in", request.url));
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { key: "auth-signin", limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  const form = await request.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");

  try {
    const response = NextResponse.redirect(new URL("/", request.url));
    const redirectPath = await signInWithPassword(username, password, response);
    response.headers.set("Location", new URL(redirectPath, request.url).toString());
    return response;
  } catch {
    return NextResponse.redirect(new URL("/sign-in?error=invalid-credentials", request.url));
  }
}
