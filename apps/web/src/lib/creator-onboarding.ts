import { prisma } from "@/lib/prisma";
import { buildTrialPlanData } from "@/lib/trial-plan";

// Idempotently guarantees the creator has a plan. New creators get a trial plan
// so they can self-serve without an admin opening one first. Existing plans
// (trial or paid) are left untouched.
export async function ensureCreatorPlan(creatorId: string, now = new Date()) {
  const existing = await prisma.creatorPlan.findUnique({ where: { creatorId } });
  if (existing) return existing;
  return prisma.creatorPlan.create({ data: buildTrialPlanData(creatorId, now) });
}
