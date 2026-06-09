import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { memoryRateLimit, rateLimitBackend, rateLimitReadiness } from "../src/lib/rate-limit";

test("memoryRateLimit allows up to the configured limit", () => {
  const input = { key: "test", limit: 2, windowMs: 1000 };
  const now = Date.now();
  const identifier = `test-${crypto.randomUUID()}`;

  assert.equal(memoryRateLimit(identifier, input, now).allowed, true);
  assert.equal(memoryRateLimit(identifier, input, now + 1).allowed, true);

  const limited = memoryRateLimit(identifier, input, now + 2);
  assert.equal(limited.allowed, false);
  assert.equal(limited.retryAfterSeconds, 1);
});

test("memoryRateLimit resets after the window", () => {
  const input = { key: "test", limit: 1, windowMs: 1000 };
  const now = Date.now();
  const identifier = `reset-${crypto.randomUUID()}`;

  assert.equal(memoryRateLimit(identifier, input, now).allowed, true);
  assert.equal(memoryRateLimit(identifier, input, now + 1).allowed, false);
  assert.equal(memoryRateLimit(identifier, input, now + 1001).allowed, true);
});

test("rateLimitReadiness rejects memory backend in production", () => {
  withEnv({ NODE_ENV: "production", RATE_LIMIT_BACKEND: "memory" }, () => {
    assert.throws(() => rateLimitReadiness(), /RATE_LIMIT_BACKEND=redis/);
  });
});

test("rateLimitReadiness requires Redis REST configuration", () => {
  withEnv({ NODE_ENV: "production", RATE_LIMIT_BACKEND: "redis", REDIS_REST_URL: "", REDIS_REST_TOKEN: "" }, () => {
    assert.throws(() => rateLimitReadiness(), /REDIS_REST_URL/);
  });
});

test("rateLimitBackend defaults to memory outside redis mode", () => {
  withEnv({ RATE_LIMIT_BACKEND: "" }, () => {
    assert.equal(rateLimitBackend(), "memory");
  });
});

function withEnv(env: Record<string, string>, run: () => void) {
  const previous = new Map(Object.keys(env).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }

  try {
    run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}
