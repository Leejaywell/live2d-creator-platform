import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";
import { z } from "zod";

import { isInvalidRequestError, jsonError, parseBody } from "../src/lib/request";

test("parseBody reports malformed JSON as an invalid request", async () => {
  const request = new NextRequest("https://app.example.test/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{bad-json",
  });

  await assert.rejects(
    () => parseBody(request, z.object({ name: z.string() })),
    (error) => isInvalidRequestError(error) && /Invalid JSON request body/.test(error.message),
  );
});

test("jsonError serializes invalid request errors without leaking parser messages", async () => {
  const request = new NextRequest("https://app.example.test/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{bad-json",
  });

  try {
    await parseBody(request, z.object({ name: z.string() }));
    assert.fail("Expected malformed JSON to be rejected");
  } catch (error) {
    const response = jsonError(error, "Request failed");
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Invalid request");
    assert.equal(body.issues[0].message, "Invalid JSON request body");
  }
});

test("jsonError keeps zod validation errors in the common invalid request shape", async () => {
  const response = jsonError(new z.ZodError([{ code: "custom", message: "Bad input", path: ["name"] }]), "Request failed");
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, "Invalid request");
  assert.equal(body.issues[0].message, "Bad input");
  assert.deepEqual(body.issues[0].path, ["name"]);
});
