type FailureRecord = {
  count: number;
  firstFailureAt: number;
  blockedUntil: number;
};

const FAILURE_WINDOW_MS = 10 * 60_000; // 10 minutes
const BLOCK_TIER_1 = { threshold: 5, blockMs: 15 * 60_000 }; // 5 failures → 15 min block
const BLOCK_TIER_2 = { threshold: 10, blockMs: 60 * 60_000 }; // 10 failures → 60 min block

const globalForFanCodeRateLimit = globalThis as unknown as {
  fanCodeFailures?: Map<string, FailureRecord>;
};

function failures() {
  if (!globalForFanCodeRateLimit.fanCodeFailures) {
    globalForFanCodeRateLimit.fanCodeFailures = new Map();
  }
  return globalForFanCodeRateLimit.fanCodeFailures;
}

export function checkFanCodeRateLimit(
  ip: string,
  now = Date.now(),
): { blocked: boolean; retryAfterMs?: number } {
  const record = failures().get(ip);
  if (!record) {
    return { blocked: false };
  }

  if (record.blockedUntil > now) {
    return { blocked: true, retryAfterMs: record.blockedUntil - now };
  }

  // Block expired — if the failure window also expired, clean up
  if (record.firstFailureAt + FAILURE_WINDOW_MS <= now) {
    failures().delete(ip);
  }

  return { blocked: false };
}

export function recordFanCodeFailure(ip: string, now = Date.now()): void {
  const map = failures();
  const existing = map.get(ip);

  if (!existing || existing.firstFailureAt + FAILURE_WINDOW_MS <= now) {
    map.set(ip, { count: 1, firstFailureAt: now, blockedUntil: 0 });
    cleanup(map, now);
    return;
  }

  existing.count += 1;

  if (existing.count >= BLOCK_TIER_2.threshold) {
    existing.blockedUntil = now + BLOCK_TIER_2.blockMs;
  } else if (existing.count >= BLOCK_TIER_1.threshold) {
    existing.blockedUntil = now + BLOCK_TIER_1.blockMs;
  }

  cleanup(map, now);
}

export function resetFanCodeFailures(ip: string): void {
  failures().delete(ip);
}

function cleanup(map: Map<string, FailureRecord>, now: number) {
  if (map.size > 10000) {
    for (const [key, record] of map.entries()) {
      if (record.blockedUntil <= now && record.firstFailureAt + FAILURE_WINDOW_MS <= now) {
        map.delete(key);
      }
    }
  }
}
