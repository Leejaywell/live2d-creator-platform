import assert from "node:assert/strict";
import test from "node:test";

import {
  InvalidLive2DModelJsonError,
  parseLive2DModelJson,
  rewriteModelReferences,
} from "../src/lib/live2d-model-proxy";

test("rewriteModelReferences rewrites model asset references through the asset proxy", () => {
  const modelJson = parseLive2DModelJson(
    JSON.stringify({
      Version: 3,
      FileReferences: {
        Moc: "avatar.moc3",
        Textures: ["textures/texture_00.png"],
        Physics: "physics.json",
        Expressions: [{ Name: "Happy", File: "expressions/happy.exp3.json" }],
        Motions: { Idle: [{ File: "motions/idle.motion3.json" }] },
      },
    }),
  );

  const rewritten = rewriteModelReferences({
    modelJson,
    modelJsonKey: "projects/project-1/models/v1/avatar.model3.json",
    viewerSessionId: "viewer-1",
    origin: "https://app.example.test",
  });

  assert.equal(
    rewritten.FileReferences?.Moc,
    "https://app.example.test/api/assets/proxy?key=projects%2Fproject-1%2Fmodels%2Fv1%2Favatar.moc3&viewerSessionId=viewer-1",
  );
  assert.equal(
    rewritten.FileReferences?.Textures?.[0],
    "https://app.example.test/api/assets/proxy?key=projects%2Fproject-1%2Fmodels%2Fv1%2Ftextures%2Ftexture_00.png&viewerSessionId=viewer-1",
  );
  assert.equal(
    rewritten.FileReferences?.Physics,
    "https://app.example.test/api/assets/proxy?key=projects%2Fproject-1%2Fmodels%2Fv1%2Fphysics.json&viewerSessionId=viewer-1",
  );
  assert.equal(
    rewritten.FileReferences?.Expressions?.[0].File,
    "https://app.example.test/api/assets/proxy?key=projects%2Fproject-1%2Fmodels%2Fv1%2Fexpressions%2Fhappy.exp3.json&viewerSessionId=viewer-1",
  );
  assert.equal(
    rewritten.FileReferences?.Motions?.Idle?.[0].File,
    "https://app.example.test/api/assets/proxy?key=projects%2Fproject-1%2Fmodels%2Fv1%2Fmotions%2Fidle.motion3.json&viewerSessionId=viewer-1",
  );
});

test("parseLive2DModelJson rejects invalid stored model JSON", () => {
  assert.throws(() => parseLive2DModelJson("{bad-json"), InvalidLive2DModelJsonError);
  assert.throws(() => parseLive2DModelJson("[]"), InvalidLive2DModelJsonError);
});

test("rewriteModelReferences rejects unsafe absolute model asset references", () => {
  const modelJson = parseLive2DModelJson(JSON.stringify({ FileReferences: { Moc: "/avatar.moc3" } }));

  assert.throws(
    () =>
      rewriteModelReferences({
        modelJson,
        modelJsonKey: "projects/project-1/models/v1/avatar.model3.json",
        viewerSessionId: "viewer-1",
        origin: "https://app.example.test",
      }),
    InvalidLive2DModelJsonError,
  );
});

test("rewriteModelReferences rejects model asset references outside the model directory", () => {
  const modelJson = parseLive2DModelJson(JSON.stringify({ FileReferences: { Textures: ["../escape.png"] } }));

  assert.throws(
    () =>
      rewriteModelReferences({
        modelJson,
        modelJsonKey: "projects/project-1/models/v1/avatar.model3.json",
        viewerSessionId: "viewer-1",
        origin: "https://app.example.test",
      }),
    InvalidLive2DModelJsonError,
  );
});

test("rewriteModelReferences normalizes backslash model asset references", () => {
  const modelJson = parseLive2DModelJson(JSON.stringify({ FileReferences: { Moc: "nested\\avatar.moc3" } }));

  const rewritten = rewriteModelReferences({
    modelJson,
    modelJsonKey: "projects/project-1/models/v1/avatar.model3.json",
    viewerSessionId: "viewer-1",
    origin: "https://app.example.test",
  });

  assert.equal(
    rewritten.FileReferences?.Moc,
    "https://app.example.test/api/assets/proxy?key=projects%2Fproject-1%2Fmodels%2Fv1%2Fnested%2Favatar.moc3&viewerSessionId=viewer-1",
  );
});

test("rewriteModelReferences supports authenticated previews without a viewer session", () => {
  const modelJson = parseLive2DModelJson(JSON.stringify({ FileReferences: { Moc: "avatar.moc3" } }));

  const rewritten = rewriteModelReferences({
    modelJson,
    modelJsonKey: "projects/project-1/models/v1/avatar.model3.json",
    origin: "https://app.example.test",
  });

  assert.equal(
    rewritten.FileReferences?.Moc,
    "https://app.example.test/api/assets/proxy?key=projects%2Fproject-1%2Fmodels%2Fv1%2Favatar.moc3",
  );
});
