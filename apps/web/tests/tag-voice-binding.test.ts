import assert from "node:assert/strict";
import test from "node:test";

import { setTagVoicesData } from "../src/lib/tag-voice-binding";

test("setTagVoicesData builds a Prisma set payload from voice ids", () => {
  assert.deepEqual(setTagVoicesData(["v1", "v2"]), { voiceAssets: { set: [{ id: "v1" }, { id: "v2" }] } });
});

test("setTagVoicesData clears bindings when given no ids", () => {
  assert.deepEqual(setTagVoicesData([]), { voiceAssets: { set: [] } });
});

test("setTagVoicesData de-duplicates ids", () => {
  assert.deepEqual(setTagVoicesData(["v1", "v1", "v2"]), { voiceAssets: { set: [{ id: "v1" }, { id: "v2" }] } });
});
