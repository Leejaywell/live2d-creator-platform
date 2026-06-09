import { NextRequest, NextResponse } from "next/server";

import { recordCspReports } from "@/lib/csp-reports";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { key: "csp-report", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const body = await request.text();
  if (body.length > 64 * 1024) {
    return NextResponse.json({ error: "CSP report too large" }, { status: 413 });
  }

  try {
    recordCspReports(JSON.parse(body));
  } catch {
    return NextResponse.json({ error: "Invalid CSP report" }, { status: 400 });
  }

  return new NextResponse(null, { status: 204 });
}
