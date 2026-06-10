import assert from "node:assert/strict";
import test from "node:test";

import { hasPermission } from "../src/lib/permissions";

test("fan code device management is limited to operational admin roles", () => {
  assert.equal(hasPermission("super_admin", "fan_codes.manage"), true);
  assert.equal(hasPermission("ops_admin", "fan_codes.manage"), true);
  assert.equal(hasPermission("support_admin", "fan_codes.manage"), false);
  assert.equal(hasPermission("creator", "fan_codes.manage"), false);
});
