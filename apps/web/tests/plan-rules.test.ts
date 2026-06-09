import assert from "node:assert/strict";
import test from "node:test";

import { assertCreatorPlanActive } from "../src/lib/plan-rules";

const now = new Date("2026-06-07T00:00:00.000Z");

test("assertCreatorPlanActive accepts an active unexpired plan", () => {
  assert.doesNotThrow(() =>
    assertCreatorPlanActive(
      {
        status: "active",
        expiresAt: new Date("2026-06-08T00:00:00.000Z"),
      },
      now,
    ),
  );
});

test("assertCreatorPlanActive rejects inactive plans", () => {
  assert.throws(
    () =>
      assertCreatorPlanActive(
        {
          status: "paused",
          expiresAt: new Date("2026-06-08T00:00:00.000Z"),
        },
        now,
      ),
    /Creator plan is not active/,
  );
});

test("assertCreatorPlanActive rejects expired plans", () => {
  assert.throws(
    () =>
      assertCreatorPlanActive(
        {
          status: "active",
          expiresAt: now,
        },
        now,
      ),
    /Creator plan is not active/,
  );
});
