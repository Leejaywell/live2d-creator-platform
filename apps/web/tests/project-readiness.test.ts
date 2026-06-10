import assert from "node:assert/strict";
import test from "node:test";

import {
  assertProjectPublishReadiness,
  missingProjectPublishRequirements,
  projectPublishReadiness,
} from "../src/lib/project-readiness";

const readyProject = {
  name: "Airi",
  slug: "airi",
  intro: "Gentle companion",
  systemPrompt: "Stay kind.",
  welcomeMessage: "Hi.",
  currentModelAsset: { validationStatus: "valid" },
  triggerTags: [{ enabled: true }],
  voiceAssets: [{ status: "active" }],
  fanAccessCodes: [{ status: "active", expiresAt: new Date("2026-07-01T00:00:00.000Z") }],
};

test("project publish readiness accepts complete projects", () => {
  const items = projectPublishReadiness(readyProject, new Date("2026-06-10T00:00:00.000Z"));

  assert.equal(items.every((item) => item.done), true);
  assert.doesNotThrow(() => assertProjectPublishReadiness(readyProject, new Date("2026-06-10T00:00:00.000Z")));
});

test("project publish readiness reports missing launch requirements", () => {
  const missing = missingProjectPublishRequirements(
    {
      ...readyProject,
      intro: "",
      currentModelAsset: { validationStatus: "invalid" },
      triggerTags: [{ enabled: false }],
      voiceAssets: [{ status: "disabled" }],
      fanAccessCodes: [{ status: "active", expiresAt: new Date("2026-06-01T00:00:00.000Z") }],
    },
    new Date("2026-06-10T00:00:00.000Z"),
  );

  assert.deepEqual(missing, ["Project profile", "Live2D model", "Trigger tags", "Voice playback", "Fan access"]);
  assert.throws(() => assertProjectPublishReadiness({ ...readyProject, fanAccessCodes: [] }), /Fan access/);
});
