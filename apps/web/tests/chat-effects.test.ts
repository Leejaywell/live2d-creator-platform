import assert from "node:assert/strict";
import test from "node:test";

import { buildTriggeredLive2DEffects, buildTriggeredVoiceAssets } from "../src/lib/chat-effects";

test("buildTriggeredVoiceAssets returns protected voice proxy URLs for triggered tags", () => {
  const voices = buildTriggeredVoiceAssets({
    tags: ["安慰", "脸红"],
    viewerSessionId: "viewer-123",
    triggerTags: [
      {
        name: "安慰",
        voiceAssets: [
          {
            id: "voice-1",
            name: "comfort",
            audioUrl: "s3://live2d-creator-platform/projects/p1/voices/voice-1.mp3",
            status: "active",
          },
          {
            id: "voice-disabled",
            name: "disabled",
            audioUrl: "s3://live2d-creator-platform/projects/p1/voices/voice-disabled.mp3",
            status: "disabled",
          },
        ],
      },
      {
        name: "脸红",
        voiceAssets: [
          {
            id: "voice-1",
            name: "comfort duplicate",
            audioUrl: "s3://live2d-creator-platform/projects/p1/voices/voice-1.mp3",
            status: "active",
          },
        ],
      },
      {
        name: "未触发",
        voiceAssets: [
          {
            id: "voice-2",
            name: "unused",
            audioUrl: "s3://live2d-creator-platform/projects/p1/voices/voice-2.mp3",
            status: "active",
          },
        ],
      },
    ],
  });

  assert.equal(voices.length, 1);
  assert.equal(voices[0].id, "voice-1");
  assert.equal(voices[0].tag, "安慰");
  assert.equal(voices[0].url.startsWith("/api/assets/proxy?"), true);
  assert.equal(new URL(`https://app.example${voices[0].url}`).searchParams.get("viewerSessionId"), "viewer-123");
});

test("buildTriggeredLive2DEffects normalizes configured params and expression fallback", () => {
  const effects = buildTriggeredLive2DEffects({
    tags: ["脸红", "安慰"],
    triggerTags: [
      {
        name: "脸红",
        live2dParams: { Param5: 1, ParamBrowLAngle: 0.75, ignored: "bad" },
        voiceAssets: [],
      },
      {
        name: "安慰",
        live2dExpression: "Param3=0.5",
        live2dParams: [{ id: "ParamSmile", value: 1 }],
        voiceAssets: [],
      },
      {
        name: "未触发",
        live2dParams: { ParamSkip: 1 },
        voiceAssets: [],
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
