import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkFanCodeRateLimit, recordFanCodeFailure, resetFanCodeFailures } from "@/lib/fan-code-rate-limit";
import { validateFanCode } from "@/lib/fan-code-service";
import { logEvent, recordApiRequest } from "@/lib/metrics";
import { rateLimit } from "@/lib/rate-limit";
import { isInvalidRequestError, jsonError, parseBody } from "@/lib/request";

const requestSchema = z.object({
  projectSlug: z.string().min(1),
  code: z.string().min(4),
  browserDeviceId: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const startedAt = performance.now();
  const limited = await rateLimit(request, { key: "fan-code-validate", limit: 30, windowMs: 60_000 });
  if (limited) {
    recordApiRequest({ route: "/api/fan-codes/validate", method: "POST", status: 429, durationMs: performance.now() - startedAt });
    return limited;
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const bruteForceCheck = checkFanCodeRateLimit(ip);
  if (bruteForceCheck.blocked) {
    recordApiRequest({ route: "/api/fan-codes/validate", method: "POST", status: 429, durationMs: performance.now() - startedAt });
    return NextResponse.json(
      { error: "Too many failed attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((bruteForceCheck.retryAfterMs ?? 0) / 1000)) } },
    );
  }

  try {
    const body = await parseBody(request, requestSchema);
    const result = await validateFanCode({
      ...body,
      userAgent: request.headers.get("user-agent") ?? "",
    });
    resetFanCodeFailures(ip);
    recordApiRequest({ route: "/api/fan-codes/validate", method: "POST", status: 200, durationMs: performance.now() - startedAt });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError || isInvalidRequestError(error)) {
      recordApiRequest({ route: "/api/fan-codes/validate", method: "POST", status: 400, durationMs: performance.now() - startedAt });
      return jsonError(error, "Invalid request");
    }
    recordFanCodeFailure(ip);
    logEvent("warn", "fan_code_validation_failed", { error: error instanceof Error ? error.message : "Access denied" });
    recordApiRequest({ route: "/api/fan-codes/validate", method: "POST", status: 403, durationMs: performance.now() - startedAt });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Access denied" }, { status: 403 });
  }
}
