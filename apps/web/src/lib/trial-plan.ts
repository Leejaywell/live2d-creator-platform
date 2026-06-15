export const TRIAL_PLAN_DEFAULTS = {
  planName: "试用",
  maxProjects: 1,
  monthlyAiMessageLimit: 300,
  fanCodeQuota: 30,
  durationDays: 30,
} as const;

// Pure builder for a new creator's default trial plan. Kept separate from the
// Prisma wrapper so it can be unit-tested without a database.
export function buildTrialPlanData(creatorId: string, now = new Date()) {
  return {
    creatorId,
    planName: TRIAL_PLAN_DEFAULTS.planName,
    tier: "trial" as const,
    status: "active" as const,
    startsAt: now,
    expiresAt: new Date(now.getTime() + TRIAL_PLAN_DEFAULTS.durationDays * 24 * 60 * 60 * 1000),
    maxProjects: TRIAL_PLAN_DEFAULTS.maxProjects,
    storageLimitMb: 0,
    monthlyAiMessageLimit: TRIAL_PLAN_DEFAULTS.monthlyAiMessageLimit,
    fanCodeQuota: TRIAL_PLAN_DEFAULTS.fanCodeQuota,
  };
}
