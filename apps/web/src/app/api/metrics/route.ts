import { NextRequest, NextResponse } from "next/server";

import { renderPrometheusMetrics } from "@/lib/metrics";

export async function GET(request: NextRequest) {
  const token = process.env.METRICS_BEARER_TOKEN;
  if (token) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${token}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }
  return new NextResponse(renderPrometheusMetrics(), {
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8", "Cache-Control": "no-store" },
  });
}
