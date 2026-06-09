const defaultPlanDurationMs = 30 * 24 * 60 * 60 * 1000;

export function defaultPlanExpiresAt(startsAt = new Date()) {
  return new Date(startsAt.getTime() + defaultPlanDurationMs);
}

export function assertFuturePlanExpiration(expiresAt: Date, now = new Date()) {
  if (expiresAt <= now) {
    throw new Error("Plan expiration must be in the future");
  }
}

export function resolveManualOrderPlanPeriod(input: { periodStart?: Date | null; periodEnd?: Date | null }, now = new Date()) {
  const startsAt = input.periodStart ?? now;
  const expiresAt = input.periodEnd ?? defaultPlanExpiresAt(startsAt);

  assertFuturePlanExpiration(expiresAt, now);
  if (expiresAt <= startsAt) {
    throw new Error("Plan period end must be after the start");
  }

  return { startsAt, expiresAt };
}
