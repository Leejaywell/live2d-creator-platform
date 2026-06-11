import assert from "node:assert/strict";
import test from "node:test";

import { parseModelCapabilities } from "../src/lib/model-capabilities";

test("parseModelCapabilities extracts named expressions and motion groups", () => {
  const model3 = {
    Version: 3,
    FileReferences: {
      Moc: "m.moc3",
      Expressions: [
        { Name: "Blushing", File: "expressions/Blushing.exp3.json" },
        { Name: "Smile", File: "expressions/Smile.exp3.json" },
      ],
      Motions: {
        Tap: [{ File: "motion/izumi_02.motion3.json" }, { File: "motion/izumi_05.motion3.json" }],
        Idle: [{ File: "motion/izumi_03.motion3.json" }],
      },
    },
  };
  const caps = parseModelCapabilities(model3);
  assert.deepEqual(caps.expressions, [
    { name: "Blushing", file: "expressions/Blushing.exp3.json" },
    { name: "Smile", file: "expressions/Smile.exp3.json" },
  ]);
  assert.deepEqual(
    caps.motions.map((m) => `${m.group}#${m.index}`),
    ["Tap#0", "Tap#1", "Idle#0"],
  );
});

test("parseModelCapabilities handles a single unnamed motion group and no expressions", () => {
  const model3 = {
    Version: 3,
    FileReferences: { Moc: "b.moc3", Motions: { "": [{ File: "motions/idle.motion3.json" }, { File: "motions/touch_head.motion3.json" }] } },
  };
  const caps = parseModelCapabilities(model3);
  assert.deepEqual(caps.expressions, []);
  assert.equal(caps.motions.length, 2);
  assert.equal(caps.motions[1].group, "");
  assert.equal(caps.motions[1].file, "motions/touch_head.motion3.json");
});

test("parseModelCapabilities returns empty capabilities for malformed input", () => {
  assert.deepEqual(parseModelCapabilities(null), { expressions: [], motions: [] });
  assert.deepEqual(parseModelCapabilities({}), { expressions: [], motions: [] });
});
