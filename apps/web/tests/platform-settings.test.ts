import assert from "node:assert/strict";
import test from "node:test";

import { parsePlatformSettingValue, platformSettingDefinitionFor, platformSettingDefinitions } from "../src/lib/platform-setting-definitions";

test("platform settings include MVP provider and policy controls", () => {
  const keys = platformSettingDefinitions.map((setting) => setting.key);
  assert.equal(keys.includes("ai.chatModel"), true);
  assert.equal(keys.includes("integrations.wechatLogin"), false);
  // The payments/checkout setting was removed from the admin UI (checkoutMode
  // still defaults to "manual-only" at runtime).
  assert.equal(keys.includes("payments.checkout"), false);
});

test("parsePlatformSettingValue accepts configured enum and numeric values", () => {
  const moderation = platformSettingDefinitionFor("security.contentModeration");
  assert.ok(moderation);
  assert.equal(parsePlatformSettingValue(moderation, "strict"), "strict");

  const maxLength = platformSettingDefinitionFor("security.maxFanMessageLength");
  assert.ok(maxLength);
  assert.equal(parsePlatformSettingValue(maxLength, 1200), 1200);
});

test("parsePlatformSettingValue rejects unsupported or unsafe values", () => {
  const moderation = platformSettingDefinitionFor("security.contentModeration");
  assert.ok(moderation);
  assert.throws(() => parsePlatformSettingValue(moderation, "crypto-moon-mode"), /Unsupported value/);

  const maxLength = platformSettingDefinitionFor("security.maxFanMessageLength");
  assert.ok(maxLength);
  assert.throws(() => parsePlatformSettingValue(maxLength, 0));
  assert.throws(() => parsePlatformSettingValue(maxLength, 10001));
});
