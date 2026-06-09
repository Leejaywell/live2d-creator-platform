import assert from "node:assert/strict";
import test from "node:test";

import JSZip from "jszip";

import { extractLive2DZipFiles, validateLive2DZip } from "../src/lib/live2d-validation";

test("validateLive2DZip accepts a minimal Cubism model with referenced files", async () => {
  const zip = new JSZip();
  zip.file(
    "avatar/avatar.model3.json",
    JSON.stringify({
      Version: 3,
      FileReferences: {
        Moc: "avatar.moc3",
        Textures: ["textures/texture_00.png"],
        Expressions: [{ File: "expressions/happy.exp3.json" }],
      },
    }),
  );
  zip.file("avatar/avatar.moc3", Buffer.from("moc"));
  zip.file("avatar/textures/texture_00.png", Buffer.from("png"));
  zip.file("avatar/expressions/happy.exp3.json", JSON.stringify({ Type: "Live2D Expression" }));

  const result = await validateLive2DZip(await zip.generateAsync({ type: "nodebuffer" }));

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.modelJsonPath, "avatar/avatar.model3.json");
    assert.deepEqual(result.referencedFiles, ["avatar.moc3", "textures/texture_00.png", "expressions/happy.exp3.json"]);
  }
});

test("validateLive2DZip rejects missing referenced assets", async () => {
  const zip = new JSZip();
  zip.file(
    "avatar.model3.json",
    JSON.stringify({
      Version: 3,
      FileReferences: {
        Moc: "missing.moc3",
      },
    }),
  );

  const result = await validateLive2DZip(await zip.generateAsync({ type: "nodebuffer" }));

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join("\n"), /Referenced file missing/);
  }
});

test("validateLive2DZip rejects malformed model json", async () => {
  const zip = new JSZip();
  zip.file("avatar.model3.json", "{not-json");

  const result = await validateLive2DZip(await zip.generateAsync({ type: "nodebuffer" }));

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join("\n"), /not valid JSON/);
  }
});

test("validateLive2DZip rejects unsupported Cubism model versions", async () => {
  const zip = new JSZip();
  zip.file("avatar.model3.json", JSON.stringify({ Version: 2 }));

  const result = await validateLive2DZip(await zip.generateAsync({ type: "nodebuffer" }));

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join("\n"), /Unsupported model3\.json Version/);
  }
});

test("validateLive2DZip rejects unsafe referenced paths", async () => {
  const zip = new JSZip();
  zip.file(
    "avatar.model3.json",
    JSON.stringify({
      Version: 3,
      FileReferences: {
        Textures: ["../escape.png"],
      },
    }),
  );

  const result = await validateLive2DZip(await zip.generateAsync({ type: "nodebuffer" }));

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join("\n"), /Unsafe referenced path/);
  }
});

test("validateLive2DZip rejects disallowed file extensions", async () => {
  const zip = new JSZip();
  zip.file("avatar.model3.json", JSON.stringify({ Version: 3 }));
  zip.file("notes.txt", "not allowed");

  const result = await validateLive2DZip(await zip.generateAsync({ type: "nodebuffer" }));

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join("\n"), /Disallowed file extension/);
  }
});

test("validateLive2DZip rejects zips over the configured size limit", async () => {
  const zip = new JSZip();
  zip.file("avatar.model3.json", JSON.stringify({ Version: 3 }));
  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  const result = await validateLive2DZip(buffer, Math.max(1, buffer.byteLength - 1));

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join("\n"), /Zip exceeds max size/);
  }
});

test("validateLive2DZip rejects unreadable zip data with a structured error", async () => {
  const result = await validateLive2DZip(Buffer.from("not a zip"));

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join("\n"), /not a readable zip file/);
  }
});

test("extractLive2DZipFiles rejects disallowed file extensions", async () => {
  const zip = new JSZip();
  zip.file("avatar.model3.json", JSON.stringify({ Version: 3 }));
  zip.file("notes.txt", "not allowed");
  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  await assert.rejects(
    () => extractLive2DZipFiles(buffer),
    /Unsafe or disallowed Live2D asset path/,
  );
});
