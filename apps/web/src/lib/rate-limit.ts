import { NextRequest, NextResponse } from "next/server";

import { incrementCounter } from "@/lib/metrics";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
};

const globalForRateLimit = globalThis as unknown as {
  rateLimitBuckets?: Map<string, Bucket>;
};

function buckets() {
  if (!globalForRateLimit.rateLimitBuckets) {
    globalForRateLimit.rateLimitBuckets = new Map();
  }
  return globalForRateLimit.rateLimitBuckets;
}

export async function rateLimit(request: NextRequest, input: RateLimitInput) {
  const ip = clientIp(request);
  const result = await rateLimitIdentifier(`${input.key}:${ip}`, input);
  if (result.allowed) {
    return null;
  }

  incrementCounter("live2d_rate_limit_rejections_total", "Total rate-limit rejections.", {
    key: input.key,
    backend: rateLimitBackend(),
  });
  return tooManyRequests(result.retryAfterSeconds);
}

export async function rateLimitIdentifier(identifier: string, input: RateLimitInput) {
  if (rateLimitBackend() === "redis") {
    return redisRateLimit(identifier, input);
  }
  return memoryRateLimit(identifier, input);
}

export function rateLimitBackend() {
  return process.env.RATE_LIMIT_BACKEND === "redis" ? "redis" : "memory";
}

export function rateLimitReadiness() {
  if (rateLimitBackend() === "redis") {
    if (!process.env.REDIS_REST_URL || !process.env.REDIS_REST_TOKEN) {
      throw new Error("REDIS_REST_URL and REDIS_REST_TOKEN are required when RATE_LIMIT_BACKEND=redis");
    }
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("RATE_LIMIT_BACKEND=redis is required for multi-instance production");
  }
}

export async function checkRedisRateLimitConnection() {
  if (rateLimitBackend() !== "redis") return;
  await redisCommand(["PING"]);
}

export function memoryRateLimit(identifier: string, input: RateLimitInput, now = Date.now()) {
  const map = buckets();
  const existing = map.get(identifier);

  if (!existing || existing.resetAt <= now) {
    map.set(identifier, { count: 1, resetAt: now + input.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= input.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  if (map.size > 10000) {
    for (const [key, bucket] of map.entries()) {
      if (bucket.resetAt <= now) {
        map.delete(key);
      }
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

function clientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

async function redisRateLimit(identifier: string, input: RateLimitInput) {
  const key = `rate-limit:${identifier}`;
  const windowSeconds = Math.max(1, Math.ceil(input.windowMs / 1000));
  const responses = await redisCommand([
    ["INCR", key],
    ["EXPIRE", key, String(windowSeconds), "NX"],
    ["TTL", key],
  ]);

  const count = Number(responses[0]?.result ?? 0);
  const ttl = Number(responses[2]?.result ?? windowSeconds);
  return count > input.limit
    ? { allowed: false, retryAfterSeconds: Math.max(1, ttl) }
    : { allowed: true, retryAfterSeconds: 0 };
}

async function redisCommand(command: string[] | string[][]) {
  const baseUrl = process.env.REDIS_REST_URL;
  const token = process.env.REDIS_REST_TOKEN;
  if (!baseUrl || !token) {
    throw new Error("Redis REST rate limit environment is not configured");
  }

  const isPipeline = Array.isArray(command[0]);
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/${isPipeline ? "pipeline" : ""}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(isPipeline ? command : command),
  });

  if (!response.ok) {
    throw new Error(`Redis REST command failed with status ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [data];
}

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}
