import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod";

import { optionalJsonString } from "../src/lib/json-field";

test("optionalJsonString parses valid JSON values", () => {
  const schema = z.object({ live2dParams: optionalJsonString("live2dParams must be valid JSON") });

  const result = schema.parse({ live2dParams: '{"ParamSmile":1}' });

  assert.deepEqual(result.live2dParams, { ParamSmile: 1 });
});

test("optionalJsonString treats empty input as omitted", () => {
  const schema = z.object({ live2dParams: optionalJsonString("live2dParams must be valid JSON") });

  const result = schema.parse({ live2dParams: "" });

  assert.equal(result.live2dParams, undefined);
});

test("optionalJsonString reports invalid JSON as a validation issue", () => {
  const schema = z.object({ live2dParams: optionalJsonString("live2dParams must be valid JSON") });
  const result = schema.safeParse({ live2dParams: "{bad-json" });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues[0].message, "live2dParams must be valid JSON");
    assert.deepEqual(result.error.issues[0].path, ["live2dParams"]);
  }
});
