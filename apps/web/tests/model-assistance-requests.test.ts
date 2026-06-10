import assert from "node:assert/strict";
import test from "node:test";

import { modelAssistanceRequestFromAuditLog, modelAssistanceStatusText, resolveModelAssistanceRequests } from "../src/lib/model-assistance-requests";

test("modelAssistanceRequestFromAuditLog extracts display fields", () => {
  const createdAt = new Date("2026-06-10T10:00:00.000Z");
  const request = modelAssistanceRequestFromAuditLog({
    id: "log_1",
    targetId: "project_1",
    actor: { email: "creator@example.com" },
    createdAt,
    after: {
      projectId: "project_1",
      projectName: "Yuri",
      notes: "Please check model3.json",
    },
  });

  assert.deepEqual(request, {
    id: "log_1",
    projectId: "project_1",
    projectName: "Yuri",
    creatorEmail: "creator@example.com",
    notes: "Please check model3.json",
    createdAt,
    status: "pending",
    fulfilledAt: undefined,
    fulfilledModelAssetId: undefined,
    fulfilledModelVersion: undefined,
  });
});

test("modelAssistanceRequestFromAuditLog falls back for partial audit payloads", () => {
  const request = modelAssistanceRequestFromAuditLog({
    id: "log_2",
    targetId: "project_2",
    actor: null,
    createdAt: new Date("2026-06-10T10:00:00.000Z"),
    after: null,
  });

  assert.equal(request.projectId, "project_2");
  assert.equal(request.projectName, "Unknown project");
  assert.equal(request.creatorEmail, "Unknown creator");
  assert.equal(request.notes, "");
});

test("modelAssistanceStatusText explains pending admin setup", () => {
  assert.match(
    modelAssistanceStatusText({ createdAt: new Date("2026-06-10T10:00:00.000Z"), status: "pending" }),
    /Waiting for admin-assisted model setup/,
  );
});

test("resolveModelAssistanceRequests marks requests fulfilled by later admin model uploads", () => {
  const requests = resolveModelAssistanceRequests(
    [
      {
        id: "log_1",
        targetId: "project_1",
        actor: { email: "creator@example.com" },
        createdAt: new Date("2026-06-10T10:00:00.000Z"),
        after: {
          projectId: "project_1",
          projectName: "Yuri",
        },
      },
      {
        id: "log_2",
        targetId: "project_2",
        actor: { email: "creator@example.com" },
        createdAt: new Date("2026-06-10T10:00:00.000Z"),
        after: {
          projectId: "project_2",
          projectName: "Una",
        },
      },
    ],
    [
      {
        id: "model_before",
        projectId: "project_1",
        version: 1,
        createdAt: new Date("2026-06-10T09:00:00.000Z"),
      },
      {
        id: "model_after",
        projectId: "project_1",
        version: 2,
        createdAt: new Date("2026-06-10T11:00:00.000Z"),
      },
    ],
  );

  assert.equal(requests[0].status, "fulfilled");
  assert.equal(requests[0].fulfilledModelAssetId, "model_after");
  assert.equal(requests[0].fulfilledModelVersion, 2);
  assert.equal(requests[1].status, "pending");
});

test("modelAssistanceStatusText explains fulfilled admin setup", () => {
  assert.match(
    modelAssistanceStatusText({
      createdAt: new Date("2026-06-10T10:00:00.000Z"),
      status: "fulfilled",
      fulfilledAt: new Date("2026-06-10T11:00:00.000Z"),
      fulfilledModelVersion: 2,
    }),
    /Fulfilled with model version 2/,
  );
});
