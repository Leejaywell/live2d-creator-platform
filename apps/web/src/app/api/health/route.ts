import { NextRequest, NextResponse } from "next/server";

import { logEvent, recordApiRequest } from "@/lib/metrics";
import { runReadinessChecks, type ReadinessMode } from "@/lib/readiness";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  const mode = readinessMode(request.nextUrl.searchParams.get("mode"));
  const report = await runReadinessChecks({ mode });
  const status = report.ok ? 200 : 503;
  recordApiRequest({ route: "/api/health", method: "GET", status, durationMs: performance.now() - startedAt });
  if (!report.ok) {
    logEvent("warn", "readiness_failed", {
      mode,
      failedChecks: report.checks.filter((check) => !check.ok).map((check) => check.name),
    });
  }
  return NextResponse.json(report, { status });
}

function readinessMode(value: string | null): ReadinessMode {
  return value === "full" ? "full" : "basic";
}
