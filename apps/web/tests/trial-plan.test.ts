import assert from "node:assert/strict";
import test from "node:test";

import { TRIAL_PLAN_DEFAULTS, buildTrialPlanData } from "../src/lib/trial-plan";

const now = new Date("2026-06-12T00:00:00.000Z");

test("buildTrialPlanData produces an active trial plan for the creator", () => {
  const data = buildTrialPlanData("creator-1", now);
  assert.equal(data.creatorId, "creator-1");
  assert.equal(data.tier, "trial");
  assert.equal(data.status, "active");
  assert.equal(data.planName, TRIAL_PLAN_DEFAULTS.planName);
  assert.equal(data.maxProjects, TRIAL_PLAN_DEFAULTS.maxProjects);
  assert.equal(data.startsAt.toISOString(), now.toISOString());
});

test("buildTrialPlanData sets expiry to the configured trial length", () => {
  const data = buildTrialPlanData("creator-1", now);
  const expectedExpiry = new Date(now.getTime() + TRIAL_PLAN_DEFAULTS.durationDays * 24 * 60 * 60 * 1000);
  assert.equal(data.expiresAt.toISOString(), expectedExpiry.toISOString());
});
