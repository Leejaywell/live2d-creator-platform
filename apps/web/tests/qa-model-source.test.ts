import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadQaModelZip } from "../src/lib/qa-model-source";

const data = Buffer.from("qa-model-zip");
const sha256 = createHash("sha256").update(data).digest("hex");

test("loadQaModelZip reads a local path and verifies sha256", async () => {
  const dir = mkdtempSync(join(tmpdir(), "qa-model-source-"));

  try {
    const path = join(dir, "model.zip");
    writeFileSync(path, data);

    const model = await loadQaModelZip({ path, sha256 });

    assert.equal(model?.fileName, "model.zip");
    assert.equal(model?.source, "path");
    assert.equal(model?.sha256, sha256);
    assert.deepEqual(model?.data, data);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadQaModelZip downloads a URL and verifies sha256", async () => {
  const model = await loadQaModelZip({
    url: "http://127.0.0.1/model.zip",
    sha256,
    allowInsecureUrl: true,
    fetchImpl: async () => new Response(data, { headers: { "content-disposition": 'attachment; filename="downloaded.zip"' } }),
  });

  assert.equal(model?.fileName, "downloaded.zip");
  assert.equal(model?.source, "url");
  assert.equal(model?.sha256, sha256);
  assert.deepEqual(model?.data, data);
});

test("loadQaModelZip rejects insecure URLs by default", async () => {
  await assert.rejects(
    () =>
      loadQaModelZip({
        url: "http://127.0.0.1/model.zip",
        fetchImpl: async () => new Response(data),
      }),
    /must be HTTPS/,
  );
});

test("loadQaModelZip rejects sha256 mismatch", async () => {
  await assert.rejects(
    () =>
      loadQaModelZip({
        url: "https://storage.example.com/model.zip",
        sha256: "0".repeat(64),
        fetchImpl: async () => new Response(data),
      }),
    /SHA256/,
  );
});
