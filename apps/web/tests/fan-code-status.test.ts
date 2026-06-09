import assert from "node:assert/strict";
import test from "node:test";

import { fanCodeDisplayStatus, FanCodeStatusInput } from "../src/lib/fan-code-status";

const now = new Date("2026-06-07T00:00:00.000Z");

function code(overrides: Partial<FanCodeStatusInput> = {}): FanCodeStatusInput {
  return {
    status: "active",
    expiresAt: new Date("2026-06-08T00:00:00.000Z"),
    usedMessages: 0,
    maxMessages: 3,
    boundDeviceHash: null,
    ...overrides,
  };
}

test("fanCodeDisplayStatus prioritizes revoked access codes", () => {
  assert.equal(
    fanCodeDisplayStatus(
      code({
        status: "revoked",
        expiresAt: new Date("2026-06-06T00:00:00.000Z"),
        usedMessages: 3,
        boundDeviceHash: "device",
      }),
      now,
    ),
    "revoked",
  );
});

test("fanCodeDisplayStatus reports expired and used-up codes", () => {
  assert.equal(fanCodeDisplayStatus(code({ expiresAt: new Date("2026-06-06T00:00:00.000Z") }), now), "expired");
  assert.equal(fanCodeDisplayStatus(code({ usedMessages: 3 }), now), "used up");
});

test("fanCodeDisplayStatus reports bound and unused active codes", () => {
  assert.equal(fanCodeDisplayStatus(code({ boundDeviceHash: "device" }), now), "bound");
  assert.equal(fanCodeDisplayStatus(code(), now), "unused");
});
