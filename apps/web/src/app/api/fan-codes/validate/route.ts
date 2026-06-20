import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkFanCodeRateLimit, recordFanCodeFailure, resetFanCodeFailures } from "@/lib/fan-code-rate-limit";
import { validateFanCode } from "@/lib/fan-code-service";
import { rateLimit } from "@/lib/rate-limit";
import { isInvalidRequestError, jsonError, parseBody } from "@/lib/request";

const schema = z.object({
  projectSlug: z.string().min(1),
  code: z.string().min(4),
  browserDeviceId: z.string().min(8),
});

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { key: "fan-code-validate", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const ip = clientIp(request);
  const bruteForce = checkFanCodeRateLimit(ip);
  if (bruteForce.blocked) {
    return NextResponse.json(
      { error: "尝试次数过多，请稍后再试。" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((bruteForce.retryAfterMs ?? 0) / 1000)) } },
    );
  }

  try {
    const body = await parseBody(request, schema);
    const result = await validateFanCode({ ...body, userAgent: request.headers.get("user-agent") ?? "" });
    resetFanCodeFailures(ip);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError || isInvalidRequestError(error)) {
      return jsonError(error, "Invalid request");
    }
    // Only a genuinely unknown project/code looks like brute-force guessing.
    // Valid-but-rejected codes (expired/revoked, quota exhausted, device-bound,
    // unpublished project, inactive creator/plan) belong to real users and must
    // not trip the IP-level failure counter.
    if (error instanceof Error && error.message === "Invalid project or access code") {
      recordFanCodeFailure(ip);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Access denied" },
      { status: 403 },
    );
  }
}
