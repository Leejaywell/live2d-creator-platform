import { NextRequest, NextResponse } from "next/server";

import { renderPrometheusMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const expectedToken = process.env.METRICS_BEARER_TOKEN;
  if (expectedToken) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (process.env.NODE_ENV === "production" && !expectedToken) {
    return NextResponse.json({ error: "METRICS_BEARER_TOKEN is required in production" }, { status: 503 });
  }

  return new NextResponse(renderPrometheusMetrics(), {
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
