import assert from "node:assert/strict";
import test from "node:test";

import { projectIdFromStorageKey } from "../src/lib/asset-keys";

test("projectIdFromStorageKey extracts project-scoped asset keys", () => {
  assert.equal(projectIdFromStorageKey("projects/project-1/voices/voice.mp3"), "project-1");
  assert.equal(projectIdFromStorageKey("projects/project-1/models/v1/avatar.model3.json"), "project-1");
});

test("projectIdFromStorageKey rejects non-project-scoped asset keys", () => {
  assert.equal(projectIdFromStorageKey("avatars/user-1.png"), null);
  assert.equal(projectIdFromStorageKey("projects"), null);
  assert.equal(projectIdFromStorageKey("projects/project-1"), null);
});
