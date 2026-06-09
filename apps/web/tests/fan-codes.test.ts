import assert from "node:assert/strict";
import test from "node:test";

import { hashBrowserDevice, hashFanCode, shouldBindDevice } from "../src/lib/fan-codes";

test("hashFanCode is stable across case and whitespace", () => {
  process.env.FAN_CODE_HASH_SECRET = "test-secret";

  const hash = hashFanCode(" URZIS-ABCD-2345-EF ");

  assert.equal(hash, hashFanCode("urzis-abcd-2345-ef"));
});

test("hashBrowserDevice includes user agent prefix and device id", () => {
  process.env.FAN_CODE_HASH_SECRET = "test-secret";

  const hash = hashBrowserDevice("device-1", "Mozilla/5.0");

  assert.equal(hash, hashBrowserDevice("device-1", "Mozilla/5.0"));
  assert.notEqual(hash, hashBrowserDevice("device-2", "Mozilla/5.0"));
});

test("shouldBindDevice follows configured bind mode", () => {
  assert.equal(shouldBindDevice("browserDevice"), true);
  assert.equal(shouldBindDevice("none"), false);
});
