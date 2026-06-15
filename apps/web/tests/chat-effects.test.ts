import assert from "node:assert/strict";
import test from "node:test";

import { buildTriggeredLive2DEffects } from "../src/lib/chat-effects";

test("buildTriggeredLive2DEffects normalizes configured params and expression fallback", () => {
  const effects = buildTriggeredLive2DEffects({
    tags: ["脸红", "安慰"],
    triggerTags: [
      {
        name: "脸红",
        live2dParams: { Param5: 1, ParamBrowLAngle: 0.75, ignored: "bad" },
      },
      {
        name: "安慰",
        live2dExpression: "Param3=0.5",
        live2dParams: [{ id: "ParamSmile", value: 1 }],
      },
      {
        name: "未触发",
        live2dParams: { ParamSkip: 1 },
      },
    ],
  });

  assert.deepEqual(effects, [
    {
      tag: "脸红",
      params: [
        { id: "Param5", value: 1 },
        { id: "ParamBrowLAngle", value: 0.75 },
      ],
    },
    {
      tag: "安慰",
      params: [
        { id: "ParamSmile", value: 1 },
        { id: "Param3", value: 0.5 },
      ],
    },
  ]);
});

test("buildTriggeredLive2DEffects extracts model expression names", () => {
  const effects = buildTriggeredLive2DEffects({
    tags: ["高兴"],
    triggerTags: [
      {
        name: "高兴",
        live2dExpression: "happy_face",
        live2dParams: {},
      },
    ],
  });

  assert.deepEqual(effects, [
    {
      tag: "高兴",
      params: [],
      expression: "happy_face",
    },
  ]);
});
