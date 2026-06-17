import { NextRequest, NextResponse } from "next/server";

import { clearCurrentSession } from "@/auth";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url));
  await clearCurrentSession(request, response);
  return response;
}

export async function POST(request: NextRequest) {
  return GET(request);
}
