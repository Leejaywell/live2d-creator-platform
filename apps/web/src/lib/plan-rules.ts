export type CreatorPlanForRules = {
  status: string;
  expiresAt: Date;
};

export function assertCreatorPlanActive(plan: CreatorPlanForRules, now = new Date()) {
  if (plan.status !== "active" || plan.expiresAt <= now) {
    throw new Error("Creator plan is not active");
  }
}
