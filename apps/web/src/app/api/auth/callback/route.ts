import { NextRequest, NextResponse } from "next/server";

import { consumeMagicLink } from "@/auth";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url));
  const email = request.nextUrl.searchParams.get("email") || "";
  const token = request.nextUrl.searchParams.get("token") || "";

  try {
    const redirectPath = await consumeMagicLink(email, token, response);
    response.headers.set("Location", new URL(redirectPath, request.url).toString());
    return response;
  } catch {
    return NextResponse.redirect(new URL("/sign-in?error=invalid-link", request.url));
  }
}
