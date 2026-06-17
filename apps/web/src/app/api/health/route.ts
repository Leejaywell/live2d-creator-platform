import { NextRequest, NextResponse } from "next/server";

import { runReadinessChecks } from "@/lib/readiness";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "full" ? "full" : "basic";
  const report = await runReadinessChecks({ mode });
  return NextResponse.json(report, { status: report.ok ? 200 : 503 });
}
