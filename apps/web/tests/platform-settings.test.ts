import assert from "node:assert/strict";
import test from "node:test";

import { parsePlatformSettingValue, platformSettingDefinitionFor, platformSettingDefinitions } from "../src/lib/platform-setting-definitions";

test("platform settings include MVP provider and policy controls", () => {
  const keys = platformSettingDefinitions.map((setting) => setting.key);
  assert.equal(keys.includes("ai.chatModel"), true);
  assert.equal(keys.includes("integrations.wechatLogin"), true);
  assert.equal(keys.includes("payments.checkout"), true);
  assert.equal(keys.includes("voiceCloning.fulfillment"), true);
});

test("parsePlatformSettingValue accepts configured enum and numeric values", () => {
  const checkout = platformSettingDefinitionFor("payments.checkout");
  assert.ok(checkout);
  assert.equal(parsePlatformSettingValue(checkout, "manual-only"), "manual-only");

  const maxLength = platformSettingDefinitionFor("security.maxFanMessageLength");
  assert.ok(maxLength);
  assert.equal(parsePlatformSettingValue(maxLength, 1200), 1200);
});

test("voice clone fulfillment is disabled by default", () => {
  const voiceCloning = platformSettingDefinitionFor("voiceCloning.fulfillment");
  assert.ok(voiceCloning);
  assert.equal(voiceCloning.defaultValue, "disabled");
});

test("parsePlatformSettingValue rejects unsupported or unsafe values", () => {
  const checkout = platformSettingDefinitionFor("payments.checkout");
  assert.ok(checkout);
  assert.throws(() => parsePlatformSettingValue(checkout, "crypto-moon-mode"), /Unsupported value/);

  const maxLength = platformSettingDefinitionFor("security.maxFanMessageLength");
  assert.ok(maxLength);
  assert.throws(() => parsePlatformSettingValue(maxLength, 0));
  assert.throws(() => parsePlatformSettingValue(maxLength, 10001));
});
