import assert from "node:assert/strict";
import test from "node:test";

import { callAiProxy } from "../src/lib/ai-proxy";

const baseInput = {
  systemPrompt: "You are a companion.",
  enabledTags: [
    {
      name: "comfort",
      description: "Comfort the viewer",
      keywords: ["sad"],
      promptFragment: "Offer gentle support.",
    },
  ],
  recentMessages: [],
};

test("callAiProxy skips provider calls when AI provider is disabled", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response("{}");
  }) as typeof fetch;

  try {
    const result = await callAiProxy({
      ...baseInput,
      aiProvider: "disabled",
      userMessage: "I feel sad today.",
    });
    assert.equal(called, false);
    assert.equal(result.reply, "Offer gentle support. 我听见了，会陪你慢慢处理。");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("callAiProxy filters provider tags to configured trigger tags", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL,
    apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
    model: process.env.OPENAI_COMPATIBLE_MODEL,
  };

  process.env.OPENAI_COMPATIBLE_BASE_URL = "https://ai.example.test";
  process.env.OPENAI_COMPATIBLE_API_KEY = "test-key";
  process.env.OPENAI_COMPATIBLE_MODEL = "test-model";
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: "I am here with you.",
                tags: ["comfort", "unknown"],
              }),
            },
          },
        ],
      }),
      { status: 200 },
    )) as typeof fetch;

  try {
    const result = await callAiProxy({
      ...baseInput,
      userMessage: "I feel sad today.",
    });

    assert.equal(result.reply, "I am here with you.");
    assert.deepEqual(result.tags, ["comfort"]);
  } finally {
    restoreEnv("OPENAI_COMPATIBLE_BASE_URL", originalEnv.baseUrl);
    restoreEnv("OPENAI_COMPATIBLE_API_KEY", originalEnv.apiKey);
    restoreEnv("OPENAI_COMPATIBLE_MODEL", originalEnv.model);
    globalThis.fetch = originalFetch;
  }
});

test("callAiProxy uses configured chat model over environment default", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL,
    apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
    model: process.env.OPENAI_COMPATIBLE_MODEL,
  };
  let requestedModel = "";

  process.env.OPENAI_COMPATIBLE_BASE_URL = "https://ai.example.test";
  process.env.OPENAI_COMPATIBLE_API_KEY = "test-key";
  process.env.OPENAI_COMPATIBLE_MODEL = "env-model";
  globalThis.fetch = (async (_url, init) => {
    requestedModel = JSON.parse(String(init?.body)).model;
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: "I am here with you.",
                tags: ["comfort"],
              }),
            },
          },
        ],
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  try {
    await callAiProxy({
      ...baseInput,
      chatModel: "configured-model",
      userMessage: "I feel sad today.",
    });
    assert.equal(requestedModel, "configured-model");
  } finally {
    restoreEnv("OPENAI_COMPATIBLE_BASE_URL", originalEnv.baseUrl);
    restoreEnv("OPENAI_COMPATIBLE_API_KEY", originalEnv.apiKey);
    restoreEnv("OPENAI_COMPATIBLE_MODEL", originalEnv.model);
    globalThis.fetch = originalFetch;
  }
});

test("callAiProxy falls back when provider returns non-json content", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL,
    apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
    model: process.env.OPENAI_COMPATIBLE_MODEL,
  };

  process.env.OPENAI_COMPATIBLE_BASE_URL = "https://ai.example.test";
  process.env.OPENAI_COMPATIBLE_API_KEY = "test-key";
  process.env.OPENAI_COMPATIBLE_MODEL = "test-model";
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: "I am here with you.",
            },
          },
        ],
      }),
      { status: 200 },
    )) as typeof fetch;

  try {
    const result = await callAiProxy({
      ...baseInput,
      userMessage: "I feel sad today.",
    });

    assert.equal(result.reply, "Offer gentle support. 我听见了，会陪你慢慢处理。");
    assert.deepEqual(result.tags, ["comfort"]);
  } finally {
    restoreEnv("OPENAI_COMPATIBLE_BASE_URL", originalEnv.baseUrl);
    restoreEnv("OPENAI_COMPATIBLE_API_KEY", originalEnv.apiKey);
    restoreEnv("OPENAI_COMPATIBLE_MODEL", originalEnv.model);
    globalThis.fetch = originalFetch;
  }
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
