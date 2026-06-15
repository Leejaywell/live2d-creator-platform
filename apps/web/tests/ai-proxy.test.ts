import assert from "node:assert/strict";
import test from "node:test";

import { callAiProxy, callAiProxyStream } from "../src/lib/ai-proxy";

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

async function readStream(stream: ReadableStream<string>): Promise<string[]> {
  const reader = stream.getReader();
  const chunks: string[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

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

test("callAiProxyStream yields chunks and done payload when disabled", async () => {
  const resultStream = await callAiProxyStream({
    ...baseInput,
    aiProvider: "disabled",
    userMessage: "I feel sad today.",
  });

  const chunks = await readStream(resultStream);
  assert.ok(chunks.length > 1);

  const lastChunk = JSON.parse(chunks[chunks.length - 1]);
  assert.equal(lastChunk.type, "done");
  assert.equal(lastChunk.reply, "Offer gentle support. 我听见了，会陪你慢慢处理。");
  assert.deepEqual(lastChunk.tags, ["comfort"]);

  const contentChunks = chunks.slice(0, -1).map(c => JSON.parse(c));
  assert.ok(contentChunks.every(c => c.type === "content"));
  const reconstructedReply = contentChunks.map(c => c.content).join("");
  assert.equal(reconstructedReply, "Offer gentle support. 我听见了，会陪你慢慢处理。");
});

test("callAiProxyStream parses OpenAI SSE stream", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL,
    apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
    model: process.env.OPENAI_COMPATIBLE_MODEL,
  };

  process.env.OPENAI_COMPATIBLE_BASE_URL = "https://ai.example.test";
  process.env.OPENAI_COMPATIBLE_API_KEY = "test-key";
  process.env.OPENAI_COMPATIBLE_MODEL = "test-model";

  // Simulate chunk-by-chunk SSE response
  const sseData = [
    'data: {"choices":[{"delta":{"content":"{"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"\\\"reply\\\":\\\"Hello\\\""}}]}\n\n',
    'data: {"choices":[{"delta":{"content":",\\\"tags\\\":[\\\"comfort\\\"]}"}}]}\n\n',
    "data: [DONE]\n\n"
  ];

  globalThis.fetch = (async () => {
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        for (const msg of sseData) {
          controller.enqueue(encoder.encode(msg));
        }
        controller.close();
      }
    });
    return new Response(stream, { status: 200 });
  }) as typeof fetch;

  try {
    const resultStream = await callAiProxyStream({
      ...baseInput,
      userMessage: "I feel sad today.",
    });

    const chunks = await readStream(resultStream);
    assert.ok(chunks.length >= 2);

    const contentChunks = chunks.slice(0, -1).map(c => JSON.parse(c));
    assert.ok(contentChunks.every(c => c.type === "content"));
    const reconstructedReply = contentChunks.map(c => c.content).join("");
    assert.equal(reconstructedReply, "Hello");

    const lastChunk = JSON.parse(chunks[chunks.length - 1]);
    assert.equal(lastChunk.type, "done");
    assert.equal(lastChunk.reply, "Hello");
    assert.deepEqual(lastChunk.tags, ["comfort"]);
  } finally {
    restoreEnv("OPENAI_COMPATIBLE_BASE_URL", originalEnv.baseUrl);
    restoreEnv("OPENAI_COMPATIBLE_API_KEY", originalEnv.apiKey);
    restoreEnv("OPENAI_COMPATIBLE_MODEL", originalEnv.model);
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
