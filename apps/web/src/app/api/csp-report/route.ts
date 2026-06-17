import { NextRequest, NextResponse } from "next/server";

import { recordCspReports } from "@/lib/csp-reports";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    recordCspReports(payload);
  } catch {
    // ignore malformed CSP reports
  }
  return new NextResponse(null, { status: 204 });
}
