import assert from "node:assert/strict";
import test from "node:test";

import { assertFanCodeCanUnlockProject } from "../src/lib/fan-code-rules";

test("fan codes unlock only published projects", () => {
  assert.doesNotThrow(() => assertFanCodeCanUnlockProject({ status: "published" }));
  assert.throws(() => assertFanCodeCanUnlockProject({ status: "draft" }), /not published/);
  assert.throws(() => assertFanCodeCanUnlockProject({ status: "paused" }), /not published/);
});
